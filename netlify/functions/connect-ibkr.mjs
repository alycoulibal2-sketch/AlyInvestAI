import * as ibkr from './_lib/brokers/ibkr.mjs';
import * as brokerConnection from './_lib/brokerConnection.mjs';

export default async (req) => {
  try {
    const { bridgeUrl, sharedSecret } = await req.json();
    if (!bridgeUrl || !sharedSecret) {
      return Response.json({ error: 'Bridge URL and shared secret are both required.' }, { status: 400 });
    }

    const live = await ibkr.verifyAndFetch(bridgeUrl, sharedSecret);

    await brokerConnection.set({
      type: 'ibkr',
      bridgeUrl,
      sharedSecret,
      lastSyncedAt: new Date().toISOString(),
    });

    return Response.json({ ok: true, holdingsCount: live.holdings.length, cash: live.cash });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }
};

export const config = { path: '/api/connect/ibkr' };
