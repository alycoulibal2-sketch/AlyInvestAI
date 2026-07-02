import * as trading212 from './_lib/brokers/trading212.mjs';
import * as brokerConnection from './_lib/brokerConnection.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => {
  try {
    const { apiKey, apiSecret, practice } = await req.json();
    if (!apiKey || typeof apiKey !== 'string') {
      return Response.json({ error: 'API key is required.' }, { status: 400 });
    }
    if (!apiSecret || typeof apiSecret !== 'string') {
      return Response.json({ error: 'API secret is required — Trading 212 issues a separate key and secret.' }, { status: 400 });
    }

    const live = await trading212.verifyAndFetch(apiKey, apiSecret, !!practice);

    await brokerConnection.set(user.id, {
      type: 'trading212',
      apiKey,
      apiSecret,
      practice: !!practice,
      lastSyncedAt: new Date().toISOString(),
    });

    return Response.json({ ok: true, holdingsCount: live.holdings.length, cash: live.cash });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }
});

export const config = { path: '/api/connect/trading212' };
