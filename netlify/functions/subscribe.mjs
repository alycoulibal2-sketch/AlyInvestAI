import * as push from './_lib/push.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => {
  const sub = await req.json();
  const count = await push.addSubscription(user.id, sub);
  return Response.json({ ok: true, subscriberCount: count });
});

export const config = { path: '/api/subscribe' };
