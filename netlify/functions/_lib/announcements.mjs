// Developer announcements: a global list any admin can post to (optionally
// scheduled for a future time), and a per-user "have they seen the latest
// one" marker so each account gets shown a new announcement exactly once,
// the next time they open the app — same pattern as the Founding Member
// welcome screen's welcomeSeenAt.
//
// Scheduling is resolved lazily on read (like the founding->lapsed status
// flip in membership.mjs) rather than via a cron job: an announcement with
// a future scheduledFor simply isn't "due" yet, so latestUnseenFor() skips
// it until its own scheduled time has passed on whatever request happens
// to check next — no separate scheduled function needed.

import { getStore } from '@netlify/blobs';

function store() { return getStore({ name: 'alyinvest', consistency: 'strong' }); }
const LIST_KEY = 'announcements:list';
const seenKey = (userId) => `${userId}:announcement-seen`;

export async function list() {
  return (await store().get(LIST_KEY, { type: 'json' })) || [];
}

export async function create({ title, body, createdBy, scheduledFor }) {
  const items = await list();
  // Date.now() alone can collide if two announcements are posted within the
  // same millisecond (e.g. rapid admin clicks, or scripted tests) — items
  // are unshifted so items[0] is always the highest id seen so far; bump
  // past it to guarantee uniqueness and stable ordering either way.
  const id = Math.max(Date.now(), (items[0]?.id || 0) + 1);
  const entry = {
    id,
    title: String(title || '').trim().slice(0, 200),
    body: String(body || '').trim().slice(0, 4000),
    createdAt: new Date().toISOString(),
    createdBy: createdBy || null,
    scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
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

function effectiveAt(a) {
  return Date.parse(a.scheduledFor || a.createdAt);
}

export function isLive(a) {
  return effectiveAt(a) <= Date.now();
}

// Returns the most recently-effective LIVE announcement (by scheduledFor if
// set, else createdAt) if this user hasn't acked it yet, else null. A
// scheduled-for-the-future announcement is invisible to everyone until due.
export async function latestUnseenFor(userId) {
  const items = await list();
  const due = items.filter(isLive);
  if (!due.length) return null;
  due.sort((a, b) => effectiveAt(b) - effectiveAt(a));
  const latest = due[0];
  const seenId = await store().get(seenKey(userId), { type: 'json' });
  if (seenId != null && Number(seenId) === latest.id) return null;
  return latest;
}

export async function markSeen(userId, id) {
  await store().set(seenKey(userId), JSON.stringify(Number(id)));
}
