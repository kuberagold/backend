const mongoose = require('mongoose');
const { INQUIRY_TYPES, INQUIRY_STATUSES } = require('../config/constants');

const inquirySchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Customer email is required'],
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: [true, 'Contact phone number is required'],
      trim: true
    },
    inquiryType: {
      type: String,
      enum: ['exchange', 'sell_gold', 'sell_silver', 'valuation_appointment', 'general', 'complaint'],
      default: 'exchange'
    },
    branch: {
      type: String,
      default: 'New Road Central Counter, Kathmandu'
    },
    appointmentDate: {
      type: String,
      default: ''
    },
    appointmentTimeSlot: {
      type: String,
      default: ''
    },
    metal: {
      type: String,
      enum: ['gold', 'silver', 'both'],
      default: 'gold'
    },
    goldDetails: {
      carat: {
        type: String,
        enum: ['24K', '22K', '18K', '14K', 'Silver', 'Other'],
        default: '22K'
      },
      weightInGrams: {
        type: Number,
        required: true,
        min: 0.1
      },
      estimatedValue: {
        type: Number,
        default: 0
      }
    },
    message: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: INQUIRY_STATUSES,
      default: 'pending'
    },
    adminNotes: {
      type: String,
      default: ''
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

inquirySchema.index({ status: 1, createdAt: -1 });
inquirySchema.index({ appointmentDate: 1, branch: 1, appointmentTimeSlot: 1 });
inquirySchema.index({ appointmentDate: 1, phone: 1 });
inquirySchema.index({ appointmentDate: 1, email: 1 });

module.exports = mongoose.model('Inquiry', inquirySchema);
