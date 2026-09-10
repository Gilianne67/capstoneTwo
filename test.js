// Load the database connection function and the password hashing library
const connectDB = require('./config/db');
const bcrypt = require('bcryptjs');

// Load all 9 schemas so we can create documents in each collection
const User = require('./models/User');
const StudentProfile = require('./models/StudentProfile');
const GuardianConsent = require('./models/GuardianConsent');
const Provider = require('./models/Provider');
const Scholarship = require('./models/Scholarship');
const CourseAlias = require('./models/CourseAlias');
const SavedMatch = require('./models/SavedMatch');
const Application = require('./models/Application');
const AuditLog = require('./models/AuditLog');

const runTest = async () => {
  // Connect to MongoDB Atlas before doing anything else
  await connectDB();

  // Hash a dummy password once, reuse it for all 3 test users
  // (bcrypt.hash's second argument is the "salt rounds" — 10 is a safe default)
  const hashedPassword = await bcrypt.hash('testPassword123', 10);

  // --- USERS ---
  // Create 3 separate User accounts, one for each role in the system.
  // We need all 3 later: the student owns a StudentProfile, the provider
  // owns a Provider record, and the admin verifies that provider.
  const studentUser = await User.create({
    email: `student_${Date.now()}@test.com`, // Date.now() keeps the email unique on every re-run
    passwordHash: hashedPassword,
    role: 'Student'
  });
  console.log('User (student) created:', studentUser._id);

  const adminUser = await User.create({
    email: `admin_${Date.now()}@test.com`,
    passwordHash: hashedPassword,
    role: 'Admin'
  });
  console.log('User (admin) created:', adminUser._id);

  const providerUser = await User.create({
    email: `provider_${Date.now()}@test.com`,
    passwordHash: hashedPassword,
    role: 'Provider'
  });
  console.log('User (provider) created:', providerUser._id);

  // --- STUDENT PROFILE ---
  // Linked to studentUser via userId. Must be created AFTER the User exists,
  // since the ObjectId reference needs a real document to point to.
  const studentProfile = await StudentProfile.create({
    userId: studentUser._id,
    dateOfBirth: new Date('2005-05-15'),
    gwa: 1.75,
    gwaScale: '1.00-5.00',
    incomeBracket: 'Category B',
    region: 'Region VI',
    province: 'Iloilo',
    course: 'BS Computer Science',
    isMinor: false
  });
  console.log('StudentProfile created:', studentProfile._id);

  // --- GUARDIAN CONSENT ---
  // Linked to studentProfile via studentProfileId (not userId directly)
  const guardianConsent = await GuardianConsent.create({
    studentProfileId: studentProfile._id,
    guardianEmail: 'guardian@test.com',
    tokenHash: 'sampletokenhash123',
    expiresAt: new Date(Date.now() + 86400000) // 24 hours from now
  });
  console.log('GuardianConsent created:', guardianConsent._id);

  // --- PROVIDER ---
  // References TWO different Users: its own account (userId) and the
  // admin who verified it (verifiedByAdminId)
  const provider = await Provider.create({
    userId: providerUser._id,
    institutionName: 'Test Foundation Inc.',
    institutionType: 'NGO',
    verifiedByAdminId: adminUser._id,
    verificationStatus: 'Verified'
  });
  console.log('Provider created:', provider._id);

  // --- SCHOLARSHIP ---
  // Linked to the Provider that created it. hardFilters, criteriaWeights,
  // and specialTags are embedded objects/arrays, not separate collections.
  const scholarship = await Scholarship.create({
    providerId: provider._id,
    name: 'Test Merit Scholarship',
    scholarshipType: 'Merit-based',
    rankingMode: 'Weighted',
    hardFilters: {
      academicLevel: 'Tertiary',
      courseProgram: ['BS Computer Science'],
      geographicLocation: ['Region VI'],
      citizenshipStatus: 'Filipino'
    },
    criteriaWeights: {
      gwaWeight: 0.6,
      incomeWeight: 0.4
    },
    specialTags: [
      { tagName: '4Ps Beneficiary', mode: 'Preferred' }
    ],
    deadline: new Date('2026-12-31'),
    applicationURL: 'https://example.com/apply'
  });
  console.log('Scholarship created:', scholarship._id);

  // --- COURSE ALIAS ---
  // Standalone lookup table — not linked by ObjectId to anything else.
  // Used by the matching logic to resolve alternate course names.
  const courseAlias = await CourseAlias.create({
    canonicalName: 'BS Computer Science',
    aliases: ['BSCS', 'Computer Science', 'BS CompSci']
  });
  console.log('CourseAlias created:', courseAlias._id);

  // --- SAVED MATCH ---
  // Many-to-many join between a student and a scholarship they bookmarked
  const savedMatch = await SavedMatch.create({
    studentProfileId: studentProfile._id,
    scholarshipId: scholarship._id
  });
  console.log('SavedMatch created:', savedMatch._id);

  // --- APPLICATION ---
  // Many-to-many join between a student and a scholarship they applied to,
  // plus the compatibility score calculated at the time of applying
  const application = await Application.create({
    studentProfileId: studentProfile._id,
    scholarshipId: scholarship._id,
    compatibilityScoreAtApplication: 87.5
  });
  console.log('Application created:', application._id);

  // --- AUDIT LOG ---
  // Generic log entry: targetEntity + targetId let this one schema point
  // to a document in ANY collection (here, it's logging the Scholarship
  // creation performed by the admin)
  const auditLog = await AuditLog.create({
    actorUserId: adminUser._id,
    actionType: 'CREATE',
    targetEntity: 'Scholarship',
    targetId: scholarship._id
  });
  console.log('AuditLog created:', auditLog._id);

  console.log('\nAll 9 collections tested successfully!');
  process.exit(0); // Close the script cleanly since Mongoose keeps the connection open otherwise
};

// Run the test, and catch any error so the script doesn't crash silently
runTest().catch((error) => {
  console.error('Test failed:', error.message);
  process.exit(1);
});