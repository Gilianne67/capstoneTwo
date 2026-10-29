const assert = require('assert');
const { buildAdminInvitationUrl } = require('../utils/invitationLink');

const token = 'abc123token';

const clientUrl = buildAdminInvitationUrl(token, {
  NODE_ENV: 'development',
  CLIENT_URL: 'https://students.example/',
  FRONTEND_URL: 'https://frontend.example',
});
assert.equal(clientUrl.ok, true);
assert.equal(clientUrl.url, `https://students.example/reset-password/${token}`);
assert.equal(clientUrl.url.includes('localhost'), false);

const frontendUrl = buildAdminInvitationUrl(token, {
  NODE_ENV: 'development',
  CLIENT_URL: '',
  FRONTEND_URL: 'https://frontend.example/',
});
assert.equal(frontendUrl.ok, true);
assert.equal(frontendUrl.url, `https://frontend.example/reset-password/${token}`);

const localDevelopment = buildAdminInvitationUrl(token, {
  NODE_ENV: 'development',
  CLIENT_URL: '',
  FRONTEND_URL: '',
});
assert.equal(localDevelopment.ok, true);
assert.equal(localDevelopment.url, `http://localhost:5173/reset-password/${token}`);

const productionSkipsLocalhost = buildAdminInvitationUrl(token, {
  NODE_ENV: 'production',
  CLIENT_URL: 'http://localhost:5173',
  FRONTEND_URL: 'https://app.example',
});
assert.equal(productionSkipsLocalhost.ok, true);
assert.equal(productionSkipsLocalhost.url, `https://app.example/reset-password/${token}`);
assert.equal(productionSkipsLocalhost.url.includes('localhost'), false);

const productionWithoutPublicUrl = buildAdminInvitationUrl(token, {
  NODE_ENV: 'production',
  CLIENT_URL: 'http://127.0.0.1:5173',
  FRONTEND_URL: '',
});
assert.equal(productionWithoutPublicUrl.ok, false);
assert.equal(productionWithoutPublicUrl.reason, 'localhost');
assert.equal(Object.prototype.hasOwnProperty.call(productionWithoutPublicUrl, 'url'), false);

const missingProductionUrl = buildAdminInvitationUrl(token, {
  NODE_ENV: 'production',
  CLIENT_URL: '',
  FRONTEND_URL: '',
});
assert.equal(missingProductionUrl.ok, false);
assert.equal(missingProductionUrl.reason, 'missing');

console.log('invitation link tests passed');
