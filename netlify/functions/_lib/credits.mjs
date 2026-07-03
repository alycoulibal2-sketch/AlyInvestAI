// Per-user Corvexsa Credits ledger. Balance + append-only transaction history,
// one record per account in Netlify Blobs (strong consistency, like the rest).
//
// What credits are spent on is deliberately not wired yet (top-up first) — but
// spend()/grant() are here so wiring consumption later is a one-liner.

import { getStore } from '@netlify/blobs';

function store() { return getStore({ name: 'alyinvest', consistency: 'strong' }); }
const k = (userId) => `${userId}:credits`;

const EMPTY = { balance: 0, txns: [] };

export async function get(userId) {
  const c = await store().get(k(userId), { type: 'json' });
  return c || { ...EMPTY };
}

export function toPublic(c) {
  return { balance: c.balance || 0, txns: (c.txns || []).slice(0, 20) };
}

// Idempotent grant: a Stripe checkout.session.completed can be delivered more
// than once, so we key each credit purchase by its session id and never grant
// the same one twice.
export async function grantForSession(userId, { sessionId, credits, pack, amount }) {
  const c = await get(userId);
  c.txns = c.txns || [];
  if (sessionId && c.txns.some(t => t.sessionId === sessionId)) return c; // already granted
  c.balance = (c.balance || 0) + credits;
  c.txns.unshift({
    type: 'purchase',
    credits,
    pack: pack || null,
    amountCents: amount || null,
    sessionId: sessionId || null,
    at: new Date().toISOString(),
  });
  c.txns = c.txns.slice(0, 100);
  await store().set(k(userId), JSON.stringify(c));
  return c;
}

// For when spending is wired later. Returns { ok, balance }; ok=false if short.
export async function spend(userId, amount, reason) {
  const c = await get(userId);
  if ((c.balance || 0) < amount) return { ok: false, balance: c.balance || 0 };
  c.balance -= amount;
  c.txns = c.txns || [];
  c.txns.unshift({ type: 'spend', credits: -amount, reason: reason || null, at: new Date().toISOString() });
  c.txns = c.txns.slice(0, 100);
  await store().set(k(userId), JSON.stringify(c));
  return { ok: true, balance: c.balance };
}
