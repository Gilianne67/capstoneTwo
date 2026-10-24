const { parentPort, threadId } = require('worker_threads');
const { rankScholarships } = require('../services/matchingEngine');

if (!parentPort) {
  throw new Error('matchingWorker must be run as a worker thread');
}

const decodePayload = (message) => {
  if (typeof message === 'string') {
    return JSON.parse(message);
  }

  if (Buffer.isBuffer(message)) {
    return JSON.parse(message.toString('utf8'));
  }

  if (message instanceof Uint8Array) {
    return JSON.parse(Buffer.from(message).toString('utf8'));
  }

  return message;
};

const reply = (payload, body) => {
  parentPort.postMessage({
    jobId: payload && payload.jobId,
    ...body,
    threadId
  });
};

/**
 * Scores and ranks scholarships that the main thread already loaded.
 * This file does not query the database or check authentication.
 */
parentPort.on('message', (message) => {
  let payload;

  try {
    payload = decodePayload(message);
  } catch (error) {
    parentPort.postMessage({
      ok: false,
      error: {
        name: error.name || 'Error',
        message: error.message || 'Matching worker failed',
        stack: error.stack || ''
      }
    });
    return;
  }

  const execute = () => {
    try {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Matching worker received an invalid payload');
      }

      if (payload.crash) {
        process.exit(1);
      }

      if (payload.hang) {
        return;
      }

      if (payload.forceError) {
        throw new Error(String(payload.forceError));
      }

      if (!Array.isArray(payload.aliasEntries)) {
        throw new Error('Matching worker requires serializable alias entries');
      }

      const now = new Date(payload.now);

      if (Number.isNaN(now.getTime())) {
        throw new Error('Matching worker requires a valid timestamp');
      }

      const matches = rankScholarships(
        payload.studentProfile,
        payload.scholarships,
        new Map(payload.aliasEntries),
        now
      );

      reply(payload, { ok: true, matches });
    } catch (error) {
      reply(payload, {
        ok: false,
        error: {
          name: error.name || 'Error',
          message: error.message || 'Matching worker failed',
          stack: error.stack || ''
        }
      });
    }
  };

  const delayMs = Number(payload && payload.delayMs);

  if (Number.isFinite(delayMs) && delayMs > 0) {
    setTimeout(execute, delayMs);
    return;
  }

  execute();
});
