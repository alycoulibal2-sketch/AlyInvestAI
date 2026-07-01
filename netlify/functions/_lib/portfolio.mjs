// Deterministic "source of truth" portfolio state, persisted in Netlify Blobs.
// Claude never edits these numbers — it only reasons over them.

import { getStore } from '@netlify/blobs';

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

function store() { return getStore('alyinvest'); }

export async function load() {
  const existing = await store().get('portfolio-state', { type: 'json' });
  if (existing) return existing;
  await store().set('portfolio-state', JSON.stringify(DEFAULT_PORTFOLIO));
  return DEFAULT_PORTFOLIO;
}

export async function save(state) {
  await store().set('portfolio-state', JSON.stringify(state));
}

export function withLivePrices(state, marketSnapshot) {
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

export { DEFAULT_PORTFOLIO };
