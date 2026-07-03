// Captures a Portfolio Snapshot for every active member, once a month.
// Runs on the 1st at 08:00 UTC (just after the daily analysis window, so the
// snapshot reflects a fresh health/goal read). Skips lapsed accounts and any
// account that already has a snapshot from this calendar month.

import * as analysisCore from './_lib/analysisCore.mjs';
import * as userRegistry from './_lib/userRegistry.mjs';
import * as membership from './_lib/membership.mjs';
import * as snapshots from './_lib/snapshots.mjs';

function sameUtcMonth(iso) {
  if (!iso) return false;
  const d = new Date(iso), now = new Date();
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
}

export default async () => {
  const userIds = await userRegistry.listAll();
  for (const userId of userIds) {
    try {
      if (!(await membership.isActive(userId))) continue; // monitoring paused
      const last = await snapshots.latest(userId);
      if (last && last.reason === 'monthly' && sameUtcMonth(last.at)) continue; // already have this month's
      await analysisCore.captureSnapshot(userId, { reason: 'monthly' });
    } catch (err) {
      console.error(`[scheduled-monthly-snapshot] failed for user ${userId}:`, err.message);
    }
  }
};

// Runs on the 1st of each month at 08:00 UTC.
export const config = { schedule: '0 8 1 * *' };
