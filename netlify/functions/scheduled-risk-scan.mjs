import * as analysisCore from './_lib/analysisCore.mjs';

export default async () => {
  try {
    await analysisCore.runRiskCheck({ manual: false });
  } catch (err) {
    console.error('[scheduled-risk-scan] failed:', err.message);
  }
};

// Runs every 2 hours around the clock.
export const config = { schedule: '0 */2 * * *' };
