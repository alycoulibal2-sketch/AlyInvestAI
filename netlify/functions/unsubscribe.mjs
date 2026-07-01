import * as push from './_lib/push.mjs';

export default async (req) => {
  const { endpoint } = await req.json();
  await push.removeSubscription(endpoint);
  return Response.json({ ok: true });
};

export const config = { path: '/api/unsubscribe' };
