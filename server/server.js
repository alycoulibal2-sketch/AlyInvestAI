require('dotenv').config();
const express = require('express');
const path = require('path');

const push = require('./lib/push');
const notifications = require('./lib/notifications');
const claude = require('./lib/claude');
const market = require('./lib/market');
const scheduler = require('./lib/scheduler');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Push ────────────────────────────────────────────────
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

app.post('/api/subscribe', (req, res) => {
  const count = push.addSubscription(req.body);
  res.json({ ok: true, subscriberCount: count });
});

app.post('/api/unsubscribe', (req, res) => {
  push.removeSubscription(req.body.endpoint);
  res.json({ ok: true });
});

// ─── Portfolio ───────────────────────────────────────────
app.get('/api/portfolio', (req, res) => {
  const snapshot = market.getDailySnapshot();
  res.json(scheduler.currentPortfolioView(snapshot));
});

// ─── Notifications feed ──────────────────────────────────
app.get('/api/notifications', (req, res) => {
  res.json(notifications.list());
});

app.post('/api/notifications/:id/read', (req, res) => {
  res.json(notifications.markRead(req.params.id));
});

// ─── Analysis (the 24h background job) ──────────────────
app.get('/api/analysis/latest', (req, res) => {
  res.json(scheduler.getLatestAnalysis());
});

app.post('/api/analysis/run', async (req, res) => {
  try {
    const entry = await scheduler.runDailyAnalysis({ manual: true });
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/risk-check', async (req, res) => {
  try {
    const entry = await scheduler.runRiskCheck({ manual: true });
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Live advisor chat ───────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    const snapshot = market.getDailySnapshot();
    const portfolioView = scheduler.currentPortfolioView(snapshot);
    const reply = await claude.chat(portfolioView, history, message);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4173;
app.listen(PORT, () => {
  console.log(`AlyInvest server running at http://localhost:${PORT}`);
  scheduler.start();
});
