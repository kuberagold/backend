const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const goldRateRoutes = require('./goldRateRoutes');
const bannerRoutes = require('./bannerRoutes');
const blogRoutes = require('./blogRoutes');
const inquiryRoutes = require('./inquiryRoutes');
const userRoutes = require('./userRoutes');
const settingRoutes = require('./settingRoutes');
const branchRoutes = require('./branchRoutes');
const noticeRoutes = require('./noticeRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/gold-rates', goldRateRoutes);
router.use('/banners', bannerRoutes);
router.use('/blogs', blogRoutes);
router.use('/inquiries', inquiryRoutes);
router.use('/users', userRoutes);
router.use('/settings', settingRoutes);
router.use('/branches', branchRoutes);
router.use('/notices', noticeRoutes);

module.exports = router;
