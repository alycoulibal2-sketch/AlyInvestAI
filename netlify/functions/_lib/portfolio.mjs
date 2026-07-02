// Portfolio state. Three possible sources, in priority order:
//   1. A connected live broker (Trading 212 API, or an IBKR bridge) — real
//      holdings and real prices, fetched fresh on every read.
//   2. A manual/CSV snapshot the user entered — real holdings, but prices are
//      only as fresh as what was typed in (or the simulated feed, for tickers
//      that happen to overlap the built-in demo universe).
//   3. The built-in demo portfolio — fake holdings whose prices are driven by
//      the seeded market simulator so the product still feels alive with
//      nothing connected.
// Claude never edits any of this — it only reasons over whatever this module
// returns.
//
// Every read/write here is scoped to one userId — this is a multi-tenant
// app, and nothing in this file may ever be shared across accounts.

import { getStore } from '@netlify/blobs';
import * as brokerConnection from './brokerConnection.mjs';
import * as trading212 from './brokers/trading212.mjs';
import * as ibkr from './brokers/ibkr.mjs';

function defaultUserProfile(authUser) {
  const name = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || authUser?.email?.split('@')[0] || 'New Client';
  return {
    name,
    riskProfile: 'Moderate',
    horizon: '15+ years',
    monthlyContribution: 1500,
    goals: ['Long-term wealth building'],
    preferredSectors: ['Technology', 'ETFs / Index Funds'],
    maxSectorConcentrationTarget: 35,
  };
}

const DEMO_HOLDINGS = [
  { ticker: 'MSFT', name: 'Microsoft',           shares: 59, avgCost: 340.00, price: 465.00 },
  { ticker: 'NVDA', name: 'NVIDIA',               shares: 76, avgCost: 95.00,  price: 140.00 },
  { ticker: 'AAPL', name: 'Apple',                shares: 39, avgCost: 190.00, price: 225.00 },
  { ticker: 'VOO',  name: 'Vanguard S&P 500 ETF', shares: 15, avgCost: 480.00, price: 545.00 },
  { ticker: 'V',    name: 'Visa',                 shares: 20, avgCost: 260.00, price: 310.00 },
  { ticker: 'JNJ',  name: 'Johnson & Johnson',    shares: 29, avgCost: 158.00, price: 152.00 },
];
const DEMO_CASH = 3110.51;

const SECTOR_OF = {
  MSFT: 'Technology', NVDA: 'Technology', AAPL: 'Technology', GOOGL: 'Technology', GOOG: 'Technology',
  META: 'Technology', AMZN: 'Consumer', TSLA: 'Consumer', AMD: 'Technology',
  VOO: 'Diversified', VUSA: 'Diversified', SPY: 'Diversified', SCHD: 'Diversified',
  V: 'Financials', MA: 'Financials', JPM: 'Financials', BAC: 'Financials',
  JNJ: 'Healthcare', UNH: 'Healthcare', PFE: 'Healthcare',
  XOM: 'Energy', CVX: 'Energy',
};

function store() { return getStore('alyinvest'); }
const k = (userId, name) => `${userId}:${name}`;

export async function loadUserProfile(userId, authUser) {
  const existing = await store().get(k(userId, 'user-profile'), { type: 'json' });
  if (existing) return existing;
  const fresh = defaultUserProfile(authUser);
  await store().set(k(userId, 'user-profile'), JSON.stringify(fresh));
  return fresh;
}

export async function saveUserProfile(userId, user) {
  await store().set(k(userId, 'user-profile'), JSON.stringify(user));
}

// Returns { user, cash, holdings, _live } — _live=true means `price` on every
// holding is already authoritative and must not be overwritten by the demo
// market simulator.
export async function load(userId, authUser) {
  const conn = await brokerConnection.get(userId);
  const user = await loadUserProfile(userId, authUser);

  if (conn.type === 'trading212') {
    try {
      const live = await trading212.verifyAndFetch(conn.apiKey, conn.apiSecret, conn.practice);
      return { user, cash: live.cash, holdings: live.holdings, _live: true };
    } catch (err) {
      console.error('[portfolio] Trading 212 fetch failed, falling back to demo:', err.message);
    }
  } else if (conn.type === 'ibkr') {
    try {
      const live = await ibkr.verifyAndFetch(conn.bridgeUrl, conn.sharedSecret);
      return { user, cash: live.cash, holdings: live.holdings, _live: true };
    } catch (err) {
      console.error('[portfolio] IBKR bridge fetch failed, falling back to demo:', err.message);
    }
  }

  // Only a manual/CSV connection reads the stored snapshot. With no connection
  // at all (including right after a disconnect) we always show the demo
  // baseline — otherwise a stale manual/CSV snapshot could linger forever.
  if (conn.type === 'manual') {
    const existing = await store().get(k(userId, 'portfolio-state'), { type: 'json' });
    if (existing) return { ...existing, user, _live: false };
  }

  return { user, cash: DEMO_CASH, holdings: DEMO_HOLDINGS, _live: false };
}

// Used by manual entry / CSV import to replace the stored snapshot.
export async function saveSnapshot(userId, { holdings, cash }, authUser) {
  const user = await loadUserProfile(userId, authUser);
  const state = { user, cash, holdings };
  await store().set(k(userId, 'portfolio-state'), JSON.stringify(state));
  return state;
}

// Overlays the simulated daily market onto holdings whose ticker happens to
// be in the built-in demo universe. Anything else keeps its stored price
// (or avgCost, if no price is known yet) until a live source is connected.
export function applyDemoMarketPrices(state, marketSnapshot) {
  const priceOf = {};
  marketSnapshot.tickers.forEach(t => { priceOf[t.ticker] = t.price; });
  const holdings = state.holdings.map(h => ({ ...h, price: priceOf[h.ticker] ?? h.price ?? h.avgCost }));
  return { ...state, holdings };
}

export function computeView(state) {
  const holdings = state.holdings.map(h => {
    const price = h.price ?? h.avgCost ?? 0;
    const value = +(price * h.shares).toFixed(2);
    const costBasis = +((h.avgCost ?? price) * h.shares).toFixed(2);
    const gainPct = h.avgCost ? +(((price - h.avgCost) / h.avgCost) * 100).toFixed(2) : 0;
    return { ...h, price, value, costBasis, gainPct };
  });

  const holdingsTotal = +holdings.reduce((s, h) => s + h.value, 0).toFixed(2);
  const total = +(holdingsTotal + state.cash).toFixed(2);
  const withWeights = holdings.map(h => ({ ...h, weightPct: total ? +((h.value / total) * 100).toFixed(2) : 0 }));

  const sectorWeights = {};
  withWeights.forEach(h => {
    const s = h.sector || SECTOR_OF[h.ticker] || 'Other';
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
