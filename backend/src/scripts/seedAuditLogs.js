const dns = require('dns');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const AuditLog = require('../models/AuditLog');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/iskolarmatch';

const sampleLogs = [
  {
    actor: 'Security Firewall',
    role: 'System',
    action: 'SECURITY_ALERT',
    details: 'Multiple failed login attempts detected for user admin@iskolarmatch.ph.',
    ipAddress: '203.177.42.10',
    severity: 'Warning'
  },
  {
    actor: 'System Consent Guard',
    role: 'System',
    action: 'CONSENT_VERIFIED',
    details: 'Minor Consent verified and attached for Student ID #4092.',
    ipAddress: '127.0.0.1',
    severity: 'Info'
  },
  {
    actor: 'Admin System',
    role: 'Admin',
    action: 'EXPORT_LOGS',
    details: 'Admin exported compliance audit logs to CSV for regulatory review.',
    ipAddress: '112.198.102.4',
    severity: 'Info'
  }
];

const resetRequested = (argv = process.argv, env = process.env) => (
  argv.includes('--reset') || env.ALLOW_AUDIT_LOG_RESET === 'true'
);

const seedAuditLogs = async ({
  reset = false,
  connect = () => mongoose.connect(MONGO_URI),
  deleteMany = (...args) => AuditLog.deleteMany(...args),
  insertMany = (...args) => AuditLog.insertMany(...args),
  log = console.log,
  warn = console.warn,
} = {}) => {
  if (!reset) {
    log('Audit history was left unchanged. Existing audit records were not deleted.');
    log('A destructive development reset requires an explicit opt-in:');
    log('  node src/scripts/seedAuditLogs.js --reset');
    log('or ALLOW_AUDIT_LOG_RESET=true. That deletes every audit record in the configured database.');
    return { deleted: false, inserted: 0 };
  }

  warn('WARNING: --reset deletes every audit record in the configured database, then inserts sample rows.');
  dns.setServers(['8.8.8.8', '8.8.4.4']);
  log('Connecting to MongoDB...');
  await connect();
  log('Clearing audit logs because reset was explicitly requested...');
  await deleteMany({});
  const created = await insertMany(sampleLogs);
  log(`Inserted ${created.length} sample audit logs.`);
  return { deleted: true, inserted: created.length };
};

if (require.main === module) {
  seedAuditLogs({ reset: resetRequested() })
    .then((result) => {
      process.exit(result.deleted ? 0 : 0);
    })
    .catch((error) => {
      console.error('Error seeding audit logs:', error.message || 'The audit seed failed.');
      process.exit(1);
    });
}

module.exports = {
  sampleLogs,
  resetRequested,
  seedAuditLogs,
};
