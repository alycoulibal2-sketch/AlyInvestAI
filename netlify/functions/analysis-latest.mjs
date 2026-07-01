import * as analysisCore from './_lib/analysisCore.mjs';

export default async () => Response.json(await analysisCore.getLatestAnalysis());

export const config = { path: '/api/analysis/latest' };
