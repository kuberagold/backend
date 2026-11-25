const express = require('express');
const router = express.Router();
const {
  getBranches,
  getAllBranchesAdmin,
  createBranch,
  updateBranch,
  deleteBranch
} = require('../controllers/branchController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');

const staff = [authenticateToken, authorize(ROLES.ADMIN, ROLES.SUPERADMIN)];

router.get('/', getBranches);
router.get('/admin/all', ...staff, getAllBranchesAdmin);
router.post('/', ...staff, createBranch);
router.put('/:id', ...staff, updateBranch);
router.delete('/:id', ...staff, deleteBranch);

module.exports = router;
