const mongoose = require('mongoose');

const rateItemSchema = new mongoose.Schema({
  carat: {
    type: String,
    required: true,
    enum: ['24K', '22K', '18K', '14K', 'Silver']
  },
  purity: {
    type: String,
    default: ''
  },
  buyRatePerGram: {
    type: Number,
    required: true,
    min: 0
  },
  sellRatePerGram: {
    type: Number,
    required: true,
    min: 0
  },
  buyRatePerTola: {
    type: Number,
    min: 0
  },
  sellRatePerTola: {
    type: Number,
    min: 0
  }
}, { _id: false });

const goldRateSchema = new mongoose.Schema(
  {
    rateDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true
    },
    rates: [rateItemSchema],
    silverRatePerGram: {
      type: Number,
      default: 0
    },
    silverRatePerKg: {
      type: Number,
      default: 0
    },
    marketTrend: {
      type: String,
      enum: ['up', 'down', 'stable'],
      default: 'stable'
    },
    changePercentage: {
      type: Number,
      default: 0
    },
    changeValue: {
      type: Number,
      default: 0
    },
    notes: {
      type: String,
      trim: true,
      default: 'Daily standard market gold exchange rates'
    },
    isCurrent: {
      type: Boolean,
      default: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient chronological rate fetching
goldRateSchema.index({ rateDate: -1 });
goldRateSchema.index({ isCurrent: 1 });

module.exports = mongoose.model('GoldRate', goldRateSchema);
