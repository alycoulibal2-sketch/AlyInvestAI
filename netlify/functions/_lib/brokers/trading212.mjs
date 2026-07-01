// Trading 212 Public API — official, read-only, API-key based.
// Docs: https://t212public-api-docs.redoc.ly/

function baseUrl(practice) {
  return practice ? 'https://demo.trading212.com/api/v0' : 'https://live.trading212.com/api/v0';
}

// T212 tickers look like "AAPL_US_EQ" / "VUSA_EQ" — strip the exchange/type suffix for display.
function cleanTicker(t) {
  return String(t).split('_')[0];
}

export async function verifyAndFetch(apiKey, practice) {
  const base = baseUrl(practice);
  const headers = { Authorization: apiKey };

  const posRes = await fetch(base + '/equity/portfolio', { headers });
  if (posRes.status === 401 || posRes.status === 403) {
    throw new Error('Trading 212 rejected this API key. Double-check it was copied correctly and has "Portfolio" scope enabled.');
  }
  if (!posRes.ok) {
    throw new Error(`Trading 212 API error (${posRes.status}). Try again in a moment.`);
  }
  const positions = await posRes.json();

  let cash = 0;
  try {
    const cashRes = await fetch(base + '/equity/account/cash', { headers });
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
