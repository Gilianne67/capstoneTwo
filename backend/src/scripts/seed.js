const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Provider = require('../models/Provider');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/scholarship_matching_db';

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log(`Connected to database: ${mongoose.connection.name}\n`);

    const plainPassword = 'hello123';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // Helper function to update or insert user without triggering pre-save hooks
    async function upsertUser(userData) {
      let user = await User.findOne({ email: userData.email });
      if (!user) {
        // Create directly with pre-hashed password
        // (Note: If pre('save') hashes it, we use direct updateOne right after)
        user = await User.create({ ...userData, password: hashedPassword });
      }
      
      // Force direct database update to guarantee exact hash
      await User.updateOne(
        { _id: user._id },
        { $set: { password: hashedPassword, status: 'active', isOnboarded: true } }
      );
      
      return User.findById(user._id);
    }

    // ==========================================
    // 1. STUDENT ACCOUNT
    // ==========================================
    console.log('Seeding Student Account...');
    const studentUser = await upsertUser({
      name: 'Juan Dela Cruz',
      fullName: 'Juan Dela Cruz',
      email: 'student.test@example.com',
      role: 'student',
      status: 'active',
      isOnboarded: true,
    });

    const studentProfileData = {
      userId: studentUser._id,
      fullName: 'Juan Dela Cruz',
      email: 'student.test@example.com',
      dateOfBirth: new Date('2003-05-15'),
      academicLevel: 'College',
      yearLevel: '3rd Year',
      course: 'BS Computer Science',
      gwa: 1.50,
      gwaScale: '1.00-5.00',
      incomeBracket: '₱21,191 – ₱43,828 / month',
      region: 'Region V (Bicol Region)',
      province: 'Camarines Sur',
      municipalityCity: 'Pili',
      schoolName: 'Ateneo de Naga University',
      schoolType: 'Private',
      citizenship: 'Filipino',
      specialEligibilityFlags: {
        isIndigenous: false,
        isPWD: false,
        isSoloParentChild: false,
        isFarmerFisherfolkChild: true,
        isWorkingStudent: false,
        isOFWChild: false,
        is4PsBeneficiary: true,
      },
      isMinor: false,
    };

    const studentProfile = await StudentProfile.findOneAndUpdate(
      { userId: studentUser._id },
      studentProfileData,
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    await User.updateOne({ _id: studentUser._id }, { $set: { profileRef: studentProfile._id } });
    console.log('✔ Student account & profile updated.');

    // ==========================================
    // 2. PROVIDER ACCOUNT
    // ==========================================
    console.log('Seeding Provider Account...');
    const providerUser = await upsertUser({
      name: 'Test Foundation Rep',
      fullName: 'Maria Santos',
      email: 'provider.test@example.com',
      role: 'provider',
      organization: 'Ayala Foundation',
      status: 'active',
      isOnboarded: true,
    });

    const providerData = {
      userId: providerUser._id,
      institutionName: 'Ayala Foundation',
      institutionType: 'Corporate Foundation',
      website: 'https://www.ayalafoundation.org',
      contactNumber: '09171234567',
      address: {
        street: 'Avenue Cor Paseo de Roxas',
        city: 'Makati',
        province: 'Metro Manila',
        region: 'NCR',
      },
      representative: {
        name: 'Maria Santos',
        title: 'Scholarship Program Officer',
        workEmail: 'provider.test@example.com',
      },
      verificationDocuments: [
        {
          documentType: 'SEC / DTI Registration',
          fileUrl: 'https://storage.googleapis.com/demo-bucket/sec-reg.pdf',
          originalName: 'SEC_Registration_2024.pdf',
          uploadedAt: new Date(),
        },
      ],
      verificationStatus: 'Approved',
      submittedAt: new Date(),
      verifiedAt: new Date(),
    };

    const providerProfile = await Provider.findOneAndUpdate(
      { userId: providerUser._id },
      providerData,
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    await User.updateOne({ _id: providerUser._id }, { $set: { profileRef: providerProfile._id } });
    console.log('✔ Provider account & profile updated.');

    // ==========================================
    // 3. ADMIN ACCOUNT
    // ==========================================
    console.log('Seeding Admin Account...');
    await upsertUser({
      name: 'System Admin',
      fullName: 'IskolarMatch Administrator',
      email: 'admin.test@example.com',
      role: 'admin',
      status: 'active',
      isOnboarded: true,
    });
    console.log('✔ Admin account created.');

    console.log('\n================================================');
    console.log('✅ DATABASE SEEDING COMPLETE!');
    console.log('================================================');
    console.log(`
1. STUDENT MODULE
   Email:    student.test@example.com
   Password: hello123
   Role:     student

2. PROVIDER MODULE
   Email:    provider.test@example.com
   Password: hello123
   Role:     provider

3. ADMIN MODULE
   Email:    admin.test@example.com
   Password: hello123
   Role:     admin
------------------------------------------------
    `);
  } catch (err) {
    console.error('❌ Error during seeding:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

seedDatabase();