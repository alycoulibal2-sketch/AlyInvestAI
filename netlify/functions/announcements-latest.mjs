import { withAuth } from './_lib/auth.mjs';
import * as announcements from './_lib/announcements.mjs';

export default withAuth(async (req, context, user) => {
  const announcement = await announcements.latestUnseenFor(user.id);
  return Response.json({ announcement });
});

export const config = { path: '/api/announcements/latest' };
