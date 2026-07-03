// Portfolio Snapshots gallery — lists the client's snapshots, newest first.
// (Capturing a new one on demand is snapshots-capture.mjs; the monthly
// auto-capture is scheduled-monthly-snapshot.mjs.)

import { withAuth } from './_lib/auth.mjs';
import * as snapshots from './_lib/snapshots.mjs';

export default withAuth(async (req, context, user) => {
  return Response.json({ snapshots: await snapshots.list(user.id) });
});

export const config = { path: '/api/snapshots' };
