// Developer announcements: a global list any admin can post to, and a
// per-user "have they seen the latest one" marker so each account gets
// shown a new announcement exactly once, the next time they open the app —
// same pattern as the Founding Member welcome screen's welcomeSeenAt.

import { getStore } from '@netlify/blobs';

function store() { return getStore({ name: 'alyinvest', consistency: 'strong' }); }
const LIST_KEY = 'announcements:list';
const seenKey = (userId) => `${userId}:announcement-seen`;

export async function list() {
  return (await store().get(LIST_KEY, { type: 'json' })) || [];
}

export async function create({ title, body, createdBy }) {
  const items = await list();
  const entry = {
    id: Date.now(),
    title: String(title || '').trim().slice(0, 200),
    body: String(body || '').trim().slice(0, 4000),
    createdAt: new Date().toISOString(),
    createdBy: createdBy || null,
  };
  items.unshift(entry);
  await store().set(LIST_KEY, JSON.stringify(items.slice(0, 200)));
  return entry;
}

export async function remove(id) {
  const items = (await list()).filter((a) => a.id !== Number(id));
  await store().set(LIST_KEY, JSON.stringify(items));
  return items;
}

// Returns the latest announcement if this user hasn't acked it yet, else null.
export async function latestUnseenFor(userId) {
  const items = await list();
  if (!items.length) return null;
  const latest = items[0];
  const seenId = await store().get(seenKey(userId), { type: 'json' });
  if (seenId != null && Number(seenId) === latest.id) return null;
  return latest;
}

export async function markSeen(userId, id) {
  await store().set(seenKey(userId), JSON.stringify(Number(id)));
}
