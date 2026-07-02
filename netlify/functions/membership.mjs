import * as membership from './_lib/membership.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => {
  const m = await membership.ensure(user.id);
  return Response.json(membership.toPublic(m));
});

export const config = { path: '/api/membership' };
