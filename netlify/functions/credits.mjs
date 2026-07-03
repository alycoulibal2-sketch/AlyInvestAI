// The account's Corvexsa Credits balance + recent history, and the available
// packs (so the UI renders the store from one source of truth).

import { withAuth } from './_lib/auth.mjs';
import * as credits from './_lib/credits.mjs';
import { CREDIT_PACKS } from './_lib/stripe.mjs';

export default withAuth(async (req, context, user) => {
  const c = await credits.get(user.id);
  return Response.json({
    ...credits.toPublic(c),
    packs: CREDIT_PACKS.map(p => ({ id: p.id, label: p.label, amount: p.amount, credits: p.credits, tagline: p.tagline, best: !!p.best })),
  });
});

export const config = { path: '/api/credits' };
