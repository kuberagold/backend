const express = require('express');
const router = express.Router();
const {
  getAvailableSlots,
  submitInquiry,
  createAppointmentByStaff,
  getAllInquiries,
  getInquiryStats,
  updateInquiryStatus,
  deleteInquiry
} = require('../controllers/inquiryController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');

const staff = [authenticateToken, authorize(ROLES.ADMIN, ROLES.SUPERADMIN)];

// Public: free appointment slots, and the enquiry / booking form
router.get('/available-slots', getAvailableSlots);
router.post('/', submitInquiry);

// Staff: dashboard numbers, phone / walk-in bookings, list, update, delete
router.get('/stats', ...staff, getInquiryStats);
router.post('/staff-booking', ...staff, createAppointmentByStaff);
router.get('/', ...staff, getAllInquiries);
router.put('/:id', ...staff, updateInquiryStatus);
router.delete('/:id', ...staff, deleteInquiry);

module.exports = router;
