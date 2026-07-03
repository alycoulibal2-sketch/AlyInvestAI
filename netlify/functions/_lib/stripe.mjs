// Stripe client + self-provisioning prices for Corvexsa's three subscription
// tiers (Essential/Premium/Elite — see _lib/tiers.mjs) and one-time Credits
// packs. Every price is looked up by lookup_key: first checkout creates the
// product+price in the connected Stripe account, later calls find it — no
// dashboard clicking, no hardcoded price ID env vars.

import Stripe from 'stripe';
import { TIERS } from './tiers.mjs';

let _stripe = null;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

// Returns the Stripe Price for a given tier id, creating product+price on
// first use. Amounts/lookup keys come from tiers.mjs — the single source of
// truth shared with the frontend pricing cards.
export async function ensureTierPrice(tierId) {
  const tier = TIERS[tierId];
  if (!tier) throw new Error(`Unknown tier: ${tierId}`);
  const s = stripe();
  const existing = await s.prices.list({ lookup_keys: [tier.lookupKey], active: true, limit: 1 });
  if (existing.data.length) return existing.data[0];

  const product = await s.products.create({
    name: `Corvexsa ${tier.name}`,
    description: tier.features.join(' · '),
  });
  return s.prices.create({
    product: product.id,
    unit_amount: tier.amount,
    currency: 'usd',
    recurring: { interval: 'month' },
    lookup_key: tier.lookupKey,
  });
}

// One-off migration: the pre-tier system had a single $14.99/mo "Corvexsa
// Premium" price under lookup_key corvexsa_premium_monthly. It's superseded
// by the three tier prices above (Stripe prices are immutable — the amount
// couldn't just be edited). Archives the old price+product so the Stripe
// dashboard stays clean; harmless no-op if already archived or never created.
// Not called from any request path — run manually once during the migration.
export async function archiveLegacyPremiumPrice() {
  const s = stripe();
  const legacyKey = 'corvexsa_premium_monthly';
  const existing = await s.prices.list({ lookup_keys: [legacyKey], active: true, limit: 1 });
  if (!existing.data.length) return { archived: false, reason: 'not found or already archived' };
  const price = existing.data[0];
  await s.prices.update(price.id, { active: false });
  await s.products.update(price.product, { active: false });
  return { archived: true, priceId: price.id, productId: price.product };
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
