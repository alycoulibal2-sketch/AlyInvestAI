// Tracks which broker (if any) is the live source of truth for each user's
// holdings/cash. One connection record per userId. Secrets (API keys, bridge
// shared secrets) live only here, server-side — the frontend never receives
// them back.

import { getStore } from '@netlify/blobs';

// strong consistency: reads reflect writes immediately (default is eventual,
// which made a just-run analysis vanish on the next read-after-write)
function store() { return getStore({ name: 'alyinvest', consistency: 'strong' }); }
const k = (userId) => `${userId}:broker-connection`;

export async function get(userId) {
  return (await store().get(k(userId), { type: 'json' })) || { type: null };
}

export async function set(userId, connection) {
  await store().set(k(userId), JSON.stringify(connection));
}

export async function clear(userId) {
  await store().set(k(userId), JSON.stringify({ type: null }));
}

// Safe-to-expose view for the Settings panel — never includes apiKey/sharedSecret.
export function toPublicStatus(connection) {
  if (!connection || !connection.type) return { type: null, label: 'Not connected' };
  switch (connection.type) {
    case 'trading212':
      return { type: 'trading212', label: `Trading 212${connection.practice ? ' (Practice)' : ''}`, lastSyncedAt: connection.lastSyncedAt };
    case 'ibkr':
      return { type: 'ibkr', label: 'Interactive Brokers (via bridge)', lastSyncedAt: connection.lastSyncedAt };
    case 'manual':
      return { type: 'manual', label: connection.source === 'csv' ? 'CSV import' : 'Manual entry', lastSyncedAt: connection.lastSyncedAt };
    default:
      return { type: null, label: 'Not connected' };
  }
}
