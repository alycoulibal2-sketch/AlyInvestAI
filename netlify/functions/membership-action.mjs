import * as membership from './_lib/membership.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => {
  const action = context.params.action;

  if (action === 'ack') {
    const m = await membership.markWelcomeSeen(user.id);
    return Response.json(membership.toPublic(m));
  }

  // Direct activation is retired: Premium is only granted by the Stripe
  // webhook after verified payment. Old clients calling this get pointed
  // at the real checkout flow.
  if (action === 'subscribe') {
    return Response.json({ error: 'Use /api/billing/checkout — subscriptions activate after payment.', code: 'use_checkout' }, { status: 410 });
  }

  return Response.json({ error: 'Unknown action' }, { status: 404 });
});

export const config = { path: '/api/membership/:action' };
