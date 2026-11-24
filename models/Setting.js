const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    siteName: {
      type: String,
      default: 'KuberaGold Exchange'
    },
    tagLine: {
      type: String,
      default: 'Trusted Gold Buying, Selling & Instant Exchange'
    },
    contactEmail: {
      type: String,
      default: 'support@kuberagold.com'
    },
    contactPhone: {
      type: String,
      default: '+91 98765 43210'
    },
    address: {
      type: String,
      default: 'Gold Souk Arcade, Jewelry Street, Mumbai, India'
    },
    logoUrl: {
      type: String,
      default: '/logo.png'
    },
    socialLinks: {
      facebook: { type: String, default: 'https://facebook.com' },
      instagram: { type: String, default: 'https://instagram.com' },
      twitter: { type: String, default: 'https://twitter.com' },
      whatsapp: { type: String, default: 'https://wa.me/919876543210' }
    },
    defaultCurrency: {
      type: String,
      default: 'INR'
    },
    exchangeCommissionPercentage: {
      type: Number,
      default: 1.5
    },
    marqueeNotice: {
      type: String,
      default: '⚡ Live Gold & Silver Rates Updated Daily. Visit our store or book online consultation for instant cash on gold!'
    },
    disclaimer: {
      type: String,
      default: 'Gold rates are subject to real-time market fluctuations and local statutory taxes/making charges.'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Setting', settingSchema);
