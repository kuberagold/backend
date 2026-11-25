/**
 * Nepal Bullion Market Standard Constants
 */
module.exports = {
  GOLD_TYPES: [
    { code: '24K', name: 'Chhapawal Gold (छापावाल सुन)', purity: '99.9%' },
    { code: '22K', name: 'Tejabi Gold (तेजाबी सुन)', purity: '91.6%' },
    { code: '18K', name: '18K Gold (१८ क्यारेट सुन)', purity: '75.0%' },
    { code: 'Silver', name: 'Pure Silver (चाँदी ९९९)', purity: '99.9%' }
  ],
  WEIGHT_UNITS: ['tola', 'gram', '10gram', 'lal', 'sovereign'],
  CONVERSIONS: {
    // In Nepal Bullion Market: 1 Tola = 11.6638 grams
    tolaToGrams: 11.6638,
    // 10 Grams standard
    tenGrams: 10.0,
    // 1 Tola = 10 Lal (1 Lal = 1.16638 grams)
    lalToGrams: 1.16638,
    // 1 Sovereign / Pavan = 8 grams
    sovereignToGrams: 8.0,
    // 1 Ounce = 31.1035 grams
    troyOunceToGrams: 31.1035
  },
  DEFAULT_CURRENCY: 'NPR',
  INQUIRY_TYPES: ['exchange', 'sell', 'buy'],
  INQUIRY_STATUSES: ['pending', 'contacted', 'completed', 'cancelled'],
  BLOG_STATUSES: ['draft', 'published'],
  MAX_DAILY_APPOINTMENTS: 14,
  APPOINTMENT_TIME_SLOTS: [
    '11:00 AM - 11:30 AM',
    '11:30 AM - 12:00 PM',
    '12:00 PM - 12:30 PM',
    '12:30 PM - 01:00 PM',
    '01:00 PM - 01:30 PM',
    '01:30 PM - 02:00 PM',
    '02:00 PM - 02:30 PM',
    '02:30 PM - 03:00 PM',
    '03:00 PM - 03:30 PM',
    '03:30 PM - 04:00 PM',
    '04:00 PM - 04:30 PM',
    '04:30 PM - 05:00 PM',
    '05:00 PM - 05:30 PM',
    '05:30 PM - 06:00 PM'
  ]
};
