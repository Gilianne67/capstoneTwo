const FAQ = require('../models/FAQ');
const { canonicalRole } = require('../middleware/auth');

const PUBLIC_FAQ_ROLES = new Set(['student', 'provider']);

// @desc    Get published FAQs. Admin articles require an authenticated admin.
// @route   GET /api/v1/faqs?role=student
// @access  Public for student and provider articles. Private for admin articles.
exports.getFAQs = async (req, res) => {
  try {
    const requested = typeof req.query.role === 'string' ? req.query.role : 'student';
    const callerRole = canonicalRole(req.user && req.user.role);
    const callerIsAdmin = callerRole === 'admin' || callerRole === 'superadmin';

    if (requested === 'admin' && !callerIsAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin help articles require an administrator account.',
      });
    }

    const targetRole = requested === 'admin'
      ? 'admin'
      : (PUBLIC_FAQ_ROLES.has(requested) ? requested : 'student');

    const faqs = await FAQ.find({
      isPublished: true,
      targetRole: { $in: [targetRole, 'all'] },
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: faqs.length,
      faqs,
    });
  } catch (error) {
    console.error('❌ Get FAQs Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new FAQ article with targetRole
// @route   POST /api/v1/admin/faqs
// @access  Private/Admin
exports.createFAQ = async (req, res) => {
  try {
    const { targetRole, category, question, answer } = req.body;

    if (!category || !question || !answer) {
      return res.status(400).json({ success: false, message: 'Category, question, and answer are required.' });
    }

    const faq = await FAQ.create({
      targetRole: targetRole || 'all',
      category,
      question,
      answer,
      createdBy: req.user._id || req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'FAQ article created successfully',
      faq,
    });
  } catch (error) {
    console.error('❌ Create FAQ Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete an FAQ article
// @route   DELETE /api/v1/admin/faqs/:id
// @access  Private/Admin
exports.deleteFAQ = async (req, res) => {
  try {
    const faq = await FAQ.findById(req.params.id);
    if (!faq) {
      return res.status(404).json({ success: false, message: 'FAQ article not found.' });
    }

    await faq.deleteOne();

    res.status(200).json({
      success: true,
      message: 'FAQ article deleted successfully',
    });
  } catch (error) {
    console.error('❌ Delete FAQ Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};