const mongoose = require('mongoose');

// Daily international gold price (USD per troy ounce), one document per trading day.
// Filled from the market feed so the chart still works when the feed is unreachable.
const intlGoldPriceSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, unique: true }, // YYYY-MM-DD (UTC)
    date: { type: Date, required: true },
    usdPerOz: { type: Number, required: true },
    source: { type: String, default: 'COMEX gold futures (GC=F)' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('IntlGoldPrice', intlGoldPriceSchema);
