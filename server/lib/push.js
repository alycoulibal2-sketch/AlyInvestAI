const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const SUBS_FILE = path.join(__dirname, '..', 'data', 'subscriptions.json');

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function loadSubs() {
  if (!fs.existsSync(SUBS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch (e) { return []; }
}

function saveSubs(subs) {
  fs.mkdirSync(path.dirname(SUBS_FILE), { recursive: true });
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

function addSubscription(sub) {
  const subs = loadSubs();
  if (!subs.find(s => s.endpoint === sub.endpoint)) {
    subs.push(sub);
    saveSubs(subs);
  }
  return subs.length;
}

function removeSubscription(endpoint) {
  const subs = loadSubs().filter(s => s.endpoint !== endpoint);
  saveSubs(subs);
}

async function sendToAll(payload) {
  const subs = loadSubs();
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(subs.map(s => webpush.sendNotification(s, body)));
  const dead = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected' && (r.reason.statusCode === 404 || r.reason.statusCode === 410)) {
      dead.push(subs[i].endpoint);
    }
  });
  if (dead.length) saveSubs(loadSubs().filter(s => !dead.includes(s.endpoint)));
  return { sent: subs.length - dead.length, pruned: dead.length };
}

module.exports = { addSubscription, removeSubscription, sendToAll, loadSubs };
