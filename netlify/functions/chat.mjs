import * as market from './_lib/market.mjs';
import * as analysisCore from './_lib/analysisCore.mjs';
import * as claude from './_lib/claude.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => {
  try {
    const { message, history } = await req.json();
    const snapshot = market.getDailySnapshot();
    const portfolioView = await analysisCore.currentPortfolioView(user.id, snapshot, user);
    const reply = await claude.chat(portfolioView, history, message);
    return Response.json({ reply });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});

export const config = { path: '/api/chat' };
