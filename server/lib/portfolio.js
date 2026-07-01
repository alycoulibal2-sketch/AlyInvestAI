// Deterministic "source of truth" portfolio state for the prototype.
// In a production build this would be read from the Portfolio Connections
// layer (broker API / CSV / manual entry). Claude never edits these numbers —
// it only reasons over them.

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'data', 'portfolio-state.json');

const DEFAULT_PORTFOLIO = {
  user: {
    name: 'Aly Coulibaly',
    riskProfile: 'Moderate',
    horizon: '15+ years',
    monthlyContribution: 1500,
    goals: ['Long-term wealth building', 'Retirement planning'],
    preferredSectors: ['Technology', 'Healthcare', 'ETFs / Index Funds'],
    maxSectorConcentrationTarget: 35,
  },
  cash: 3110.51,
  holdings: [
    { ticker: 'MSFT', name: 'Microsoft',           shares: 59, avgCost: 340.00, price: 465.00 },
    { ticker: 'NVDA', name: 'NVIDIA',               shares: 76, avgCost: 95.00,  price: 140.00 },
    { ticker: 'AAPL', name: 'Apple',                shares: 39, avgCost: 190.00, price: 225.00 },
    { ticker: 'VOO',  name: 'Vanguard S&P 500 ETF', shares: 15, avgCost: 480.00, price: 545.00 },
    { ticker: 'V',    name: 'Visa',                 shares: 20, avgCost: 260.00, price: 310.00 },
    { ticker: 'JNJ',  name: 'Johnson & Johnson',    shares: 29, avgCost: 158.00, price: 152.00 },
  ],
};

function load() {
  if (fs.existsSync(STATE_FILE)) {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) { /* fall through */ }
  }
  save(DEFAULT_PORTFOLIO);
  return DEFAULT_PORTFOLIO;
}

function save(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Apply the latest market snapshot's prices onto the holdings so
// value/weight/gain figures always reflect "today's" simulated market.
function withLivePrices(state, marketSnapshot) {
  const priceOf = {};
  marketSnapshot.tickers.forEach(t => { priceOf[t.ticker] = t.price; });

  const holdings = state.holdings.map(h => {
    const price = priceOf[h.ticker] ?? h.price;
    const value = +(price * h.shares).toFixed(2);
    const costBasis = +(h.avgCost * h.shares).toFixed(2);
    const gainPct = +(((price - h.avgCost) / h.avgCost) * 100).toFixed(2);
    return { ...h, price, value, costBasis, gainPct };
  });

  const holdingsTotal = +holdings.reduce((s, h) => s + h.value, 0).toFixed(2);
  const total = +(holdingsTotal + state.cash).toFixed(2);
  const withWeights = holdings.map(h => ({ ...h, weightPct: +((h.value / total) * 100).toFixed(2) }));

  const sectorOf = { MSFT: 'Technology', NVDA: 'Technology', AAPL: 'Technology', VOO: 'Diversified', V: 'Financials', JNJ: 'Healthcare' };
  const sectorWeights = {};
  withWeights.forEach(h => {
    const s = sectorOf[h.ticker] || 'Other';
    sectorWeights[s] = +((sectorWeights[s] || 0) + h.weightPct).toFixed(2);
  });

  return {
    user: state.user,
    cash: state.cash,
    holdingsTotal,
    total,
    holdings: withWeights,
    sectorWeights,
  };
}

module.exports = { load, save, withLivePrices, DEFAULT_PORTFOLIO };
