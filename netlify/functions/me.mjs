import { withAuth } from './_lib/auth.mjs';
import * as brokerConnection from './_lib/brokerConnection.mjs';

export default withAuth(async (req, context, user) => {
  const conn = await brokerConnection.get(user.id);
  return Response.json({
    id: user.id,
    email: user.email,
    brokerConnected: !!conn.type,
  });
});

export const config = { path: '/api/me' };
