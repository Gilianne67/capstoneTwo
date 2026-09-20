const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const envPath = [
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../../.env'),
].find((p) => fs.existsSync(p));

if (envPath) {
  dotenv.config({ path: envPath });
  console.log(`📁 Loaded environment variables from: ${envPath}`);
} else {
  dotenv.config();
}

const User = require('../models/User');

const createSuperAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGO_URI is missing from environment variables.');

    console.log('🔄 Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas successfully!');

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@iskolarmatch.ph';
    const adminPassword = process.env.ADMIN_PASSWORD || 'SuperAdmin@2026!';
    const adminName = process.env.ADMIN_NAME || 'Super Administrator';

    // 1. Check if admin exists
    let existingAdmin = await User.findOne({ email: adminEmail.toLowerCase() });

    if (existingAdmin) {
      console.log(`\n⚠️ Admin account (${adminEmail}) already exists.`);
      existingAdmin.role = 'admin'; // Standardized to 'admin'
      existingAdmin.status = 'active';
      existingAdmin.isVerified = true;
      existingAdmin.isOnboarded = true;
      await existingAdmin.save();
      console.log(`🔄 Updated existing account (${adminEmail}) with 'admin' role & active status.`);
      process.exit(0);
    }

    // 2. Create Admin User
    await User.create({
      name: adminName,
      email: adminEmail.toLowerCase(),
      password: adminPassword,
      role: 'admin', // Standardized to 'admin'
      status: 'active',
      isOnboarded: true,
      isVerified: true,
    });

    console.log('\n====================================================');
    console.log('🎉 Super Admin account created successfully!');
    console.log(`Email:    ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log(`Role:     admin`);
    console.log('====================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating Super Admin:', error.message);
    process.exit(1);
  }
};

createSuperAdmin();