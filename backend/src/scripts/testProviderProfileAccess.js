const assert = require('assert');

const Provider = require('../models/Provider');
const { getProfile } = require('../controllers/providerController');

const originalFindOne = Provider.findOne;

const mockRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

const main = async () => {
  Provider.findOne = async (query) => {
    if (String(query.userId) === 'user-a') {
      return {
        institutionName: 'Org A Foundation',
        userId: 'user-a',
        verificationStatus: 'Verified'
      };
    }
    if (String(query.userId) === 'user-b') {
      return {
        institutionName: 'Org B Foundation',
        userId: 'user-b',
        verificationStatus: 'Pending Review'
      };
    }
    return null;
  };

  const resA = mockRes();
  await getProfile({ user: { id: 'user-a' } }, resA);
  assert.equal(resA.statusCode, 200);
  assert.equal(resA.body.success, true);
  assert.equal(resA.body.provider.institutionName, 'Org A Foundation');

  const resB = mockRes();
  await getProfile({ user: { id: 'user-b' } }, resB);
  assert.equal(resB.statusCode, 200);
  assert.equal(resB.body.provider.institutionName, 'Org B Foundation');
  assert.notEqual(resB.body.provider.institutionName, resA.body.provider.institutionName);

  const resMissing = mockRes();
  await getProfile({ user: { id: 'user-c' } }, resMissing);
  assert.equal(resMissing.statusCode, 404);
  assert.equal(resMissing.body.success, false);

  console.log('provider profile access tests passed');
};

main()
  .then(() => {
    Provider.findOne = originalFindOne;
    process.exit(0);
  })
  .catch((error) => {
    Provider.findOne = originalFindOne;
    console.error(error);
    process.exit(1);
  });
