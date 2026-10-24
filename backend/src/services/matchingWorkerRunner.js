const path = require('path');
const { Worker } = require('worker_threads');

const WORKER_PATH = path.join(__dirname, '../workers/matchingWorker.js');
const DEFAULT_TIMEOUT_MS = 20000;

const clonePlain = (value) => JSON.parse(JSON.stringify(value));

const buildPayload = ({
  studentProfile,
  scholarships,
  aliasIndex,
  now,
  forceError
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
    studentProfile: clonePlain(studentProfile),
    scholarships: clonePlain(scholarships),
    aliasEntries: clonePlain(Array.from(aliasIndex.entries())),
    now: timestamp.toISOString()
  };

  if (forceError) {
    payload.forceError = String(forceError);
  }

  return payload;
};

/**
 * Runs the existing ranking function on a worker thread.
 * A worker failure rejects. Ranking is not repeated on the main thread.
 */
const runMatchingWorker = (input, options = {}) => {
  let payload;

  try {
    payload = buildPayload(input);
  } catch (error) {
    return Promise.reject(error);
  }

  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? options.timeoutMs
    : DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    let worker;

    try {
      worker = options.workerCode
        ? new Worker(options.workerCode, { eval: true })
        : new Worker(options.workerPath || WORKER_PATH);
    } catch (error) {
      reject(error);
      return;
    }

    let settled = false;
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
        const error = new Error(
          message?.error?.message || 'Matching worker failed'
        );
        error.name = message?.error?.name || 'MatchingWorkerError';

        if (message?.error?.stack) {
          error.stack = message.error.stack;
        }

        fail(error);
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
};

module.exports = {
  runMatchingWorker
};
