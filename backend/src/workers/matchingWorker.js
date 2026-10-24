const { parentPort } = require('worker_threads');
const { rankScholarships } = require('../services/matchingService');

if (!parentPort) {
  throw new Error('matchingWorker must be run as a worker thread');
}

/**
 * Scores and ranks scholarships that the main thread already loaded.
 * This file does not query the database or check authentication.
 */
parentPort.on('message', (payload) => {
  try {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Matching worker received an invalid payload');
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

    parentPort.postMessage({ ok: true, matches });
  } catch (error) {
    parentPort.postMessage({
      ok: false,
      error: {
        name: error.name || 'Error',
        message: error.message || 'Matching worker failed',
        stack: error.stack || ''
      }
    });
  }
});
