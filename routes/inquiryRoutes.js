const express = require('express');
const router = express.Router();
const {
  submitInquiry,
  getAllInquiries,
  updateInquiryStatus,
  deleteInquiry
} = require('../controllers/inquiryController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');

// Public inquiry submission (Guests)
router.post('/', submitInquiry);

// Protected inquiry management
router.get('/', authenticateToken, authorize(ROLES.ADMIN, ROLES.SUPERADMIN), getAllInquiries);
router.put('/:id', authenticateToken, authorize(ROLES.ADMIN, ROLES.SUPERADMIN), updateInquiryStatus);
router.delete('/:id', authenticateToken, authorize(ROLES.ADMIN, ROLES.SUPERADMIN), deleteInquiry);

module.exports = router;
