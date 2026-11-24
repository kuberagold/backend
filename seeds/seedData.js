require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const GoldRate = require('../models/GoldRate');
const Banner = require('../models/Banner');
const Blog = require('../models/Blog');
const Setting = require('../models/Setting');
const { ROLES } = require('../config/roles');
const { CONVERSIONS } = require('../config/constants');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kuberagold';
    await mongoose.connect(mongoUri);
    console.log('[Seed] Connected to database');

    await User.deleteMany({});
    await GoldRate.deleteMany({});
    await Banner.deleteMany({});
    await Blog.deleteMany({});
    await Setting.deleteMany({});
    console.log('[Seed] Cleared existing data');

    const superadmin = await User.create({
      name: 'Super Administrator',
      email: 'superadmin@kuberagold.com',
      password: 'Admin@123456',
      phone: '+977 98510 00001',
      role: ROLES.SUPERADMIN
    });

    const admin = await User.create({
      name: 'New Road Counter Desk',
      email: 'admin@kuberagold.com',
      password: 'Admin@123456',
      phone: '+977 98510 00002',
      role: ROLES.ADMIN
    });

    const guest = await User.create({
      name: 'Ram Bahadur Shrestha',
      email: 'guest@kuberagold.com',
      password: 'Guest@123456',
      phone: '+977 98412 34567',
      role: ROLES.GUEST
    });

    // Nepal Gold Rates
    const initialRates = [
      {
        carat: '24K',
        purity: '99.9% (Chhapawal Fine)',
        buyRatePerGram: 14450,
        sellRatePerGram: 14700,
        buyRatePerTola: Math.round(14450 * CONVERSIONS.tolaToGrams),
        sellRatePerTola: Math.round(14700 * CONVERSIONS.tolaToGrams)
      },
      {
        carat: '22K',
        purity: '91.6% (Tejabi Hallmark)',
        buyRatePerGram: 13800,
        sellRatePerGram: 14050,
        buyRatePerTola: Math.round(13800 * CONVERSIONS.tolaToGrams),
        sellRatePerTola: Math.round(14050 * CONVERSIONS.tolaToGrams)
      },
      {
        carat: '18K',
        purity: '75.0% Fine Ornaments',
        buyRatePerGram: 11200,
        sellRatePerGram: 11450,
        buyRatePerTola: Math.round(11200 * CONVERSIONS.tolaToGrams),
        sellRatePerTola: Math.round(11450 * CONVERSIONS.tolaToGrams)
      }
    ];

    await GoldRate.create({
      rateDate: new Date(),
      currency: 'NPR',
      rates: initialRates,
      silverRatePerGram: 185,
      silverRatePerKg: 185000,
      marketTrend: 'up',
      changePercentage: 0.65,
      changeValue: 1100,
      notes: 'Federation of Nepal Gold and Silver Dealers Association (FENEGOSIDA) Reference Benchmark',
      isCurrent: true,
      updatedBy: superadmin._id
    });

    await Setting.create({
      siteName: 'Kubera Gold Exchange',
      tagLine: 'Exact Purity. Maximum Value. (Kathmandu, Nepal)',
      contactEmail: 'info@kuberagoldnepal.com',
      contactPhone: '+977 1 4256789 / 98510 12345',
      address: 'Dharmapath, New Road (Opposite Bishal Bazaar), Kathmandu, Nepal',
      logoUrl: '/logo.jpg',
      defaultCurrency: 'NPR',
      exchangeCommissionPercentage: 1.5,
      marqueeNotice: '⚡ Nepal Bullion Benchmark (FENEGOSIDA): 24K Chhapawal @ Rs. 1,68,500/tola | 22K Tejabi @ Rs. 1,61,000/tola | Silver 999 @ Rs. 2,150/tola • Visit New Road Counter for Instant Cash Payout!',
      disclaimer: 'Daily gold and silver rates adhere strictly to prevailing Federation of Nepal Gold and Silver Dealers Association (FENEGOSIDA) benchmarks.'
    });

    console.log('✅ Nepal Bullion seed data saved successfully in English!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error:', error);
    process.exit(1);
  }
};

seedData();
