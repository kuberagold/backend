const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a blog title'],
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    excerpt: {
      type: String,
      required: [true, 'Please provide a short excerpt'],
      maxlength: 300
    },
    content: {
      type: String,
      required: [true, 'Please provide blog content']
    },
    coverImage: {
      type: String,
      default: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=80'
    },
    category: {
      type: String,
      default: 'Market Trends',
      trim: true
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    author: {
      type: String,
      default: 'KuberaGold Research Desk'
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'published'
    },
    views: {
      type: Number,
      default: 0
    },
    publishedAt: {
      type: Date,
      default: Date.now
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

blogSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model('Blog', blogSchema);
