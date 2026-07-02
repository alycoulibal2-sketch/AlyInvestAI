import * as analysisCore from './_lib/analysisCore.mjs';
import { withAuth } from './_lib/auth.mjs';
import * as membership from './_lib/membership.mjs';

export default withAuth(async (req, context, user) => {
  try {
    if (!(await membership.isActive(user.id))) {
      return Response.json({ error: 'Your Founding Member access has ended. Resume Premium to continue — your advisor remembers everything.', code: 'membership_required' }, { status: 402 });
    }

    const entry = await analysisCore.runDailyAnalysis(user.id, { manual: true, authUser: user });
    return Response.json(entry);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});

export const config = { path: '/api/analysis/run' };
