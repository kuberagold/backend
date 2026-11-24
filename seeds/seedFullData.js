require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const GoldRate = require('../models/GoldRate');
const Banner = require('../models/Banner');
const Blog = require('../models/Blog');
const Setting = require('../models/Setting');
const memoryStore = require('../utils/memoryStore');
const { ROLES } = require('../config/roles');

const seedMongo = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kuberagold';
    await mongoose.connect(mongoUri);
    console.log('[Seed] Connected to MongoDB');

    // 1. Users
    await User.deleteMany({});
    const superadmin = await User.create({
      name: 'Super Administrator',
      email: 'superadmin@kuberagold.com',
      password: 'Admin@123456',
      phone: '+977 98510 00001',
      role: ROLES.SUPERADMIN
    });

    const admin = await User.create({
      name: 'Central Counter Admin',
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
    console.log('[Seed] 3 Users created (superadmin, admin, guest)');

    // 2. Settings
    await Setting.deleteMany({});
    await Setting.create({
      siteName: memoryStore.settings.siteName,
      tagLine: memoryStore.settings.tagLine,
      contactEmail: memoryStore.settings.contactEmail,
      contactPhone: memoryStore.settings.contactPhone,
      address: memoryStore.settings.address,
      logoUrl: memoryStore.settings.logoUrl,
      defaultCurrency: memoryStore.settings.defaultCurrency,
      exchangeCommissionPercentage: memoryStore.settings.exchangeCommissionPercentage,
      marqueeNotice: memoryStore.settings.marqueeNotice,
      disclaimer: memoryStore.settings.disclaimer
    });
    console.log('[Seed] Settings created');

    // 3. Banners
    await Banner.deleteMany({});
    const bannersToInsert = memoryStore.banners.map(b => ({
      title: b.title,
      subtitle: b.subtitle,
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl,
      isActive: b.isActive,
      displayOrder: b.displayOrder,
      badgeText: b.badgeText
    }));
    await Banner.insertMany(bannersToInsert);
    console.log(`[Seed] ${bannersToInsert.length} Banners inserted`);

    // 4. Blogs
    await Blog.deleteMany({});
    const blogsToInsert = memoryStore.blogs.map(b => ({
      title: b.title,
      slug: b.slug,
      excerpt: b.excerpt,
      content: b.content,
      coverImage: b.coverImage,
      category: b.category,
      tags: b.tags,
      author: superadmin._id,
      publishedAt: b.publishedAt || new Date(),
      isPublished: true,
      readTime: b.readTime || 5
    }));
    await Blog.insertMany(blogsToInsert);
    console.log(`[Seed] ${blogsToInsert.length} Blogs inserted`);

    // 5. Gold Rates (366 records)
    await GoldRate.deleteMany({});
    const ratesToInsert = memoryStore.goldRates.map((r, index) => ({
      rateDate: new Date(r.rateDate),
      currency: r.currency || 'NPR',
      rates: r.rates.map(item => ({
        carat: item.carat,
        purity: item.purity,
        buyRatePerGram: item.buyRatePerGram,
        sellRatePerGram: item.sellRatePerGram,
        buyRatePerTola: item.buyRatePerTola,
        sellRatePerTola: item.sellRatePerTola
      })),
      silverRatePerGram: r.silverRatePerGram,
      silverRatePerKg: r.silverRatePerKg,
      marketTrend: r.marketTrend,
      changePercentage: r.changePercentage,
      changeValue: r.changeValue,
      notes: r.notes,
      isCurrent: index === memoryStore.goldRates.length - 1,
      updatedBy: superadmin._id
    }));
    await GoldRate.insertMany(ratesToInsert);
    console.log(`[Seed] ${ratesToInsert.length} Daily Gold Rates seeded into MongoDB`);

    console.log('✅ All MongoDB data seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error:', error);
    process.exit(1);
  }
};

seedMongo();
