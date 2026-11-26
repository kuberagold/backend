const express = require('express');
const router = express.Router();
const {
  MAX_BYTES,
  getActiveNotices,
  getNoticeFile,
  getAllNotices,
  uploadNoticeFile,
  createNotice,
  updateNotice,
  deleteNotice,
} = require('../controllers/noticeController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');

const staff = [authenticateToken, authorize(ROLES.ADMIN, ROLES.SUPERADMIN)];

// Public: notices to show now, and their files
router.get('/active', getActiveNotices);
router.get('/file/:fileId', getNoticeFile);

// Staff
router.get('/', ...staff, getAllNotices);
router.post(
  '/upload',
  ...staff,
  // Raw file bytes, whatever the type; the server checks what the file really is
  express.raw({ type: () => true, limit: MAX_BYTES }),
  uploadNoticeFile
);
router.post('/', ...staff, createNotice);
router.put('/:id', ...staff, updateNotice);
router.delete('/:id', ...staff, deleteNotice);

module.exports = router;
