import * as push from './_lib/push.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => {
  const { endpoint } = await req.json();
  await push.removeSubscription(user.id, endpoint);
  return Response.json({ ok: true });
});

export const config = { path: '/api/unsubscribe' };
