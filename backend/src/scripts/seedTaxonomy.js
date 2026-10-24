const dns = require('dns');
// Force Node to use Google Public DNS for SRV record resolution (MongoDB Atlas compatibility)
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend root directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

const Taxonomy = require('../models/Taxonomy');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/iskolarmatch';

// Default Taxonomy Data with Canonical Terms and Synonyms/Aliases
const sampleTaxonomies = [
  // --- Field of Study ---
  {
    name: 'Bachelor of Science in Information Technology',
    category: 'Field of Study',
    aliases: ['bsit', 'bs info tech', 'bs information technology', 'it degree', 'information technology'],
    isSystem: true,
    usageCount: 18
  },
  {
    name: 'Bachelor of Science in Computer Science',
    category: 'Field of Study',
    aliases: ['bscs', 'bs comp sci', 'computer science', 'comp sci'],
    isSystem: true,
    usageCount: 14
  },
  {
    name: 'Bachelor of Science in Nursing',
    category: 'Field of Study',
    aliases: ['bsn', 'bs nursing', 'nursing degree'],
    isSystem: true,
    usageCount: 12
  },
  {
    name: 'Bachelor of Science in Business Administration',
    category: 'Field of Study',
    aliases: ['bsba', 'bs bus admin', 'business admin', 'business management'],
    isSystem: true,
    usageCount: 22
  },
  {
    name: 'Bachelor of Science in Civil Engineering',
    category: 'Field of Study',
    aliases: ['bsce', 'civil engineering', 'bs civil eng'],
    isSystem: true,
    usageCount: 9
  },

  // --- Education Level ---
  {
    name: 'Undergraduate Degree',
    category: 'Education Level',
    aliases: ['college', 'bachelors', 'tertiary', 'undergrad'],
    isSystem: true,
    usageCount: 45
  },
  {
    name: 'Senior High School',
    category: 'Education Level',
    aliases: ['shs', 'grade 11', 'grade 12', 'k-12 senior'],
    isSystem: true,
    usageCount: 30
  },
  {
    name: 'Postgraduate / Masteral',
    category: 'Education Level',
    aliases: ['masters', 'ms', 'ma', 'postgrad'],
    isSystem: false,
    usageCount: 5
  },

  // --- Demographic ---
  {
    name: 'Indigent / Low-Income Student',
    category: 'Demographic',
    aliases: ['4ps beneficiary', 'low income', 'indigent', 'financial assistance'],
    isSystem: true,
    usageCount: 38
  },
  {
    name: 'Indigenous People (IP)',
    category: 'Demographic',
    aliases: ['ip student', 'indigenous student', 'ncip grantee'],
    isSystem: false,
    usageCount: 8
  },
  {
    name: 'Persons with Disability (PWD)',
    category: 'Demographic',
    aliases: ['pwd', 'disabled student', 'differently abled'],
    isSystem: false,
    usageCount: 6
  },

  // --- Award Type ---
  {
    name: 'Full Tuition Grant',
    category: 'Award Type',
    aliases: ['100% scholarship', 'full ride', '100% tuition'],
    isSystem: true,
    usageCount: 25
  },
  {
    name: 'Monthly Allowance / Stipend',
    category: 'Award Type',
    aliases: ['stipend', 'allowance', 'monthly cash assistance'],
    isSystem: false,
    usageCount: 19
  }
];

const seedTaxonomy = async () => {
  try {
    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB.');

    console.log('🧹 Clearing existing taxonomy entries...');
    await Taxonomy.deleteMany({});

    const preparedData = sampleTaxonomies.map(item => ({
      ...item,
      aliases: item.aliases.map(a => a.toLowerCase().trim())
    }));

    console.log('🌱 Inserting seed taxonomy catalog...');
    const createdTags = await Taxonomy.insertMany(preparedData);

    console.log(`\n🎉 Success! Seeded ${createdTags.length} taxonomy records into MongoDB.\n`);
    console.table(
      createdTags.map(t => ({
        Name: t.name,
        Category: t.category,
        Aliases: t.aliases.join(', '),
        IsSystem: t.isSystem
      }))
    );

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding taxonomy database:', error);
    process.exit(1);
  }
};

seedTaxonomy();