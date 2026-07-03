// The Advisor Journal — every daily analysis carries a first-person
// journalEntry the advisor wrote that day, so the journal isn't a separate
// store: it's a view over the analysis log (which is exactly why it links
// naturally to the Timeline and each day's recommendations). Supports
// searching by company ticker, recommendation action, free text, or date.

import * as analysisCore from './_lib/analysisCore.mjs';
import { withAuth } from './_lib/auth.mjs';

function toEntry(a) {
  const recs = a.recommendations || [];
  const opps = a.opportunities || [];
  const companies = [...new Set([...recs.map(r => r.ticker), ...opps.map(o => o.ticker)].filter(Boolean))];
  const actions = [...new Set(recs.map(r => r.action).filter(a => a && a !== 'hold'))];
  return {
    id: a.id,
    at: a.ranAt,
    date: a.marketDate || (a.ranAt || '').slice(0, 10),
    text: a.journalEntry || a.advisorMessage || '',
    health: a.portfolioHealthScore ?? null,
    companies,
    actions,
  };
}

export default withAuth(async (req, context, user) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const action = (url.searchParams.get('action') || '').trim().toLowerCase();
  const date = (url.searchParams.get('date') || '').trim(); // YYYY-MM-DD prefix

  const analyses = await analysisCore.listAnalyses(user.id, 90);
  let entries = analyses.map(toEntry).filter(e => e.text);

  if (q) {
    entries = entries.filter(e =>
      e.text.toLowerCase().includes(q) ||
      e.companies.some(c => c.toLowerCase().includes(q))
    );
  }
  if (action) entries = entries.filter(e => e.actions.map(a => a.toLowerCase()).includes(action));
  if (date) entries = entries.filter(e => (e.date || '').startsWith(date));

  return Response.json({ entries });
});

export const config = { path: '/api/journal' };
