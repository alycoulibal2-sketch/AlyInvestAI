// Company search for following favorites — type a ticker ("AMZN") or a name
// ("Amazon") and get matches from the whole catalog, each with today's live
// (simulated) price and change so the picker feels like a real market search.

import { withAuth } from './_lib/auth.mjs';
import * as catalog from './_lib/catalog.mjs';
import * as market from './_lib/market.mjs';

export default withAuth(async (req) => {
  const q = new URL(req.url).searchParams.get('q') || '';
  const results = catalog.search(q, 14).map(r => {
    const px = market.priceTicker(r.ticker);
    return { ...r, price: px?.price ?? null, changePct: px?.changePct ?? null };
  });
  return Response.json({ results });
});

export const config = { path: '/api/companies/search' };
