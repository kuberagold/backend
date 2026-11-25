const mongoose = require('mongoose');

const RETRY_MS = 15000;
let retryTimer = null;
let warnedFallback = false;

// Connects to MongoDB and keeps retrying in the background until it succeeds, so fixing
// the database (e.g. allowing this IP in MongoDB Atlas) takes effect without a restart.
const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kuberagold';
  try {
    const conn = await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`[Database] MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`[Database Warning] Could not connect to MongoDB: ${error.message}`);
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Database] Production mode: API answers 503 until the database is reachable.');
    } else if (!warnedFallback) {
      warnedFallback = true;
      console.warn('[Database Note] Development fallback: using the in-memory demo store. Nothing you change is saved until MongoDB connects.');
    }
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connectDB, RETRY_MS);
  }
};

mongoose.connection.on('disconnected', () => console.warn('[Database] MongoDB disconnected; the driver will try to reconnect.'));
mongoose.connection.on('reconnected', () => console.log('[Database] MongoDB reconnected.'));

module.exports = connectDB;
