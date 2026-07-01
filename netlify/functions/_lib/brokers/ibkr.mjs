// Interactive Brokers has no serverless-friendly API — account data only comes through
// the Client Portal Gateway, a persistent local process requiring an interactive login
// session (and periodic re-auth, roughly every 24h). We can't run that inside a Netlify
// Function, so instead we call out to a small bridge service the user runs themselves
// (see /ibkr-bridge in this repo) that sits next to their logged-in gateway and exposes
// one authenticated read-only endpoint.

export async function verifyAndFetch(bridgeUrl, sharedSecret) {
  const url = bridgeUrl.replace(/\/$/, '') + '/positions';
  let res;
  try {
    res = await fetch(url, { headers: { 'x-bridge-secret': sharedSecret } });
  } catch (err) {
    throw new Error('Could not reach the IBKR bridge at that URL. Is it running and publicly reachable?');
  }
  if (res.status === 401) {
    throw new Error('The bridge rejected the shared secret — check it matches the bridge\'s BRIDGE_SECRET.');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`IBKR bridge error (${res.status}): ${text.slice(0, 200) || 'is the Client Portal Gateway logged in?'}`);
  }
  const data = await res.json();
  if (!Array.isArray(data.holdings)) {
    throw new Error('The bridge returned an unexpected shape — expected { holdings: [...], cash: number }.');
  }
  return { holdings: data.holdings, cash: data.cash ?? 0 };
}
