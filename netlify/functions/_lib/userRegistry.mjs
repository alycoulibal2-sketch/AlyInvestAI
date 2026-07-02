// A flat list of every user ID that has ever authenticated, so the scheduled
// (cron) functions — which have no request/session to read a user ID from —
// know whose portfolios to run the daily analysis and risk scan against.

import { getStore } from '@netlify/blobs';

// strong consistency: reads reflect writes immediately (default is eventual,
// which made a just-run analysis vanish on the next read-after-write)
function store() { return getStore({ name: 'alyinvest', consistency: 'strong' }); }

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
