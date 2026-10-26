const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');
const FAQ = require('../models/FAQ');
const User = require('../models/User');

dotenv.config();
dns.setServers(['8.8.8.8', '1.1.1.1']);

const initialFAQs = [
  // --- STUDENT FAQS ---
  {
    targetRole: 'student',
    category: 'Scholarship Matching',
    question: 'How does IskolarMatch calculate my match score?',
    answer: 'IskolarMatch first checks whether you meet a scholarship’s hard requirements, such as academic level, course, location, citizenship, GWA, and exclusive eligibility tags. Scholarships that pass those filters receive a match score based on your GWA, household income bracket, and special eligibility flags. Scores of 90 or higher are labeled Highly Recommended.'
  },
  {
    targetRole: 'student',
    category: 'Scholarship Matching',
    question: 'Why am I not seeing scholarship matches?',
    answer: 'Matches appear only after you have a student profile and only for open scholarships that fit your academic, location, GWA, citizenship, and eligibility details. Incomplete profile information, a GWA below a listing’s requirement, a different region or course, or closed or expired scholarships can hide results.'
  },
  {
    targetRole: 'student',
    category: 'Finding Scholarships',
    question: 'How do I search for scholarships?',
    answer: 'Open Scholarship Search to browse listings and filter by the details that matter to you. You can also start from the Matched Feed, which ranks scholarships that already fit your profile.'
  },
  {
    targetRole: 'student',
    category: 'Saved Scholarships',
    question: 'How do deadline alerts work?',
    answer: 'When you save a scholarship with a deadline, IskolarMatch can create deadline reminders as the due date approaches, including 7-day, 3-day, and 24-hour windows. Open Deadline Alerts to review those reminders and jump back to the listing.'
  },
  {
    targetRole: 'student',
    category: 'Student Profile',
    question: 'Why should I complete my student profile?',
    answer: 'Your Student Profile is the source of truth for matching. Without it, the platform cannot compare you with scholarship requirements. Completing academic, location, income, and eligibility details unlocks the Matched Feed and more accurate scores.'
  },

  // --- PROVIDER FAQS ---
  {
    targetRole: 'provider',
    category: 'Grant Management',
    question: 'How do I create a scholarship listing?',
    answer: 'Providers can create a listing that contains scholarship information, benefits, a deadline, eligibility requirements, geographic eligibility, and ranking preferences.'
  },
  {
    targetRole: 'provider',
    category: 'Grant Management',
    question: 'What happens when my scholarship reaches its deadline?',
    answer: 'Scholarships past their deadline are automatically treated as closed and are excluded from active matching and search results.'
  },
  {
    targetRole: 'provider',
    category: 'Matching & Eligibility',
    question: 'How does scholarship matching work?',
    answer: 'Students must first pass the applicable hard eligibility requirements. Eligible scholarships are then ranked using academic performance, income, and preferred eligibility tags according to the scholarship’s configured ranking weights.'
  },
  {
    targetRole: 'provider',
    category: 'Matching & Eligibility',
    question: 'What are Required and Preferred eligibility tags?',
    answer: 'Required means the student must satisfy the criterion. Preferred means the criterion contributes to ranking but does not automatically exclude the student.'
  },

  // --- ADMIN FAQS ---
  {
    targetRole: 'admin',
    category: 'Provider Verification',
    question: 'What credentials are required to approve a new Grant Provider?',
    answer: 'Verify official institutional documents, CHED recognition, or government agency credentials before granting publishing access in the provider management panel.'
  },
 
  {
    targetRole: 'admin',
    category: 'System Dispatch',
    question: 'What is the policy for sending platform-wide broadcast messages?',
    answer: 'Global banners must be pre-approved by the Lead Administrator. Use broadcasts only for critical announcements like system maintenance windows, urgent application deadlines, or security notices.'
  },
  {
    targetRole: 'admin',
    category: 'Data Privacy',
    question: 'How should student Data Erasure Requests (Right to be Forgotten) be executed?',
    answer: 'Verify student identity, then execute soft-delete or anonymize records to preserve aggregate analytics while stripping all Personally Identifiable Information (PII) and uploaded documents within compliance timelines.'
  }
];

const seedFAQs = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI or MONGO_URI is missing in your .env file!');
      process.exit(1);
    }

    // Added family: 4 to force IPv4 connection and bypass network DNS SRV issues
    await mongoose.connect(mongoUri, { family: 4 });
    console.log('📦 Connected to MongoDB for seeding FAQs...');

    // Find a default admin user to attach as creator
    let adminUser = await User.findOne({ role: { $in: ['admin', 'super_admin'] } });
    
    if (!adminUser) {
      adminUser = await User.findOne({});
      if (!adminUser) {
        console.error('❌ No users found in database. Please register an admin user first before running seed.');
        process.exit(1);
      }
    }

    // Clear existing FAQs and re-seed
    await FAQ.deleteMany({});
    console.log('🧹 Cleared existing FAQ collection.');

    const faqsWithCreator = initialFAQs.map(faq => ({
      ...faq,
      createdBy: adminUser._id
    }));

    await FAQ.insertMany(faqsWithCreator);
    console.log(`✅ Successfully seeded ${faqsWithCreator.length} FAQ articles into MongoDB.`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding FAQs:', error);
    process.exit(1);
  }
};

seedFAQs();