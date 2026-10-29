const express = require('express');
const router = express.Router();
const {
  getFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
} = require('../controllers/faqController');
const { protect, authorize } = require('../middleware/auth');

const manageFaqs = authorize('admin', 'super_admin', 'superadmin');

// Portal reads use the signed-in role. Admins receive every article.
router.get('/', protect, getFAQs);

router.post('/', protect, manageFaqs, createFAQ);
router.patch('/:id', protect, manageFaqs, updateFAQ);
router.delete('/:id', protect, manageFaqs, deleteFAQ);

module.exports = router;
