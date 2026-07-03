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
import { TIERS, FOUNDING_ENTITLEMENTS } from './tiers.mjs';

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
    tier: m.status === 'subscribed' ? (m.tier || 'premium') : null, // legacy fallback, see resolveTier()
    foundingEndsAt: m.foundingEndsAt,
    daysLeft,
    welcomeSeen: !!m.welcomeSeenAt,
    subscribedAt: m.subscribedAt,
  };
}

// Accounts subscribed before the 3-tier system existed have no `tier` field
// (they paid for the old single $14.99/mo "everything included" plan) —
// treat them as Premium, which had equivalent unlimited access.
function resolveTier(m) {
  return TIERS[m.tier] || TIERS.premium;
}

// Resolves what an account is actually entitled to right now. Returns null
// for lapsed (no chat/voice access at all — the existing isActive() gate),
// otherwise an entitlements object with interactionsPerMonth/voiceUnlimited/
// priorityPush that every metered endpoint reads from, so "founding" and
// "subscribed" never need special-casing beyond this one function.
export function entitlements(m) {
  if (m.status === 'founding') return FOUNDING_ENTITLEMENTS;
  if (m.status === 'subscribed') {
    const tier = resolveTier(m);
    return {
      tier: tier.id,
      label: tier.name,
      interactionsPerMonth: tier.interactionsPerMonth,
      voiceUnlimited: tier.voiceUnlimited,
      priorityPush: tier.priorityPush,
    };
  }
  return null;
}

export async function markWelcomeSeen(userId) {
  const m = await ensure(userId);
  if (!m.welcomeSeenAt) { m.welcomeSeenAt = new Date().toISOString(); await save(userId, m); }
  return m;
}

export async function subscribe(userId, stripeInfo) {
  const m = await ensure(userId);
  m.status = 'subscribed';
  m.subscribedAt = new Date().toISOString();
  if (stripeInfo) {
    m.stripeCustomerId = stripeInfo.customerId || m.stripeCustomerId;
    m.stripeSubscriptionId = stripeInfo.subscriptionId || m.stripeSubscriptionId;
    if (stripeInfo.tier) m.tier = stripeInfo.tier;
  }
  await save(userId, m);
  return m;
}

// A plan change on an already-active subscription (upgrade/downgrade), driven
// by Stripe's customer.subscription.updated webhook — the tier of record is
// always whatever Stripe says the subscription's current price is, never a
// value trusted from the client.
export async function setTier(userId, tier) {
  const m = await ensure(userId);
  if (m.status !== 'subscribed' || m.tier === tier) return m;
  m.tier = tier;
  await save(userId, m);
  return m;
}

// Subscription ended (cancelled or payment ultimately failed). Not a lockout:
// data, timeline and Advisor Memory stay intact — same as a lapsed founding.
export async function unsubscribe(userId) {
  const m = await ensure(userId);
  m.status = 'lapsed';
  m.stripeSubscriptionId = null;
  await save(userId, m);
  return m;
}

// Premium features (chat, analysis, monitoring) are available to founding
// and subscribed members. Lapsed members keep read access to their data.
export async function isActive(userId) {
  const m = await ensure(userId);
  return m.status !== 'lapsed';
}
