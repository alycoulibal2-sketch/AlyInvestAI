import { getStore } from '@netlify/blobs';
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

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
