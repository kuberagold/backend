const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const memoryStore = require('../utils/memoryStore');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const generateSlug = (title) => {
  return title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
};

const getPublicBlogs = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;

      const query = { status: 'published' };
      if (req.query.category) query.category = req.query.category;

      const total = await Blog.countDocuments(query);
      const blogs = await Blog.find(query)
        .select('title slug excerpt coverImage category author publishedAt views tags')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit);

      return successResponse(res, {
        message: 'Blogs retrieved successfully',
        data: blogs,
        pagination: { page, limit, totalPages: Math.ceil(total / limit), total }
      });
    } else {
      let blogs = memoryStore.blogs.filter(b => b.status === 'published');
      if (req.query.category) {
        blogs = blogs.filter(b => b.category === req.query.category);
      }
      return successResponse(res, {
        message: 'Blogs retrieved successfully',
        data: blogs
      });
    }
  } catch (error) {
    next(error);
  }
};

const getBlogBySlug = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const blog = await Blog.findOne({ slug: req.params.slug });
      if (!blog) return errorResponse(res, { statusCode: 404, message: 'Article not found' });
      blog.views += 1;
      await blog.save();
      return successResponse(res, { message: 'Blog article retrieved', data: blog });
    } else {
      const blog = memoryStore.blogs.find(b => b.slug === req.params.slug);
      if (!blog) return errorResponse(res, { statusCode: 404, message: 'Article not found' });
      blog.views += 1;
      return successResponse(res, { message: 'Blog article retrieved', data: blog });
    }
  } catch (error) {
    next(error);
  }
};

const getAllBlogsAdmin = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const blogs = await Blog.find().sort({ createdAt: -1 });
      return successResponse(res, { message: 'Admin blogs retrieved', data: blogs });
    } else {
      return successResponse(res, { message: 'Admin blogs retrieved', data: memoryStore.blogs });
    }
  } catch (error) {
    next(error);
  }
};

const createBlog = async (req, res, next) => {
  try {
    const { title, excerpt, content, coverImage, category, tags, author, status } = req.body;
    let slug = generateSlug(title);

    if (mongoose.connection.readyState === 1) {
      const blog = await Blog.create({
        title, slug, excerpt, content,
        coverImage: coverImage || 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=80',
        category: category || 'Market Trends',
        tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : ['Gold']),
        author: author || req.user?.name || 'KuberaGold Desk',
        status: status || 'published',
        publishedAt: status === 'published' ? new Date() : null,
        createdBy: req.user?._id
      });
      return successResponse(res, { statusCode: 201, message: 'Blog created successfully', data: blog });
    } else {
      const blog = {
        _id: String(Date.now()),
        title, slug, excerpt, content,
        coverImage: coverImage || 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=80',
        category: category || 'Market Trends',
        tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : ['Gold']),
        author: author || req.user?.name || 'KuberaGold Desk',
        status: status || 'published',
        views: 0,
        publishedAt: status === 'published' ? new Date() : null,
        createdAt: new Date()
      };
      memoryStore.blogs.unshift(blog);
      return successResponse(res, { statusCode: 201, message: 'Blog created successfully', data: blog });
    }
  } catch (error) {
    next(error);
  }
};

const BLOG_EDITABLE = ['title', 'excerpt', 'content', 'coverImage', 'category', 'author', 'status', 'tags'];

const pickBlogChanges = (body = {}) => {
  const out = {};
  BLOG_EDITABLE.forEach((k) => {
    if (body[k] === undefined) return;
    out[k] = k === 'tags'
      ? (Array.isArray(body.tags) ? body.tags : String(body.tags).split(',')).map((t) => String(t).trim()).filter(Boolean)
      : body[k];
  });
  return out;
};

const updateBlog = async (req, res, next) => {
  try {
    const changes = pickBlogChanges(req.body);
    if (mongoose.connection.readyState === 1) {
      const updated = await Blog.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
      if (!updated) return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
      return successResponse(res, { message: 'Blog updated successfully', data: updated });
    } else {
      const blog = memoryStore.blogs.find(b => b._id === req.params.id);
      if (!blog) return errorResponse(res, { statusCode: 404, message: 'Blog not found' });
      Object.assign(blog, changes);
      if (changes.status === 'published' && !blog.publishedAt) blog.publishedAt = new Date();
      return successResponse(res, { message: 'Blog updated successfully', data: blog });
    }
  } catch (error) {
    next(error);
  }
};

const deleteBlog = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await Blog.findByIdAndDelete(req.params.id);
    } else {
      memoryStore.blogs = memoryStore.blogs.filter(b => b._id !== req.params.id);
    }
    return successResponse(res, { message: 'Blog deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicBlogs,
  getBlogBySlug,
  getAllBlogsAdmin,
  createBlog,
  updateBlog,
  deleteBlog
};
