import { getStore } from '@netlify/blobs';

function store() { return getStore('alyinvest'); }

export async function list() {
  return (await store().get('notifications', { type: 'json' })) || [];
}

export async function add({ tag, title, body }) {
  const items = await list();
  const nextId = items.reduce((m, n) => Math.max(m, n.id), 0) + 1;
  const n = { id: nextId, tag, title, body, time: new Date().toISOString(), unread: true };
  items.unshift(n);
  await store().set('notifications', JSON.stringify(items.slice(0, 200)));
  return n;
}

export async function markRead(id) {
  const items = await list();
  const n = items.find(x => x.id === Number(id));
  if (n) n.unread = false;
  await store().set('notifications', JSON.stringify(items));
  return n;
}
