// Favorite companies the client follows without owning. GET returns each
// favorite enriched with live price/change/headline from the market feed;
// POST adds one, DELETE removes one. Any active member can use this.

import { withAuth } from './_lib/auth.mjs';
import * as membership from './_lib/membership.mjs';
import * as favorites from './_lib/favorites.mjs';
import * as market from './_lib/market.mjs';
import * as analysisCore from './_lib/analysisCore.mjs';

export default withAuth(async (req, context, user) => {
  if (!(await membership.isActive(user.id))) {
    return Response.json({ error: 'Resume your subscription to follow companies.', code: 'membership_required' }, { status: 402 });
  }

  if (req.method === 'POST') {
    const { ticker } = await req.json();
    const r = await favorites.add(user.id, ticker);
    if (!r.ok) return Response.json({ error: 'That company is not in your advisor’s coverage yet.' }, { status: 400 });
  } else if (req.method === 'DELETE') {
    const { ticker } = await req.json();
    await favorites.remove(user.id, ticker);
  }

  // Enrich the (possibly just-updated) list with market data + any recent
  // recommendation the advisor made about each favorite.
  const [list, snapshot, latest] = await Promise.all([
    favorites.list(user.id),
    Promise.resolve(market.getDailySnapshot()),
    analysisCore.getLatestAnalysis(user.id),
  ]);
  const byTicker = {};
  snapshot.tickers.forEach(t => { byTicker[t.ticker] = t; });
  const recRec = {};
  (latest?.recommendations || []).forEach(r => { recRec[r.ticker] = r; });
  (latest?.opportunities || []).forEach(o => { if (!recRec[o.ticker]) recRec[o.ticker] = { ticker: o.ticker, action: 'buy', rationale: o.rationale, confidence: o.confidence }; });

  const items = list.map(tk => {
    const m = byTicker[tk] || {};
    const rec = recRec[tk] || null;
    return {
      ticker: tk,
      name: m.name || tk,
      sector: m.sector || null,
      price: m.price ?? null,
      changePct: m.changePct ?? null,
      headline: m.headline || null,
      daysToEarnings: m.daysToEarnings ?? null,
      recommendation: rec ? { action: rec.action, rationale: rec.rationale, confidence: rec.confidence } : null,
    };
  });

  return Response.json({ favorites: items });
});

export const config = { path: '/api/favorites' };
