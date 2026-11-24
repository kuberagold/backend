const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const goldRateRoutes = require('./goldRateRoutes');
const bannerRoutes = require('./bannerRoutes');
const blogRoutes = require('./blogRoutes');
const inquiryRoutes = require('./inquiryRoutes');
const userRoutes = require('./userRoutes');
const settingRoutes = require('./settingRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/gold-rates', goldRateRoutes);
router.use('/banners', bannerRoutes);
router.use('/blogs', blogRoutes);
router.use('/inquiries', inquiryRoutes);
router.use('/users', userRoutes);
router.use('/settings', settingRoutes);

module.exports = router;
