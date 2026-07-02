import * as analysisCore from './_lib/analysisCore.mjs';
import * as userRegistry from './_lib/userRegistry.mjs';
import * as membership from './_lib/membership.mjs';

export default async () => {
  const userIds = await userRegistry.listAll();
  for (const userId of userIds) {
    try {
      if (!(await membership.isActive(userId))) continue; // monitoring paused
      await analysisCore.runRiskCheck(userId, { manual: false });
    } catch (err) {
      console.error(`[scheduled-risk-scan] failed for user ${userId}:`, err.message);
    }
  }
};

// Runs every 2 hours around the clock.
export const config = { schedule: '0 */2 * * *' };
