const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const AuditLog = require('../models/AuditLog');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/iskolarmatch';

const sampleLogs = [
  {
    actor: 'Admin System',
    role: 'Admin',
    action: 'TAXONOMY_UPDATE',
    details: 'Admin User updated Taxonomy Tag: Bachelor of Science in Information Technology (BSIT).',
    ipAddress: '127.0.0.1',
    severity: 'Info'
  },
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

const seedAuditLogs = async () => {
  try {
    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB.');

    console.log('🧹 Clearing old audit logs...');
    await AuditLog.deleteMany({});

    console.log('🌱 Inserting clean audit log trails...');
    const created = await AuditLog.insertMany(sampleLogs);

    console.log(`\n🎉 Success! Seeded ${created.length} system audit logs into MongoDB.\n`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding audit logs:', error);
    process.exit(1);
  }
};

seedAuditLogs();