import * as analysisCore from './_lib/analysisCore.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => {
  try {
    const entry = await analysisCore.runRiskCheck(user.id, { manual: true, authUser: user });
    return Response.json(entry);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});

export const config = { path: '/api/risk-check' };
