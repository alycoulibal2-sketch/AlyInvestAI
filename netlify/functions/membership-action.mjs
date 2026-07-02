import * as membership from './_lib/membership.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => {
  const action = context.params.action;

  if (action === 'ack') {
    const m = await membership.markWelcomeSeen(user.id);
    return Response.json(membership.toPublic(m));
  }

  if (action === 'subscribe') {
    // NOTE: no payment processor is wired yet — this activates the plan
    // directly. When Stripe (or similar) is connected, this endpoint should
    // only flip status after a verified checkout/webhook.
    const m = await membership.subscribe(user.id);
    return Response.json(membership.toPublic(m));
  }

  return Response.json({ error: 'Unknown action' }, { status: 404 });
});

export const config = { path: '/api/membership/:action' };
