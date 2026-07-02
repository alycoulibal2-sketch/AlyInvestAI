// A flat list of every user ID that has ever authenticated, so the scheduled
// (cron) functions — which have no request/session to read a user ID from —
// know whose portfolios to run the daily analysis and risk scan against.

import { getStore } from '@netlify/blobs';

function store() { return getStore('alyinvest'); }

export async function register(userId) {
  const users = (await store().get('user-registry', { type: 'json' })) || [];
  if (!users.includes(userId)) {
    users.push(userId);
    await store().set('user-registry', JSON.stringify(users));
  }
}

export async function listAll() {
  return (await store().get('user-registry', { type: 'json' })) || [];
}
