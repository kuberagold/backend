const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a banner title'],
      trim: true
    },
    subtitle: {
      type: String,
      trim: true,
      default: ''
    },
    badgeText: {
      type: String,
      trim: true,
      default: 'Today Exclusive'
    },
    imageUrl: {
      type: String,
      required: [true, 'Please provide an image URL'],
      trim: true
    },
    ctaText: {
      type: String,
      default: 'Check Live Rates'
    },
    ctaLink: {
      type: String,
      default: '/live-rates'
    },
    order: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

bannerSchema.index({ order: 1, isActive: 1 });

module.exports = mongoose.model('Banner', bannerSchema);
