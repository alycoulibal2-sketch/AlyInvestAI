import { getStore } from '@netlify/blobs';
import * as portfolioLib from './portfolio.mjs';
import * as market from './market.mjs';
import * as claude from './claude.mjs';
import * as push from './push.mjs';
import * as notifications from './notifications.mjs';

function store() { return getStore('alyinvest'); }

async function loadLog() {
  return (await store().get('analysis-log', { type: 'json' })) || [];
}
async function saveLog(log) {
  await store().set('analysis-log', JSON.stringify(log));
}

export async function getLatestAnalysis() {
  const log = await loadLog();
  return log[0] || null;
}

export async function currentPortfolioView(marketSnapshot) {
  const state = await portfolioLib.load();
  const priced = state._live ? state : portfolioLib.applyDemoMarketPrices(state, marketSnapshot);
  return portfolioLib.computeView(priced);
}

export async function runDailyAnalysis({ manual = false } = {}) {
  const marketSnapshot = market.getDailySnapshot();
  const portfolioView = await currentPortfolioView(marketSnapshot);
  const recent = await notifications.list();

  const result = await claude.runDailyAnalysis(portfolioView, marketSnapshot, recent);

  const entry = {
    id: Date.now(),
    ranAt: new Date().toISOString(),
    manual,
    marketDate: marketSnapshot.date,
    portfolioTotal: portfolioView.total,
    ...result,
  };
  const log = await loadLog();
  log.unshift(entry);
  await saveLog(log.slice(0, 90));

  const actionable = (result.recommendations || []).filter(r => r.action !== 'hold');
  const oppCount = (result.opportunities || []).length;

  await notifications.add({ tag: 'update', title: 'Your advisor reviewed your portfolio', body: result.advisorMessage });

  for (const r of actionable) {
    await notifications.add({
      tag: 'update',
      title: `${r.action.toUpperCase()} ${r.ticker}${r.quantity ? ` · ${r.quantity} sh` : ''}`,
      body: r.rationale,
    });
  }
  for (const o of (result.opportunities || [])) {
    await notifications.add({ tag: 'opportunity', title: `Opportunity: ${o.ticker}${o.name ? ' · ' + o.name : ''}`, body: o.rationale });
  }
  for (const a of (result.alerts || [])) {
    await notifications.add({ tag: a.severity === 'critical' ? 'alert' : 'update', title: a.title, body: a.body });
  }

  const pushLines = [];
  if (actionable.length) pushLines.push(`${actionable.length} recommendation${actionable.length > 1 ? 's' : ''}`);
  if (oppCount) pushLines.push(`${oppCount} opportunit${oppCount > 1 ? 'ies' : 'y'}`);
  const summary = pushLines.length ? pushLines.join(' · ') : 'Portfolio reviewed — no changes needed';

  await push.sendToAll({ title: 'Your Advisor · Daily Review', body: summary, url: '/#advisor', tag: 'daily-analysis' });

  return entry;
}

export async function runRiskCheck({ manual = false } = {}) {
  const marketSnapshot = market.getIntradaySnapshot();
  const portfolioView = await currentPortfolioView(marketSnapshot);
  const result = await claude.runRiskCheck(portfolioView, marketSnapshot);

  if (result.riskDetected && (result.alerts || []).length) {
    for (const a of result.alerts) {
      await notifications.add({ tag: 'alert', title: a.title, body: a.body });
    }
    const first = result.alerts[0];
    await push.sendToAll({ title: `Risk Alert · ${first.title}`, body: first.body, url: '/#advisor', tag: 'risk-alert' });
  }

  return { ranAt: new Date().toISOString(), manual, ...result };
}
