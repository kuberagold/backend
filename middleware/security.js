const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const mongoose = require('mongoose');

const isProd = () => process.env.NODE_ENV === 'production';

// ---------- Security headers ----------
// This server only returns JSON, so the strictest content policy is safe here.
const securityHeaders = helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  crossOriginResourcePolicy: { policy: 'same-site' },
});

// ---------- Rate limits ----------
const limitResponse = (message) => (req, res) =>
  res.status(429).json({ success: false, message });

const makeLimiter = ({ windowMs, limit, message, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: limitResponse(message),
  });

const MIN = 60 * 1000;

const limiters = {
  // Whole API. Generous, because many Nepali ISPs put lots of customers behind one IP (CGNAT).
  api: makeLimiter({ windowMs: 15 * MIN, limit: 1000, message: 'Too many requests. Please slow down and try again shortly.' }),
  // Failed logins only, so staff logging in normally are never blocked
  login: makeLimiter({ windowMs: 15 * MIN, limit: 10, skipSuccessfulRequests: true, message: 'Too many failed login attempts. Please wait 15 minutes and try again.' }),
  register: makeLimiter({ windowMs: 60 * MIN, limit: 5, message: 'Too many sign-up attempts from this network. Please try again later.' }),
  // Public enquiry / appointment forms
  inquiry: makeLimiter({ windowMs: 60 * MIN, limit: 10, message: 'Too many enquiries sent from this network. Please call or WhatsApp us instead.' }),
  calculator: makeLimiter({ windowMs: 1 * MIN, limit: 60, message: 'Too many calculations. Please wait a minute.' }),
};

// ---------- Injection filter ----------
// Removes keys such as "$ne" / "$gt" / "a.b" from request data so user input can never
// become a MongoDB operator. (Mongoose's sanitizeFilter is enabled too, in server.js.)
const stripOperators = (value, depth = 0) => {
  if (depth > 10 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => stripOperators(v, depth + 1));
  const clean = {};
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith('$') || k.includes('.') || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    clean[k] = stripOperators(v, depth + 1);
  }
  return clean;
};

const sanitizeRequest = (req, res, next) => {
  if (req.body && typeof req.body === 'object') req.body = stripOperators(req.body);
  if (req.params) req.params = stripOperators(req.params);
  // req.query is a getter in newer Express; rebuild it in place
  if (req.query && typeof req.query === 'object') {
    const q = stripOperators(req.query);
    Object.keys(req.query).forEach((k) => { if (!(k in q)) delete req.query[k]; else req.query[k] = q[k]; });
  }
  next();
};

// ---------- Database guard ----------
// In production, never fall back to the in-memory demo store: that would lose every
// write on restart and enable the demo accounts. Answer 503 until MongoDB is back.
const requireDatabaseInProduction = (req, res, next) => {
  if (!isProd() || mongoose.connection.readyState === 1) return next();
  return res.status(503).json({ success: false, message: 'Service temporarily unavailable. Please try again shortly.' });
};

// ---------- Startup checks ----------
const KNOWN_WEAK_SECRETS = [
  'kuberagold_super_secret_jwt_key_2026_change_in_production',
  'replace_with_a_long_random_string_at_least_32_chars',
  'change_me',
  'secret',
];

let devFallbackSecret = null;

// Never sign tokens with a guessable secret. Production refuses to start; development
// uses a random per-process secret (logins reset on restart) and prints a warning.
const getJwtSecret = () => {
  const s = process.env.JWT_SECRET || '';
  if (s.length >= 32 && !KNOWN_WEAK_SECRETS.includes(s)) return s;
  if (isProd()) {
    throw new Error('JWT_SECRET is missing, too short or a published example value. Set a long random secret in .env before starting in production.');
  }
  if (!devFallbackSecret) {
    devFallbackSecret = require('crypto').randomBytes(48).toString('hex');
    console.warn('[Security] JWT_SECRET is weak or missing; using a random development secret. Set a strong JWT_SECRET in .env.');
  }
  return devFallbackSecret;
};

const assertSafeConfig = () => {
  getJwtSecret();
  if (isProd() && (!process.env.CLIENT_URL || process.env.CLIENT_URL.includes('*'))) {
    throw new Error('CLIENT_URL must list the website origin(s) in production (no "*").');
  }
};

module.exports = {
  securityHeaders,
  limiters,
  sanitizeRequest,
  stripOperators,
  requireDatabaseInProduction,
  getJwtSecret,
  assertSafeConfig,
  KNOWN_WEAK_SECRETS,
};
