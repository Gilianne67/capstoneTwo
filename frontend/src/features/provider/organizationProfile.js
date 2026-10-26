const INSTITUTION_TYPE_LABELS = {
  University: 'University / College',
  'University / College': 'University / College',
  'Non-Profit': 'Non-Profit / NGO',
  'Non-Profit / NGO': 'Non-Profit / NGO',
  Corporate: 'Corporate Foundation',
  'Corporate Foundation': 'Corporate Foundation',
  Government: 'Government Agency',
  'Government Agency': 'Government Agency',
  Other: 'Other'
};

const DOCUMENT_TYPE_LABELS = {
  SEC_DTI: 'SEC / DTI Registration',
  'SEC / DTI Registration': 'SEC / DTI Registration',
  CHED_DepEd: 'CHED / DepEd Recognition',
  'CHED / DepEd Recognition': 'CHED / DepEd Recognition',
  Authorization_Letter: 'Signed Authorization Letter',
  'Signed Authorization Letter': 'Signed Authorization Letter',
  Gov_ID: 'Government ID of Representative',
  'Government ID of Representative': 'Government ID of Representative'
};

const INSTITUTION_TYPE_FORM_VALUES = {
  University: 'University',
  'University / College': 'University',
  'Non-Profit': 'Non-Profit',
  'Non-Profit / NGO': 'Non-Profit',
  Corporate: 'Corporate',
  'Corporate Foundation': 'Corporate',
  Government: 'Government',
  'Government Agency': 'Government',
  Other: 'Other'
};

const DOCUMENT_TYPE_FORM_VALUES = {
  SEC_DTI: 'SEC_DTI',
  'SEC / DTI Registration': 'SEC_DTI',
  CHED_DepEd: 'CHED_DepEd',
  'CHED / DepEd Recognition': 'CHED_DepEd',
  Authorization_Letter: 'Authorization_Letter',
  'Signed Authorization Letter': 'Authorization_Letter',
  Gov_ID: 'Gov_ID',
  'Government ID of Representative': 'Gov_ID'
};

export const EMPTY_ONBOARDING_FORM = {
  institutionName: '',
  institutionType: 'Non-Profit',
  website: '',
  contactNumber: '',
  street: '',
  city: '',
  province: '',
  region: '',
  repName: '',
  repTitle: '',
  repEmail: ''
};

export function hasText(value) {
  return String(value || '').trim() !== '';
}

export function labelInstitutionType(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return INSTITUTION_TYPE_LABELS[trimmed] || trimmed;
}

export function labelDocumentType(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return DOCUMENT_TYPE_LABELS[trimmed] || trimmed;
}

export function formatProfileDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatAddress(address) {
  if (!address || typeof address !== 'object') return '';
  return [address.street, address.city, address.province, address.region]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

export function organizationInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return 'ORG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function websiteHref(website) {
  const trimmed = String(website || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function documentLabel(doc) {
  if (hasText(doc?.originalName) || hasText(doc?.name) || hasText(doc?.filename)) {
    return doc.originalName || doc.name || doc.filename;
  }
  return labelDocumentType(doc?.documentType);
}

function documentPath(doc) {
  if (typeof doc === 'string') return doc;
  return doc?.fileUrl || doc?.url || doc?.path || '';
}

export function readVerificationDocuments(provider) {
  const collections = [provider?.verificationDocuments, provider?.documents];
  const documents = [];

  collections.forEach((collection) => {
    if (!Array.isArray(collection)) return;
    collection.forEach((doc) => {
      if (!doc) return;
      const label = documentLabel(doc);
      const path = documentPath(doc);
      if (!hasText(label) && !hasText(path)) return;
      documents.push({
        id: doc._id || doc.id || path || label,
        label: label || 'Verification document',
        documentType: labelDocumentType(doc.documentType),
        uploadedAt: formatProfileDate(doc.uploadedAt),
        fileUrl: path && path !== '#' ? path : ''
      });
    });
  });

  return documents;
}

export function mapProviderProfile(provider) {
  const representative = provider?.representative && typeof provider.representative === 'object'
    ? provider.representative
    : {};

  return {
    institutionName: String(provider?.institutionName || '').trim(),
    institutionType: labelInstitutionType(provider?.institutionType),
    website: String(provider?.website || '').trim(),
    contactNumber: String(provider?.contactNumber || '').trim(),
    address: formatAddress(provider?.address),
    representativeName: String(representative.name || '').trim(),
    representativeTitle: String(representative.title || '').trim(),
    representativeEmail: String(representative.workEmail || '').trim(),
    verificationStatus: String(provider?.verificationStatus || '').trim(),
    rejectionReason: String(provider?.rejectionReason || '').trim(),
    isFinalRejection: Boolean(provider?.isFinalRejection),
    submittedAt: formatProfileDate(provider?.submittedAt),
    verifiedAt: formatProfileDate(provider?.verifiedAt),
    documents: readVerificationDocuments(provider)
  };
}

export function toOnboardingInstitutionType(value) {
  const trimmed = String(value || '').trim();
  return INSTITUTION_TYPE_FORM_VALUES[trimmed] || 'Non-Profit';
}

export function toOnboardingDocumentType(value) {
  const trimmed = String(value || '').trim();
  return DOCUMENT_TYPE_FORM_VALUES[trimmed] || 'SEC_DTI';
}

export function mapOnboardingForm(provider) {
  if (!provider) {
    return {
      ...EMPTY_ONBOARDING_FORM,
      documentType: 'SEC_DTI',
      documents: [],
      rejectionReason: '',
      isFinalRejection: false,
      verificationStatus: '',
      hasExistingRecord: false
    };
  }

  const address = provider.address && typeof provider.address === 'object' ? provider.address : {};
  const representative = provider.representative && typeof provider.representative === 'object'
    ? provider.representative
    : {};
  const storedDocuments = Array.isArray(provider.verificationDocuments)
    ? provider.verificationDocuments
    : [];
  const latestDocument = storedDocuments.length ? storedDocuments[storedDocuments.length - 1] : null;

  return {
    institutionName: String(provider.institutionName || '').trim(),
    institutionType: toOnboardingInstitutionType(provider.institutionType),
    website: String(provider.website || '').trim(),
    contactNumber: String(provider.contactNumber || '').trim(),
    street: String(address.street || '').trim(),
    city: String(address.city || '').trim(),
    province: String(address.province || '').trim(),
    region: String(address.region || '').trim(),
    repName: String(representative.name || '').trim(),
    repTitle: String(representative.title || '').trim(),
    repEmail: String(representative.workEmail || '').trim(),
    documentType: toOnboardingDocumentType(latestDocument?.documentType),
    documents: readVerificationDocuments(provider),
    rejectionReason: String(provider.rejectionReason || '').trim(),
    isFinalRejection: Boolean(provider.isFinalRejection),
    verificationStatus: String(provider.verificationStatus || '').trim(),
    hasExistingRecord: true
  };
}

export function requiresNewVerificationDocument(existingDocuments, replacementFile) {
  if (replacementFile) return false;
  return !Array.isArray(existingDocuments) || existingDocuments.length === 0;
}
