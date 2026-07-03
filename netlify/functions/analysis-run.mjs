import * as analysisCore from './_lib/analysisCore.mjs';
import { withAuth } from './_lib/auth.mjs';
import * as membership from './_lib/membership.mjs';
import * as interactions from './_lib/interactions.mjs';

const LIMIT_REACHED_MESSAGE = "You've used all of your Advisor Interactions for this month.\n\nYour advisor will continue monitoring your portfolio in the background.\n\nYou'll still receive important notifications and portfolio alerts.\n\nUpgrade to Premium for unlimited conversations with your advisor.";

export default withAuth(async (req, context, user) => {
  try {
    const mem = await membership.ensure(user.id);
    if (!(await membership.isActive(user.id))) {
      return Response.json({ error: 'Your Founding Member access has ended. Resume your subscription to continue — your advisor remembers everything.', code: 'membership_required' }, { status: 402 });
    }

    // A manually-triggered full review is "portfolio analysis" — it counts.
    // The scheduled daily review (scheduled-daily-analysis.mjs) calls
    // analysisCore directly and never touches this endpoint, so background
    // monitoring never draws from the quota.
    const ent = membership.entitlements(mem);
    const quota = await interactions.checkAndConsume(user.id, ent.interactionsPerMonth);
    if (!quota.allowed) {
      return Response.json({ limitReached: true, message: LIMIT_REACHED_MESSAGE, interactions: { used: quota.used, limit: quota.limit } });
    }

    const entry = await analysisCore.runDailyAnalysis(user.id, { manual: true, authUser: user });
    return Response.json({ ...entry, interactions: { used: quota.used, limit: quota.limit } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});

export const config = { path: '/api/analysis/run' };
