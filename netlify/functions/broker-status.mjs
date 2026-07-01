import * as brokerConnection from './_lib/brokerConnection.mjs';

export default async () => {
  const conn = await brokerConnection.get();
  return Response.json(brokerConnection.toPublicStatus(conn));
};

export const config = { path: '/api/broker-status' };
