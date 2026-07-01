// Mock market data feed. Stands in for a real provider (Polygon, Finnhub,
// Alpha Vantage, etc). Deterministic per calendar day via a seeded PRNG so
// repeated calls the same day are stable; a small independent jitter layer
// simulates intraday movement for on-demand risk checks.

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

const UNIVERSE = {
  MSFT:  { base: 465, sector: 'Technology',  name: 'Microsoft' },
  NVDA:  { base: 140, sector: 'Technology',  name: 'NVIDIA' },
  AAPL:  { base: 225, sector: 'Technology',  name: 'Apple' },
  VOO:   { base: 545, sector: 'Diversified', name: 'Vanguard S&P 500 ETF' },
  V:     { base: 310, sector: 'Financials',  name: 'Visa' },
  JNJ:   { base: 152, sector: 'Healthcare',  name: 'Johnson & Johnson' },
  GOOGL: { base: 178, sector: 'Technology',  name: 'Alphabet' },
  AMZN:  { base: 205, sector: 'Consumer',    name: 'Amazon' },
  SCHD:  { base: 84,  sector: 'Diversified', name: 'Schwab US Dividend ETF' },
  XOM:   { base: 118, sector: 'Energy',      name: 'Exxon Mobil' },
  UNH:   { base: 512, sector: 'Healthcare',  name: 'UnitedHealth Group' },
};

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

function buildSnapshot(dateKey, intradayNonce) {
  const tickers = Object.entries(UNIVERSE).map(([ticker, meta]) => {
    const rng = mulberry32(seedFromString(dateKey + ':' + ticker + (intradayNonce || '')));
    const changePct = +(((rng() - 0.5) * 6)).toFixed(2);
    const price = +(meta.base * (1 + changePct / 100)).toFixed(2);
    const volumeM = +(rng() * 40 + 5).toFixed(1);
    const hasHeadline = rng() < 0.55;
    const headline = hasHeadline ? HEADLINE_POOL[Math.floor(rng() * HEADLINE_POOL.length)](ticker) : null;
    const daysToEarnings = Math.floor(rng() * 45) + 1;
    return { ticker, name: meta.name, sector: meta.sector, price, changePct, volumeM, headline, daysToEarnings };
  });

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

export { UNIVERSE };
