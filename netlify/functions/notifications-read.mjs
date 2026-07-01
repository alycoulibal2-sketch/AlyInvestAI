import * as notifications from './_lib/notifications.mjs';

export default async (req, context) => {
  const n = await notifications.markRead(context.params.id);
  return Response.json(n);
};

export const config = { path: '/api/notifications/:id/read' };
