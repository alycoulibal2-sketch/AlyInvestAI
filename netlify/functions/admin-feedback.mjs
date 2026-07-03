// Developer-only view of everything submitted through the Founding Member
// Feedback flow (bug reports, feature suggestions, experience notes,
// ratings) plus the vote tally on upcoming features. GET reads; POST marks
// an entry reviewed/unreviewed so the list can distinguish handled feedback
// from what's still outstanding.

import { getStore } from '@netlify/blobs';
import { withAuth } from './_lib/auth.mjs';
import { isAdmin } from './_lib/admin.mjs';

function store() { return getStore({ name: 'alyinvest', consistency: 'strong' }); }

export default withAuth(async (req, context, user) => {
  if (!isAdmin(user.email)) return Response.json({ error: 'Not authorized' }, { status: 403 });

  if (req.method === 'GET') {
    const [entries, votes] = await Promise.all([
      store().get('feedback:entries', { type: 'json' }),
      store().get('feedback:votes', { type: 'json' }),
    ]);
    // Stored oldest-first (feedback.mjs appends with push) — most recent first for review.
    return Response.json({ entries: (entries || []).slice().reverse(), votes: votes || {} });
  }

  if (req.method === 'POST') {
    const { id, reviewed } = await req.json();
    const entries = (await store().get('feedback:entries', { type: 'json' })) || [];
    const entry = entries.find((e) => e.id === Number(id));
    if (!entry) return Response.json({ error: 'Not found' }, { status: 404 });
    entry.reviewed = !!reviewed;
    await store().set('feedback:entries', JSON.stringify(entries));
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
});

export const config = { path: '/api/admin/feedback' };
