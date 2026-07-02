import * as brokerConnection from './_lib/brokerConnection.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => {
  await brokerConnection.clear(user.id);
  return Response.json({ ok: true });
});

export const config = { path: '/api/disconnect-broker' };
