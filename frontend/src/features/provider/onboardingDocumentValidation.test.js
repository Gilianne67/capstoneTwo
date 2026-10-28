import assert from 'node:assert/strict';
import {
  INVALID_VERIFICATION_FILE_TYPE_MESSAGE,
  MAX_VERIFICATION_DOCUMENT_BYTES,
  REQUIRED_VERIFICATION_DOCUMENT_MESSAGE,
  VERIFICATION_FILE_TOO_LARGE_MESSAGE,
  documentErrorAfterSavedDocuments,
  planProviderOnboardingDocuments,
  verificationDocumentFileError,
} from './onboardingDocumentValidation.js';

const savedDocuments = [
  {
    label: 'old-sec.pdf',
    fileUrl: '/api/v1/documents/old-sec.pdf',
  },
];

const validPdf = new File(['pdf'], 'sec-registration.pdf', { type: 'application/pdf' });

let passed = 0;

const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const gateSubmission = (input) => {
  const posts = [];
  const decision = planProviderOnboardingDocuments(input);

  if (!decision.sendRequest) {
    return { sent: false, posts, error: decision.error, attachFile: false };
  }

  const payload = new FormData();
  if (decision.attachFile) {
    payload.append('verificationDoc', input.file);
  }
  posts.push(payload);

  return {
    sent: true,
    posts,
    error: decision.error,
    attachFile: decision.attachFile,
    payloadHasFile: payload.has('verificationDoc'),
  };
};

check('first-time submission without a document shows the required-document error and does not send the request', () => {
  const result = gateSubmission({ existingDocuments: [], file: null });

  assert.equal(result.sent, false);
  assert.equal(result.posts.length, 0);
  assert.equal(result.error, REQUIRED_VERIFICATION_DOCUMENT_MESSAGE);
  assert.equal(result.error, 'Please upload at least one required document before submitting.');
});

check('first-time submission with a valid document proceeds', () => {
  const result = gateSubmission({ existingDocuments: [], file: validPdf });

  assert.equal(result.sent, true);
  assert.equal(result.posts.length, 1);
  assert.equal(result.error, '');
  assert.equal(result.attachFile, true);
  assert.equal(result.payloadHasFile, true);
  assert.equal(result.posts[0].get('verificationDoc').name, 'sec-registration.pdf');
});

check('resubmission with existing documents and no new file proceeds', () => {
  const result = gateSubmission({ existingDocuments: savedDocuments, file: null });

  assert.equal(result.sent, true);
  assert.equal(result.posts.length, 1);
  assert.equal(result.error, '');
  assert.equal(result.attachFile, false);
  assert.equal(result.payloadHasFile, false);
});

check('resubmission without existing documents or a new file shows the required-document error', () => {
  const missingDocuments = gateSubmission({ existingDocuments: [], file: null });
  const labelOnly = gateSubmission({
    existingDocuments: [{ label: 'sec-registration.pdf' }],
    file: null,
  });

  assert.equal(missingDocuments.sent, false);
  assert.equal(missingDocuments.posts.length, 0);
  assert.equal(missingDocuments.error, REQUIRED_VERIFICATION_DOCUMENT_MESSAGE);
  assert.equal(labelOnly.sent, false);
  assert.equal(labelOnly.posts.length, 0);
  assert.equal(labelOnly.error, REQUIRED_VERIFICATION_DOCUMENT_MESSAGE);
});

check('invalid selected files show the appropriate validation message', () => {
  const textFile = {
    name: 'notes.txt',
    type: 'text/plain',
    size: 40,
  };
  const oversizedPdf = {
    name: 'sec-registration.pdf',
    type: 'application/pdf',
    size: MAX_VERIFICATION_DOCUMENT_BYTES + 1,
  };
  const textDecision = planProviderOnboardingDocuments({
    existingDocuments: [],
    file: textFile,
  });
  const oversizedDecision = planProviderOnboardingDocuments({
    existingDocuments: savedDocuments,
    file: oversizedPdf,
  });

  assert.equal(textDecision.sendRequest, false);
  assert.equal(textDecision.attachFile, false);
  assert.equal(textDecision.error, INVALID_VERIFICATION_FILE_TYPE_MESSAGE);
  assert.equal(oversizedDecision.sendRequest, false);
  assert.equal(oversizedDecision.attachFile, false);
  assert.equal(oversizedDecision.error, VERIFICATION_FILE_TOO_LARGE_MESSAGE);
  assert.equal(
    verificationDocumentFileError({
      name: 'sec-registration.pdf',
      type: 'application/pdf',
      size: MAX_VERIFICATION_DOCUMENT_BYTES,
    }),
    ''
  );
});

check('a valid file or loaded saved documents clear the missing-document error', () => {
  assert.equal(verificationDocumentFileError(validPdf), '');
  assert.equal(
    verificationDocumentFileError({ name: 'permit.png', type: 'image/png', size: 800 }),
    ''
  );
  assert.equal(
    verificationDocumentFileError({ name: 'id.jpg', type: 'image/jpeg', size: 800 }),
    ''
  );
  assert.equal(
    documentErrorAfterSavedDocuments(REQUIRED_VERIFICATION_DOCUMENT_MESSAGE, savedDocuments),
    ''
  );
  assert.equal(
    documentErrorAfterSavedDocuments(REQUIRED_VERIFICATION_DOCUMENT_MESSAGE, []),
    REQUIRED_VERIFICATION_DOCUMENT_MESSAGE
  );
  assert.equal(
    documentErrorAfterSavedDocuments(INVALID_VERIFICATION_FILE_TYPE_MESSAGE, savedDocuments),
    INVALID_VERIFICATION_FILE_TYPE_MESSAGE
  );
});

console.log(`\n${passed} onboarding document checks passed`);
