import * as brokerConnection from './_lib/brokerConnection.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => {
  const conn = await brokerConnection.get(user.id);
  return Response.json(brokerConnection.toPublicStatus(conn));
});

export const config = { path: '/api/broker-status' };
