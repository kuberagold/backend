const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    mobile: { type: String, default: '', trim: true },
    whatsapp: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    // Free text, e.g. "Sunday – Friday: 10:00 AM – 6:30 PM (Saturday Closed)".
    // The public site reads days and times from it to show live open/closed status.
    hours: { type: String, default: '', trim: true },
    services: { type: [String], default: [] },
    mapUrl: { type: String, default: '', trim: true },
    image: { type: String, default: '', trim: true },
    isHeadOffice: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

module.exports = mongoose.model('Branch', branchSchema);
