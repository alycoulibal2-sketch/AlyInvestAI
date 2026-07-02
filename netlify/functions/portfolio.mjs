import * as market from './_lib/market.mjs';
import * as analysisCore from './_lib/analysisCore.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => {
  const snapshot = market.getDailySnapshot();
  const view = await analysisCore.currentPortfolioView(user.id, snapshot, user);
  return Response.json(view);
});

export const config = { path: '/api/portfolio' };
