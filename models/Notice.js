const mongoose = require('mongoose');

// A popup notice shown to visitors when they open the website, between startsAt and expiresAt.
const attachmentSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['none', 'image', 'pdf'], default: 'none' },
    // Uploaded file (stored in MongoDB GridFS, bucket "noticeFiles"), or an external link
    fileId: { type: mongoose.Schema.Types.ObjectId, default: null },
    url: { type: String, trim: true, default: '' },
    fileName: { type: String, trim: true, default: '' },
    mimeType: { type: String, trim: true, default: '' },
    size: { type: Number, default: 0 },
  },
  { _id: false }
);

const noticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Please add a title'], trim: true, maxlength: 150 },
    message: { type: String, trim: true, default: '', maxlength: 3000 },
    attachment: { type: attachmentSchema, default: () => ({}) },
    // Optional button, e.g. "Book now" -> /book-valuation
    ctaText: { type: String, trim: true, default: '', maxlength: 40 },
    ctaLink: { type: String, trim: true, default: '', maxlength: 500 },
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: [true, 'Please set an expiry time'] },
    // once: until the visitor closes it; session: once per browser session; always: on every visit
    frequency: { type: String, enum: ['once', 'session', 'always'], default: 'session' },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

noticeSchema.index({ isActive: 1, startsAt: 1, expiresAt: 1 });

module.exports = mongoose.model('Notice', noticeSchema);
