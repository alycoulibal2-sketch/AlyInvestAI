// Capture a Portfolio Snapshot on demand ("save this moment"). Active
// members only, rate-limited to once per day so the gallery stays a curated
// album rather than a firehose — the monthly auto-capture is the main source.

import { withAuth } from './_lib/auth.mjs';
import * as membership from './_lib/membership.mjs';
import * as snapshots from './_lib/snapshots.mjs';
import * as analysisCore from './_lib/analysisCore.mjs';

export default withAuth(async (req, context, user) => {
  if (!(await membership.isActive(user.id))) {
    return Response.json({ error: 'Resume your subscription to capture snapshots.', code: 'membership_required' }, { status: 402 });
  }
  const last = await snapshots.latest(user.id);
  if (last && Date.now() - Date.parse(last.at) < 20 * 3600 * 1000) {
    return Response.json({ error: 'You already captured a snapshot today. Your next monthly one arrives automatically.', code: 'rate_limited' }, { status: 429 });
  }
  const entry = await analysisCore.captureSnapshot(user.id, { reason: 'manual', authUser: user });
  return Response.json({ snapshot: entry });
});

export const config = { path: '/api/snapshots/capture' };
