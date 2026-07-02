// Per-account chat history. Every user message and advisor reply is stored
// here, so the conversation survives reloads and follows the account across
// devices — and Claude's context is built from THIS, not from whatever the
// current browser tab happens to remember.

import { getStore } from '@netlify/blobs';

const CAP = 300; // newest turns kept; old ones age out

function store() { return getStore({ name: 'alyinvest', consistency: 'strong' }); }
const k = (userId) => `${userId}:chat-history`;

export async function list(userId) {
  return (await store().get(k(userId), { type: 'json' })) || [];
}

export async function append(userId, turns) {
  const items = await list(userId);
  const at = new Date().toISOString();
  for (const t of turns) items.push({ role: t.role, text: t.text, data: t.data || undefined, at });
  await store().set(k(userId), JSON.stringify(items.slice(-CAP)));
}
