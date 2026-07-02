import * as analysisCore from './_lib/analysisCore.mjs';
import * as userRegistry from './_lib/userRegistry.mjs';

export default async () => {
  const userIds = await userRegistry.listAll();
  for (const userId of userIds) {
    try {
      await analysisCore.runDailyAnalysis(userId, { manual: false });
    } catch (err) {
      console.error(`[scheduled-daily-analysis] failed for user ${userId}:`, err.message);
    }
  }
};

// Runs once a day at 07:00 UTC.
export const config = { schedule: '0 7 * * *' };
