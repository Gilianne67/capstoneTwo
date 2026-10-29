import assert from 'node:assert/strict';
import {
  canAccessProviderOnboarding,
  canAccessProviderPendingApproval,
  canAccessStudentOnboarding,
  isSessionOptionalRoute,
  providerFlowRedirect,
  resolveRedirectPath,
  studentFlowRedirect,
} from './redirectPath.js';

const check = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

const newProvider = {
  role: 'provider',
  isOnboarded: false,
  isVerified: false,
  verificationStatus: 'Approved',
};

check('a copied provider onboarding URL without a session goes to sign in', () => {
  assert.equal(isSessionOptionalRoute('/provider/onboarding'), false);
  assert.equal(isSessionOptionalRoute('/provider/pending-approval'), false);
  assert.equal(isSessionOptionalRoute('/dashboard/provider'), false);
});

check('a copied student onboarding URL without a session goes to sign in', () => {
  assert.equal(isSessionOptionalRoute('/onboarding'), false);
  assert.equal(isSessionOptionalRoute('/consent/verify'), true);
});

const newStudent = {
  role: 'student',
  isOnboarded: false,
  isVerified: false,
  status: 'active',
  email: 'new.student@example.com',
};

check('a newly registered student returns to onboarding after authentication', () => {
  assert.equal(canAccessStudentOnboarding(newStudent), true);
  assert.equal(studentFlowRedirect(newStudent, '/onboarding'), null);
  assert.equal(resolveRedirectPath(newStudent), '/onboarding');
  assert.equal(studentFlowRedirect(newStudent, '/dashboard/student'), null);
});

check('an onboarded student leaves onboarding for the student dashboard', () => {
  const student = {
    role: 'student',
    isOnboarded: true,
    isVerified: true,
    status: 'active',
  };
  assert.equal(canAccessStudentOnboarding(student), false);
  assert.equal(studentFlowRedirect(student, '/onboarding'), '/dashboard/student');
  assert.equal(resolveRedirectPath(student), '/dashboard/student');
});

check('a provider cannot open student onboarding', () => {
  assert.equal(canAccessStudentOnboarding(newProvider), false);
  assert.equal(studentFlowRedirect(newProvider, '/onboarding'), '/provider/onboarding');
  const verifiedProvider = {
    role: 'provider',
    isOnboarded: true,
    verificationStatus: 'Verified',
  };
  assert.equal(studentFlowRedirect(verifiedProvider, '/onboarding'), '/dashboard/provider');
});

check('an admin cannot open student onboarding', () => {
  const admin = { role: 'admin', isOnboarded: true, status: 'active' };
  const superadmin = { role: 'superadmin', status: 'active' };
  assert.equal(canAccessStudentOnboarding(admin), false);
  assert.equal(studentFlowRedirect(admin, '/onboarding'), '/dashboard/admin');
  assert.equal(studentFlowRedirect(superadmin, '/onboarding'), '/dashboard/admin');
});

check('pending guardian consent stays on the consent screen', () => {
  const minor = {
    role: 'student',
    isOnboarded: true,
    status: 'pending_consent',
  };
  assert.equal(canAccessStudentOnboarding(minor), false);
  assert.equal(studentFlowRedirect(minor, '/onboarding'), '/consent/verify');
  assert.equal(resolveRedirectPath(minor), '/consent/verify');
  assert.equal(isSessionOptionalRoute('/consent/verify'), true);
});

check('a newly registered provider can open onboarding', () => {
  assert.equal(canAccessProviderOnboarding(newProvider), true);
  assert.equal(providerFlowRedirect(newProvider, '/provider/onboarding'), null);
  assert.equal(resolveRedirectPath(newProvider), '/provider/onboarding');
});

check('a provider who can resubmit can open onboarding', () => {
  const provider = {
    role: 'provider',
    isOnboarded: true,
    verificationStatus: 'Rejected',
    isFinalRejection: false,
  };
  assert.equal(canAccessProviderOnboarding(provider), true);
  assert.equal(providerFlowRedirect(provider, '/provider/onboarding'), null);
});

check('a verified provider is sent to the provider dashboard', () => {
  const provider = {
    role: 'provider',
    isOnboarded: true,
    verificationStatus: 'Verified',
  };
  assert.equal(canAccessProviderOnboarding(provider), false);
  assert.equal(providerFlowRedirect(provider, '/provider/onboarding'), '/dashboard/provider');
});

check('a provider waiting for review stays on the pending page and leaves onboarding', () => {
  const provider = {
    role: 'provider',
    isOnboarded: true,
    verificationStatus: 'Pending Review',
  };
  assert.equal(canAccessProviderPendingApproval(provider), true);
  assert.equal(providerFlowRedirect(provider, '/provider/pending-approval'), null);
  assert.equal(providerFlowRedirect(provider, '/provider/onboarding'), '/provider/pending-approval');
});

check('a final rejection cannot reopen provider onboarding', () => {
  const provider = {
    role: 'provider',
    isOnboarded: true,
    verificationStatus: 'Rejected',
    isFinalRejection: true,
  };
  assert.equal(canAccessProviderOnboarding(provider), false);
  assert.equal(providerFlowRedirect(provider, '/provider/onboarding'), '/auth?mode=signin');
});

check('student dashboard routes are not treated as public onboarding', () => {
  assert.equal(isSessionOptionalRoute('/dashboard/student'), false);
  assert.equal(isSessionOptionalRoute('/dashboard/student/matches'), false);
});

console.log('\n13 student and provider onboarding route checks passed');
