import * as analysisCore from './_lib/analysisCore.mjs';

export default async () => {
  try {
    await analysisCore.runDailyAnalysis({ manual: false });
  } catch (err) {
    console.error('[scheduled-daily-analysis] failed:', err.message);
  }
};

// Runs once a day at 07:00 UTC.
export const config = { schedule: '0 7 * * *' };
