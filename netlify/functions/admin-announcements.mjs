// Developer-only announcement management. GET lists everything ever posted
// (for the admin's own reference); POST creates a new one (becomes the
// latest, so it's what every user sees next); DELETE removes one from the
// list (does not un-notify anyone who already saw it).

import { withAuth } from './_lib/auth.mjs';
import { isAdmin } from './_lib/admin.mjs';
import * as announcements from './_lib/announcements.mjs';

export default withAuth(async (req, context, user) => {
  if (!isAdmin(user.email)) return Response.json({ error: 'Not authorized' }, { status: 403 });

  if (req.method === 'GET') {
    return Response.json({ items: await announcements.list() });
  }
  if (req.method === 'POST') {
    const { title, body } = await req.json();
    if (!String(title || '').trim() && !String(body || '').trim()) {
      return Response.json({ error: 'Nothing to post' }, { status: 400 });
    }
    const entry = await announcements.create({ title, body, createdBy: user.email });
    return Response.json(entry);
  }
  if (req.method === 'DELETE') {
    const { id } = await req.json();
    const items = await announcements.remove(id);
    return Response.json({ items });
  }
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
});

export const config = { path: '/api/admin/announcements' };
