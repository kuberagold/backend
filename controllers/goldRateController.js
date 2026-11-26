const mongoose = require('mongoose');
const GoldRate = require('../models/GoldRate');
const memoryStore = require('../utils/memoryStore');
const { CONVERSIONS } = require('../config/constants');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { loadSettings } = require('./settingController');

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
      currency = 'INR',
      rates,
      silverRatePerGram = 0,
      silverRatePerKg = 0,
      notes
    } = req.body;

    if (!rates || !Array.isArray(rates) || rates.length === 0) {
      return errorResponse(res, {
        statusCode: 400,
        message: 'Please provide rate array containing at least 24K and 22K rates'
      });
    }

    const formattedRates = rates.map((r) => {
      const buyRatePerTola = r.buyRatePerTola || Math.round(r.buyRatePerGram * CONVERSIONS.tolaToGrams);
      const sellRatePerTola = r.sellRatePerTola || Math.round(r.sellRatePerGram * CONVERSIONS.tolaToGrams);
      return {
        carat: r.carat,
        purity: r.purity || (r.carat === '24K' ? '99.9%' : r.carat === '22K' ? '91.6%' : '75.0%'),
        buyRatePerGram: Number(r.buyRatePerGram),
        sellRatePerGram: Number(r.sellRatePerGram),
        buyRatePerTola,
        sellRatePerTola
      };
    });

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
      customRate,
      marginPercent = 1.5
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

      const matchedRate = latestRate.rates.find(r => r.carat === carat) || latestRate.rates[0];
      referenceRatePerGram = matchedRate.referenceMarketRatePerGram || matchedRate.sellRatePerGram;
      ratePerGram = customRate ? Number(customRate) : (type === 'buy' ? matchedRate.sellRatePerGram : matchedRate.buyRatePerGram);
    }

    const fineMetalGrams = totalGrams * purityRatio;
    const referenceMetalValue = fineMetalGrams * (metal === 'silver' ? referenceRatePerGram : referenceRatePerGram);
    const baseAmount = fineMetalGrams * ratePerGram;
    // Commission comes from SuperAdmin > System Settings unless the caller passes one
    const settings = await loadSettings();
    const appliedMargin = marginPercent !== undefined && marginPercent !== ''
      ? Number(marginPercent) || 0
      : Number(settings?.exchangeCommissionPercentage) || 0;
    const estimatedDeductions = type === 'sell' ? (baseAmount * (appliedMargin / 100)) : 0;
    const estimatedBuyingValue = baseAmount - estimatedDeductions;

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
        marginPercentage: appliedMargin,
        estimatedDeductions: Number(estimatedDeductions.toFixed(2)),
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
