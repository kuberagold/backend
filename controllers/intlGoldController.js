const mongoose = require('mongoose');
const IntlGoldPrice = require('../models/IntlGoldPrice');
const { successResponse } = require('../utils/apiResponse');

// International gold price history (USD / troy ounce).
// Source: Yahoo Finance daily closes for COMEX gold futures (GC=F), fetched by the server
// (never by the browser), cached in memory for an hour and saved to MongoDB, which is
// served instead whenever the feed is unreachable.
const FEED_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=1y&interval=1d';
const SOURCE = 'COMEX gold futures (GC=F)';
const CACHE_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6000;

let cache = { at: 0, points: null };
let inflight = null;

const dayKey = (d) => d.toISOString().slice(0, 10);

const fetchFeed = async () => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(FEED_URL, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
    const json = await res.json();
    const r = json?.chart?.result?.[0];
    const ts = r?.timestamp || [];
    const close = r?.indicators?.quote?.[0]?.close || [];
    const byDay = new Map();
    ts.forEach((t, i) => {
      const v = close[i];
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return;
      const date = new Date(t * 1000);
      byDay.set(dayKey(date), { date, usdPerOz: Math.round(v * 100) / 100 });
    });
    const points = [...byDay.entries()]
      .map(([day, p]) => ({ day, ...p }))
      .sort((a, b) => a.date - b.date);
    if (points.length < 2) throw new Error('feed returned no prices');
    return points;
  } finally {
    clearTimeout(timer);
  }
};

const saveToDb = async (points) => {
  if (mongoose.connection.readyState !== 1) return;
  await IntlGoldPrice.bulkWrite(
    points.map((p) => ({
      updateOne: {
        filter: { day: p.day },
        update: { $set: { date: p.date, usdPerOz: p.usdPerOz, source: SOURCE } },
        upsert: true,
      },
    })),
    { ordered: false }
  );
};

const loadFromDb = async () => {
  if (mongoose.connection.readyState !== 1) return [];
  const since = new Date(Date.now() - 366 * 864e5);
  const rows = await IntlGoldPrice.find({ date: { $gte: since } }).sort({ date: 1 }).lean();
  return rows.map((r) => ({ day: r.day, date: r.date, usdPerOz: r.usdPerOz }));
};

const getPoints = async () => {
  if (cache.points && Date.now() - cache.at < CACHE_MS) return { points: cache.points, live: true };
  if (!inflight) {
    inflight = fetchFeed()
      .then(async (points) => {
        cache = { at: Date.now(), points };
        saveToDb(points).catch((e) => console.error('IntlGoldPrice save failed:', e.message));
        return { points, live: true };
      })
      .catch(async (e) => {
        console.error('International gold feed unavailable:', e.message);
        const points = await loadFromDb();
        if (points.length) cache = { at: Date.now() - CACHE_MS + 5 * 60 * 1000, points }; // retry feed in 5 min
        return { points, live: false };
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
};

const getInternationalHistory = async (req, res, next) => {
  try {
    const { points, live } = await getPoints();
    return successResponse(res, {
      message: points.length ? 'International gold prices retrieved' : 'International gold prices are unavailable right now',
      data: {
        unit: 'USD per troy ounce',
        source: SOURCE,
        live,
        chartData: points.map((p) => ({ date: p.date, usdPerOz: p.usdPerOz })),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getInternationalHistory };
