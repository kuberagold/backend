const express = require('express');
const router = express.Router();
const {
  getLatestRates,
  getRateHistory,
  updateDailyRate,
  calculateExchangeValue
} = require('../controllers/goldRateController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');

// Public endpoints
router.get('/latest', getLatestRates);
router.get('/history', getRateHistory);
router.post('/calculate', calculateExchangeValue);

// Daily gold price update - restricted to Admin and SuperAdmin
router.post(
  '/daily-update',
  authenticateToken,
  authorize(ROLES.ADMIN, ROLES.SUPERADMIN),
  updateDailyRate
);

module.exports = router;
