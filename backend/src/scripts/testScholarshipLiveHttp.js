const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Provider = require('../models/Provider');
const Scholarship = require('../models/Scholarship');
const {
  isElasticsearchEnabled,
  getElasticsearchIndex
} = require('../config/elasticsearch');
const { searchScholarships, removeScholarship } = require('../services/scholarshipSearchService');
const { manilaCalendarDate } = require('../utils/scholarshipInputValidation');

const API = process.env.SCHOLARSHIP_LIVE_API || 'http://localhost:5000/api/v1';
const MARKER = `__QA_LIVE_HTTP__${Date.now()}`;

const listingBody = (overrides = {}) => ({
  name: `${MARKER} Live HTTP Grant`,
  scholarshipType: 'Merit-Based',
  description: 'Temporary QA listing for live HTTP authorization and search checks.',
  grantValue: '18000',
  deadline: '2026-12-31',
  applicationURL: 'https://qa.example.com/apply',
  academicRequirements: [
    {
      gradingScale: '1.00-5.00',
      minimumGPA: 2.5
    }
  ],
  hardFilters: {
    academicLevel: 'College',
    courseProgram: ['BS Information Technology'],
    citizenshipStatus: 'Filipino',
    geographicLocation: {
      scope: 'Nationwide',
      regions: [],
      provinces: [],
      municipalities: []
    }
  },
  criteriaWeights: {
    gwaWeight: 0.4,
    incomeWeight: 0.4,
    tagsWeight: 0.2
  },
  rankingMode: 'Weighted',
  ...overrides
});

const request = async (method, route, { token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return { status: response.status, body: payload };
};

const pingApi = async () => {
  try {
    const response = await fetch(`${API}/health`, { signal: AbortSignal.timeout(4000) });
    return response.ok;
  } catch {
    return false;
  }
};

const connectMongo = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set');
  }

  await mongoose.connect(uri, {
    dbName: 'scholarship_matching_db',
    serverSelectionTimeoutMS: 4000
  });
};

const makeUser = async ({ role, emailName, verified = true, status = 'active' }) => {
  const user = await User.create({
    name: `${MARKER} ${emailName}`,
    email: `qa.livehttp.${emailName}.${Date.now()}@example.com`,
    password: 'Secret1',
    role,
    status,
    isOnboarded: true,
    isVerified: verified
  });

  let provider = null;
  if (role === 'provider') {
    provider = await Provider.create({
      userId: user._id,
      institutionName: `${MARKER} ${emailName} Foundation`,
      institutionType: 'Non-Profit / NGO',
      verificationStatus: verified ? 'Verified' : 'Pending Review'
    });
  }

  return {
    user,
    provider,
    token: user.getSignedJwtToken()
  };
};

const cleanup = async (ids) => {
  if (ids.scholarshipIds.length) {
    await Scholarship.deleteMany({ _id: { $in: ids.scholarshipIds } });
  }
  await Scholarship.deleteMany({ name: new RegExp(`^${MARKER}`) });
  if (ids.providerIds.length) {
    await Provider.deleteMany({ _id: { $in: ids.providerIds } });
  }
  if (ids.userIds.length) {
    await User.deleteMany({ _id: { $in: ids.userIds } });
  }
};

const main = async () => {
  const apiUp = await pingApi();
  if (!apiUp) {
    console.log(`scholarship live HTTP tests skipped: ${API}/health is unreachable`);
    return;
  }

  await connectMongo();

  const ids = {
    userIds: [],
    providerIds: [],
    scholarshipIds: []
  };

  try {
    const owner = await makeUser({ role: 'provider', emailName: 'owner', verified: true });
    const other = await makeUser({ role: 'provider', emailName: 'other', verified: true });
    const pending = await makeUser({ role: 'provider', emailName: 'pending', verified: false });
    const student = await makeUser({ role: 'student', emailName: 'student', verified: true });
    ids.userIds.push(owner.user._id, other.user._id, pending.user._id, student.user._id);
    ids.providerIds.push(owner.provider._id, other.provider._id, pending.provider._id);

    const noTokenCreate = await request('POST', '/scholarships', { body: listingBody() });
    assert.equal(noTokenCreate.status, 401);

    const noTokenUpdate = await request('PUT', '/scholarships/000000000000000000000000', {
      body: { description: 'no token' }
    });
    assert.equal(noTokenUpdate.status, 401);

    const studentCreate = await request('POST', '/scholarships', {
      token: student.token,
      body: listingBody()
    });
    assert.equal(studentCreate.status, 403);

    const studentUpdate = await request('PUT', '/scholarships/000000000000000000000000', {
      token: student.token,
      body: { description: 'student edit' }
    });
    assert.equal(studentUpdate.status, 403);

    const studentArchive = await request('PATCH', '/scholarships/000000000000000000000000/archive', {
      token: student.token
    });
    assert.equal(studentArchive.status, 403);

    const pendingCreate = await request('POST', '/scholarships', {
      token: pending.token,
      body: listingBody()
    });
    assert.equal(pendingCreate.status, 403);
    assert.match(pendingCreate.body.message, /Only verified providers/);

    const createRes = await request('POST', '/scholarships', {
      token: owner.token,
      body: listingBody()
    });
    assert.equal(createRes.status, 201, createRes.body && createRes.body.message);
    assert.equal(createRes.body.success, true);
    const createdId = String(createRes.body.scholarship._id);
    ids.scholarshipIds.push(createdId);
    assert.equal(createRes.body.synchronized, undefined);

    const persisted = await Scholarship.findById(createdId);
    assert.ok(persisted);
    assert.equal(manilaCalendarDate(persisted.deadline), '2026-12-31');

    const hijack = await request('PUT', `/scholarships/${createdId}`, {
      token: other.token,
      body: { description: 'Hijacked over HTTP' }
    });
    assert.equal(hijack.status, 404);

    const hijackArchive = await request('PATCH', `/scholarships/${createdId}/archive`, {
      token: other.token
    });
    assert.equal(hijackArchive.status, 404);

    const updateRes = await request('PUT', `/scholarships/${createdId}`, {
      token: owner.token,
      body: { description: 'Updated over live HTTP.' }
    });
    assert.equal(updateRes.status, 200, updateRes.body && updateRes.body.message);
    const updated = await Scholarship.findById(createdId);
    assert.equal(updated.description, 'Updated over live HTTP.');

    let searchResult = { configured: isElasticsearchEnabled(), indexed: false, searchable: false };
    if (searchResult.configured) {
      try {
        let found = { hits: [] };
        for (let attempt = 0; attempt < 4; attempt += 1) {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          found = await searchScholarships({
            query: 'Live HTTP Grant',
            academicLevel: 'College',
            size: 20
          });
          if ((found.hits || []).some((hit) => String(hit.id) === createdId)) {
            break;
          }
        }
        searchResult.searchable = (found.hits || []).some(
          (hit) => String(hit.id) === createdId || String(hit.name || '').includes(MARKER)
        );
        searchResult.indexed = searchResult.searchable;
        searchResult.total = found.total;
        searchResult.index = getElasticsearchIndex();
      } catch (error) {
        searchResult.error = error.code || error.message;
      }
    }

    console.log(
      JSON.stringify(
        {
          liveHttp: 'passed',
          elasticsearch: searchResult,
          createdId
        },
        null,
        2
      )
    );
  } finally {
    try {
      if (ids.scholarshipIds.length && isElasticsearchEnabled()) {
        await Promise.all(
          ids.scholarshipIds.map((id) => removeScholarship(id).catch(() => {}))
        );
      }
      await cleanup(ids);
    } catch (cleanupError) {
      console.error('Failed to clean up live HTTP QA records:', cleanupError);
    }
    await mongoose.disconnect();
  }
};

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error(disconnectError);
    }
    process.exit(1);
  });
