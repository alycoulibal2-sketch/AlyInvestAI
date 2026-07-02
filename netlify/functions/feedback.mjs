// Founding Member feedback: bug reports, feature suggestions, experience
// notes, AI-recommendation ratings, and votes on upcoming features.
// Entries land in a global list for review; votes are tallied globally with
// a per-user voted set so each account votes once per feature.

import { getStore } from '@netlify/blobs';
import { withAuth } from './_lib/auth.mjs';

function store() { return getStore({ name: 'alyinvest', consistency: 'strong' }); }

const UPCOMING = [
  { id: 'live-market-data', title: 'Live market data', desc: 'Real-time prices and news from a live feed' },
  { id: 'weekly-report', title: 'Weekly PDF report', desc: 'A beautiful summary of your week, every Monday' },
  { id: 'multi-portfolio', title: 'Multiple portfolios', desc: 'Connect several brokers side by side' },
  { id: 'dividend-tracking', title: 'Dividend tracking', desc: 'Income calendar and projections' },
  { id: 'mobile-app', title: 'Native mobile app', desc: 'Corvexsa for iOS and Android' },
  { id: 'goal-planning', title: 'Goal planning', desc: 'Retirement and milestone projections with your advisor' },
];

const KINDS = ['bug', 'feature', 'experience', 'rating'];

export default withAuth(async (req, context, user) => {
  if (req.method === 'GET') {
    const [votes, mine] = await Promise.all([
      store().get('feedback:votes', { type: 'json' }),
      store().get(`${user.id}:votes`, { type: 'json' }),
    ]);
    const tally = votes || {};
    const voted = mine || [];
    return Response.json({
      features: UPCOMING.map(f => ({ ...f, votes: tally[f.id] || 0, voted: voted.includes(f.id) })),
    });
  }

  if (req.method === 'POST') {
    const body = await req.json();

    if (body.kind === 'vote') {
      if (!UPCOMING.find(f => f.id === body.featureId)) {
        return Response.json({ error: 'Unknown feature' }, { status: 400 });
      }
      const voted = (await store().get(`${user.id}:votes`, { type: 'json' })) || [];
      if (!voted.includes(body.featureId)) {
        voted.push(body.featureId);
        const tally = (await store().get('feedback:votes', { type: 'json' })) || {};
        tally[body.featureId] = (tally[body.featureId] || 0) + 1;
        await store().set(`${user.id}:votes`, JSON.stringify(voted));
        await store().set('feedback:votes', JSON.stringify(tally));
      }
      return Response.json({ ok: true });
    }

    if (!KINDS.includes(body.kind)) return Response.json({ error: 'Unknown feedback kind' }, { status: 400 });
    const text = String(body.text || '').slice(0, 4000);
    const rating = body.kind === 'rating' ? Math.min(5, Math.max(1, Number(body.rating) || 0)) : null;
    if (!text && !rating) return Response.json({ error: 'Nothing to submit' }, { status: 400 });

    const entries = (await store().get('feedback:entries', { type: 'json' })) || [];
    entries.push({ userId: user.id, email: user.email || null, kind: body.kind, text, rating, at: new Date().toISOString() });
    await store().set('feedback:entries', JSON.stringify(entries.slice(-1000)));
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
});

export const config = { path: '/api/feedback' };
