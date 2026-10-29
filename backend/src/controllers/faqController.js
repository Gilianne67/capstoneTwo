const mongoose = require('mongoose');
const FAQ = require('../models/FAQ');
const { canonicalRole, isAdminRole } = require('../middleware/auth');

const AUDIENCES = new Set(['student', 'provider', 'admin', 'all']);

const isFaqId = (value) => (
  typeof value === 'string'
  && /^[a-fA-F0-9]{24}$/.test(value)
  && mongoose.Types.ObjectId.isValid(value)
);

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeAudience = (value) => {
  if (typeof value !== 'string') return null;
  const audience = value.trim();
  return AUDIENCES.has(audience) ? audience : null;
};

const serializeFaq = (faq) => ({
  _id: faq._id,
  targetRole: faq.targetRole,
  category: faq.category,
  question: faq.question,
  answer: faq.answer,
  isPublished: Boolean(faq.isPublished),
  createdBy: faq.createdBy,
  createdAt: faq.createdAt,
  updatedAt: faq.updatedAt,
});

const rejectUnlessManager = (req, res) => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Please log in to continue.' });
    return false;
  }
  if (!isAdminRole(req.user.role)) {
    res.status(403).json({
      success: false,
      message: 'You do not have permission to manage help articles.',
    });
    return false;
  }
  return true;
};

const portalFilter = (role) => ({
  isPublished: true,
  targetRole: { $in: [role, 'all'] },
});

// Audience comes from the signed-in account. The role query is ignored so a
// student or provider cannot request another portal's articles.
async function getFAQs(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Please log in to continue.' });
    }

    const role = canonicalRole(req.user.role);
    let filter;
    if (isAdminRole(role)) {
      filter = {};
    } else if (role === 'student' || role === 'provider') {
      filter = portalFilter(role);
    } else {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view help articles.',
      });
    }

    const faqs = await FAQ.find(filter).sort({ createdAt: -1 });
    const list = (Array.isArray(faqs) ? faqs : []).map(serializeFaq);

    return res.status(200).json({
      success: true,
      count: list.length,
      faqs: list,
    });
  } catch (error) {
    console.error('Get FAQs Error:', error);
    return res.status(500).json({ success: false, message: 'Unable to load help articles.' });
  }
}

async function createFAQ(req, res) {
  try {
    if (!rejectUnlessManager(req, res)) return;

    const body = req.body || {};
    const category = cleanText(body.category);
    const question = cleanText(body.question);
    const answer = cleanText(body.answer);
    const targetRole = normalizeAudience(body.targetRole);
    const createdBy = req.user._id || req.user.id;

    if (!category || !question || !answer) {
      return res.status(400).json({
        success: false,
        message: 'Category, question, and answer are required.',
      });
    }
    if (!targetRole) {
      return res.status(400).json({
        success: false,
        message: 'Audience must be student, provider, admin, or all.',
      });
    }
    if (body.isPublished !== undefined && typeof body.isPublished !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Publication status must be true or false.',
      });
    }
    if (!createdBy) {
      return res.status(401).json({ success: false, message: 'Please log in to continue.' });
    }

    const faq = await FAQ.create({
      targetRole,
      category,
      question,
      answer,
      isPublished: body.isPublished === undefined ? true : body.isPublished,
      createdBy,
    });

    return res.status(201).json({
      success: true,
      message: 'FAQ article created successfully',
      faq: serializeFaq(faq),
    });
  } catch (error) {
    console.error('Create FAQ Error:', error);
    return res.status(500).json({ success: false, message: 'Unable to create the help article.' });
  }
}

async function updateFAQ(req, res) {
  try {
    if (!rejectUnlessManager(req, res)) return;

    const id = typeof req.params?.id === 'string' ? req.params.id : '';
    if (!isFaqId(id)) {
      return res.status(400).json({ success: false, message: 'A valid FAQ id is required.' });
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ success: false, message: 'Request body is required.' });
    }

    const changes = {};
    if (Object.prototype.hasOwnProperty.call(body, 'targetRole')) {
      const targetRole = normalizeAudience(body.targetRole);
      if (!targetRole) {
        return res.status(400).json({
          success: false,
          message: 'Audience must be student, provider, admin, or all.',
        });
      }
      changes.targetRole = targetRole;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'category')) {
      const category = cleanText(body.category);
      if (!category) {
        return res.status(400).json({ success: false, message: 'Category is required.' });
      }
      changes.category = category;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'question')) {
      const question = cleanText(body.question);
      if (!question) {
        return res.status(400).json({ success: false, message: 'Question is required.' });
      }
      changes.question = question;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'answer')) {
      const answer = cleanText(body.answer);
      if (!answer) {
        return res.status(400).json({ success: false, message: 'Answer is required.' });
      }
      changes.answer = answer;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'isPublished')) {
      if (typeof body.isPublished !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Publication status must be true or false.',
        });
      }
      changes.isPublished = body.isPublished;
    }

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ success: false, message: 'No FAQ changes were provided.' });
    }

    const faq = await FAQ.findById(id);
    if (!faq) {
      return res.status(404).json({ success: false, message: 'FAQ article not found.' });
    }

    Object.assign(faq, changes);
    await faq.save();

    return res.status(200).json({
      success: true,
      message: 'FAQ article updated successfully',
      faq: serializeFaq(faq),
    });
  } catch (error) {
    console.error('Update FAQ Error:', error);
    return res.status(500).json({ success: false, message: 'Unable to update the help article.' });
  }
}

async function deleteFAQ(req, res) {
  try {
    if (!rejectUnlessManager(req, res)) return;

    const id = typeof req.params?.id === 'string' ? req.params.id : '';
    if (!isFaqId(id)) {
      return res.status(400).json({ success: false, message: 'A valid FAQ id is required.' });
    }

    const faq = await FAQ.findById(id);
    if (!faq) {
      return res.status(404).json({ success: false, message: 'FAQ article not found.' });
    }

    await faq.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'FAQ article deleted successfully',
    });
  } catch (error) {
    console.error('Delete FAQ Error:', error);
    return res.status(500).json({ success: false, message: 'Unable to delete the help article.' });
  }
}

module.exports = {
  getFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
};
