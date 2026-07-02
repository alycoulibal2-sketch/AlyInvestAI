import * as notifications from './_lib/notifications.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => {
  const n = await notifications.markRead(user.id, context.params.id);
  return Response.json(n);
});

export const config = { path: '/api/notifications/:id/read' };
