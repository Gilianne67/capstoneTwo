import assert from 'node:assert/strict';
import { buildFaqWriteBody, filterHelpArticles } from './faqHelp.js';

const articles = [
  { question: 'Student match', answer: 'student-only-answer', category: 'Matching', targetRole: 'student', isPublished: true },
  { question: 'Shared guide', answer: 'all-audience-answer', category: 'General', targetRole: 'all', isPublished: true },
  { question: 'Provider listing', answer: 'provider-only-answer', category: 'Listings', targetRole: 'provider', isPublished: true },
  { question: 'Admin procedure', answer: 'admin-only-answer', category: 'Verification', targetRole: 'admin', isPublished: true },
  { question: 'Hidden student draft', answer: 'unpublished-answer', category: 'Matching', targetRole: 'student', isPublished: false },
];

const questions = (rows) => rows.map((row) => row.question);

const studentView = filterHelpArticles(articles, { role: 'student', isAdmin: false });
assert.deepEqual(questions(studentView), ['Student match', 'Shared guide']);
assert.equal(JSON.stringify(studentView).includes('provider-only-answer'), false);
assert.equal(JSON.stringify(studentView).includes('admin-only-answer'), false);
assert.equal(JSON.stringify(studentView).includes('unpublished-answer'), false);

const providerView = filterHelpArticles(articles, { role: 'provider', isAdmin: false });
assert.deepEqual(questions(providerView), ['Shared guide', 'Provider listing']);
assert.equal(JSON.stringify(providerView).includes('student-only-answer'), false);
assert.equal(JSON.stringify(providerView).includes('unpublished-answer'), false);

const ignoredRoleQuery = filterHelpArticles(articles, {
  role: 'student',
  isAdmin: false,
  audience: 'provider',
  status: 'unpublished',
});
assert.deepEqual(questions(ignoredRoleQuery), ['Student match', 'Shared guide']);

const studentSearch = filterHelpArticles(articles, {
  role: 'student',
  isAdmin: false,
  query: 'all-audience',
});
assert.deepEqual(questions(studentSearch), ['Shared guide']);

const adminView = filterHelpArticles(articles, { role: 'admin', isAdmin: true });
assert.deepEqual(questions(adminView), questions(articles));

const unpublishedOnly = filterHelpArticles(articles, {
  role: 'admin',
  isAdmin: true,
  status: 'unpublished',
});
assert.deepEqual(questions(unpublishedOnly), ['Hidden student draft']);

const providerAudience = filterHelpArticles(articles, {
  role: 'admin',
  isAdmin: true,
  audience: 'provider',
});
assert.deepEqual(questions(providerAudience), ['Provider listing']);

const matchingCategory = filterHelpArticles(articles, {
  role: 'admin',
  isAdmin: true,
  category: 'Matching',
  query: 'draft',
});
assert.deepEqual(questions(matchingCategory), ['Hidden student draft']);

const created = buildFaqWriteBody({
  targetRole: ' provider ',
  category: '  Listings ',
  question: ' How do I publish? ',
  answer: ' Use the listing form. ',
  isPublished: false,
});
assert.equal(created.ok, true);
assert.deepEqual(created.body, {
  targetRole: 'provider',
  category: 'Listings',
  question: 'How do I publish?',
  answer: 'Use the listing form.',
  isPublished: false,
});

assert.equal(buildFaqWriteBody({
  targetRole: 'guest',
  category: 'General',
  question: 'Q',
  answer: 'A',
  isPublished: true,
}).ok, false);

assert.equal(buildFaqWriteBody({
  targetRole: 'student',
  category: '   ',
  question: 'Q',
  answer: 'A',
  isPublished: true,
}).ok, false);

assert.equal(buildFaqWriteBody({
  targetRole: 'student',
  category: 'General',
  question: 'Q',
  answer: 'A',
  isPublished: 'true',
}).ok, false);

console.log('faq help helper tests passed');
