/**
 * In-memory data store for Kubera Gold Exchange (Nepal Market Context - English Content)
 * Brand Slogan: EXACT PURITY. MAXIMUM VALUE.
 * Main Positioning: HIGHEST GOLD & SILVER BUYBACK PRICES IN NEPAL
 * German XRF Technology | Transparent Valuation | Fast Process | Secure Payments (Bank Transfer / Account Payee Cheque)
 */
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/roles');
const { CONVERSIONS } = require('../config/constants');

const memoryStore = {
  users: [
    {
      _id: '665000000000000000000001',
      name: 'Super Administrator',
      email: 'superadmin@kuberagold.com',
      passwordHash: bcrypt.hashSync('Admin@123456', 10),
      phone: '+977 98510 00001',
      role: ROLES.SUPERADMIN,
      isActive: true,
      createdAt: new Date()
    },
    {
      _id: '665000000000000000000002',
      name: 'Central Counter Admin',
      email: 'admin@kuberagold.com',
      passwordHash: bcrypt.hashSync('Admin@123456', 10),
      phone: '+977 98510 00002',
      role: ROLES.ADMIN,
      isActive: true,
      createdAt: new Date()
    },
    {
      _id: '665000000000000000000003',
      name: 'Ram Bahadur Shrestha',
      email: 'guest@kuberagold.com',
      passwordHash: bcrypt.hashSync('Guest@123456', 10),
      phone: '+977 98412 34567',
      role: ROLES.GUEST,
      isActive: true,
      createdAt: new Date()
    }
  ],

  goldRates: (() => {
    const list = [];
    const now = new Date();
    const tolaGrams = CONVERSIONS.tolaToGrams; // 11.6638

    // Generate 365 daily points (1 Year) up to today
    for (let i = 365; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
      const progress = (365 - i) / 365;
      
      // Realistically rising gold trend in Nepal over the past year: Rs. 139,000 -> Rs. 171,458 / tola
      const base24kGram = 11920 + (14500 - 11920) * Math.pow(progress, 0.88);
      const cycleWave = Math.sin(i * 0.12) * 45 + Math.cos(i * 0.04) * 35;
      const final24kBuyGram = i === 0 ? 14500 : Math.round(base24kGram + cycleWave);
      const final24kRefGram = final24kBuyGram + 200;

      const final22kBuyGram = Math.round(final24kBuyGram * (22 / 24) * 0.999);
      const final22kRefGram = final22kBuyGram + 200;

      const final18kBuyGram = Math.round(final24kBuyGram * (18 / 24));
      const final18kRefGram = final18kBuyGram + 200;

      const final14kBuyGram = Math.round(final24kBuyGram * (14 / 24));
      const final14kRefGram = final14kBuyGram + 200;

      const silverBuyGram = Math.round(155 + (186 - 155) * progress + Math.sin(i * 0.18) * 2);
      const silverRefGram = silverBuyGram + 4;

      const prevRate = list[list.length - 1];
      let changeVal = 0;
      let changePct = 0;
      let trend = 'stable';
      if (prevRate) {
        changeVal = final24kBuyGram - prevRate.rates[0].buyRatePerGram;
        changePct = Number(((changeVal / prevRate.rates[0].buyRatePerGram) * 100).toFixed(2));
        if (changeVal > 0) trend = 'up';
        else if (changeVal < 0) trend = 'down';
      }

      list.push({
        _id: `rate_${Date.now() - i * 86400000}`,
        rateDate: d,
        currency: 'NPR',
        rates: [
          {
            carat: '24K',
            nepaliName: 'Fine Gold (Chhapawal 24K)',
            purity: '99.9% (Chhapawal Fine)',
            referenceMarketRatePerGram: final24kRefGram,
            referenceMarketRatePerTola: Math.round(final24kRefGram * tolaGrams),
            buyRatePerGram: final24kBuyGram,
            sellRatePerGram: final24kRefGram + 50,
            buyRatePerTola: Math.round(final24kBuyGram * tolaGrams),
            sellRatePerTola: Math.round((final24kRefGram + 50) * tolaGrams)
          },
          {
            carat: '22K',
            nepaliName: 'Tejabi Gold (22K Hallmark)',
            purity: '91.6% (22 Karat Hallmark)',
            referenceMarketRatePerGram: final22kRefGram,
            referenceMarketRatePerTola: Math.round(final22kRefGram * tolaGrams),
            buyRatePerGram: final22kBuyGram,
            sellRatePerGram: final22kRefGram + 50,
            buyRatePerTola: Math.round(final22kBuyGram * tolaGrams),
            sellRatePerTola: Math.round((final22kRefGram + 50) * tolaGrams)
          },
          {
            carat: '18K',
            nepaliName: '18K Fine Jewelry Gold',
            purity: '75.0% Fine',
            referenceMarketRatePerGram: final18kRefGram,
            referenceMarketRatePerTola: Math.round(final18kRefGram * tolaGrams),
            buyRatePerGram: final18kBuyGram,
            sellRatePerGram: final18kRefGram + 50,
            buyRatePerTola: Math.round(final18kBuyGram * tolaGrams),
            sellRatePerTola: Math.round((final18kRefGram + 50) * tolaGrams)
          },
          {
            carat: '14K',
            nepaliName: '14K Modern Jewelry Gold',
            purity: '58.5% Modern',
            referenceMarketRatePerGram: final14kRefGram,
            referenceMarketRatePerTola: Math.round(final14kRefGram * tolaGrams),
            buyRatePerGram: final14kBuyGram,
            sellRatePerGram: final14kRefGram + 50,
            buyRatePerTola: Math.round(final14kBuyGram * tolaGrams),
            sellRatePerTola: Math.round((final14kRefGram + 50) * tolaGrams)
          }
        ],
        silverReferenceMarketRatePerGram: silverRefGram,
        silverReferenceMarketRatePerTola: Math.round(silverRefGram * tolaGrams),
        silverRatePerGram: silverBuyGram,
        silverRatePerTola: Math.round(silverBuyGram * tolaGrams),
        silverRatePerKg: silverBuyGram * 1000,
        internationalGoldUsdPerOz: Number((2300 + (2724.8 - 2300) * progress).toFixed(2)),
        internationalSilverUsdPerOz: Number((24.5 + (31.65 - 24.5) * progress).toFixed(2)),
        usdNprExchangeRate: Number((132.5 + (134.85 - 132.5) * progress).toFixed(2)),
        marketTrend: trend,
        changePercentage: changePct,
        changeValue: changeVal,
        notes: i === 0 ? 'FENEGOSIDA Morning Benchmark Rate' : 'Daily standard bullion index',
        isCurrent: i === 0
      });
    }
    return list;
  })(),

  banners: [
    {
      _id: '665000000000000000000020',
      title: 'SELL YOUR GOLD & SILVER AT THE HIGHEST BUYBACK PRICES IN NEPAL',
      subtitle: 'Experience German XRF technology, transparent purity testing, accurate gold and silver valuation, a fast selling process and secure bank payments.',
      badgeText: 'EXACT PURITY. MAXIMUM VALUE.',
      imageUrl: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1400&q=80',
      ctaText: 'Sell Your Gold',
      ctaLink: '/sell-gold',
      order: 1,
      isActive: true
    },
    {
      _id: '665000000000000000000021',
      title: 'German XRF Non-Destructive Purity Testing',
      subtitle: 'Instant elemental composition analysis in 3 minutes without melting, cutting or damage. Zero hidden deductions.',
      badgeText: 'German XRF Technology',
      imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1400&q=80',
      ctaText: 'How Valuation Works',
      ctaLink: '/how-it-works',
      order: 2,
      isActive: true
    },
    {
      _id: '665000000000000000000022',
      title: 'Instant Bank Transfer & Account Payee Cheque',
      subtitle: '100% compliant, secure electronic bank disbursements via ConnectIPS or Cheque. Strictly transparent and legal transactions.',
      badgeText: 'Secure Bank Payments',
      imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1400&q=80',
      ctaText: 'Book a Valuation',
      ctaLink: '/book-valuation',
      order: 3,
      isActive: true
    }
  ],

  branches: [
    {
      id: 'kathmandu-newroad',
      name: 'New Road Central Counter (Head Office)',
      city: 'Kathmandu',
      address: 'Dharmapath, New Road (Opposite Bishal Bazaar), Kathmandu, Nepal',
      phone: '+977 1 4256789',
      mobile: '+977 98510 12345',
      whatsapp: '+9779851012345',
      email: 'newroad@kuberagoldnepal.com',
      hours: 'Sunday – Friday: 10:00 AM – 6:30 PM (Saturday Closed)',
      services: ['Gold Buyback', 'Silver Buyback', 'German XRF Purity Testing', 'Bank Transfer Disbursement', 'Valuation Certificates'],
      mapUrl: 'https://maps.google.com/?q=Dharmapath+New+Road+Kathmandu',
      image: '',
      isHeadOffice: true,
      isActive: true,
      displayOrder: 1
    },
    {
      id: 'lalitpur-kumaripati',
      name: 'Kumaripati Branch',
      city: 'Lalitpur',
      address: 'Kumaripati Main Road (Opposite Jawalakhel Chowk), Lalitpur, Nepal',
      phone: '+977 1 5543210',
      mobile: '+977 98510 54321',
      whatsapp: '+9779851054321',
      email: 'kumaripati@kuberagoldnepal.com',
      hours: 'Sunday – Friday: 10:00 AM – 6:00 PM (Saturday Closed)',
      services: ['Gold Buyback', 'Silver Buyback', 'German XRF Purity Testing', 'Instant Bank Payout'],
      mapUrl: 'https://maps.google.com/?q=Kumaripati+Lalitpur+Nepal',
      image: '',
      isHeadOffice: false,
      isActive: true,
      displayOrder: 2
    },
    {
      id: 'pokhara-chipledhunga',
      name: 'Pokhara Branch',
      city: 'Pokhara',
      address: 'Chipledhunga Commercial Centre (Near Mahendrapool / New Road), Pokhara, Gandaki, Nepal',
      phone: '+977 61 534567',
      mobile: '+977 98560 98765',
      whatsapp: '+9779856098765',
      email: 'pokhara@kuberagoldnepal.com',
      hours: 'Sunday – Friday: 10:00 AM – 5:30 PM (Saturday Closed)',
      services: ['Gold Buyback', 'Silver Buyback', 'XRF Spectrometer Analysis', 'Bank Transfer Disbursement'],
      mapUrl: 'https://maps.google.com/?q=Chipledhunga+Pokhara+Nepal',
      image: '',
      isHeadOffice: false,
      isActive: true,
      displayOrder: 3
    }
  ],

  blogs: [
    {
      _id: '665000000000000000000030',
      title: "Today's Gold Price in Nepal",
      slug: 'todays-gold-price-in-nepal',
      excerpt: 'Comprehensive daily overview of Fine Chhapawal (24K) and Tejabi (22K) gold prices in Nepal per Tola and Gram based on official FENEGOSIDA benchmarks.',
      content: `### Today's Official Bullion Benchmark in Nepal

Gold in Nepal is an essential asset for weddings, cultural festivals, and inflation hedging. Daily market prices are established by the Federation of Nepal Gold and Silver Dealers Association (FENEGOSIDA).

#### 1. Price Breakdown (Per Tola and Per Gram)
- **Fine Gold (Chhapawal 24K)**: NPR 1,71,458 per Tola (approx. NPR 14,700 per gram)
- **Tejabi Gold (22K)**: NPR 1,63,876 per Tola (approx. NPR 14,050 per gram)
- **18K Modern Jewelry**: NPR 133,550 per Tola (approx. NPR 11,450 per gram)

#### 2. Understanding Kubera Buying Rates
Published market rates serve as general retail benchmarks. At Kubera Gold Exchange, we offer the **highest buyback prices in Nepal**, transparently factoring in exact computerized purity and clear, disclosed processing margins.

#### 3. Factors Influencing Today's Rates
1. **International Spot Gold**: Changes in USD per troy ounce from London and New York bullion desks.
2. **USD/NPR Currency Rate**: Fluctuations in foreign exchange between the US Dollar and Nepalese Rupee.
3. **Nepal Rastra Bank Quotas**: Import quotas allocated to commercial banks.
4. **Customs Duties**: Tariffs established by the Ministry of Finance.`,
      coverImage: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=80',
      category: 'Market Rates',
      tags: ['Gold Price Nepal', 'Chhapawal', 'Tejabi', 'FENEGOSIDA', 'New Road'],
      author: 'Kubera Gold Research Desk',
      status: 'published',
      views: 520,
      publishedAt: new Date(Date.now() - 3600000 * 2)
    },
    {
      _id: '665000000000000000000031',
      title: "Today's Silver Price in Nepal",
      slug: 'todays-silver-price-in-nepal',
      excerpt: 'Current pure silver 999 market benchmarks in Nepal per Tola, Gram, and Kilogram, along with Kubera Silver buyback procedures.',
      content: `### Silver Bullion & Article Valuation in Nepal

Silver holds immense religious, artistic, and decorative importance in Nepalese heritage. From traditional silver utensils (Pooja Thali, Kalash) to modern 925 sterling jewelry, silver demand remains robust.

#### Today's Benchmark Silver Rates:
- **Silver Per Tola (11.664g)**: NPR 2,216
- **Silver Per Gram**: NPR 190
- **Silver Per Kilogram (1kg Bar)**: NPR 190,000

#### What Silver Kubera Buys:
- Fine Silver Bars and Bullion Coins (999)
- Traditional Utensils, Bowls, and Plates
- Silver Jewelry and Broken Ornaments
- Temple Articles and Heirlooms

Every piece undergoes precision weight verification and surface testing to ensure you receive maximum value.`,
      coverImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
      category: 'Market Rates',
      tags: ['Silver Nepal', 'Silver 999', 'Silver Buyback', 'Tola'],
      author: 'Kubera Silver Valuation Team',
      status: 'published',
      views: 310,
      publishedAt: new Date(Date.now() - 3600000 * 5)
    },
    {
      _id: '665000000000000000000032',
      title: 'How to Sell Gold in Nepal: A Step-by-Step Guide',
      slug: 'how-to-sell-gold-in-nepal',
      excerpt: 'Step-by-step instructions on selling old jewellery, gold coins, or scrap gold legally, securely, and at the best buyback rates in Kathmandu.',
      content: `### Safe & Transparent Gold Selling in Nepal

Selling gold should never be an intimidating or opaque process. Here is how you can sell gold safely in Nepal:

1. **Choose an Authorized Buyer**: Look for transparent pricing, certified precision scales, and computerized testing.
2. **Bring Government-Issued Identification**: In accordance with Nepal regulatory and anti-money laundering frameworks, buyers require a valid Citizenship Certificate, Passport, or National Identity Card.
3. **Bring Purchase Invoices (If Available)**: Original bills streamline verification. Items without original bills undergo enhanced KYC verification.
4. **Demand Non-Destructive Testing**: Never allow anyone to melt or cut your ornaments without initial testing and your written consent.
5. **Insist on Bank Transfers**: Direct account payee bank transfers or ConnectIPS ensure documented, secure settlement.`,
      coverImage: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80',
      category: 'Selling Guide',
      tags: ['Sell Gold Nepal', 'KYC', 'New Road Counter', 'Safe Selling'],
      author: 'Senior Valuation Officer',
      status: 'published',
      views: 640,
      publishedAt: new Date(Date.now() - 3600000 * 12)
    },
    {
      _id: '665000000000000000000033',
      title: 'How Gold Purity Is Calculated: Karats, Millesimal Fineness & Percentages',
      slug: 'how-gold-purity-is-calculated',
      excerpt: 'Understand 24K, 22K, 18K, and 14K purities, hallmark stamps, and how millesimal fineness translates into pure gold value.',
      content: `### Understanding Karats and Precious Metal Purity

Purity indicates the proportion of pure gold relative to alloy metals (copper, silver, zinc) added to increase durability.

#### Purity Conversion Table:
- **24 Karat (24K)**: 99.9% Pure Gold (999 fineness)
- **22 Karat (22K)**: 91.6% Pure Gold (916 fineness)
- **18 Karat (18K)**: 75.0% Pure Gold (750 fineness)
- **14 Karat (14K)**: 58.5% Pure Gold (585 fineness)

#### Pure Gold Weight Formula:
$$\\text{Pure Gold Weight} = \\text{Total Net Weight} \\times \\left(\\frac{\\text{Karat}}{24}\\right)$$

For example, a 10-gram 22K necklace contains:
$$10\\text{ g} \\times \\left(\\frac{22}{24}\\right) = 9.166\\text{ grams of pure fine gold}$$`,
      coverImage: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=80',
      category: 'Purity & Testing',
      tags: ['Karat', '24K', '22K', 'Purity Formula', 'Fineness'],
      author: 'Technical Lab Director',
      status: 'published',
      views: 450,
      publishedAt: new Date(Date.now() - 3600000 * 24)
    },
    {
      _id: '665000000000000000000034',
      title: 'What Is German XRF Technology? How Computerized Testing Protects Sellers',
      slug: 'what-is-german-xrf-technology',
      excerpt: 'Explore how X-Ray Fluorescence (XRF) spectrometry provides instant non-destructive elemental analysis without scratching or melting jewellery.',
      content: `### What Is German XRF Technology?

German X-Ray Fluorescence (XRF) spectroscopy is the global gold standard for non-destructive elemental composition analysis.

#### How It Works:
1. An X-ray beam excites the atoms on the metal surface.
2. Each element (Gold, Silver, Platinum, Copper, Zinc, Cadmium) emits secondary fluorescent X-rays with unique characteristic energy signatures.
3. Advanced silicon drift detectors compute exact percentages of all elements present within seconds.

#### Advantages for Sellers:
- **100% Non-Destructive**: No scraping, no acid tests, no melting losses.
- **Accurate**: Accurate to $\\pm 0.1\\%$ purity.
- **Immediate Results**: Printed purity reading within 3 minutes in front of the customer.`,
      coverImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
      category: 'Technology',
      tags: ['German XRF', 'Spectrometer', 'Non Destructive', 'Purity Testing'],
      author: 'Kubera Technical Lab',
      status: 'published',
      views: 780,
      publishedAt: new Date(Date.now() - 3600000 * 36)
    },
    {
      _id: '665000000000000000000035',
      title: '22K vs 24K Gold: Key Differences in Value, Hardness and Buyback Rates',
      slug: '22k-vs-24k-gold',
      excerpt: 'Why 24K is bullion gold and 22K is traditional bridal jewelry in Nepal. How buyback values differ.',
      content: `### Comparing 24K Chhapawal and 22K Tejabi Gold

In Nepal, customers frequently encounter the terms **Chhapawal (24K)** and **Tejabi (22K)**.

#### 24K Gold (Fine Gold):
- **Purity**: 99.9%
- **Characteristics**: Very soft, intensely yellow, malleable.
- **Usage**: Investment bars, minted bullion coins, sovereign medallions.
- **Buyback Value**: Highest possible valuation per gram.

#### 22K Gold (Ornament Gold):
- **Purity**: 91.6% (22 parts gold, 2 parts alloy)
- **Characteristics**: Durable enough to hold intricate shapes, filigree, and clasp tensions.
- **Usage**: Nepali bridal jewellery like Tilhari, Mangalsutra, Naugedi, bangles.
- **Buyback Value**: Calculated at 91.6% of pure fine rate.`,
      coverImage: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80',
      category: 'Purity & Testing',
      tags: ['24K', '22K', 'Chhapawal', 'Tejabi', 'Jewellery Resale'],
      author: 'Bullion Specialist',
      status: 'published',
      views: 390,
      publishedAt: new Date(Date.now() - 3600000 * 48)
    },
    {
      _id: '665000000000000000000036',
      title: 'How to Calculate Pure Gold Weight and Remove Non-Precious Attachments',
      slug: 'how-to-calculate-pure-gold-weight',
      excerpt: 'Learn how to separate gross jewellery weight from net precious metal weight by subtracting stones, wax, beads, and enamel.',
      content: `### Gross Weight vs Net Pure Weight

One common trap sellers encounter is weighing an entire necklace with stones and expecting full pure-gold valuation.

#### Step 1: Gross Weight Measurement
The piece is weighed on a certified 3-decimal scale (e.g., 25.450 grams).

#### Step 2: Identification of Non-Precious Components
- Enamel and lacquer fillings (Laha)
- Synthetic stones, zircons, pearls, and glass beads
- Base metal screws, springs, and safety wires

#### Step 3: Calculation of Net Weight
$$\\text{Net Weight} = \\text{Gross Weight} - \\text{Non-Precious Inclusions}$$

Only this accepted net weight enters purity valuation.`,
      coverImage: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=80',
      category: 'Valuation & Selling',
      tags: ['Net Weight', 'Gross Weight', 'Stones Deduction', 'Calibrated Scale'],
      author: 'Senior Valuation Officer',
      status: 'published',
      views: 295,
      publishedAt: new Date(Date.now() - 3600000 * 60)
    },
    {
      _id: '665000000000000000000037',
      title: 'Understanding Gold Buying Deductions: Don’t Lose Money Unknowingly',
      slug: 'understanding-gold-buying-deductions',
      excerpt: 'An in-depth explanation of melting charges, refining margins, and why unexplained 10% to 15% deductions cost sellers thousands of rupees.',
      content: `### The Hidden Cost of Unexplained Deductions

When selling gold in traditional markets, sellers often see arbitrary deductions labeled as "Jarti" (wastage), melting losses, or unstated margins.

#### Illustrative Scenario (Assessed Gold Value NPR 300,000):
| Deduction % | Total Deduction Amount | Customer Receives |
| :--- | :--- | :--- |
| **Kubera Clear Margin (1.5% - 2%)** | NPR 4,500 - NPR 6,000 | **NPR 294,000 - NPR 295,500** |
| Typical Shop (5%) | NPR 15,000 | NPR 285,000 |
| Heavy Deduction (8%) | NPR 24,000 | NPR 276,000 |
| Opaque Shop (10%) | NPR 30,000 | NPR 270,000 |
| Excessive Deduction (12%) | NPR 36,000 | NPR 264,000 |

*Every percentage matters.* Always ask for an itemized valuation sheet showing gross weight, net weight, XRF purity, applied rate, and exact deductions.`,
      coverImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
      category: 'Customer Education',
      tags: ['Deductions', 'How Sellers Lose Money', 'Jarti', 'Transparent Valuation'],
      author: 'Kubera Advisory Desk',
      status: 'published',
      views: 890,
      publishedAt: new Date(Date.now() - 3600000 * 72)
    },
    {
      _id: '665000000000000000000038',
      title: 'Why Jewellery Resale Value Is Different from the Retail Purchase Price',
      slug: 'why-jewellery-resale-value-is-different',
      excerpt: 'Understand why making charges (Jyati), wastage (Jarti), stones, and VAT are not recoverable when selling back jewellery.',
      content: `### Retail Purchase Price vs Bullion Resale Value

Many customers are surprised when the buyback offer for their wedding ornament is lower than the invoice paid 5 years ago.

#### When You Buy Jewellery, You Pay For:
1. **Raw Gold Content** (The metal value)
2. **Making Charges (Jyati)** (Artisanal labor: 8% to 18%)
3. **Wastage (Jarti)** (Manufacturing loss: 5% to 12%)
4. **Stones and Gems** (Charged at retail gem rates)
5. **Value Added Tax (VAT)** (Government levy)

#### When You Sell Jewellery Back:
A buyer can only pay for the **recoverable pure gold or silver content**. Making charges, wastage, and taxes are non-recoverable consumption costs. Understanding this difference helps you make smart selling decisions.`,
      coverImage: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80',
      category: 'Customer Education',
      tags: ['Resale Value', 'Making Charges', 'Jyati', 'Jewellery Economics'],
      author: 'Senior Valuation Officer',
      status: 'published',
      views: 410,
      publishedAt: new Date(Date.now() - 3600000 * 84)
    },
    {
      _id: '665000000000000000000039',
      title: 'How to Avoid Gold Selling Scams: Red Flags Every Customer Must Know',
      slug: 'how-to-avoid-gold-selling-scams',
      excerpt: 'Protect yourself from uncalibrated scales, corrosive acid tests, hidden fees, and off-the-books cash offers.',
      content: `### Common Traps and How to Protect Yourself

Precious metal transactions require diligence. Protect yourself against these common market pitfalls:

1. **Uncalibrated Scales**: Always check if the digital scale displays zero, is placed on a flat, vibration-free surface, and holds a valid calibration stamp.
2. **Destructive Acid Testing Without Written Consent**: Acid touchstone testing scratches gold and removes surface layers. Never authorize cutting or melting without a written declaration.
3. **The "Bait-and-Switch" Quote**: Offering high phone rates only to introduce enormous hidden deductions upon arrival.
4. **Unregulated Cash Payments**: Cash transactions lack banking audit trails and violate transaction limits. Transparent companies pay directly into verified bank accounts.`,
      coverImage: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=80',
      category: 'Customer Protection',
      tags: ['Scam Prevention', 'Uncalibrated Scales', 'Customer Rights', 'Security'],
      author: 'Compliance Officer',
      status: 'published',
      views: 710,
      publishedAt: new Date(Date.now() - 3600000 * 96)
    },
    {
      _id: '665000000000000000000040',
      title: 'Gold Refining and Purity Testing: From Scrap to 99.9% Fine Bullion',
      slug: 'gold-refining-and-purity-testing',
      excerpt: 'A technical overview of induction melting, chemical aqua regia refining, and assaying techniques used in the bullion industry.',
      content: `### The Science of Bullion Assaying and Refining

Once old jewellery is bought back, it enters an authorized refining cycle:

1. **Homogeneous Induction Melting**: Scrap jewellery is melted inside ceramic induction crucibles at over $1,064^\\circ\\text{C}$ to produce a uniform alloy bar.
2. **Fire Assay (Cupellation)**: The definitive metallurgical benchmark. Lead foil extracts base metals, leaving pure gold-silver beads.
3. **Aqua Regia Refining**: Chemical parting separates pure $99.9\\%$ gold bullion from alloy components like copper, zinc, and silver.
4. **Assay Ingot Casting**: Pure gold is cast into certified investment bars with serial hallmarks.`,
      coverImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
      category: 'Technology',
      tags: ['Refining', 'Fire Assay', 'Induction Melting', 'Aqua Regia'],
      author: 'Technical Lab Director',
      status: 'published',
      views: 280,
      publishedAt: new Date(Date.now() - 3600000 * 108)
    },
    {
      _id: '665000000000000000000041',
      title: 'Tola to Gram Conversion Guide for Nepal Precious Metals',
      slug: 'tola-to-gram-conversion-guide',
      excerpt: 'Quick reference tables and conversion formulas for Tola, Lal, Grams, Sovereigns, and Troy Ounces used in Nepali bullion trading.',
      content: `### Nepal Weight Conversion Reference

Precious metals in Nepal are traditionally measured in **Tola** and **Lal**, while international spot prices use **Troy Ounces** and metric **Grams**.

#### Standard Conversion Equivalencies:
- **1 Tola** $= 11.6638$ Grams (standardized as $11.664$ g)
- **1 Tola** $= 10$ Lal (लाल)
- **1 Lal** $= 1.1664$ Grams
- **1 Sovereign (Pavan)** $= 8.000$ Grams
- **1 Troy Ounce** $= 31.1035$ Grams $= 2.6666$ Tola
- **1 Kilogram** $= 1,000$ Grams $= 85.735$ Tola

Use our live online calculator to convert any weight instantaneously into NPR valuation!`,
      coverImage: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80',
      category: 'Knowledge Base',
      tags: ['Tola to Gram', 'Lal', 'Conversion Table', 'Weight Units'],
      author: 'Kubera Advisory Desk',
      status: 'published',
      views: 620,
      publishedAt: new Date(Date.now() - 3600000 * 120)
    },
    {
      _id: '665000000000000000000042',
      title: 'Gold and Silver Market Updates: Global Economic Trends & Nepal Rates',
      slug: 'gold-and-silver-market-updates',
      excerpt: 'How US Federal Reserve interest rates, geopolitical tensions, and central bank bullion reserve purchases drive market prices in Kathmandu.',
      content: `### Global Bullion Dynamics and Local Pricing

Gold rates in Nepal reflect a blend of international spot movements and local monetary policy.

#### 1. Central Bank Reserve Purchases
Global central banks have added historic volumes of physical gold bullion to foreign reserves to diversify away from currency risks.

#### 2. Inflation and Interest Rate Expectations
When global interest rates plateau or decline, non-yielding physical gold becomes significantly more attractive to institutional and retail investors alike.

#### 3. Nepal Exchange Rate Dynamics
Any appreciation of the USD relative to the Nepalese Rupee automatically elevates local landed import costs for raw bullion.`,
      coverImage: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=80',
      category: 'Market Analysis',
      tags: ['Market Updates', 'Federal Reserve', 'Central Banks', 'Economic Trends'],
      author: 'Kubera Gold Research Desk',
      status: 'published',
      views: 510,
      publishedAt: new Date(Date.now() - 3600000 * 132)
    },
    {
      _id: '665000000000000000000043',
      title: 'Selling Gold Without Original Bills: What the Law in Nepal Requires',
      slug: 'selling-gold-without-original-bills',
      excerpt: 'Lost your purchase bill? How Kubera conducts legal enhanced KYC, identity verification, and ownership declarations to buy your gold lawfully.',
      content: `### Selling Inherited or Bill-Free Gold in Nepal

Many families in Nepal possess ancestral ornaments, gifted gold, or jewelry whose purchase receipts were misplaced over decades.

#### Can You Sell Gold Without an Original Receipt?
**Yes**, but reputable and compliant companies like Kubera Gold Exchange follow structured enhanced due-diligence procedures:

1. **Government Photo ID**: National ID, Citizenship Card, or Passport is mandatory.
2. **Written Declaration of Lawful Ownership**: The seller formally signs an affidavit declaring that the items are lawful personal or inherited property, free of disputes or encumbrances.
3. **Traceable Bank Settlement**: Payouts are made directly into a bank account in the seller's legal name.
4. **Enhanced Verification**: Suspicious articles or transactions failing ownership screening are rejected in accordance with our Responsible Buying Policy.`,
      coverImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
      category: 'Legal & Policy',
      tags: ['No Original Bill', 'KYC', 'Lawful Ownership', 'Nepal Regulations'],
      author: 'Compliance Officer',
      status: 'published',
      views: 940,
      publishedAt: new Date(Date.now() - 3600000 * 144)
    },
    {
      _id: '665000000000000000000044',
      title: 'Understanding Silver Purity: 999 Bullion vs 925 Sterling vs Traditional Silver',
      slug: 'understanding-silver-purity',
      excerpt: 'Learn how to identify silver fineness marks, tarnish resistance, and resale valuation across utensils and jewelry.',
      content: `### Silver Fineness Standards Explained

Silver is graded by parts per thousand of pure elemental silver:

#### 1. Fine Silver (999 Fineness)
- **Purity**: 99.9%
- **Usage**: Minted bullion coins, investment silver bars.
- **Resale Value**: Top silver buyback benchmark.

#### 2. Sterling Silver (925 Fineness)
- **Purity**: 92.5% silver, 7.5% copper.
- **Usage**: High-end jewelry, chains, rings, cutlery.
- **Resale Value**: Calculated based on 92.5% silver content.

#### 3. Traditional Utensil Silver (700 – 850 Fineness)
- Traditional Puja Thali, statues, and vessels often contain silver alloys ranging between 70% to 85%.
- German XRF testing determines the exact silver percentage accurately before purchase.`,
      coverImage: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=80',
      category: 'Purity & Testing',
      tags: ['Silver Purity', '999 Silver', '925 Sterling', 'Silver Articles'],
      author: 'Kubera Silver Valuation Team',
      status: 'published',
      views: 340,
      publishedAt: new Date(Date.now() - 3600000 * 156)
    }
  ],

  inquiries: [],

  settings: {
    siteName: 'Kubera Gold Exchange',
    officialSlogan: 'EXACT PURITY. MAXIMUM VALUE.',
    brandPositioning: 'HIGHEST GOLD & SILVER BUYBACK PRICES IN NEPAL',
    tagLine: 'German XRF Technology | Transparent Valuation | Fast Process | Secure Payments',
    aboutShort: "Nepal's destination for old gold and silver exchange, with computerised German XRF purity testing and payment by bank transfer or account-payee cheque.",
    contactEmail: 'info@kuberagoldnepal.com',
    contactPhone: '+977 1 4256789',
    contactMobile: '+977 98510 12345',
    whatsapp: '+9779851012345',
    address: 'Dharmapath, New Road (Opposite Bishal Bazaar), Kathmandu, Nepal',
    businessHours: 'Sunday – Friday: 10:00 AM – 6:30 PM (Saturday Closed)',
    logoUrl: '/logo-transparent.png',
    socialLinks: { facebook: '', instagram: '', tiktok: '', youtube: '' },
    defaultCurrency: 'NPR',
    paymentMethods: 'Bank Transfer & Account Payee Cheque (No cash payments)',
    exchangeCommissionPercentage: 1.5,
    marqueeNotice: 'Live gold & silver rates updated daily. German XRF purity testing at every branch.',
    disclaimer: 'Published reference market prices adhere strictly to prevailing Federation of Nepal Gold and Silver Dealers Association (FENEGOSIDA) benchmarks. Kubera buyback rates are determined via calibrated German XRF testing and direct bank transfer disbursement.'
  }
};

module.exports = memoryStore;