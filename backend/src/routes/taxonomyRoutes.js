const express = require('express');
const {
  getTaxonomyTags,
  createTaxonomyTag,
  updateTaxonomyTag,
  deleteTaxonomyTag
} = require('../controllers/taxonomyController');

// Make sure this path points directly to your auth middleware file
const auth = require('../middleware/auth'); // or '../middleware/authMiddleware'

const router = express.Router();

// Verify middleware functions exist before passing them to router.use
if (auth && auth.protect) {
  router.use(auth.protect);
}
if (auth && auth.adminOnly) {
  router.use(auth.adminOnly);
}

router.route('/')
  .get(getTaxonomyTags)
  .post(createTaxonomyTag);

router.route('/:id')
  .patch(updateTaxonomyTag)
  .delete(deleteTaxonomyTag);

module.exports = router;