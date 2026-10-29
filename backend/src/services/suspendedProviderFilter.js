const mongoose = require('mongoose');
const User = require('../models/User');
const Provider = require('../models/Provider');

const databaseIsConnected = () =>
  Boolean(mongoose.connection && mongoose.connection.readyState === 1);

const readQuery = async (query) => {
  if (!query) return query;
  if (typeof query.select === 'function') {
    return query.lean();
  }
  return query;
};

/**
 * Provider accounts whose scholarships must stay out of student discovery.
 * Organization verification is a separate field and is not consulted here.
 */
const suspendedProviderIds = async () => {
  if (!databaseIsConnected()) return [];

  const users = await readQuery(
    User.find({ status: 'suspended' }).select('_id')
  );
  const userIds = (Array.isArray(users) ? users : [])
    .map((user) => user && user._id)
    .filter((id) => id !== undefined && id !== null && id !== '');

  if (userIds.length === 0) return [];

  const providers = await readQuery(
    Provider.find({ userId: { $in: userIds } }).select('_id')
  );

  return (Array.isArray(providers) ? providers : [])
    .map((provider) => provider && provider._id)
    .filter((id) => id !== undefined && id !== null && id !== '');
};

const publishedScholarshipFilter = async () => {
  const filter = {
    status: 'Open',
    isArchived: false,
    adminRemovedAt: null,
  };
  const hiddenIds = await suspendedProviderIds();

  if (hiddenIds.length > 0) {
    filter.providerId = { $nin: hiddenIds };
  }

  return filter;
};

const isProviderAccountSuspended = async (providerId) => {
  if (!providerId || !databaseIsConnected()) return false;

  const provider = await readQuery(
    Provider.findById(providerId).select('userId')
  );
  if (!provider || !provider.userId) return false;

  const user = await readQuery(
    User.findById(provider.userId).select('status')
  );

  return Boolean(user && user.status === 'suspended');
};

module.exports = {
  suspendedProviderIds,
  publishedScholarshipFilter,
  isProviderAccountSuspended,
};
