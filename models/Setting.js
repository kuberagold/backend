const mongoose = require('mongoose');

// One document holds the site-wide settings managed from SuperAdmin > System Settings.
// Defaults are only the first-run values; everything here is editable in the admin panel.
const settingSchema = new mongoose.Schema(
  {
    siteName: { type: String, default: 'Kubera Gold Exchange' },
    officialSlogan: { type: String, default: 'EXACT PURITY. MAXIMUM VALUE.' },
    tagLine: { type: String, default: 'German XRF Technology | Transparent Valuation | Fast Process | Secure Payments' },
    aboutShort: {
      type: String,
      default: "Nepal's destination for old gold and silver exchange, with computerised German XRF purity testing and payment by bank transfer or account-payee cheque."
    },
    contactEmail: { type: String, default: 'info@kuberagoldnepal.com' },
    contactPhone: { type: String, default: '+977 1 4256789' },
    contactMobile: { type: String, default: '+977 98510 12345' },
    whatsapp: { type: String, default: '+9779851012345' },
    address: { type: String, default: 'Dharmapath, New Road (Opposite Bishal Bazaar), Kathmandu, Nepal' },
    businessHours: { type: String, default: 'Sunday – Friday: 10:00 AM – 6:30 PM (Saturday Closed)' },
    logoUrl: { type: String, default: '/logo-transparent.png' },
    socialLinks: {
      facebook: { type: String, default: '' },
      instagram: { type: String, default: '' },
      tiktok: { type: String, default: '' },
      youtube: { type: String, default: '' }
    },
    defaultCurrency: { type: String, default: 'NPR' },
    paymentMethods: { type: String, default: 'Bank Transfer & Account Payee Cheque (No cash payments)' },
    marqueeNotice: {
      type: String,
      default: 'Live gold & silver rates updated daily. German XRF purity testing at every branch.'
    },
    disclaimer: {
      type: String,
      default: 'Published reference market prices follow Federation of Nepal Gold and Silver Dealers Association (FENEGOSIDA) benchmarks. Kubera buyback rates are set by calibrated German XRF testing, with payment by bank transfer.'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Setting', settingSchema);
