// Stripe client + the single Corvexsa Premium price ($14.99/month).
// The price is self-provisioning via lookup_key: first checkout creates the
// product+price in the connected Stripe account, later calls find it — no
// dashboard clicking, no hardcoded price ID env var.

import Stripe from 'stripe';

export const PRICE_LOOKUP_KEY = 'corvexsa_premium_monthly';

let _stripe = null;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

export async function ensurePremiumPrice() {
  const s = stripe();
  const existing = await s.prices.list({ lookup_keys: [PRICE_LOOKUP_KEY], active: true, limit: 1 });
  if (existing.data.length) return existing.data[0];

  const product = await s.products.create({
    name: 'Corvexsa Premium',
    description: 'Your personal AI investment advisor — unlimited conversations, daily portfolio monitoring, investment memory and timeline. One plan, everything included.',
  });
  return s.prices.create({
    product: product.id,
    unit_amount: 1499,
    currency: 'usd',
    recurring: { interval: 'month' },
    lookup_key: PRICE_LOOKUP_KEY,
  });
}

// One-time Corvexsa Credits packs. Self-provisioning by lookup_key, exactly like
// the Premium price — first checkout of a pack creates its product+price, later
// checkouts find it. Purely additive; never touches other products on the account.
// `credits` = units granted on purchase; amounts are cents (USD).
export const CREDIT_PACKS = [
  { id: 'starter', lookupKey: 'corvexsa_credits_starter', label: 'Starter', amount: 500,  credits: 50,  tagline: '50 credits' },
  { id: 'plus',    lookupKey: 'corvexsa_credits_plus',    label: 'Plus',    amount: 1500, credits: 175, tagline: '175 credits · 17% bonus', best: true },
  { id: 'pro',     lookupKey: 'corvexsa_credits_pro',     label: 'Pro',     amount: 5000, credits: 650, tagline: '650 credits · 30% bonus' },
];

export function creditPack(id) {
  return CREDIT_PACKS.find(p => p.id === id) || null;
}

// Returns the Stripe Price for a given pack, creating product+price on first use.
export async function ensureCreditsPrice(pack) {
  const s = stripe();
  const existing = await s.prices.list({ lookup_keys: [pack.lookupKey], active: true, limit: 1 });
  if (existing.data.length) return existing.data[0];

  const product = await s.products.create({
    name: `Corvexsa Credits — ${pack.label}`,
    description: `${pack.credits} Corvexsa credits.`,
  });
  return s.prices.create({
    product: product.id,
    unit_amount: pack.amount,
    currency: 'usd',
    lookup_key: pack.lookupKey,
  });
}
