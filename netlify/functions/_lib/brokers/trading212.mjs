// Trading 212 Public API — official, read-only, key+secret based.
// Docs: https://docs.trading212.com/api
//
// Auth: T212 issues an API Key + API Secret pair. The request must carry
// HTTP Basic Auth with base64("API_KEY:API_SECRET") — NOT a raw key in the
// Authorization header. (An earlier version of this file assumed a single
// bare key, which is why real accounts kept getting a clean 401 even with
// correct scopes — always verify against current docs, not memory.)

const LIVE = 'https://live.trading212.com/api/v0';
const DEMO = 'https://demo.trading212.com/api/v0';

// T212 tickers look like "AAPL_US_EQ" / "VUSA_EQ" — strip the exchange/type suffix for display.
function cleanTicker(t) {
  return String(t).split('_')[0];
}

function basicAuthHeader(apiKey, apiSecret) {
  const token = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

async function fetchPositions(base, headers) {
  return fetch(base + '/equity/portfolio', { headers });
}

// Live and practice (demo) accounts use separate credentials against separate
// hosts, and it's easy to check the wrong box for which one a pair belongs
// to. Rather than fail on a mismatch, try the hinted environment first and
// fall back to the other one before reporting an error — a 429 (rate limit)
// is not retried against the other host since it means the credentials are fine.
export async function verifyAndFetch(apiKey, apiSecret, practiceHint) {
  const headers = basicAuthHeader(apiKey, apiSecret);
  const order = practiceHint ? [DEMO, LIVE] : [LIVE, DEMO];

  let lastStatus = null;
  let workingBase = null;
  let positions = null;

  for (const base of order) {
    const res = await fetchPositions(base, headers);
    if (res.status === 429) {
      throw new Error('Trading 212 is rate-limiting this key right now — wait about a minute and try again.');
    }
    if (res.ok) {
      workingBase = base;
      positions = await res.json();
      break;
    }
    lastStatus = res.status;
  }

  if (!workingBase) {
    if (lastStatus === 401 || lastStatus === 403) {
      throw new Error(`Trading 212 rejected these credentials on both the live and practice endpoints (status ${lastStatus}). Double-check both the API Key and API Secret were copied correctly (they're two separate values) and that "Portfolio" scope was enabled when you generated them.`);
    }
    throw new Error(`Trading 212 API error (status ${lastStatus}). Try again in a moment.`);
  }

  let cash = 0;
  try {
    const cashRes = await fetch(workingBase + '/equity/account/cash', { headers });
    if (cashRes.ok) {
      const cashData = await cashRes.json();
      cash = cashData.free ?? cashData.total ?? 0;
    }
  } catch (e) { /* cash endpoint is best-effort */ }

  const holdings = positions.map(p => ({
    ticker: cleanTicker(p.ticker),
    name: cleanTicker(p.ticker),
    shares: p.quantity,
    avgCost: p.averagePrice,
    price: p.currentPrice,
  })).filter(h => h.shares > 0);

  return { holdings, cash };
}
