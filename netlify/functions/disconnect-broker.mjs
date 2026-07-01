import * as brokerConnection from './_lib/brokerConnection.mjs';

export default async () => {
  await brokerConnection.clear();
  return Response.json({ ok: true });
};

export const config = { path: '/api/disconnect-broker' };
