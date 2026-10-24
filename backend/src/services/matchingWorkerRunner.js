const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');

const WORKER_PATH = path.join(__dirname, '../workers/matchingWorker.js');
const DEFAULT_TIMEOUT_MS = 20000;

const positiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const cpuCount = typeof os.availableParallelism === 'function'
  ? os.availableParallelism()
  : os.cpus().length;

const POOL_SIZE = positiveInt(
  process.env.MATCHING_WORKER_POOL_SIZE,
  Math.max(1, Math.min(4, cpuCount))
);
const MAX_QUEUE = positiveInt(process.env.MATCHING_WORKER_MAX_QUEUE, 100);

const buildPayload = ({
  studentProfile,
  scholarships,
  aliasIndex,
  now,
  forceError,
  delayMs,
  hang,
  crash
}) => {
  if (!(aliasIndex instanceof Map)) {
    throw new Error(
      'Matching worker requires the course alias index from the main thread'
    );
  }

  const timestamp = now instanceof Date ? now : new Date(now);

  if (Number.isNaN(timestamp.getTime())) {
    throw new Error('Matching worker requires a valid timestamp');
  }

  const payload = {
    studentProfile,
    scholarships,
    aliasEntries: Array.from(aliasIndex.entries()),
    now: timestamp.toISOString()
  };

  if (forceError) {
    payload.forceError = String(forceError);
  }

  if (Number(delayMs) > 0) {
    payload.delayMs = Number(delayMs);
  }

  if (hang) {
    payload.hang = true;
  }

  if (crash) {
    payload.crash = true;
  }

  return payload;
};

const slots = [];
const queue = [];
let nextJobId = 0;
let shuttingDown = false;

const matchingError = (message) => {
  const error = new Error(
    message?.error?.message || 'Matching worker failed'
  );
  error.name = message?.error?.name || 'MatchingWorkerError';

  if (message?.error?.stack) {
    error.stack = message.error.stack;
  }

  return error;
};

const removeSlot = (slot) => {
  const index = slots.indexOf(slot);

  if (index >= 0) {
    slots.splice(index, 1);
  }
};

const failSlot = (slot, error) => {
  if (slot.retired) {
    return;
  }

  slot.retired = true;
  const job = slot.job;
  slot.job = null;

  if (job) {
    clearTimeout(job.timer);
    job.reject(error);
  }

  removeSlot(slot);
  slot.worker.terminate().catch(() => {});

  if (!shuttingDown && slots.length < POOL_SIZE) {
    try {
      createSlot();
    } catch (createError) {
      console.error('Matching worker replacement failed:', createError);
    }
  }

  pump();
};

const settleJob = (slot, fn, value) => {
  const job = slot.job;

  if (!job) {
    return;
  }

  clearTimeout(job.timer);
  slot.job = null;
  fn(value);
  pump();
};

const onMessage = (slot, message) => {
  if (slot.retired || !slot.job) {
    return;
  }

  if (!message || message.jobId !== slot.job.jobId) {
    return;
  }

  if (message.ok !== true || !Array.isArray(message.matches)) {
    settleJob(slot, slot.job.reject, matchingError(message));
    return;
  }

  if (slot.job.diagnostics) {
    settleJob(slot, slot.job.resolve, {
      matches: message.matches,
      threadId: message.threadId
    });
    return;
  }

  settleJob(slot, slot.job.resolve, message.matches);
};

const createSlot = () => {
  const worker = new Worker(WORKER_PATH);
  worker.unref();
  const slot = {
    worker,
    job: null,
    retired: false
  };

  worker.on('message', (message) => onMessage(slot, message));
  worker.on('error', (error) => {
    failSlot(
      slot,
      error instanceof Error ? error : new Error(String(error))
    );
  });
  worker.on('exit', (code) => {
    if (slot.retired) {
      return;
    }

    failSlot(slot, new Error(`Matching worker exited with code ${code}`));
  });

  slots.push(slot);
  return slot;
};

const assign = (slot, task) => {
  const jobId = nextJobId + 1;
  nextJobId = jobId;
  const job = {
    ...task,
    jobId
  };
  slot.job = job;
  job.timer = setTimeout(() => {
    failSlot(slot, new Error('Matching worker timed out'));
  }, task.timeoutMs);

  try {
    slot.worker.postMessage(JSON.stringify({
      ...task.payload,
      jobId
    }));
  } catch (error) {
    clearTimeout(job.timer);
    slot.job = null;
    task.reject(error);
    pump();
  }
};

const pump = () => {
  while (queue.length > 0 && !shuttingDown) {
    const idle = slots.find((slot) => !slot.retired && !slot.job);

    if (idle) {
      assign(idle, queue.shift());
      continue;
    }

    if (slots.length < POOL_SIZE) {
      let slot;

      try {
        slot = createSlot();
      } catch (error) {
        const task = queue.shift();
        task.reject(error);
        return;
      }

      assign(slot, queue.shift());
      continue;
    }

    return;
  }
};

const enqueue = (payload, options) => new Promise((resolve, reject) => {
  if (shuttingDown) {
    reject(new Error('Matching worker pool is shut down'));
    return;
  }

  if (queue.length >= MAX_QUEUE) {
    reject(new Error('Matching worker queue is full'));
    return;
  }

  queue.push({
    payload,
    resolve,
    reject,
    timeoutMs: Number.isFinite(options.timeoutMs)
      ? options.timeoutMs
      : DEFAULT_TIMEOUT_MS,
    diagnostics: options.diagnostics === true
  });
  pump();
});

const runOneShotWorker = (payload, options) => new Promise((resolve, reject) => {
  let worker;

  try {
    worker = options.workerCode
      ? new Worker(options.workerCode, { eval: true })
      : new Worker(options.workerPath);
  } catch (error) {
    reject(error);
    return;
  }

  let settled = false;
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? options.timeoutMs
    : DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => {
    fail(new Error('Matching worker timed out'));
  }, timeoutMs);

  const settle = (fn, value) => {
    if (settled) {
      return;
    }

    settled = true;
    clearTimeout(timer);
    fn(value);
    worker.terminate().catch(() => {});
  };

  const fail = (error) => settle(reject, error);

  worker.once('message', (message) => {
    if (!message || message.ok !== true || !Array.isArray(message.matches)) {
      fail(matchingError(message));
      return;
    }

    if (options.diagnostics) {
      settle(resolve, {
        matches: message.matches,
        threadId: message.threadId
      });
      return;
    }

    settle(resolve, message.matches);
  });

  worker.once('error', (error) => {
    fail(error instanceof Error ? error : new Error(String(error)));
  });

  worker.once('exit', (code) => {
    if (!settled) {
      fail(new Error(`Matching worker exited with code ${code}`));
    }
  });

  try {
    worker.postMessage(payload);
  } catch (error) {
    fail(error);
  }
});

/**
 * Runs the existing ranking function on a reused worker thread.
 * A worker failure rejects. Ranking is not repeated on the main thread.
 */
const runMatchingWorker = (input, options = {}) => {
  let payload;

  try {
    payload = buildPayload(input);
  } catch (error) {
    return Promise.reject(error);
  }

  if (options.workerCode || options.workerPath) {
    return runOneShotWorker(payload, options);
  }

  return enqueue(payload, options);
};

const getMatchingPoolStats = () => ({
  poolSize: POOL_SIZE,
  maxQueue: MAX_QUEUE,
  workers: slots.filter((slot) => !slot.retired).length,
  busy: slots.filter((slot) => !slot.retired && slot.job).length,
  queued: queue.length
});

const closeMatchingPool = () => {
  shuttingDown = true;
  const pending = queue.splice(0, queue.length);
  const shutdownError = () => new Error('Matching worker pool is shut down');

  pending.forEach((task) => {
    task.reject(shutdownError());
  });

  slots.splice(0, slots.length).forEach((slot) => {
    slot.retired = true;

    if (slot.job) {
      clearTimeout(slot.job.timer);
      slot.job.reject(shutdownError());
      slot.job = null;
    }

    slot.worker.terminate().catch(() => {});
  });

  shuttingDown = false;
};

module.exports = {
  MATCHING_POOL_SIZE: POOL_SIZE,
  MATCHING_MAX_QUEUE: MAX_QUEUE,
  runMatchingWorker,
  getMatchingPoolStats,
  closeMatchingPool
};
