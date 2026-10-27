const express = require('express');
const {
  getTaxonomyTags,
  createTaxonomyTag,
  updateTaxonomyTag,
  deleteTaxonomyTag
} = require('../controllers/taxonomyController');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(getTaxonomyTags) // Public read access
  .post(protect, authorize('admin', 'super_admin'), createTaxonomyTag); // Admin only

router.route('/:id')
  .patch(protect, authorize('admin', 'super_admin'), updateTaxonomyTag)
  .delete(protect, authorize('admin', 'super_admin'), deleteTaxonomyTag);

module.exports = router;