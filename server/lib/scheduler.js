const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const portfolioLib = require('./portfolio');
const market = require('./market');
const claude = require('./claude');
const push = require('./push');
const notifications = require('./notifications');

const LOG_FILE = path.join(__dirname, '..', 'data', 'analysis-log.json');

function loadLog() {
  if (!fs.existsSync(LOG_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (e) { return []; }
}
function saveLog(log) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}
function getLatestAnalysis() {
  const log = loadLog();
  return log[0] || null;
}

function currentPortfolioView(marketSnapshot) {
  const state = portfolioLib.load();
  return portfolioLib.withLivePrices(state, marketSnapshot);
}

async function runDailyAnalysis({ manual = false } = {}) {
  const marketSnapshot = market.getDailySnapshot();
  const portfolioView = currentPortfolioView(marketSnapshot);
  const recent = notifications.list();

  const result = await claude.runDailyAnalysis(portfolioView, marketSnapshot, recent);

  const entry = {
    id: Date.now(),
    ranAt: new Date().toISOString(),
    manual,
    marketDate: marketSnapshot.date,
    portfolioTotal: portfolioView.total,
    ...result,
  };
  const log = loadLog();
  log.unshift(entry);
  saveLog(log.slice(0, 90));

  // Turn the analysis into notification feed items + one push summary.
  const actionable = (result.recommendations || []).filter(r => r.action !== 'hold');
  const oppCount = (result.opportunities || []).length;

  notifications.add({
    tag: 'update',
    title: 'Your advisor reviewed your portfolio',
    body: result.advisorMessage,
  });

  actionable.forEach(r => {
    notifications.add({
      tag: 'update',
      title: `${r.action.toUpperCase()} ${r.ticker}${r.quantity ? ` · ${r.quantity} sh` : ''}`,
      body: r.rationale,
    });
  });

  (result.opportunities || []).forEach(o => {
    notifications.add({
      tag: 'opportunity',
      title: `Opportunity: ${o.ticker}${o.name ? ' · ' + o.name : ''}`,
      body: o.rationale,
    });
  });

  (result.alerts || []).forEach(a => {
    notifications.add({ tag: a.severity === 'critical' ? 'alert' : 'update', title: a.title, body: a.body });
  });

  const pushLines = [];
  if (actionable.length) pushLines.push(`${actionable.length} recommendation${actionable.length > 1 ? 's' : ''}`);
  if (oppCount) pushLines.push(`${oppCount} opportunit${oppCount > 1 ? 'ies' : 'y'}`);
  const summary = pushLines.length ? pushLines.join(' · ') : 'Portfolio reviewed — no changes needed';

  await push.sendToAll({
    title: 'Your Advisor · Daily Review',
    body: summary,
    url: '/#advisor',
    tag: 'daily-analysis',
  });

  return entry;
}

async function runRiskCheck({ manual = false } = {}) {
  const marketSnapshot = market.getIntradaySnapshot();
  const portfolioView = currentPortfolioView(marketSnapshot);
  const result = await claude.runRiskCheck(portfolioView, marketSnapshot);

  if (result.riskDetected && (result.alerts || []).length) {
    result.alerts.forEach(a => {
      notifications.add({ tag: 'alert', title: a.title, body: a.body });
    });
    const first = result.alerts[0];
    await push.sendToAll({
      title: `Risk Alert · ${first.title}`,
      body: first.body,
      url: '/#advisor',
      tag: 'risk-alert',
    });
  }

  return { ranAt: new Date().toISOString(), manual, ...result };
}

function start() {
  // Daily deep analysis — 07:00 server time.
  cron.schedule('0 7 * * *', () => {
    runDailyAnalysis().catch(err => console.error('[scheduler] daily analysis failed:', err.message));
  });

  // Lightweight risk scan every 2 hours during the day.
  cron.schedule('0 */2 * * *', () => {
    runRiskCheck().catch(err => console.error('[scheduler] risk check failed:', err.message));
  });

  console.log('[scheduler] daily analysis: every day at 07:00 · risk scan: every 2 hours');
}

module.exports = { start, runDailyAnalysis, runRiskCheck, getLatestAnalysis, currentPortfolioView };
