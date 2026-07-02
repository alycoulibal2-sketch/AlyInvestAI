import { getStore } from '@netlify/blobs';

// strong consistency: reads reflect writes immediately (default is eventual,
// which made a just-run analysis vanish on the next read-after-write)
function store() { return getStore({ name: 'alyinvest', consistency: 'strong' }); }
const k = (userId) => `${userId}:notifications`;

export async function list(userId) {
  return (await store().get(k(userId), { type: 'json' })) || [];
}

export async function add(userId, { tag, title, body }) {
  const items = await list(userId);
  const nextId = items.reduce((m, n) => Math.max(m, n.id), 0) + 1;
  const n = { id: nextId, tag, title, body, time: new Date().toISOString(), unread: true };
  items.unshift(n);
  await store().set(k(userId), JSON.stringify(items.slice(0, 200)));
  return n;
}

export async function markRead(userId, id) {
  const items = await list(userId);
  const n = items.find(x => x.id === Number(id));
  if (n) n.unread = false;
  await store().set(k(userId), JSON.stringify(items));
  return n;
}
