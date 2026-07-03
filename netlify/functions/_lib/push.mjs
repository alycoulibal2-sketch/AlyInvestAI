import { getStore } from '@netlify/blobs';
import webpush from 'web-push';

// Push notifications are optional — chat/analysis/portfolio must keep working
// even if VAPID keys were never configured. A bad or missing key here must
// never crash the whole module (and therefore every function that imports
// it transitively through analysisCore.mjs).
const VAPID_CONFIGURED = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (VAPID_CONFIGURED) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch (err) {
    console.error('[push] Invalid VAPID keys, push notifications disabled:', err.message);
  }
} else {
  console.warn('[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — push notifications are disabled.');
}

// strong consistency: reads reflect writes immediately (default is eventual,
// which made a just-run analysis vanish on the next read-after-write)
function store() { return getStore({ name: 'alyinvest', consistency: 'strong' }); }
const k = (userId) => `${userId}:subscriptions`;

export async function loadSubs(userId) {
  return (await store().get(k(userId), { type: 'json' })) || [];
}

export async function saveSubs(userId, subs) {
  await store().set(k(userId), JSON.stringify(subs));
}

export async function addSubscription(userId, sub) {
  const subs = await loadSubs(userId);
  if (!subs.find(s => s.endpoint === sub.endpoint)) {
    subs.push(sub);
    await saveSubs(userId, subs);
  }
  return subs.length;
}

export async function removeSubscription(userId, endpoint) {
  const subs = (await loadSubs(userId)).filter(s => s.endpoint !== endpoint);
  await saveSubs(userId, subs);
}

// Sends to every device this one user has subscribed on (not a broadcast to
// all users — each user only ever hears about their own portfolio).
// `urgency` ('very-low'|'low'|'normal'|'high') is a real Web Push protocol
// header — push services and mobile OSes use it to decide whether to wake
// the device immediately or batch delivery, so it's a genuine (not
// cosmetic) "priority notifications" lever for Premium/Elite.
export async function sendToUser(userId, payload, { urgency } = {}) {
  if (!VAPID_CONFIGURED) return { sent: 0, pruned: 0, skipped: 'vapid-not-configured' };
  const subs = await loadSubs(userId);
  const body = JSON.stringify(payload);
  const options = urgency ? { urgency } : undefined;
  const results = await Promise.allSettled(subs.map(s => webpush.sendNotification(s, body, options)));
  const dead = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected' && (r.reason.statusCode === 404 || r.reason.statusCode === 410)) {
      dead.push(subs[i].endpoint);
    }
  });
  if (dead.length) {
    const remaining = (await loadSubs(userId)).filter(s => !dead.includes(s.endpoint));
    await saveSubs(userId, remaining);
  }
  return { sent: subs.length - dead.length, pruned: dead.length };
}
