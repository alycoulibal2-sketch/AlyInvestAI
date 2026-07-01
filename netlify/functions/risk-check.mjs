import * as analysisCore from './_lib/analysisCore.mjs';

export default async () => {
  try {
    const entry = await analysisCore.runRiskCheck({ manual: true });
    return Response.json(entry);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

export const config = { path: '/api/risk-check' };
