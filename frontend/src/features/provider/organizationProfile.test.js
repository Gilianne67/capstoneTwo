import assert from 'node:assert/strict';
import {
  formatAddress,
  formatProfileDate,
  hasText,
  labelDocumentType,
  labelInstitutionType,
  mapOnboardingForm,
  mapProviderProfile,
  organizationInitials,
  requiresNewVerificationDocument,
  toOnboardingDocumentType,
  toOnboardingInstitutionType,
  websiteHref
} from './organizationProfile.js';

const check = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

check('maps onboarding organization and representative fields', () => {
  const profile = mapProviderProfile({
    institutionName: 'DOST Foundation',
    institutionType: 'Non-Profit',
    website: 'https://dost.gov.ph',
    contactNumber: '+63 912 345 6789',
    address: {
      street: '123 Science Ave',
      city: 'Taguig',
      province: 'Metro Manila',
      region: 'NCR'
    },
    representative: {
      name: 'Juan Dela Cruz',
      title: 'Program Director',
      workEmail: 'juan@dost.gov.ph'
    },
    verificationStatus: 'Pending Review',
    submittedAt: '2026-10-01T08:00:00.000Z',
    verificationDocuments: [
      {
        documentType: 'SEC_DTI',
        fileUrl: '/api/v1/documents/sec.pdf',
        originalName: 'sec-registration.pdf',
        uploadedAt: '2026-10-01T08:00:00.000Z'
      }
    ]
  });

  assert.equal(profile.institutionName, 'DOST Foundation');
  assert.equal(profile.institutionType, 'Non-Profit / NGO');
  assert.equal(profile.website, 'https://dost.gov.ph');
  assert.equal(profile.contactNumber, '+63 912 345 6789');
  assert.equal(profile.address, '123 Science Ave, Taguig, Metro Manila, NCR');
  assert.equal(profile.representativeName, 'Juan Dela Cruz');
  assert.equal(profile.representativeTitle, 'Program Director');
  assert.equal(profile.representativeEmail, 'juan@dost.gov.ph');
  assert.equal(profile.verificationStatus, 'Pending Review');
  assert.equal(profile.documents.length, 1);
  assert.equal(profile.documents[0].documentType, 'SEC / DTI Registration');
  assert.equal(profile.documents[0].label, 'sec-registration.pdf');
});

check('omits empty optional fields instead of inventing values', () => {
  const profile = mapProviderProfile({
    institutionName: 'Sample Org',
    institutionType: '',
    website: '  ',
    contactNumber: null,
    address: { street: '', city: '', province: '', region: '' },
    representative: {},
    verificationStatus: 'Verified'
  });

  assert.equal(profile.institutionType, '');
  assert.equal(profile.website, '');
  assert.equal(profile.contactNumber, '');
  assert.equal(profile.address, '');
  assert.equal(profile.representativeName, '');
  assert.equal(profile.representativeEmail, '');
  assert.equal(profile.rejectionReason, '');
  assert.equal(profile.isFinalRejection, false);
  assert.equal(profile.verifiedAt, '');
  assert.equal(profile.documents.length, 0);
  assert.equal(hasText(profile.website), false);
});

check('does not invent a verified date, logo, or description', () => {
  const profile = mapProviderProfile({
    institutionName: 'Sample Org',
    verificationStatus: 'Pending Review'
  });

  assert.equal(profile.verifiedAt, '');
  assert.equal(Object.prototype.hasOwnProperty.call(profile, 'logo'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(profile, 'description'), false);
});

check('formats helpers used by the profile page', () => {
  assert.equal(labelInstitutionType('Government'), 'Government Agency');
  assert.equal(labelDocumentType('Gov_ID'), 'Government ID of Representative');
  assert.equal(organizationInitials('DOST Foundation'), 'DF');
  assert.equal(websiteHref('example.org'), 'https://example.org');
  assert.equal(formatAddress(null), '');
  assert.equal(formatProfileDate('not-a-date'), '');
});

check('prefills onboarding fields from a saved rejected provider record', () => {
  const mapped = mapOnboardingForm({
    institutionName: 'QA Org Foundation',
    institutionType: 'Non-Profit / NGO',
    website: 'https://example.org',
    contactNumber: '09171234567',
    address: {
      street: '1 Test Street',
      city: 'Legazpi',
      province: 'Albay',
      region: 'Bicol Region'
    },
    representative: {
      name: 'Maria Santos',
      title: 'Director',
      workEmail: 'maria.santos@example.org'
    },
    verificationStatus: 'Rejected',
    rejectionReason: 'SEC registration is incomplete.',
    isFinalRejection: false,
    verificationDocuments: [
      {
        documentType: 'SEC / DTI Registration',
        fileUrl: '/api/v1/documents/sec.pdf',
        originalName: 'sec-registration.pdf',
        uploadedAt: '2026-10-01T08:00:00.000Z'
      }
    ]
  });

  assert.equal(mapped.institutionName, 'QA Org Foundation');
  assert.equal(mapped.institutionType, 'Non-Profit');
  assert.equal(mapped.website, 'https://example.org');
  assert.equal(mapped.contactNumber, '09171234567');
  assert.equal(mapped.street, '1 Test Street');
  assert.equal(mapped.city, 'Legazpi');
  assert.equal(mapped.province, 'Albay');
  assert.equal(mapped.region, 'Bicol Region');
  assert.equal(mapped.repName, 'Maria Santos');
  assert.equal(mapped.repTitle, 'Director');
  assert.equal(mapped.repEmail, 'maria.santos@example.org');
  assert.equal(mapped.documentType, 'SEC_DTI');
  assert.equal(mapped.documents.length, 1);
  assert.equal(mapped.documents[0].label, 'sec-registration.pdf');
  assert.equal(mapped.rejectionReason, 'SEC registration is incomplete.');
  assert.equal(mapped.hasExistingRecord, true);
});

check('keeps first-time onboarding empty and requires a new document', () => {
  const mapped = mapOnboardingForm(null);
  assert.equal(mapped.institutionName, '');
  assert.equal(mapped.hasExistingRecord, false);
  assert.equal(mapped.documents.length, 0);
  assert.equal(requiresNewVerificationDocument(mapped.documents, null), true);
  assert.equal(requiresNewVerificationDocument(mapped.documents, { name: 'sec.pdf' }), false);
});

check('does not require a replacement when a stored document already exists', () => {
  assert.equal(
    requiresNewVerificationDocument([{ label: 'sec-registration.pdf' }], null),
    false
  );
  assert.equal(toOnboardingInstitutionType('Government Agency'), 'Government');
  assert.equal(toOnboardingDocumentType('CHED / DepEd Recognition'), 'CHED_DepEd');
});

console.log('\n7 organization profile checks passed');
