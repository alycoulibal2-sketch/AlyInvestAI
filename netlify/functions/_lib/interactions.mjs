// Advisor Interactions: the shared monthly quota that text chat and voice
// conversations both draw from on the Essential tier. Unlimited tiers
// (Premium/Elite/Founding) never call checkAndConsume — see each caller.
//
// The counter resets itself for free: the blob key is scoped to the calendar
// month (`userId:interactions:YYYY-MM`), so a new month is simply a fresh key
// with nothing to read yet. No cron job, no explicit reset step, and no risk
// of a missed reset leaving someone stuck — the record for last month is just
// never looked at again.

import { getStore } from '@netlify/blobs';

function store() { return getStore({ name: 'alyinvest', consistency: 'strong' }); }

function currentMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function blobKey(userId, monthKey) {
  return `${userId}:interactions:${monthKey}`;
}

export async function used(userId) {
  const rec = await store().get(blobKey(userId, currentMonthKey()), { type: 'json' });
  return (rec && rec.count) || 0;
}

// Checks the quota and — only if there's room — atomically increments it in
// the same call, returning the up-to-date usage either way. `limit` is the
// tier's interactionsPerMonth; pass null/undefined for unlimited tiers (skips
// storage entirely — nothing to meter).
export async function checkAndConsume(userId, limit) {
  if (limit == null) return { allowed: true, used: null, limit: null };

  const key = blobKey(userId, currentMonthKey());
  const rec = (await store().get(key, { type: 'json' })) || { count: 0 };
  if (rec.count >= limit) {
    return { allowed: false, used: rec.count, limit };
  }
  rec.count += 1;
  await store().set(key, JSON.stringify(rec));
  return { allowed: true, used: rec.count, limit };
}

export async function toPublic(userId, entitlements) {
  const limit = entitlements ? entitlements.interactionsPerMonth : null;
  if (limit == null) return { limit: null, used: null }; // unlimited — nothing to show a count against
  return { limit, used: await used(userId) };
}
