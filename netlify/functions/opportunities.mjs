// The Opportunity Feed — the opportunities from the client's latest daily
// analysis, shaped for the feed: Company, Opportunity Score (=confidence),
// Reason, Risk, Advisor Summary. No new Claude call; these are already
// produced (and enriched with a risk note) by the daily analysis.

import { withAuth } from './_lib/auth.mjs';
import * as analysisCore from './_lib/analysisCore.mjs';

export default withAuth(async (req, context, user) => {
  const latest = await analysisCore.getLatestAnalysis(user.id);
  const opportunities = (latest?.opportunities || []).map(o => ({
    ticker: o.ticker,
    name: o.name || o.ticker,
    score: o.confidence,
    reason: o.rationale,
    risk: o.risk || null,
    quantity: o.quantity ?? null,
    estPrice: o.estPrice ?? null,
  })).sort((a, b) => (b.score || 0) - (a.score || 0));

  return Response.json({ opportunities, asOf: latest?.ranAt || null });
});

export const config = { path: '/api/opportunities' };
