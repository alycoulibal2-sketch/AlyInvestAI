import * as membership from './_lib/membership.mjs';
import * as interactions from './_lib/interactions.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => {
  const m = await membership.ensure(user.id);
  const ent = membership.entitlements(m);
  const usage = ent ? await interactions.toPublic(user.id, ent) : { limit: null, used: null };
  return Response.json({
    ...membership.toPublic(m),
    entitlementLabel: ent ? ent.label : null,
    interactions: usage,
  });
});

export const config = { path: '/api/membership' };
