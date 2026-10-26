const crypto = require('crypto');
const User = require('../models/User');

const VERIFICATION_TTL_MS = 2 * 60 * 60 * 1000;
const FRESH_WINDOW_MS = 60 * 1000;

const clientBaseUrl = () => {
  const configured = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  return String(configured).trim().replace(/\/+$/, '');
};

const buildVerificationUrl = (rawToken) => `${clientBaseUrl()}/verify-email/${rawToken}`;

const hashToken = (rawToken) =>
  crypto.createHash('sha256').update(String(rawToken)).digest('hex');

const hasFreshVerificationToken = (user, windowMs = FRESH_WINDOW_MS) => {
  if (!user?.emailVerificationToken || !user.emailVerificationExpire) return false;
  const expireMs = new Date(user.emailVerificationExpire).getTime();
  if (!Number.isFinite(expireMs) || expireMs <= Date.now()) return false;
  return expireMs > Date.now() + VERIFICATION_TTL_MS - windowMs;
};

/**
 * Store one hashed verification token.
 * A token issued inside the fresh window is left in place so a duplicate
 * request cannot invalidate the link that was just emailed.
 * force is only for an address change, which must mint a deliverable raw token.
 */
const claimVerificationToken = async (userId, { force = false } = {}) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashToken(rawToken);
  const expire = new Date(Date.now() + VERIFICATION_TTL_MS);
  const freshCutoff = new Date(Date.now() + VERIFICATION_TTL_MS - FRESH_WINDOW_MS);

  const filter = {
    _id: userId,
    isVerified: { $ne: true },
  };

  if (!force) {
    filter.$or = [
      { emailVerificationExpire: { $exists: false } },
      { emailVerificationExpire: null },
      { emailVerificationExpire: { $lt: freshCutoff } },
    ];
  }

  const updated = await User.findOneAndUpdate(
    filter,
    {
      $set: {
        emailVerificationToken: hashedToken,
        emailVerificationExpire: expire,
      },
    },
    { new: true }
  );

  if (updated) {
    return { claimed: true, rawToken };
  }

  const current = await User.findById(userId);
  if (!current) return { claimed: false, reason: 'missing' };
  if (current.isVerified) return { claimed: false, reason: 'verified' };
  if (!force && hasFreshVerificationToken(current)) return { claimed: false, reason: 'fresh' };
  return { claimed: false, reason: 'unavailable' };
};

/**
 * Put the previous token back when a newly claimed token could not be emailed.
 * The filter matches only the failed token, so a newer claim is left alone.
 */
const restoreVerificationToken = async (userId, rawToken, previousToken, previousExpire) => {
  const update = previousToken
    ? {
        $set: {
          emailVerificationToken: previousToken,
          emailVerificationExpire: previousExpire,
        },
      }
    : { $unset: { emailVerificationToken: 1, emailVerificationExpire: 1 } };

  await User.updateOne({ _id: userId, emailVerificationToken: hashToken(rawToken) }, update);
};

module.exports = {
  VERIFICATION_TTL_MS,
  FRESH_WINDOW_MS,
  clientBaseUrl,
  buildVerificationUrl,
  hashToken,
  hasFreshVerificationToken,
  claimVerificationToken,
  restoreVerificationToken,
};
