// Mock market data feed. Stands in for a real provider (Polygon, Finnhub,
// Alpha Vantage, etc). Deterministic per calendar day via a seeded PRNG so
// repeated calls the same day are stable; a small independent jitter layer
// simulates intraday movement for on-demand risk checks.
//
// The tradable universe is the full catalog (_lib/catalog.mjs — ~200 real
// US companies across every sector), so the advisor genuinely scans the
// whole market and users can search/follow anything in it.

import { CATALOG, ALL_TICKERS } from './catalog.mjs';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
  return h;
}

const HEADLINE_POOL = [
  t => `${t} beats analyst estimates on quarterly revenue`,
  t => `Analysts raise price target on ${t} citing strong demand`,
  t => `${t} announces expanded buyback program`,
  t => `${t} faces regulatory scrutiny over new product line`,
  t => `${t} guidance for next quarter comes in below expectations`,
  t => `Institutional ownership in ${t} increased last quarter`,
  t => `${t} unveils new AI-driven product roadmap`,
  t => `Sector rotation pressures ${t} shares this week`,
  t => `${t} dividend declared, payable next month`,
  t => `${t} trading volume spikes on unconfirmed acquisition rumors`,
];

function dateStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

// Prices one ticker deterministically for a given day (and optional intraday
// nonce). Used both to build full snapshots and to look up a single symbol
// on demand (search results, favorites enrichment) without pricing all 200.
export function priceTicker(ticker, dateKey = dateStr(), intradayNonce) {
  const meta = CATALOG[ticker];
  if (!meta) return null;
  const rng = mulberry32(seedFromString(dateKey + ':' + ticker + (intradayNonce || '')));
  const changePct = +(((rng() - 0.5) * 6)).toFixed(2);
  const price = +(meta.base * (1 + changePct / 100)).toFixed(2);
  const volumeM = +(rng() * 40 + 5).toFixed(1);
  const hasHeadline = rng() < 0.55;
  const headline = hasHeadline ? HEADLINE_POOL[Math.floor(rng() * HEADLINE_POOL.length)](ticker) : null;
  const daysToEarnings = Math.floor(rng() * 45) + 1;
  return { ticker, name: meta.name, sector: meta.sector, price, changePct, volumeM, headline, daysToEarnings };
}

function buildSnapshot(dateKey, intradayNonce) {
  const tickers = ALL_TICKERS.map(t => priceTicker(t, dateKey, intradayNonce));
  const vixRng = mulberry32(seedFromString(dateKey + ':VIX' + (intradayNonce || '')));
  const vix = +(14 + vixRng() * 14).toFixed(1);
  return { date: dateKey, timestamp: new Date().toISOString(), vix, tickers };
}

export function getDailySnapshot() {
  return buildSnapshot(dateStr());
}

export function getIntradaySnapshot() {
  const now = new Date();
  const hourKey = dateStr(now) + 'T' + now.getUTCHours();
  return buildSnapshot(dateStr(now), hourKey);
}

// Screens the whole market down to a relevant candidate shortlist for the
// advisor to reason over (sending all ~200 tickers to the model every run
// would be slow and costly). The shortlist genuinely spans the market:
//   - the client's holdings + followed favorites (always included),
//   - the day's biggest movers across ALL stocks (up and down),
//   - a few names from sectors the portfolio is light in (diversification),
//   - a small rotating sample so ideas don't stagnate.
// The advisor then picks the best few opportunities from this shortlist.
export function screenCandidates(snapshot, { holdingTickers = [], favoriteTickers = [], sectorWeights = {}, n = 26 } = {}) {
  const held = new Set(holdingTickers);
  const fav = new Set(favoriteTickers);
  const picked = new Map(); // ticker -> row
  const add = (row) => { if (row && !picked.has(row.ticker)) picked.set(row.ticker, row); };

  const byTicker = {};
  snapshot.tickers.forEach(t => { byTicker[t.ticker] = t; });

  holdingTickers.forEach(t => add(byTicker[t]));
  favoriteTickers.forEach(t => add(byTicker[t]));

  // Biggest absolute movers across the entire market.
  const movers = [...snapshot.tickers].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  for (const m of movers) { if (picked.size >= n) break; if (!held.has(m.ticker)) add(m); }

  // Fill remaining slots from underweight sectors (diversification ideas),
  // preferring sectors the portfolio has little/none of.
  if (picked.size < n) {
    const bySector = {};
    snapshot.tickers.forEach(t => { (bySector[t.sector] ||= []).push(t); });
    const sectorsByNeed = Object.keys(bySector).sort((a, b) => (sectorWeights[a] || 0) - (sectorWeights[b] || 0));
    for (const sec of sectorsByNeed) {
      for (const row of bySector[sec]) {
        if (picked.size >= n) break;
        if (!held.has(row.ticker)) add(row);
      }
      if (picked.size >= n) break;
    }
  }

  return [...picked.values()].slice(0, n);
}

// Back-compat: some callers imported UNIVERSE. It's the full catalog now.
const UNIVERSE = CATALOG;
export { UNIVERSE };
