const mongoose = require('mongoose');

// Example Mongoose Schema Structure matching your form fields
const scholarshipSchema = new mongoose.Schema({
  // 1. Basic Program Details
  title: { type: String, required: true },
  grantValue: { type: String, required: true },
  category: [{ 
    type: String, 
    enum: ['Merit-Based', 'Need-Based', 'STEM Specialized', 'Agricultural', 'Municipal / Local'] 
  }],
  applicationDeadline: { type: Date },
  externalUrl: { type: String },
  overview: { type: String },
  contactDetails: { type: String },

  // 2. Hard Requirements (Boolean Gatekeeper Constraints)
  hardRequirements: {
    academicLevel: [{ 
      type: String, 
      enum: ["Senior High School", "College / Undergraduate", "Graduate Studies (Master's / PhD)"] 
    }],
    citizenship: { type: String, enum: ["Filipino Citizen Only", "Open to Any Citizenship"], default: "Filipino Citizen Only" },
    maxAllowableGwa: { type: Number }, // Note: In PH system, standard conversion or percentage (e.g. 85 = 85%)
    minGwaPercentage: { type: Number },
    annualIncomeCeiling: { type: Number }, // PHP
    eligibleDegreePrograms: [{ type: String }],
    geographicBounds: [{ type: String }],
    customHardRequirements: [{ type: String }]
  },

  // 3. Special Eligibility Tags Configuration (Dynamic Gatekeeping)
  // Values: 'Required', 'Prefer', 'None'
  specialEligibilityTags: {
    fourPsBeneficiary: { type: String, enum: ['Required', 'Prefer', 'None'], default: 'None' },
    indigenousPeoples: { type: String, enum: ['Required', 'Prefer', 'None'], default: 'None' },
    pwd: { type: String, enum: ['Required', 'Prefer', 'None'], default: 'None' },
    soloParentDependent: { type: String, enum: ['Required', 'Prefer', 'None'], default: 'None' },
    orphanStatus: { type: String, enum: ['Required', 'Prefer', 'None'], default: 'None' },
    childOfFarmerFisherfolk: { type: String, enum: ['Required', 'Prefer', 'None'], default: 'None' },
    disasterAffectedFamily: { type: String, enum: ['Required', 'Prefer', 'None'], default: 'None' },
    workingStudent: { type: String, enum: ['Required', 'Prefer', 'None'], default: 'None' },
    femaleOnly: { type: String, enum: ['Required', 'Prefer', 'None'], default: 'None' },
    ofwDependent: { type: String, enum: ['Required', 'Prefer', 'None'], default: 'None' },
    customRequiredTags: [{ type: String }],
    customPreferredTags: [{ type: String }]
  },

  // 4. Provider-Defined Ranking Weight Distribution (WGPA + WIncome + WTags = 100%)
  rankingWeights: {
    wGpa: { type: Number, required: true, min: 20, max: 70 },
    wIncome: { type: Number, required: true, min: 20, max: 70 },
    wTags: { type: Number, required: true, min: 0, max: 30 }
  }
}, { timestamps: true });

const Scholarship = mongoose.models.Scholarship || mongoose.model('Scholarship', scholarshipSchema);

const scholarshipsData = [
  // 1. Ayala Foundation (U-Go)
  {
    title: "Ayala Foundation (U-Go Scholarship)",
    grantValue: "₱40,000 per year",
    category: ["Need-Based", "Merit-Based"],
    overview: "This private scholarship program supports deserving female students in public colleges and universities. It provides ₱40,000 per year and is renewable as long as the scholar maintains good academic standing.",
    contactDetails: "Call (632) 7759 8288, email u-go@ayalafoundation.org, or message them on Facebook.",
    hardRequirements: {
      academicLevel: ["College / Undergraduate"],
      citizenship: "Filipino Citizen Only",
      minGwaPercentage: 85,
      eligibleDegreePrograms: [],
      geographicBounds: [],
      customHardRequirements: [
        "Must be enrolled in a public university or college",
        "Must not be a recipient of any other scholarship",
        "No failing grades"
      ]
    },
    specialEligibilityTags: {
      fourPsBeneficiary: "None",
      indigenousPeoples: "None",
      pwd: "None",
      soloParentDependent: "None",
      orphanStatus: "None",
      childOfFarmerFisherfolk: "None",
      disasterAffectedFamily: "None",
      workingStudent: "None",
      femaleOnly: "Required",
      customRequiredTags: ["Female Only"],
      customPreferredTags: []
    },
    rankingWeights: {
      wGpa: 40,
      wIncome: 50,
      wTags: 10
    }
  },

  // 2. SM Foundation College Scholarship
  {
    title: "SM Foundation College Scholarship",
    grantValue: "Full tuition, monthly allowance, and part-time job opportunities",
    category: ["Need-Based", "Merit-Based"],
    overview: "SM Foundation's college scholarship includes full tuition for its partner schools, a monthly allowance, and part-time job opportunities during school breaks.",
    contactDetails: "Check the application portal, use the contact form, or call (632) 8857-0100 local 1678.",
    hardRequirements: {
      academicLevel: ["College / Undergraduate"],
      citizenship: "Filipino Citizen Only",
      minGwaPercentage: 92,
      annualIncomeCeiling: 250000,
      eligibleDegreePrograms: ["Accountancy", "Information Technology", "Engineering", "Education"],
      geographicBounds: [],
      customHardRequirements: [
        "Grade 12 graduate from public or private schools (with DepEd voucher or completed Grade 10 in public high school)"
      ]
    },
    specialEligibilityTags: {
      fourPsBeneficiary: "Prefer",
      indigenousPeoples: "None",
      pwd: "None",
      soloParentDependent: "None",
      orphanStatus: "None",
      childOfFarmerFisherfolk: "None",
      disasterAffectedFamily: "None",
      workingStudent: "None",
      femaleOnly: "None",
      customRequiredTags: [],
      customPreferredTags: []
    },
    rankingWeights: {
      wGpa: 40,
      wIncome: 40,
      wTags: 20
    }
  },

  // 3. Aboitiz Foundation College Scholarship
  {
    title: "Aboitiz Foundation College Scholarship",
    grantValue: "Full tuition, monthly allowance, board exam stipends, and honor incentives",
    category: ["Merit-Based"],
    overview: "Aboitiz scholars receive full tuition and a monthly allowance. They also get stipends while studying for board exams and special incentives for graduating with Latin honors or board topnotchers.",
    contactDetails: "Send a message through contact form, call (632) 8886 2800 local 12666, or email aboitizfoundation@aboitiz.com.",
    hardRequirements: {
      academicLevel: ["College / Undergraduate"],
      citizenship: "Filipino Citizen Only",
      minGwaPercentage: 88,
      eligibleDegreePrograms: [],
      geographicBounds: [],
      customHardRequirements: [
        "Must be a sophomore student enrolled in partner universities",
        "No dropped, failing, or incomplete grades",
        "Without any record of disciplinary action"
      ]
    },
    specialEligibilityTags: {
      fourPsBeneficiary: "None",
      indigenousPeoples: "None",
      pwd: "None",
      soloParentDependent: "None",
      orphanStatus: "None",
      childOfFarmerFisherfolk: "None",
      disasterAffectedFamily: "None",
      workingStudent: "None",
      femaleOnly: "None",
      customRequiredTags: [],
      customPreferredTags: []
    },
    rankingWeights: {
      wGpa: 60,
      wIncome: 20,
      wTags: 20
    }
  },

  // 4. Megaworld Foundation
  {
    title: "Megaworld Foundation Scholarship",
    grantValue: "Full tuition, monthly allowance via ATM, volunteer and career opportunities",
    category: ["Need-Based", "Merit-Based"],
    overview: "Covers full tuition and a monthly allowance. Offers opportunities for volunteer work and career employment within Megaworld and its affiliates post-graduation.",
    contactDetails: "Call (632) 8894 6437 to 38, or email megaworldfoundation@megaworldcorp.com.",
    hardRequirements: {
      academicLevel: ["College / Undergraduate"],
      citizenship: "Filipino Citizen Only",
      minGwaPercentage: 85,
      annualIncomeCeiling: 400000,
      eligibleDegreePrograms: [],
      geographicBounds: [],
      customHardRequirements: [
        "Incoming college freshman or incoming sophomore/junior with full-load enrollment",
        "Passed entrance exam / admission"
      ]
    },
    specialEligibilityTags: {
      fourPsBeneficiary: "None",
      indigenousPeoples: "None",
      pwd: "None",
      soloParentDependent: "None",
      orphanStatus: "None",
      childOfFarmerFisherfolk: "None",
      disasterAffectedFamily: "None",
      workingStudent: "None",
      femaleOnly: "None",
      customRequiredTags: [],
      customPreferredTags: []
    },
    rankingWeights: {
      wGpa: 40,
      wIncome: 40,
      wTags: 20
    }
  },

  // 5. Iskolar ng LANDBANK
  {
    title: "Iskolar ng LANDBANK Program",
    grantValue: "Tuition and monthly allowance",
    category: ["Need-Based", "Agricultural"],
    overview: "Helps children and grandchildren of farmers and fishermen in the country's 60 poorest provinces. Includes full tuition and allowance.",
    contactDetails: "Call (632) 8405 7000 or email contactus@landbank.com.",
    hardRequirements: {
      academicLevel: ["College / Undergraduate"],
      citizenship: "Filipino Citizen Only",
      annualIncomeCeiling: 300000,
      eligibleDegreePrograms: [],
      geographicBounds: ["60 Poorest Provinces in the Philippines"],
      customHardRequirements: [
        "Child or grandchild of an agrarian reform beneficiary or small farmer/fisherfolk",
        "Recommended by a LANDBANK client cooperative/association",
        "Top-performing graduating high school student endorsed by principal",
        "Not receiving other scholarships"
      ]
    },
    specialEligibilityTags: {
      fourPsBeneficiary: "None",
      indigenousPeoples: "None",
      pwd: "None",
      soloParentDependent: "None",
      orphanStatus: "None",
      childOfFarmerFisherfolk: "Required",
      disasterAffectedFamily: "None",
      workingStudent: "None",
      femaleOnly: "None",
      customRequiredTags: ["Child of Farmer / Fisherfolk"],
      customPreferredTags: []
    },
    rankingWeights: {
      wGpa: 30,
      wIncome: 50,
      wTags: 20
    }
  },

  // 6. CHED Merit Scholarship Program (CMSP)
  {
    title: "CHED Merit Scholarship Program (CMSP)",
    grantValue: "Tuition and school fees, book/connectivity allowance, and living stipend",
    category: ["Merit-Based"],
    overview: "CMSP covers tuition, mandatory fees, connectivity allowances, and monthly stipends for high-performing senior high school graduates.",
    externalUrl: "https://ched.gov.ph",
    hardRequirements: {
      academicLevel: ["College / Undergraduate"],
      citizenship: "Filipino Citizen Only",
      minGwaPercentage: 93,
      annualIncomeCeiling: 500000,
      eligibleDegreePrograms: [],
      geographicBounds: [],
      customHardRequirements: [
        "Filipino Senior High School graduate"
      ]
    },
    specialEligibilityTags: {
      fourPsBeneficiary: "None",
      indigenousPeoples: "None",
      pwd: "None",
      soloParentDependent: "None",
      orphanStatus: "None",
      childOfFarmerFisherfolk: "None",
      disasterAffectedFamily: "None",
      workingStudent: "None",
      femaleOnly: "None",
      customRequiredTags: [],
      customPreferredTags: []
    },
    rankingWeights: {
      wGpa: 50,
      wIncome: 30,
      wTags: 20
    }
  },

  // 7. Tertiary Education Subsidy (TES)
  {
    title: "Tertiary Education Subsidy (TES)",
    grantValue: "Tuition subsidies for Private HEIs, SUCs, and LUCs",
    category: ["Need-Based"],
    overview: "Need-based national subsidy prioritizing financially disadvantaged students listed under Listahanan, 4Ps beneficiaries, and low-income PHEI enrolled students.",
    externalUrl: "https://unifast.gov.ph",
    hardRequirements: {
      academicLevel: ["College / Undergraduate"],
      citizenship: "Filipino Citizen Only",
      eligibleDegreePrograms: [],
      geographicBounds: [],
      customHardRequirements: [
        "Enrolled in CHED-recognized SUCs, LUCs, or PHEIs"
      ]
    },
    specialEligibilityTags: {
      fourPsBeneficiary: "Required",
      indigenousPeoples: "Prefer",
      pwd: "Prefer",
      soloParentDependent: "None",
      orphanStatus: "None",
      childOfFarmerFisherfolk: "None",
      disasterAffectedFamily: "None",
      workingStudent: "None",
      femaleOnly: "None",
      customRequiredTags: [],
      customPreferredTags: ["Listahanan Listed"]
    },
    rankingWeights: {
      wGpa: 20,
      wIncome: 60,
      wTags: 20
    }
  },

  // 8. Tulong Dunong Program (TDP)
  {
    title: "CHED Tulong Dunong Program (TDP)",
    grantValue: "₱15,000 per year (₱7,500 per semester)",
    category: ["Need-Based"],
    overview: "Government assistance program covering partial tuition costs for undergraduate students in CHED-registered SUCs, LUCs, or PHEIs.",
    externalUrl: "https://ched.gov.ph",
    hardRequirements: {
      academicLevel: ["College / Undergraduate"],
      citizenship: "Filipino Citizen Only",
      annualIncomeCeiling: 500000,
      eligibleDegreePrograms: [],
      geographicBounds: [],
      customHardRequirements: [
        "Senior High School graduate",
        "Enrolled in first undergraduate degree program in SUCs/LUCs/PHEIs under CHED Registry",
        "Not a beneficiary of TES, CSPs, or other national StuFAPs"
      ]
    },
    specialEligibilityTags: {
      fourPsBeneficiary: "Prefer",
      indigenousPeoples: "None",
      pwd: "None",
      soloParentDependent: "None",
      orphanStatus: "None",
      childOfFarmerFisherfolk: "None",
      disasterAffectedFamily: "None",
      workingStudent: "None",
      femaleOnly: "None",
      customRequiredTags: [],
      customPreferredTags: []
    },
    rankingWeights: {
      wGpa: 30,
      wIncome: 50,
      wTags: 20
    }
  },

  // 9. DOST-SEI Undergraduate Scholarship
  {
    title: "DOST-SEI Undergraduate Scholarship",
    grantValue: "Up to ₱40,000/year tuition grant + ₱8,000/month stipend",
    category: ["STEM Specialized", "Merit-Based"],
    overview: "Provides grants for top Filipino students pursuing priority degree programs in Science, Technology, Engineering, and Mathematics.",
    contactDetails: "Email fgs@sei.dost.gov.ph or call 8330 8876 / 8330 8826.",
    externalUrl: "https://www.sei.dost.gov.ph",
    hardRequirements: {
      academicLevel: ["Senior High School", "College / Undergraduate"],
      citizenship: "Filipino Citizen Only",
      eligibleDegreePrograms: ["Science", "Technology", "Engineering", "Mathematics"],
      geographicBounds: [],
      customHardRequirements: [
        "STEM strand senior high graduate OR Non-STEM in top 5% of graduating class"
      ]
    },
    specialEligibilityTags: {
      fourPsBeneficiary: "None",
      indigenousPeoples: "None",
      pwd: "None",
      soloParentDependent: "None",
      orphanStatus: "None",
      childOfFarmerFisherfolk: "None",
      disasterAffectedFamily: "None",
      workingStudent: "None",
      femaleOnly: "None",
      customRequiredTags: [],
      customPreferredTags: []
    },
    rankingWeights: {
      wGpa: 60,
      wIncome: 20,
      wTags: 20
    }
  },

  // 10. OWWA - Education for Development Scholarship Program (EDSP)
  {
    title: "OWWA Education for Development Scholarship Program (EDSP)",
    grantValue: "Up to ₱60,000 per year",
    category: ["Merit-Based"],
    overview: "Financial assistance for qualified dependents of active OWWA members pursuing 4-year or 5-year baccalaureate courses.",
    contactDetails: "Visit OWWA website or call OWWA Hotline 1348.",
    externalUrl: "https://owwa.gov.ph",
    hardRequirements: {
      academicLevel: ["College / Undergraduate"],
      citizenship: "Filipino Citizen Only",
      eligibleDegreePrograms: [],
      geographicBounds: [],
      customHardRequirements: [
        "Child of active OWWA member",
        "Top 1,000 qualifier in DOST national qualifying exam"
      ]
    },
    specialEligibilityTags: {
      fourPsBeneficiary: "None",
      indigenousPeoples: "None",
      pwd: "None",
      soloParentDependent: "None",
      orphanStatus: "None",
      childOfFarmerFisherfolk: "None",
      disasterAffectedFamily: "None",
      workingStudent: "None",
      femaleOnly: "None",
      ofwDependent: "Required",
      customRequiredTags: ["OFW Dependent"],
      customPreferredTags: []
    },
    rankingWeights: {
      wGpa: 50,
      wIncome: 30,
      wTags: 20
    }
  },

  // 11. OWWA - OFW Dependent Scholarship Program (ODSP)
  {
    title: "OWWA OFW Dependent Scholarship Program (ODSP)",
    grantValue: "₱20,000 per year",
    category: ["Need-Based"],
    overview: "Financial assistance provided to dependents of active OWWA members whose monthly salary is below OWWA set threshold guidelines.",
    contactDetails: "Call OWWA Hotline 1348.",
    externalUrl: "https://owwa.gov.ph",
    hardRequirements: {
      academicLevel: ["College / Undergraduate"],
      citizenship: "Filipino Citizen Only",
      eligibleDegreePrograms: [],
      geographicBounds: [],
      customHardRequirements: [
        "Dependent of active OFW earning below OWWA salary guidelines"
      ]
    },
    specialEligibilityTags: {
      fourPsBeneficiary: "None",
      indigenousPeoples: "None",
      pwd: "None",
      soloParentDependent: "None",
      orphanStatus: "None",
      childOfFarmerFisherfolk: "None",
      disasterAffectedFamily: "None",
      workingStudent: "None",
      femaleOnly: "None",
      ofwDependent: "Required",
      customRequiredTags: ["OFW Dependent"],
      customPreferredTags: []
    },
    rankingWeights: {
      wGpa: 30,
      wIncome: 50,
      wTags: 20
    }
  },

  // 12. OWWA - Congressional Migrant Workers Scholarship Program (CMWSP)
  {
    title: "OWWA Congressional Migrant Workers Scholarship Program (CMWSP)",
    grantValue: "Up to ₱60,000 per year",
    category: ["STEM Specialized"],
    overview: "Funded by PCSO via OWWA for deserving migrant workers or their dependents who intend to pursue Science and Technology degree courses.",
    contactDetails: "Call OWWA Hotline 1348.",
    externalUrl: "https://owwa.gov.ph",
    hardRequirements: {
      academicLevel: ["College / Undergraduate"],
      citizenship: "Filipino Citizen Only",
      eligibleDegreePrograms: ["Science", "Technology"],
      geographicBounds: [],
      customHardRequirements: [
        "Migrant worker or direct descendant of active OFW"
      ]
    },
    specialEligibilityTags: {
      fourPsBeneficiary: "None",
      indigenousPeoples: "None",
      pwd: "None",
      soloParentDependent: "None",
      orphanStatus: "None",
      childOfFarmerFisherfolk: "None",
      disasterAffectedFamily: "None",
      workingStudent: "None",
      femaleOnly: "None",
      ofwDependent: "Required",
      customRequiredTags: ["OFW Dependent"],
      customPreferredTags: []
    },
    rankingWeights: {
      wGpa: 40,
      wIncome: 40,
      wTags: 20
    }
  },

  // 13. OWWA - Education and Livelihood Assistance Program (ELAP)
  {
    title: "OWWA Education and Livelihood Assistance Program (ELAP)",
    grantValue: "Up to ₱10,000 per year for college",
    category: ["Need-Based"],
    overview: "Assistance to dependents of deceased active OWWA members or OFWs sentenced to death abroad with valid contributions.",
    contactDetails: "Call OWWA Hotline 1348.",
    externalUrl: "https://owwa.gov.ph",
    hardRequirements: {
      academicLevel: ["College / Undergraduate"],
      citizenship: "Filipino Citizen Only",
      eligibleDegreePrograms: [],
      geographicBounds: [],
      customHardRequirements: [
        "Dependent of deceased active OWWA member OR OFW sentenced to death abroad with active membership"
      ]
    },
    specialEligibilityTags: {
      fourPsBeneficiary: "None",
      indigenousPeoples: "None",
      pwd: "None",
      soloParentDependent: "None",
      orphanStatus: "Required",
      childOfFarmerFisherfolk: "None",
      disasterAffectedFamily: "None",
      workingStudent: "None",
      femaleOnly: "None",
      ofwDependent: "Required",
      customRequiredTags: ["Orphan Status", "OFW Dependent"],
      customPreferredTags: []
    },
    rankingWeights: {
      wGpa: 20,
      wIncome: 50,
      wTags: 30
    }
  }
];

// Seed function to execute against MongoDB
async function seedDB() {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/iskolarmatch';
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB for seeding...");

    // Insert or update seed records
    for (const data of scholarshipsData) {
      await Scholarship.updateOne(
        { title: data.title }, 
        { $set: data }, 
        { upsert: true }
      );
    }

    console.log("✅ Successfully seeded 13 scholarships into MongoDB database!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding Error:", err);
    process.exit(1);
  }
}

seedDB();