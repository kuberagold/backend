const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  updateUserRole,
  toggleUserStatus,
  deleteUser
} = require('../controllers/userController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');

// All user management routes are strictly reserved for SUPERADMIN
router.use(authenticateToken, authorize(ROLES.SUPERADMIN));

router.get('/', getAllUsers);
router.put('/:id/role', updateUserRole);
router.put('/:id/toggle-status', toggleUserStatus);
router.delete('/:id', deleteUser);

module.exports = router;
