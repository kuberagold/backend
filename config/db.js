const mongoose = require('mongoose');

const RETRY_MS = 15000;
const isServerless = () => Boolean(process.env.VERCEL);

let connPromise = null;
let retryTimer = null;
let warnedFallback = false;

// Connect once and share the connection. On Vercel the module (and this connection) is
// reused across requests on a warm instance; each request awaits it via ensureDatabase.
// On a normal server, a failed connection retries in the background every 15 seconds.
const connectDB = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (connPromise) return connPromise;

  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kuberagold';
  connPromise = mongoose
    .connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: isServerless() ? 5 : 10,
    })
    .then((conn) => {
      console.log(`[Database] MongoDB connected: ${conn.connection.host}`);
      return conn.connection;
    })
    .catch((error) => {
      connPromise = null; // let the next request (or retry) try again
      console.warn(`[Database Warning] Could not connect to MongoDB: ${error.message}`);
      if (process.env.NODE_ENV === 'production') {
        console.warn('[Database] Production mode: API answers 503 until the database is reachable.');
      } else if (!warnedFallback) {
        warnedFallback = true;
        console.warn('[Database Note] Development fallback: using the in-memory demo store. Nothing you change is saved until MongoDB connects.');
      }
      if (!isServerless()) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => connectDB().catch(() => {}), RETRY_MS);
      }
      throw error;
    });
  return connPromise;
};

// Express middleware: in production/serverless, wait for the database before handling
// the request (cold starts). In development it never waits, so the memory fallback stays fast.
const ensureDatabase = async (req, res, next) => {
  const mustWait = process.env.NODE_ENV === 'production' || isServerless();
  if (mustWait && mongoose.connection.readyState !== 1) {
    try { await connectDB(); } catch { /* requireDatabaseInProduction answers 503 */ }
  }
  next();
};

mongoose.connection.on('disconnected', () => console.warn('[Database] MongoDB disconnected; the driver will try to reconnect.'));
mongoose.connection.on('reconnected', () => console.log('[Database] MongoDB reconnected.'));

module.exports = connectDB;
module.exports.ensureDatabase = ensureDatabase;
