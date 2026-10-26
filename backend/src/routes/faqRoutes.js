const express = require('express');
const router = express.Router();
const { getFAQs, createFAQ, deleteFAQ } = require('../controllers/faqController');
const { protect, authorize } = require('../middleware/auth');

// GET /api/v1/faqs?role=student
router.get('/', getFAQs);

// POST /api/v1/faqs (Admin creates FAQ)
router.post('/', protect, authorize('admin', 'super_admin', 'superadmin'), createFAQ);

// DELETE /api/v1/faqs/:id (Admin deletes FAQ)
router.delete('/:id', protect, authorize('admin', 'super_admin', 'superadmin'), deleteFAQ);

module.exports = router;