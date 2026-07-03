// Developer-only view of everything submitted through the Founding Member
// Feedback flow (bug reports, feature suggestions, experience notes,
// ratings) plus the vote tally on upcoming features. Read-only.

import { getStore } from '@netlify/blobs';
import { withAuth } from './_lib/auth.mjs';
import { isAdmin } from './_lib/admin.mjs';

function store() { return getStore({ name: 'alyinvest', consistency: 'strong' }); }

export default withAuth(async (req, context, user) => {
  if (!isAdmin(user.email)) return Response.json({ error: 'Not authorized' }, { status: 403 });

  const [entries, votes] = await Promise.all([
    store().get('feedback:entries', { type: 'json' }),
    store().get('feedback:votes', { type: 'json' }),
  ]);

  // Stored oldest-first (feedback.mjs appends with push) — most recent first for review.
  return Response.json({ entries: (entries || []).slice().reverse(), votes: votes || {} });
});

export const config = { path: '/api/admin/feedback' };
