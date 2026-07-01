import * as push from './_lib/push.mjs';

export default async (req) => {
  const sub = await req.json();
  const count = await push.addSubscription(sub);
  return Response.json({ ok: true, subscriberCount: count });
};

export const config = { path: '/api/subscribe' };
