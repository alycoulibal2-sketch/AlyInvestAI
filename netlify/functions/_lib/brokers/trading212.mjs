// Trading 212 Public API — official, read-only, API-key based.
// Docs: https://t212public-api-docs.redoc.ly/

const LIVE = 'https://live.trading212.com/api/v0';
const DEMO = 'https://demo.trading212.com/api/v0';

// T212 tickers look like "AAPL_US_EQ" / "VUSA_EQ" — strip the exchange/type suffix for display.
function cleanTicker(t) {
  return String(t).split('_')[0];
}

async function fetchPositions(base, apiKey) {
  return fetch(base + '/equity/portfolio', { headers: { Authorization: apiKey } });
}

// Live and practice (demo) accounts use separate keys against separate hosts,
// and it's easy to check the wrong box for which one a key belongs to. Rather
// than fail on a mismatch, try the hinted environment first and silently fall
// back to the other one before reporting an error — a 429 (rate limit) is not
// retried against the other host since it means the key itself is fine.
export async function verifyAndFetch(apiKey, practiceHint) {
  const order = practiceHint ? [DEMO, LIVE] : [LIVE, DEMO];

  let lastStatus = null;
  let workingBase = null;
  let positions = null;

  for (const base of order) {
    const res = await fetchPositions(base, apiKey);
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
      throw new Error(`Trading 212 rejected this API key on both the live and practice endpoints (status ${lastStatus}). Check it was copied correctly and has "Portfolio" read scope enabled when you generated it in Settings → API (Beta).`);
    }
    throw new Error(`Trading 212 API error (status ${lastStatus}). Try again in a moment.`);
  }

  let cash = 0;
  try {
    const cashRes = await fetch(workingBase + '/equity/account/cash', { headers: { Authorization: apiKey } });
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
