const express = require('express');
const router = express.Router();
const {
  getPublicBlogs,
  getBlogBySlug,
  getAllBlogsAdmin,
  createBlog,
  updateBlog,
  deleteBlog
} = require('../controllers/blogController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');

// Public routes
router.get('/', getPublicBlogs);
router.get('/article/:slug', getBlogBySlug);

// Admin / SuperAdmin management routes
router.get('/admin/all', authenticateToken, authorize(ROLES.ADMIN, ROLES.SUPERADMIN), getAllBlogsAdmin);
router.post('/', authenticateToken, authorize(ROLES.ADMIN, ROLES.SUPERADMIN), createBlog);
router.put('/:id', authenticateToken, authorize(ROLES.ADMIN, ROLES.SUPERADMIN), updateBlog);
router.delete('/:id', authenticateToken, authorize(ROLES.ADMIN, ROLES.SUPERADMIN), deleteBlog);

module.exports = router;
