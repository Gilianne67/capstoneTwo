// Force DNS resolution for MongoDB Atlas SRV records
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load .env relative to project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Models
const Report = require('../models/Report');
const Scholarship = require('../models/Scholarship');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/iskolarmatch';

const seedModerationReports = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB.');

    // 1. Find or create dummy student and provider users
    let student = await User.findOne({ role: 'student' });
    if (!student) {
      student = await User.create({
        name: 'Juan Dela Cruz',
        email: 'juan.student@test.com',
        password: 'Password123!seed',
        role: 'student',
      });
      console.log('👤 Created dummy student user.');
    }

    let provider = await User.findOne({ role: 'provider' });
    if (!provider) {
      provider = await User.create({
        name: 'Global Education Foundation',
        email: 'provider@test.com',
        password: 'Password123!seed',
        role: 'provider',
      });
      console.log('🏢 Created dummy provider user.');
    }

    // 2. Sample scholarship listings mapped to the valid providerId
    const sampleScholarships = [
      {
        providerId: provider._id,
        name: 'Suspicious Overseas Financial Grant',
        scholarshipType: 'Private Grant',
        description: 'Requires advance processing fee payment before release of funds.',
        grantValue: 'PHP 100,000 / semester',
        status: 'Open',
        applicationURL: 'https://suspicious-grant.com/apply',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        academicRequirement: { minimumGPA: 85, gradingScale: '60-100' },
        hardFilters: { academicLevel: 'Undergraduate', citizenshipStatus: 'Filipino' },
      },
      {
        providerId: provider._id,
        name: 'Outdated Regional STEM Assistance Program',
        scholarshipType: 'Government Assistance',
        description: 'Listing links to an expired application form.',
        grantValue: 'PHP 25,000 / year',
        status: 'Open',
        applicationURL: 'https://expired-stem-link.org',
        deadline: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        academicRequirement: { minimumGPA: 88, gradingScale: '60-100' },
        hardFilters: { academicLevel: 'Senior High School', citizenshipStatus: 'Filipino' },
      },
    ];

    await Report.deleteMany({ reason: { $regex: /\[TEST SEED\]/ } });

    console.log('📝 Seeding test scholarships and reports...');

    for (const scData of sampleScholarships) {
      let scholarship = await Scholarship.findOne({ name: scData.name });
      if (!scholarship) {
        scholarship = await Scholarship.create(scData);
      }

      await Report.create({
        reportedBy: student._id,
        listingId: scholarship._id,
        listingTitle: scholarship.name,
        providerName: provider.name,
        category: 'Scam or Fraud',
        reason: '[TEST SEED] This listing asks students for payment before processing applications.',
        severity: 'High',
        status: 'Pending Review',
        resolution: 'NONE',
      });
    }

    console.log('🎉 Successfully seeded test reports!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding moderation reports:', error);
    process.exit(1);
  }
};

seedModerationReports();