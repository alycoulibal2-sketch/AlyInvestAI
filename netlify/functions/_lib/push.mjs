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

function store() { return getStore('alyinvest'); }

export async function loadSubs() {
  return (await store().get('subscriptions', { type: 'json' })) || [];
}

export async function saveSubs(subs) {
  await store().set('subscriptions', JSON.stringify(subs));
}

export async function addSubscription(sub) {
  const subs = await loadSubs();
  if (!subs.find(s => s.endpoint === sub.endpoint)) {
    subs.push(sub);
    await saveSubs(subs);
  }
  return subs.length;
}

export async function removeSubscription(endpoint) {
  const subs = (await loadSubs()).filter(s => s.endpoint !== endpoint);
  await saveSubs(subs);
}

export async function sendToAll(payload) {
  if (!VAPID_CONFIGURED) return { sent: 0, pruned: 0, skipped: 'vapid-not-configured' };
  const subs = await loadSubs();
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(subs.map(s => webpush.sendNotification(s, body)));
  const dead = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected' && (r.reason.statusCode === 404 || r.reason.statusCode === 410)) {
      dead.push(subs[i].endpoint);
    }
  });
  if (dead.length) {
    const remaining = (await loadSubs()).filter(s => !dead.includes(s.endpoint));
    await saveSubs(remaining);
  }
  return { sent: subs.length - dead.length, pruned: dead.length };
}
