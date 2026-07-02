import { getStore } from '@netlify/blobs';
import * as portfolioLib from './portfolio.mjs';
import * as market from './market.mjs';
import * as claude from './claude.mjs';
import * as push from './push.mjs';
import * as notifications from './notifications.mjs';

function store() { return getStore('alyinvest'); }
const k = (userId) => `${userId}:analysis-log`;

async function loadLog(userId) {
  return (await store().get(k(userId), { type: 'json' })) || [];
}
async function saveLog(userId, log) {
  await store().set(k(userId), JSON.stringify(log));
}

export async function getLatestAnalysis(userId) {
  const log = await loadLog(userId);
  return log[0] || null;
}

export async function currentPortfolioView(userId, marketSnapshot, authUser) {
  const state = await portfolioLib.load(userId, authUser);
  const priced = state._live ? state : portfolioLib.applyDemoMarketPrices(state, marketSnapshot);
  return portfolioLib.computeView(priced);
}

export async function runDailyAnalysis(userId, { manual = false, authUser } = {}) {
  const marketSnapshot = market.getDailySnapshot();
  const portfolioView = await currentPortfolioView(userId, marketSnapshot, authUser);
  const recent = await notifications.list(userId);

  const result = await claude.runDailyAnalysis(portfolioView, marketSnapshot, recent);

  const entry = {
    id: Date.now(),
    ranAt: new Date().toISOString(),
    manual,
    marketDate: marketSnapshot.date,
    portfolioTotal: portfolioView.total,
    ...result,
  };
  const log = await loadLog(userId);
  log.unshift(entry);
  await saveLog(userId, log.slice(0, 90));

  const actionable = (result.recommendations || []).filter(r => r.action !== 'hold');
  const oppCount = (result.opportunities || []).length;

  await notifications.add(userId, { tag: 'update', title: 'Your advisor reviewed your portfolio', body: result.advisorMessage });

  for (const r of actionable) {
    await notifications.add(userId, {
      tag: 'update',
      title: `${r.action.toUpperCase()} ${r.ticker}${r.quantity ? ` · ${r.quantity} sh` : ''}`,
      body: r.rationale,
    });
  }
  for (const o of (result.opportunities || [])) {
    await notifications.add(userId, { tag: 'opportunity', title: `Opportunity: ${o.ticker}${o.name ? ' · ' + o.name : ''}`, body: o.rationale });
  }
  for (const a of (result.alerts || [])) {
    await notifications.add(userId, { tag: a.severity === 'critical' ? 'alert' : 'update', title: a.title, body: a.body });
  }

  const pushLines = [];
  if (actionable.length) pushLines.push(`${actionable.length} recommendation${actionable.length > 1 ? 's' : ''}`);
  if (oppCount) pushLines.push(`${oppCount} opportunit${oppCount > 1 ? 'ies' : 'y'}`);
  const summary = pushLines.length ? pushLines.join(' · ') : 'Portfolio reviewed — no changes needed';

  await push.sendToUser(userId, { title: 'Your Advisor · Daily Review', body: summary, url: '/#advisor', tag: 'daily-analysis' });

  return entry;
}

export async function runRiskCheck(userId, { manual = false, authUser } = {}) {
  const marketSnapshot = market.getIntradaySnapshot();
  const portfolioView = await currentPortfolioView(userId, marketSnapshot, authUser);
  const result = await claude.runRiskCheck(portfolioView, marketSnapshot);

  if (result.riskDetected && (result.alerts || []).length) {
    for (const a of result.alerts) {
      await notifications.add(userId, { tag: 'alert', title: a.title, body: a.body });
    }
    const first = result.alerts[0];
    await push.sendToUser(userId, { title: `Risk Alert · ${first.title}`, body: first.body, url: '/#advisor', tag: 'risk-alert' });
  }

  return { ranAt: new Date().toISOString(), manual, ...result };
}
