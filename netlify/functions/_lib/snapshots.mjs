// Portfolio Snapshots — a photo-album of the client's investing journey.
// One is captured automatically every month (scheduled), and can be captured
// on demand ("save this moment"). Each stores the full computed state plus
// the advisor's narrative colour, so five years later the client can relive
// exactly where they stood and how their advisor felt about it.
//
// Append-only, newest-first, capped. This is the backbone the Portfolio
// Replay, Monthly Progress and Advisor Memory Timeline features read from.

import { getStore } from '@netlify/blobs';

function store() { return getStore({ name: 'alyinvest', consistency: 'strong' }); }
const k = (userId) => `${userId}:snapshots`;

export async function list(userId) {
  return (await store().get(k(userId), { type: 'json' })) || [];
}

export async function get(userId, id) {
  return (await list(userId)).find((s) => s.id === Number(id)) || null;
}

export async function add(userId, snapshot) {
  const items = await list(userId);
  const entry = { id: Date.now(), at: new Date().toISOString(), ...snapshot };
  items.unshift(entry);
  await store().set(k(userId), JSON.stringify(items.slice(0, 120)));
  return entry;
}

// True if the most recent snapshot is in the same calendar month (UTC) — used
// by the monthly scheduler to avoid duplicating a month's snapshot, and by
// manual capture to rate-limit to one per day.
export async function latest(userId) {
  return (await list(userId))[0] || null;
}
