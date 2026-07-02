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
