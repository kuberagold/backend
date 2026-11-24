const express = require('express');
const router = express.Router();
const { getPublicSettings, updateSettings, getBranches } = require('../controllers/settingController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');

// Public configuration
router.get('/', getPublicSettings);
router.get('/branches', getBranches);

// Settings update (SuperAdmin only)
router.put('/', authenticateToken, authorize(ROLES.SUPERADMIN), updateSettings);

module.exports = router;
