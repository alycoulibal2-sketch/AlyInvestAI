import * as trading212 from './_lib/brokers/trading212.mjs';
import * as brokerConnection from './_lib/brokerConnection.mjs';

export default async (req) => {
  try {
    const { apiKey, practice } = await req.json();
    if (!apiKey || typeof apiKey !== 'string') {
      return Response.json({ error: 'API key is required.' }, { status: 400 });
    }

    const live = await trading212.verifyAndFetch(apiKey, !!practice);

    await brokerConnection.set({
      type: 'trading212',
      apiKey,
      practice: !!practice,
      lastSyncedAt: new Date().toISOString(),
    });

    return Response.json({ ok: true, holdingsCount: live.holdings.length, cash: live.cash });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }
};

export const config = { path: '/api/connect/trading212' };
