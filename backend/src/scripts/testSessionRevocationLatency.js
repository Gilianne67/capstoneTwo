/**
 * Measures account-status change -> Redis blocklist acknowledgment.
 * Uses a real Redis database 15 on localhost. Does not flush Redis.
 */
const { execFile } = require('child_process');
const Module = require('module');
const jwt = require('jsonwebtoken');
const { createClient } = require('redis');

const secret = process.env.JWT_SECRET || 'session-revocation-latency-secret';
process.env.JWT_SECRET = secret;
const TRIALS = 10;
const LIMIT_MS = 500;
const keysToDelete = new Set();

const exec = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
};

const openClient = async (url) => {
  const client = createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 1000,
      reconnectStrategy: () => false,
    },
  });
  client.on('error', () => {});
  await client.connect();
  const info = String(await client.sendCommand(['CLIENT', 'INFO']));
  if (!info.includes('db=15')) {
    await client.quit();
    throw new Error(`Refusing to write: ${url} is not database 15`);
  }
  return client;
};

const connectRedis = async () => {
  try {
    const client = await openClient('redis://127.0.0.1:6379/15');
    return {
      client,
      endpoint: '127.0.0.1:6379 database 15',
      containerName: null,
    };
  } catch (existingError) {
    const containerName = `iskolarmatch-session-revocation-${process.pid}`;
    try {
      await exec('docker', [
        'run',
        '-d',
        '--name',
        containerName,
        '-p',
        '127.0.0.1:6399:6379',
        'redis:7-alpine',
      ]);
    } catch (dockerError) {
      const reason = existingError && existingError.message ? existingError.message : 'connection failed';
      throw new Error(
        `No isolated Redis available. Localhost:6379 database 15 failed (${reason}). Docker start failed (${dockerError.message}).`
      );
    }

    let lastError = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const client = await openClient('redis://127.0.0.1:6399/15');
        return {
          client,
          endpoint: '127.0.0.1:6399 database 15 (temporary Docker Redis)',
          containerName,
        };
      } catch (error) {
        lastError = error;
        await delay(250);
      }
    }
    try {
      await exec('docker', ['rm', '-f', containerName]);
    } catch (cleanupError) {
      lastError = cleanupError;
    }
    throw new Error(`Temporary Redis did not become ready: ${lastError && lastError.message}`);
  }
};

const invoke = (handler, req) =>
  new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        resolve({ statusCode: this.statusCode, body });
      },
    };
    Promise.resolve(handler(req, res, (error) => reject(error || new Error('next called')))).catch(reject);
  });

const run = (middleware, req) =>
  new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        resolve({ nextCalled: false, statusCode: this.statusCode, body });
      },
    };
    Promise.resolve(
      middleware(req, res, () => {
        resolve({ nextCalled: true, statusCode: res.statusCode, body: res.body });
      })
    ).catch(reject);
  });

const main = async () => {
  const connection = await connectRedis();
  const { client } = connection;
  const redisPath = require.resolve('../config/redis');
  const redisModule = new Module(redisPath, module);
  redisModule.filename = redisPath;
  redisModule.loaded = true;
  redisModule.exports = client;
  require.cache[redisPath] = redisModule;

  const User = require('../models/User');
  const auditController = require('../controllers/auditController');
  const { updateUserAccountStatus } = require('../controllers/adminController');
  const { registerIssuedToken, isTokenBlacklisted } = require('../services/tokenService');
  const { protect } = require('../middleware/auth');

  const users = new Map();
  User.findById = (id) => {
    const doc = users.get(String(id)) || null;
    return {
      select() {
        return Promise.resolve(doc);
      },
      then(resolve, reject) {
        return Promise.resolve(doc).then(resolve, reject);
      },
    };
  };
  auditController.recordAuditLog = async () => ({});

  const originalSet = client.set.bind(client);
  const runId = `${Date.now()}-${process.pid}`;
  const trials = [];
  let otherCheck = null;

  try {
    for (let index = 0; index < TRIALS; index += 1) {
      const id = `latency-${runId}-${index}`;
      const user = {
        _id: id,
        id,
        email: `${id}@example.test`,
        name: 'Latency Subject',
        role: 'student',
        status: 'active',
        statusChangedAt: null,
        async save() {
          users.set(id, this);
          this.statusChangedAt = process.hrtime.bigint();
          return this;
        },
      };
      users.set(id, user);
      const tokenA = jwt.sign(
        { id, role: 'student', status: 'active' },
        secret,
        { expiresIn: '10m', jwtid: `${id}-a` }
      );
      const tokenB = jwt.sign(
        { id, role: 'student', status: 'active' },
        secret,
        { expiresIn: '10m', jwtid: `${id}-b` }
      );
      keysToDelete.add(`auth:sessions:${id}`);
      keysToDelete.add(`bl_${tokenA}`);
      keysToDelete.add(`bl_${tokenB}`);

      const registeredA = await registerIssuedToken(id, tokenA);
      const registeredB = await registerIssuedToken(id, tokenB);
      if (!registeredA.ok || !registeredB.ok) {
        trials.push({
          trial: index + 1,
          success: false,
          elapsedMs: null,
          handlerElapsedMs: null,
          meets500ms: false,
          redisAcknowledged: 0,
          confirmed: false,
          revokedRejected: false,
          revokedStatus: null,
          measurementAgrees: false,
          errorMessage: `session index failed (${registeredA.reason || 'unknown'}, ${registeredB.reason || 'unknown'})`,
        });
        continue;
      }
      const acks = [];
      client.set = async (key, value, options) => {
        const result = await originalSet(key, value, options);
        if (typeof key === 'string' && key.startsWith('bl_')) acks.push(process.hrtime.bigint());
        return result;
      };

      let response = null;
      let errorMessage = null;
      try {
        response = await invoke(updateUserAccountStatus, {
          params: { id },
          body: { status: 'suspended' },
          user: { role: 'admin', name: 'Latency Admin', email: 'latency-admin@example.test' },
          headers: {},
          ip: '127.0.0.1',
        });
      } catch (error) {
        errorMessage = error.message;
      } finally {
        client.set = originalSet;
      }

      const handlerMs = response && response.body && response.body.revocation
        ? response.body.revocation.elapsedMs
        : null;
      const proxyMs = user.statusChangedAt && acks.length
        ? Number(acks[acks.length - 1] - user.statusChangedAt) / 1e6
        : null;
      const confirmedA = (await client.get(`bl_${tokenA}`)) === 'true';
      const confirmedB = (await client.get(`bl_${tokenB}`)) === 'true';
      const measurementAgrees = typeof handlerMs === 'number'
        && typeof proxyMs === 'number'
        && Math.abs(handlerMs - proxyMs) <= 50;
      const revoked = await run(protect, {
        method: 'GET',
        originalUrl: '/api/v1/students/profile',
        url: '/api/v1/students/profile',
        headers: { authorization: `Bearer ${tokenA}` },
        cookies: {},
      });
      const success = Boolean(
        response
        && response.statusCode === 200
        && response.body.success === true
        && response.body.revocation.success === true
        && response.body.revocation.blocklisted === 2
        && response.body.revocation.failed === 0
        && acks.length === 2
        && confirmedA
        && confirmedB
        && measurementAgrees
        && revoked.nextCalled === false
        && (revoked.statusCode === 401 || revoked.statusCode === 403)
      );

      trials.push({
        trial: index + 1,
        success,
        elapsedMs: proxyMs,
        handlerElapsedMs: handlerMs,
        meets500ms: success && typeof proxyMs === 'number' && proxyMs <= LIMIT_MS,
        redisAcknowledged: acks.length,
        confirmed: confirmedA && confirmedB,
        revokedRejected: revoked.nextCalled === false,
        revokedStatus: revoked.statusCode,
        measurementAgrees,
        errorMessage,
      });
    }

    const otherId = `latency-${runId}-other`;
    const other = {
      _id: otherId,
      id: otherId,
      email: `${otherId}@example.test`,
      name: 'Other Subject',
      role: 'student',
      status: 'active',
      async save() {
        users.set(otherId, this);
        return this;
      },
    };
    users.set(otherId, other);
    const otherToken = jwt.sign(
      { id: otherId, role: 'student', status: 'active' },
      secret,
      { expiresIn: '10m', jwtid: `${otherId}-keep` }
    );
    keysToDelete.add(`auth:sessions:${otherId}`);
    keysToDelete.add(`bl_${otherToken}`);
    await registerIssuedToken(otherId, otherToken);
    const otherAccess = await run(protect, {
      method: 'GET',
      originalUrl: '/api/v1/students/profile',
      url: '/api/v1/students/profile',
      headers: { authorization: `Bearer ${otherToken}` },
      cookies: {},
    });
    otherCheck = {
      accessAllowed: otherAccess.nextCalled === true,
      blocklisted: await isTokenBlacklisted(otherToken),
    };

    const measured = trials.map((trial) => trial.elapsedMs).filter((value) => typeof value === 'number');
    const successful = trials.filter((trial) => trial.success).length;
    const report = {
      kind: 'real-redis',
      endpoint: connection.endpoint,
      included: 'Time from account-status save completion to Redis acknowledgment of the last blocklist SET for that user.',
      excluded: 'MongoDB network time, audit logging, HTTP, session-index deletion, and the follow-up GET used only to confirm the write.',
      trials,
      successful,
      failed: trials.length - successful,
      medianMs: median(measured),
      maximumMs: measured.length ? Math.max(...measured) : null,
      requirementMet: successful === TRIALS
        && trials.every((trial) => trial.meets500ms)
        && otherCheck.accessAllowed === true
        && otherCheck.blocklisted === false,
      otherUser: otherCheck,
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.requirementMet) process.exitCode = 1;
  } finally {
    client.set = originalSet;
    let deleted = 0;
    const cleanupErrors = [];
    for (const key of keysToDelete) {
      try {
        deleted += Number(await client.del(key)) || 0;
      } catch (error) {
        cleanupErrors.push(error.message);
      }
    }
    console.log(JSON.stringify({
      cleanup: {
        keysAttempted: keysToDelete.size,
        keysDeleted: deleted,
        cleanupErrors: cleanupErrors.length,
        containerRemoved: Boolean(connection.containerName),
      },
    }));
    try {
      if (client.isOpen) await client.quit();
    } catch (error) {
      console.log(JSON.stringify({ cleanupQuitError: error.message }));
    }
    if (connection.containerName) {
      try {
        await exec('docker', ['rm', '-f', connection.containerName]);
      } catch (error) {
        console.log(JSON.stringify({ containerCleanupError: error.message }));
      }
    }
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
