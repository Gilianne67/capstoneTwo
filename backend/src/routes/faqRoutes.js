const express = require('express');
const router = express.Router();
const { getFAQs, createFAQ, deleteFAQ } = require('../controllers/faqController');
const { protect, authorize } = require('../middleware/auth');

const attachUserIfPresent = (req, res, next) => {
  const header = req.headers.authorization;
  const hasBearer = typeof header === 'string' && header.startsWith('Bearer ') && header.slice(7).trim();
  const hasCookie = Boolean(req.cookies && req.cookies.token);
  if (!hasBearer && !hasCookie) return next();
  return protect(req, res, next);
};

// GET /api/v1/faqs?role=student
router.get('/', attachUserIfPresent, getFAQs);

// POST /api/v1/faqs (Admin creates FAQ)
router.post('/', protect, authorize('admin', 'super_admin', 'superadmin'), createFAQ);

// DELETE /api/v1/faqs/:id (Admin deletes FAQ)
router.delete('/:id', protect, authorize('admin', 'super_admin', 'superadmin'), deleteFAQ);

module.exports = router;