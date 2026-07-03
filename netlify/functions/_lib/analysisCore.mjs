import { getStore } from '@netlify/blobs';
import * as portfolioLib from './portfolio.mjs';
import * as market from './market.mjs';
import * as claude from './claude.mjs';
import * as push from './push.mjs';
import * as notifications from './notifications.mjs';
import * as membership from './membership.mjs';
import * as favorites from './favorites.mjs';
import * as snapshots from './snapshots.mjs';

// Premium/Elite (and Founding) get 'high' Web Push urgency — a real protocol
// header, not cosmetic — so their alerts are more likely to wake the device
// immediately rather than wait for a batched delivery window.
async function pushUrgency(userId) {
  const ent = membership.entitlements(await membership.ensure(userId));
  return ent && ent.priorityPush ? 'high' : 'normal';
}

// strong consistency: reads reflect writes immediately (default is eventual,
// which made a just-run analysis vanish on the next read-after-write)
function store() { return getStore({ name: 'alyinvest', consistency: 'strong' }); }
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

export async function listAnalyses(userId, limit = 10) {
  const log = await loadLog(userId);
  return log.slice(0, limit);
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
  const favs = await favorites.list(userId);

  const result = await claude.runDailyAnalysis(portfolioView, marketSnapshot, recent, favs);

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

  await push.sendToUser(userId, { title: 'Your Advisor · Daily Review', body: summary, url: '/#advisor', tag: 'daily-analysis' }, { urgency: await pushUrgency(userId) });

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
    await push.sendToUser(userId, { title: `Risk Alert · ${first.title}`, body: first.body, url: '/#advisor', tag: 'risk-alert' }, { urgency: await pushUrgency(userId) });
  }

  return { ranAt: new Date().toISOString(), manual, ...result };
}

// Captures a Portfolio Snapshot — the computed state (from real portfolio +
// latest analysis) plus a fresh narrative from the advisor. `reason` is
// 'monthly' (scheduled) or 'manual'. Returns the stored snapshot.
export async function captureSnapshot(userId, { reason = 'manual', authUser } = {}) {
  const marketSnapshot = market.getDailySnapshot();
  const [portfolioView, latestAnalysis] = await Promise.all([
    currentPortfolioView(userId, marketSnapshot, authUser),
    getLatestAnalysis(userId),
  ]);

  const narrative = await claude.generateSnapshotNarrative(portfolioView, latestAnalysis, marketSnapshot, {
    reason, date: new Date().toISOString().slice(0, 10),
  });

  // Allocation and top holdings, computed from the real portfolio.
  const topHoldings = [...portfolioView.holdings]
    .sort((a, b) => b.value - a.value).slice(0, 5)
    .map(h => ({ ticker: h.ticker, weightPct: h.weightPct, value: h.value, gainPct: h.gainPct }));

  const entry = await snapshots.add(userId, {
    reason,
    // Computed facts
    portfolioValue: portfolioView.total,
    cash: portfolioView.cash,
    health: latestAnalysis?.portfolioHealthScore ?? null,
    healthBreakdown: latestAnalysis?.healthBreakdown ?? null,
    risk: latestAnalysis?.overallRisk ?? null,
    diversification: latestAnalysis?.healthBreakdown?.diversification?.score ?? latestAnalysis?.diversificationScore ?? null,
    goals: (latestAnalysis?.goalAssessments || []).map(g => ({ goal: g.goal, progressPct: g.progressPct, probabilityPct: g.probabilityPct })),
    topHoldings,
    sectorWeights: portfolioView.sectorWeights,
    marketVix: marketSnapshot.vix,
    // Advisor narrative
    ...narrative,
  });

  await notifications.add(userId, {
    tag: 'update',
    title: reason === 'monthly' ? 'Your monthly Portfolio Snapshot is ready' : 'Portfolio Snapshot saved',
    body: narrative.advisorSummary,
  });

  return entry;
}
