const mongoose = require('mongoose');
const GoldRate = require('../models/GoldRate');
const memoryStore = require('../utils/memoryStore');
const { CONVERSIONS } = require('../config/constants');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const getLatestRates = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      let latestRate = await GoldRate.findOne({ isCurrent: true })
        .populate('updatedBy', 'name email role')
        .sort({ rateDate: -1 });

      if (!latestRate) {
        latestRate = await GoldRate.findOne().sort({ rateDate: -1 });
      }

      return successResponse(res, {
        message: latestRate ? 'Latest gold rates retrieved' : 'No gold rates published yet',
        data: latestRate
      });
    } else {
      const latestRate = memoryStore.goldRates[memoryStore.goldRates.length - 1];
      return successResponse(res, {
        message: 'Latest gold rates retrieved',
        data: latestRate
      });
    }
  } catch (error) {
    next(error);
  }
};

const getRateHistory = async (req, res, next) => {
  try {
    const period = req.query.period || '30d'; // '7d' | '30d' | '1m' | '3m' | '6m' | '1y'
    const carat = req.query.carat || '24K';

    let days = 30;
    if (period === '7d') days = 7;
    else if (period === '1m' || period === '30d') days = 30;
    else if (period === '3m' || period === '90d') days = 90;
    else if (period === '6m' || period === '180d') days = 180;
    else if (period === '1y' || period === '365d') days = 365;
    else if (req.query.limit) days = parseInt(req.query.limit, 10);

    let rawList = [];
    if (mongoose.connection.readyState === 1) {
      rawList = await GoldRate.find()
        .sort({ rateDate: -1 })
        .limit(days);
      rawList = rawList.reverse();
    } else {
      rawList = memoryStore.goldRates.slice(-days);
    }

    // Keep every daily point: the chart zooms down to individual days (a year is ~366 small rows)
    const sampledList = rawList;

    const tolaMultiplier = CONVERSIONS.tolaToGrams; // 11.6638

    const chartData = sampledList.map((item, index) => {
      const d = new Date(item.rateDate);
      let buyGram = 0;
      let refGram = 0;
      let buyTola = 0;
      let refTola = 0;

      // Only real published figures; a day without the metal's market rate is dropped (filtered below).
      // Market reference = the FENEGOSIDA (federation) rate: the explicit reference field, else the
      // published market (sell) rate. It never falls back to Kubera's own buying rate.
      if (carat === 'Silver') {
        buyGram = item.silverRatePerGram || 0;
        refGram = item.silverReferenceMarketRatePerGram || 0;
        buyTola = item.silverRatePerTola || Math.round(buyGram * tolaMultiplier);
        refTola = item.silverReferenceMarketRatePerTola || Math.round(refGram * tolaMultiplier);
      } else {
        const caratData = item.rates?.find(r => r.carat === carat) || {};
        buyGram = caratData.buyRatePerGram || 0;
        refGram = caratData.referenceMarketRatePerGram || caratData.sellRatePerGram || 0;
        buyTola = caratData.buyRatePerTola || Math.round(buyGram * tolaMultiplier);
        refTola = caratData.referenceMarketRatePerTola
          || (caratData.referenceMarketRatePerGram ? 0 : caratData.sellRatePerTola)
          || Math.round(refGram * tolaMultiplier);
      }
      if (!refGram && !refTola) return null;

      return {
        id: item._id,
        date: item.rateDate,
        label: d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: days > 90 ? '2-digit' : undefined
        }),
        fullDate: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        carat,
        buyRatePerGram: buyGram,
        referenceRatePerGram: refGram,
        buyRatePerTola: buyTola,
        referenceRatePerTola: refTola,
        silverRatePerGram: item.silverRatePerGram,
        silverRatePerTola: item.silverRatePerTola,
        marketTrend: item.marketTrend,
        changePercentage: item.changePercentage,
        changeValue: item.changeValue
      };
    }).filter(Boolean);

    // Calculate Summary Stats
    const prices = chartData.map(c => c.referenceRatePerTola);
    const currentPrice = prices[prices.length - 1] || 0;
    const initialPrice = prices[0] || currentPrice;
    const highPrice = Math.max(...prices, currentPrice);
    const lowPrice = Math.min(...prices, currentPrice);
    const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / (prices.length || 1));
    const totalChange = currentPrice - initialPrice;
    const totalChangePercentage = initialPrice > 0 ? Number(((totalChange / initialPrice) * 100).toFixed(2)) : 0;

    return successResponse(res, {
      message: 'Rate history fetched successfully',
      data: {
        period,
        carat,
        days,
        summary: {
          currentPrice,
          initialPrice,
          highPrice,
          lowPrice,
          averagePrice: avgPrice,
          totalChange,
          totalChangePercentage,
          trend: totalChange >= 0 ? 'up' : 'down'
        },
        chartData,
        history: rawList.slice(-15).reverse() // 15 most recent for the tabular log
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateDailyRate = async (req, res, next) => {
  try {
    const {
      rateDate,
      rates,
      silverRatePerGram = 0,
      silverRatePerKg = 0,
      notes,
      confirmLargeChange = false
    } = req.body;
    const currency = 'NPR'; // all published rates are Nepali rupees

    if (!rates || !Array.isArray(rates) || rates.length === 0) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide rate array containing at least 24K and 22K rates'
      });
    }

    // The federation publishes fine gold per tola, so the per-tola figure may be sent as entered;
    // per-gram is derived from it (or the other way round). The buying rate is optional and
    // defaults to the published rate. Whichever is sent, both units always agree.
    const TOLA = CONVERSIONS.tolaToGrams;
    const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
    const round2 = (v) => Math.round(v * 100) / 100;
    const formattedRates = rates.map((r) => {
      const sellTola = num(r.sellRatePerTola);
      const sellRatePerGram = num(r.sellRatePerGram) ?? (sellTola !== null ? round2(sellTola / TOLA) : NaN);
      const sellRatePerTola = sellTola ?? Math.round(sellRatePerGram * TOLA);
      const buyTola = num(r.buyRatePerTola);
      const buyRatePerGram = num(r.buyRatePerGram) ?? (buyTola !== null ? round2(buyTola / TOLA) : sellRatePerGram);
      const buyRatePerTola = buyTola ?? (num(r.buyRatePerGram) !== null ? Math.round(buyRatePerGram * TOLA) : sellRatePerTola);
      return {
        carat: String(r.carat || ''),
        purity: r.purity || (r.carat === '24K' ? '99.9%' : r.carat === '22K' ? '91.6%' : r.carat === '18K' ? '75.0%' : '58.5%'),
        buyRatePerGram,
        sellRatePerGram,
        buyRatePerTola,
        sellRatePerTola
      };
    });

    // ---- Sanity checks: stop typing mistakes from going live on the public site ----
    const CARAT_ORDER = ['24K', '22K', '18K', '14K'];
    const problems = [];
    formattedRates.forEach((r) => {
      if (!CARAT_ORDER.includes(r.carat)) problems.push(`Unknown carat "${r.carat}"`);
      if (!Number.isFinite(r.buyRatePerGram) || r.buyRatePerGram <= 0) problems.push(`${r.carat} buy rate must be a positive number`);
      if (!Number.isFinite(r.sellRatePerGram) || r.sellRatePerGram <= 0) problems.push(`${r.carat} sell rate must be a positive number`);
      if (r.buyRatePerGram > r.sellRatePerGram) problems.push(`${r.carat} buy rate (${r.buyRatePerGram}) is higher than its sell rate (${r.sellRatePerGram})`);
    });
    if (!formattedRates.some((r) => r.carat === '24K')) problems.push('24K (fine gold) rate is required');
    const present = CARAT_ORDER.map((c) => formattedRates.find((r) => r.carat === c)).filter(Boolean);
    for (let i = 1; i < present.length; i++) {
      if (present[i].sellRatePerGram >= present[i - 1].sellRatePerGram) {
        problems.push(`${present[i].carat} sell rate must be lower than ${present[i - 1].carat}`);
      }
    }
    const silverGram = Number(silverRatePerGram);
    if (!Number.isFinite(silverGram) || silverGram < 0) problems.push('Silver rate must be zero or a positive number');
    if (problems.length) {
      return errorResponse(res, { statusCode: 400, message: problems.join('. ') });
    }

    // A day-to-day move above 15% is almost always a typo: ask the admin to confirm it
    const MAX_DAILY_MOVE = 0.15;
    const latest = mongoose.connection.readyState === 1
      ? await GoldRate.findOne({ isCurrent: true }).sort({ rateDate: -1 }).lean()
      : memoryStore.goldRates[memoryStore.goldRates.length - 1];
    if (!confirmLargeChange && latest?.rates?.length) {
      const big = formattedRates
        .map((r) => {
          const old = latest.rates.find((p) => p.carat === r.carat);
          if (!old?.sellRatePerGram) return null;
          const move = (r.sellRatePerGram - old.sellRatePerGram) / old.sellRatePerGram;
          return Math.abs(move) > MAX_DAILY_MOVE
            ? `${r.carat} sell ${old.sellRatePerGram} → ${r.sellRatePerGram} (${move > 0 ? '+' : ''}${(move * 100).toFixed(1)}%)`
            : null;
        })
        .filter(Boolean);
      if (big.length) {
        return errorResponse(res, {
          statusCode: 409,
          message: `These rates changed by more than 15% since the last published rate: ${big.join('; ')}. Please check for a typing mistake, or confirm to publish anyway.`,
          errors: { code: 'LARGE_CHANGE', changes: big }
        });
      }
    }

    const finalSilverKg = silverRatePerKg || Math.round(silverRatePerGram * 1000);

    let marketTrend = 'stable';
    let changePercentage = 0;
    let changeValue = 0;

    if (mongoose.connection.readyState === 1) {
      const previousRate = await GoldRate.findOne({ isCurrent: true }).sort({ rateDate: -1 });

      if (previousRate && previousRate.rates?.length > 0) {
        const prev24k = previousRate.rates.find(r => r.carat === '24K') || previousRate.rates[0];
        const new24k = formattedRates.find(r => r.carat === '24K') || formattedRates[0];

        if (prev24k && new24k) {
          changeValue = Number((new24k.buyRatePerGram - prev24k.buyRatePerGram).toFixed(2));
          changePercentage = Number(((changeValue / prev24k.buyRatePerGram) * 100).toFixed(2));

          if (changeValue > 0) marketTrend = 'up';
          else if (changeValue < 0) marketTrend = 'down';
        }
      }

      await GoldRate.updateMany({ isCurrent: true }, { $set: { isCurrent: false } });

      const newDailyRate = await GoldRate.create({
        rateDate: rateDate ? new Date(rateDate) : new Date(),
        currency,
        rates: formattedRates,
        silverRatePerGram: Number(silverRatePerGram),
        silverRatePerKg: finalSilverKg,
        marketTrend,
        changePercentage,
        changeValue,
        notes: notes || 'Updated by KuberaGold desk',
        isCurrent: true,
        updatedBy: req.user?._id
      });

      return successResponse(res, {
        statusCode: 201,
        message: 'Daily gold rates updated successfully!',
        data: newDailyRate
      });
    } else {
      const previousRate = memoryStore.goldRates[memoryStore.goldRates.length - 1];
      if (previousRate && previousRate.rates?.length > 0) {
        const prev24k = previousRate.rates.find(r => r.carat === '24K') || previousRate.rates[0];
        const new24k = formattedRates.find(r => r.carat === '24K') || formattedRates[0];

        if (prev24k && new24k) {
          changeValue = Number((new24k.buyRatePerGram - prev24k.buyRatePerGram).toFixed(2));
          changePercentage = Number(((changeValue / prev24k.buyRatePerGram) * 100).toFixed(2));

          if (changeValue > 0) marketTrend = 'up';
          else if (changeValue < 0) marketTrend = 'down';
        }
      }

      const newDailyRate = {
        _id: String(Date.now()),
        rateDate: new Date(),
        currency,
        rates: formattedRates,
        silverRatePerGram: Number(silverRatePerGram),
        silverRatePerKg: finalSilverKg,
        marketTrend,
        changePercentage,
        changeValue,
        notes: notes || 'Updated by KuberaGold desk',
        isCurrent: true
      };

      memoryStore.goldRates.push(newDailyRate);

      return successResponse(res, {
        statusCode: 201,
        message: 'Daily gold rates updated successfully!',
        data: newDailyRate
      });
    }
  } catch (error) {
    next(error);
  }
};

const calculateExchangeValue = async (req, res, next) => {
  try {
    const {
      metal = 'gold', // 'gold' or 'silver'
      carat = '24K',
      purityPercent,
      weightInGrams,
      unit = 'tola',
      type = 'sell',
      customRate
    } = req.body;

    if (!weightInGrams || weightInGrams <= 0) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide valid metal weight'
      });
    }

    let totalGrams = Number(weightInGrams);
    if (unit === 'tola') totalGrams *= CONVERSIONS.tolaToGrams;
    else if (unit === 'sovereign') totalGrams *= CONVERSIONS.sovereignToGrams;
    else if (unit === 'ounce') totalGrams *= CONVERSIONS.troyOunceToGrams;
    else if (unit === 'kg') totalGrams *= CONVERSIONS.kgToGrams;

    let latestRate;
    if (mongoose.connection.readyState === 1) {
      latestRate = await GoldRate.findOne({ isCurrent: true }).sort({ rateDate: -1 });
    } else {
      latestRate = memoryStore.goldRates[memoryStore.goldRates.length - 1];
    }

    if (!latestRate) {
      return errorResponse(res, {
        statusCode: 404,
        message: 'Bullion rate benchmark not configured yet. Please try later.'
      });
    }

    let purityRatio = 1.0;
    let ratePerGram = 0;
    let referenceRatePerGram = 0;

    if (metal === 'silver') {
      purityRatio = purityPercent ? Number(purityPercent) / 100 : (carat === '925' ? 0.925 : 0.999);
      // Never price from a made-up rate: refuse if today's silver rate isn't published
      if (!latestRate.silverRatePerGram && !customRate) {
        return errorResponse(res, { statusCode: 404, message: "Today's silver rate has not been published yet. Please try later." });
      }
      ratePerGram = customRate ? Number(customRate) : latestRate.silverRatePerGram;
      referenceRatePerGram = latestRate.silverReferenceMarketRatePerGram || ratePerGram;
    } else {
      // Gold
      if (purityPercent) {
        purityRatio = Number(purityPercent) / 100;
      } else {
        if (carat === '24K') purityRatio = 0.999;
        else if (carat === '22K') purityRatio = 0.916;
        else if (carat === '18K') purityRatio = 0.750;
        else if (carat === '14K') purityRatio = 0.585;
      }

      // Only the fine gold (24K) rate is published. Value = fine gold content x fine gold rate,
      // so purity is applied once (a per-carat rate here would count the purity twice).
      const fine = latestRate.rates.find(r => r.carat === '24K') || latestRate.rates[0];
      referenceRatePerGram = fine.referenceMarketRatePerGram || fine.sellRatePerGram;
      ratePerGram = customRate ? Number(customRate) : (type === 'buy' ? fine.sellRatePerGram : fine.buyRatePerGram);
    }

    const fineMetalGrams = totalGrams * purityRatio;
    const referenceMetalValue = fineMetalGrams * (metal === 'silver' ? referenceRatePerGram : referenceRatePerGram);
    // Estimate = fine metal weight x the published rate; nothing is deducted from it
    const baseAmount = fineMetalGrams * ratePerGram;
    const estimatedBuyingValue = baseAmount;

    return successResponse(res, {
      message: 'Calculation completed successfully',
      data: {
        metal,
        carat: metal === 'silver' ? (carat === '925' ? 'Sterling 925' : 'Fine 999') : carat,
        purityPercent: Number((purityRatio * 100).toFixed(1)),
        inputWeight: Number(weightInGrams),
        inputUnit: unit,
        totalWeightGrams: Number(totalGrams.toFixed(3)),
        fineMetalGrams: Number(fineMetalGrams.toFixed(3)),
        referenceRatePerGram,
        appliedRatePerGram: ratePerGram,
        referenceMetalValue: Number(referenceMetalValue.toFixed(2)),
        baseAmount: Number(baseAmount.toFixed(2)),
        estimatedBuyingValue: Number(estimatedBuyingValue.toFixed(2)),
        currency: latestRate.currency || 'NPR',
        asOfDate: latestRate.rateDate
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLatestRates,
  getRateHistory,
  updateDailyRate,
  calculateExchangeValue
};
