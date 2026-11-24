const express = require('express');
const router = express.Router();
const {
  getPublicBanners,
  getAllBannersAdmin,
  createBanner,
  updateBanner,
  deleteBanner
} = require('../controllers/bannerController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');

// Public route for landing page banners
router.get('/', getPublicBanners);

// Protected routes for managing banners
router.get('/admin/all', authenticateToken, authorize(ROLES.ADMIN, ROLES.SUPERADMIN), getAllBannersAdmin);
router.post('/', authenticateToken, authorize(ROLES.ADMIN, ROLES.SUPERADMIN), createBanner);
router.put('/:id', authenticateToken, authorize(ROLES.ADMIN, ROLES.SUPERADMIN), updateBanner);
router.delete('/:id', authenticateToken, authorize(ROLES.ADMIN, ROLES.SUPERADMIN), deleteBanner);

module.exports = router;
