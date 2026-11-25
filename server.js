require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const {
  securityHeaders,
  limiters,
  sanitizeRequest,
  requireDatabaseInProduction,
  assertSafeConfig,
} = require('./middleware/security');

// Refuse to start in production with an unsafe configuration (weak JWT secret, open CORS)
assertSafeConfig();

// Treat user input in query filters as plain values, never as MongoDB operators
mongoose.set('sanitizeFilter', true);

const app = express();

// Behind a reverse proxy (nginx, Render, etc.) set TRUST_PROXY=1 so rate limits see real client IPs
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// Plain query parsing: ?a[b]=c stays a string key instead of becoming a nested object
app.set('query parser', 'simple');

// Database Connection (retries in the background until it connects)
connectDB();

// Core Middleware
app.use(securityHeaders);

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // Same-origin and server-to-server requests have no Origin header
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(sanitizeRequest);

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health Check API (reports database state, nothing sensitive)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Rate limits: whole API, plus stricter limits on sensitive public endpoints
app.use('/api', limiters.api);
app.use('/api/auth/login', limiters.login);
app.use('/api/auth/register', limiters.register);
app.post('/api/inquiries', limiters.inquiry);
app.use('/api/gold-rates/calculate', limiters.calculator);

// Production never serves from the in-memory demo store
app.use('/api', requireDatabaseInProduction);

// Mount Main API Routes
app.use('/api', routes);

// 404 Route Not Found Handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Resource not found',
  });
});

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('===============================================');
  console.log(`KuberaGold Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('===============================================');
});

module.exports = app;
