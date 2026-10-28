export const REQUIRED_VERIFICATION_DOCUMENT_MESSAGE =
  'Please upload at least one required document before submitting.';

export const INVALID_VERIFICATION_FILE_TYPE_MESSAGE =
  'Only .pdf, .jpg, .jpeg, and .png files are allowed!';

export const VERIFICATION_FILE_TOO_LARGE_MESSAGE =
  'File too large. Verification documents must be 10 MB or smaller.';

export const MAX_VERIFICATION_DOCUMENT_BYTES = 10 * 1024 * 1024;

const ALLOWED_DOCUMENT_PATTERN = /jpeg|jpg|png|pdf/;

function fileExtension(name) {
  const base = String(name || '').replace(/\\/g, '/').split('/').pop().toLowerCase();
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot);
}

export function hasValidSavedVerificationDocuments(existingDocuments) {
  if (!Array.isArray(existingDocuments)) return false;

  return existingDocuments.some((doc) => {
    if (!doc || typeof doc !== 'object') return false;
    const reference = String(doc.fileUrl || doc.url || doc.path || '').trim();
    return reference !== '' && reference !== '#';
  });
}

export function verificationDocumentFileError(file) {
  if (!file) return '';

  const extension = fileExtension(file.name || file.originalname);
  const mimeType = String(file.type || file.mimetype || '').toLowerCase();
  const extensionAllowed = ALLOWED_DOCUMENT_PATTERN.test(extension);
  const mimeAllowed = ALLOWED_DOCUMENT_PATTERN.test(mimeType);

  if (!extensionAllowed || !mimeAllowed) {
    return INVALID_VERIFICATION_FILE_TYPE_MESSAGE;
  }

  const size = Number(file.size);
  if (Number.isFinite(size) && size > MAX_VERIFICATION_DOCUMENT_BYTES) {
    return VERIFICATION_FILE_TOO_LARGE_MESSAGE;
  }

  return '';
}

export function planProviderOnboardingDocuments({ existingDocuments, file } = {}) {
  if (file) {
    const fileError = verificationDocumentFileError(file);
    if (fileError) {
      return { sendRequest: false, error: fileError, attachFile: false };
    }

    return { sendRequest: true, error: '', attachFile: true };
  }

  if (!hasValidSavedVerificationDocuments(existingDocuments)) {
    return {
      sendRequest: false,
      error: REQUIRED_VERIFICATION_DOCUMENT_MESSAGE,
      attachFile: false,
    };
  }

  return { sendRequest: true, error: '', attachFile: false };
}

export function documentErrorAfterSavedDocuments(currentError, existingDocuments) {
  if (
    currentError === REQUIRED_VERIFICATION_DOCUMENT_MESSAGE
    && hasValidSavedVerificationDocuments(existingDocuments)
  ) {
    return '';
  }

  return currentError || '';
}
