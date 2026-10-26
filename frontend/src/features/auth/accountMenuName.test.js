import assert from 'node:assert/strict';
import { resolveAccountMenuInitial, resolveAccountMenuName } from './accountMenuName.js';

const check = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

check('student account menu uses the authenticated user name', () => {
  assert.equal(
    resolveAccountMenuName({ role: 'student', name: 'Ava Santos' }),
    'Ava Santos'
  );
  assert.equal(resolveAccountMenuInitial('Ava Santos'), 'A');
});

check('provider account menu uses the representative name when present', () => {
  assert.equal(
    resolveAccountMenuName({
      role: 'provider',
      name: 'Enhanced Provider',
      representativeName: 'Gilianne Rose',
    }),
    'Gilianne Rose'
  );
});

check('updating a provider user with a representative name changes the account menu', () => {
  const session = {
    role: 'provider',
    name: 'Enhanced Provider',
    representativeName: '',
  };
  assert.equal(resolveAccountMenuName(session), 'Enhanced Provider');
  session.representativeName = 'Gilianne Rose';
  assert.equal(resolveAccountMenuName(session), 'Gilianne Rose');
});

check('admin account menu uses the authenticated user name', () => {
  assert.equal(
    resolveAccountMenuName({ role: 'admin', name: 'Review Admin' }),
    'Review Admin'
  );
});

check('provider account menu falls back to the user name before a representative exists', () => {
  assert.equal(
    resolveAccountMenuName({
      role: 'provider',
      name: 'Enhanced Provider',
      representativeName: '',
    }),
    'Enhanced Provider'
  );
  assert.equal(
    resolveAccountMenuName({
      role: 'provider',
      name: 'Enhanced Provider',
    }),
    'Enhanced Provider'
  );
});

check('missing names fall back to User without using organization fields', () => {
  assert.equal(resolveAccountMenuName(null), 'User');
  assert.equal(
    resolveAccountMenuName({
      role: 'provider',
      organization: 'Enhanced Provider',
    }),
    'User'
  );
  assert.equal(resolveAccountMenuInitial('User'), 'U');
});

console.log('\n6 account menu name checks passed');
