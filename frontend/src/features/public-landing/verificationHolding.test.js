import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verificationHoldingEmail } from './verificationHolding.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const check = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

check('a copied holding URL without a session does not reveal an address', () => {
  assert.equal(verificationHoldingEmail({}), '');
  assert.equal(verificationHoldingEmail({
    userEmail: '',
    stateEmail: '',
  }), '');
});

check('the same browser can show the address passed after unverified sign-in', () => {
  assert.equal(verificationHoldingEmail({
    stateEmail: '  Student@Example.com ',
  }), 'student@example.com');
});

check('a signed-in user sees only their own email', () => {
  assert.equal(verificationHoldingEmail({
    userEmail: 'Owner@Example.com',
    stateEmail: 'other.person@example.com',
  }), 'owner@example.com');
});

check('the holding page stays public and does not read an email from the URL', () => {
  const appSource = read('src/App.jsx');
  const publicSection = appSource.slice(0, appSource.indexOf('STANDALONE ONBOARDING ROUTES'));
  const guardedSection = appSource.slice(appSource.indexOf('STANDALONE ONBOARDING ROUTES'));
  assert.ok(publicSection.includes('path="/verify-holding"'));
  assert.ok(!guardedSection.includes('path="/verify-holding"'));
  assert.ok(!appSource.includes('verify-holding?email='));

  const holdingSource = read('src/features/public-landing/pages/VerifyHoldingPage.jsx');
  assert.ok(holdingSource.includes('verificationHoldingEmail'));
  assert.ok(!holdingSource.includes('searchParams'));
  assert.ok(holdingSource.includes("'/api/v1/auth/resend-verification'"));
  assert.equal((holdingSource.match(/handleResend\(/g) || []).length, 0);

  const authSource = read('src/features/auth/AuthPage.jsx');
  const onboardingSource = read('src/features/auth/OnboardingPage.jsx');
  assert.ok(authSource.includes("navigate('/verify-holding'"));
  assert.ok(!authSource.includes('verify-holding?email='));
  assert.ok(onboardingSource.includes("navigate('/verify-holding'"));
  assert.ok(!onboardingSource.includes('verify-holding?email='));
});

console.log('verification holding access tests passed');
