// Bridges AlyInvest to a locally-running IBKR Client Portal Gateway.
//
// Why this exists: IBKR has no serverless-friendly API. The only way to read
// account data is through the Client Portal Gateway, a Java process you run
// yourself and log into via a browser (with 2FA) at https://localhost:5000.
// That session expires roughly every 24h and needs you to log back in through
// the browser — this bridge cannot automate that part for you.
//
// Run this next to a logged-in gateway, then point AlyInvest's "Connect
// Interactive Brokers" screen at wherever this ends up reachable (e.g. via a
// tunnel, or a small always-on machine on your network).
require('dotenv').config();
const express = require('express');

const SECRET = process.env.BRIDGE_SECRET;
const GATEWAY = (process.env.IBKR_GATEWAY_URL || 'https://localhost:5000/v1/api').replace(/\/$/, '');
const PORT = process.env.PORT || 7777;

if (!SECRET) {
  console.error('BRIDGE_SECRET is not set — refusing to start with no auth. Copy .env.example to .env first.');
  process.exit(1);
}

// The gateway serves a self-signed cert on localhost — this is IBKR's own
// documented local-dev setup, not a production TLS relaxation of a public host.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();

function auth(req, res, next) {
  if (req.headers['x-bridge-secret'] !== SECRET) return res.status(401).json({ error: 'unauthorized' });
  next();
}

async function gatewayGet(path) {
  const res = await fetch(GATEWAY + path);
  if (!res.ok) throw new Error(`Gateway ${path} returned ${res.status}`);
  return res.json();
}

app.get('/health', async (req, res) => {
  try {
    const accounts = await gatewayGet('/portfolio/accounts');
    res.json({ ok: true, gatewayReachable: true, accountCount: accounts.length });
  } catch (err) {
    res.json({ ok: true, gatewayReachable: false, error: err.message });
  }
});

app.get('/positions', auth, async (req, res) => {
  try {
    const accounts = await gatewayGet('/portfolio/accounts');
    const accountId = accounts[0]?.accountId || accounts[0]?.id;
    if (!accountId) {
      return res.status(502).json({ error: 'No IBKR account found — open https://localhost:5000 and log in.' });
    }

    const positions = await gatewayGet(`/portfolio/${accountId}/positions/0`);
    const summary = await gatewayGet(`/portfolio/${accountId}/summary`).catch(() => ({}));

    const holdings = positions
      .filter(p => p.position && p.position !== 0)
      .map(p => ({
        ticker: (p.ticker || p.contractDesc || '').split(' ')[0],
        name: p.contractDesc || p.ticker,
        shares: p.position,
        avgCost: p.avgCost ?? p.avgPrice ?? 0,
        price: p.mktPrice ?? p.avgCost ?? 0,
      }));

    const cash = summary.availablefunds?.amount ?? summary.totalcashvalue?.amount ?? 0;

    res.json({ holdings, cash });
  } catch (err) {
    res.status(500).json({ error: err.message + ' — is the Client Portal Gateway running and logged in at ' + GATEWAY + '?' });
  }
});

// Keep the gateway session alive while this process runs. Does NOT survive
// the ~24h forced re-login — that still requires you to open the browser.
setInterval(() => {
  fetch(GATEWAY + '/tickle').catch(() => {});
}, 60_000);

app.listen(PORT, () => {
  console.log(`IBKR bridge listening on http://localhost:${PORT}`);
  console.log(`Proxying to gateway at ${GATEWAY}`);
  console.log('Make sure you are logged in at https://localhost:5000 in a browser.');
});
