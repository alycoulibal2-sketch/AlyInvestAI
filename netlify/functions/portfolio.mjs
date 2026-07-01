import * as market from './_lib/market.mjs';
import * as analysisCore from './_lib/analysisCore.mjs';

export default async () => {
  const snapshot = market.getDailySnapshot();
  const view = await analysisCore.currentPortfolioView(snapshot);
  return Response.json(view);
};

export const config = { path: '/api/portfolio' };
