/**
 * In-memory stand-in for the revocation and issued-session collections.
 * Unit tests use this. It is not a live MongoDB.
 */
const installMemoryRevocationStore = () => {
  const revokedRows = new Map();
  const issuedRows = new Map();
  const state = {
    failRevokedWrites: false,
    failRevokedReads: false,
    failIssuedWrites: false,
  };

  const RevokedToken = require('../models/RevokedToken');
  const IssuedSession = require('../models/IssuedSession');
  RevokedToken.persistenceStub = true;
  IssuedSession.persistenceStub = true;

  RevokedToken.updateOne = async (filter, update) => {
    if (state.failRevokedWrites) throw new Error('revocation write failed');
    revokedRows.set(filter.tokenHash, update.$set.expiresAt);
    return { acknowledged: true };
  };
  RevokedToken.findOne = (filter) => ({
    select() {
      return this;
    },
    async lean() {
      if (state.failRevokedReads) throw new Error('revocation read failed');
      const expiresAt = revokedRows.get(filter.tokenHash);
      if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) return null;
      return { _id: filter.tokenHash };
    },
  });
  RevokedToken.find = () => ({
    select() {
      return this;
    },
    async lean() {
      return [...revokedRows.entries()]
        .filter(([, expiresAt]) => new Date(expiresAt).getTime() > Date.now())
        .map(([tokenHash, expiresAt]) => ({ tokenHash, expiresAt }));
    },
  });

  IssuedSession.updateOne = async (filter, update) => {
    if (state.failIssuedWrites) throw new Error('issued session write failed');
    issuedRows.set(filter.tokenHash, {
      tokenHash: filter.tokenHash,
      userId: update.$set.userId,
      expiresAt: update.$set.expiresAt,
    });
    return { acknowledged: true };
  };
  IssuedSession.deleteOne = async (filter) => {
    issuedRows.delete(filter.tokenHash);
    return { deletedCount: issuedRows.has(filter.tokenHash) ? 0 : 1 };
  };
  IssuedSession.find = (filter) => ({
    select() {
      return this;
    },
    async lean() {
      const now = Date.now();
      return [...issuedRows.values()].filter((row) => {
        if (filter && filter.userId != null && String(row.userId) !== String(filter.userId)) return false;
        return new Date(row.expiresAt).getTime() > now;
      });
    },
  });

  return { revokedRows, issuedRows, state };
};

module.exports = { installMemoryRevocationStore };
