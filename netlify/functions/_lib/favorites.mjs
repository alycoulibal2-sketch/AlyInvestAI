// Favorite companies — tickers the client follows without owning. The
// advisor is made aware of them in the daily analysis (so it can surface
// them as opportunities or flag their news), and the hub shows each with
// live price/change from the market feed. Only companies in the simulated
// market universe can be favorited (the advisor has no data on anything
// else yet).

import { getStore } from '@netlify/blobs';
import { UNIVERSE } from './market.mjs';

function store() { return getStore({ name: 'alyinvest', consistency: 'strong' }); }
const k = (userId) => `${userId}:favorites`;

export async function list(userId) {
  return (await store().get(k(userId), { type: 'json' })) || [];
}

export function isKnownTicker(ticker) {
  return !!UNIVERSE[String(ticker || '').toUpperCase()];
}

export async function add(userId, ticker) {
  const t = String(ticker || '').toUpperCase();
  if (!isKnownTicker(t)) return { ok: false, reason: 'unknown' };
  const favs = await list(userId);
  if (!favs.includes(t)) { favs.push(t); await store().set(k(userId), JSON.stringify(favs)); }
  return { ok: true, favorites: favs };
}

export async function remove(userId, ticker) {
  const t = String(ticker || '').toUpperCase();
  const favs = (await list(userId)).filter((x) => x !== t);
  await store().set(k(userId), JSON.stringify(favs));
  return { ok: true, favorites: favs };
}
