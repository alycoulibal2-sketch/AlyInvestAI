// Membership state, one record per account.
//
//   founding    every new account, automatically — full Premium, free,
//               for FOUNDING_DAYS from first sign-in (launch program)
//   subscribed  paying member after the founding period
//   lapsed      founding period ended without subscribing — NOT locked out:
//               monitoring/analysis/chat pause, but the timeline, portfolio
//               and Advisor Memory stay intact and readable, and
//               resubscribing restores everything instantly.

import { getStore } from '@netlify/blobs';

const DAY = 24 * 3600 * 1000;
export const FOUNDING_DAYS = 60;

function store() { return getStore({ name: 'alyinvest', consistency: 'strong' }); }
const k = (userId) => `${userId}:membership`;

export async function ensure(userId) {
  let m = await store().get(k(userId), { type: 'json' });
  if (!m) {
    const now = new Date();
    m = {
      status: 'founding',
      foundingStartedAt: now.toISOString(),
      foundingEndsAt: new Date(now.getTime() + FOUNDING_DAYS * DAY).toISOString(),
      welcomeSeenAt: null,
      subscribedAt: null,
      remindersSent: [],
    };
    await store().set(k(userId), JSON.stringify(m));
  }
  if (m.status === 'founding' && Date.now() > Date.parse(m.foundingEndsAt)) {
    m.status = 'lapsed';
    await store().set(k(userId), JSON.stringify(m));
  }
  return m;
}

export async function save(userId, m) {
  await store().set(k(userId), JSON.stringify(m));
}

export function toPublic(m) {
  const daysLeft = m.status === 'founding'
    ? Math.max(0, Math.ceil((Date.parse(m.foundingEndsAt) - Date.now()) / DAY))
    : 0;
  return {
    status: m.status,
    foundingEndsAt: m.foundingEndsAt,
    daysLeft,
    welcomeSeen: !!m.welcomeSeenAt,
    subscribedAt: m.subscribedAt,
  };
}

export async function markWelcomeSeen(userId) {
  const m = await ensure(userId);
  if (!m.welcomeSeenAt) { m.welcomeSeenAt = new Date().toISOString(); await save(userId, m); }
  return m;
}

export async function subscribe(userId) {
  const m = await ensure(userId);
  m.status = 'subscribed';
  m.subscribedAt = new Date().toISOString();
  await save(userId, m);
  return m;
}

// Premium features (chat, analysis, monitoring) are available to founding
// and subscribed members. Lapsed members keep read access to their data.
export async function isActive(userId) {
  const m = await ensure(userId);
  return m.status !== 'lapsed';
}
