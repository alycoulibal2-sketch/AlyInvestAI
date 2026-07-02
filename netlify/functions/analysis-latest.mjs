import * as analysisCore from './_lib/analysisCore.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => Response.json(await analysisCore.getLatestAnalysis(user.id)));

export const config = { path: '/api/analysis/latest' };
