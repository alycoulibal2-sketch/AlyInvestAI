import { withAuth } from './_lib/auth.mjs';
import * as announcements from './_lib/announcements.mjs';

export default withAuth(async (req, context, user) => {
  const { id } = await req.json();
  if (id == null) return Response.json({ error: 'Missing id' }, { status: 400 });
  await announcements.markSeen(user.id, id);
  return Response.json({ ok: true });
});

export const config = { path: '/api/announcements/ack' };
