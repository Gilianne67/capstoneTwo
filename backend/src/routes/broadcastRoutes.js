const express = require('express');
const router = express.Router();
const { 
  getBroadcasts, 
  createBroadcast, 
  revokeBroadcast 
} = require('../controllers/broadcastController');
const { protect, authorize } = require('../middleware/auth');

// Protect all broadcast routes & restrict to admin / super_admin
router.use(protect, authorize('admin', 'super_admin'));

router.route('/broadcasts')
  .get(getBroadcasts);

router.route('/broadcast')
  .post(createBroadcast);

router.route('/broadcast/:id')
  .delete(revokeBroadcast);

module.exports = router;