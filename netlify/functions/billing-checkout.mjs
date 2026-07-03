// Creates a Stripe Checkout Session for one of Corvexsa's three subscription
// tiers (Essential/Premium/Elite) and returns its URL; the frontend redirects
// there. Membership only flips to subscribed — or changes tier — when the
// webhook confirms it — never here, except for the one legitimate write this
// endpoint makes directly: telling Stripe to swap the price on an ALREADY
// active subscription (a plan change), which itself still round-trips through
// customer.subscription.updated before the stored tier is trusted.

import { withAuth } from './_lib/auth.mjs';
import * as membership from './_lib/membership.mjs';
import { stripe, ensureTierPrice } from './_lib/stripe.mjs';
import { TIERS } from './_lib/tiers.mjs';

export default withAuth(async (req, context, user) => {
  try {
    const { tier: tierId } = await req.json();
    const tier = TIERS[tierId];
    if (!tier) return Response.json({ error: 'Unknown plan.' }, { status: 400 });

    const m = await membership.ensure(user.id);
    const price = await ensureTierPrice(tier.id);
    const origin = new URL(req.url).origin;

    // Already on a paid plan: this is an upgrade/downgrade, not a new
    // subscription. Swap the price on the existing subscription instead of
    // starting a second one — Stripe prorates automatically.
    if (m.status === 'subscribed' && m.stripeSubscriptionId) {
      if ((m.tier || 'premium') === tier.id) {
        return Response.json({ error: `You're already on ${tier.name}.` }, { status: 400 });
      }
      const sub = await stripe().subscriptions.retrieve(m.stripeSubscriptionId);
      const item = sub.items.data[0];
      await stripe().subscriptions.update(m.stripeSubscriptionId, {
        items: [{ id: item.id, price: price.id }],
        proration_behavior: 'create_prorations',
        metadata: { ...sub.metadata, userId: user.id, tier: tier.id },
      });
      // The tier of record updates when Stripe's customer.subscription.updated
      // webhook lands (usually within a second or two) — the frontend polls
      // /api/membership the same way it does for a brand-new subscription.
      return Response.json({ changed: true, tier: tier.id });
    }

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: user.id,
      customer: m.stripeCustomerId || undefined,       // returning member keeps their customer
      customer_email: m.stripeCustomerId ? undefined : (user.email || undefined),
      metadata: { userId: user.id, tier: tier.id },
      subscription_data: { metadata: { userId: user.id, tier: tier.id } },
      allow_promotion_codes: true,
      success_url: `${origin}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?billing=cancelled`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error('[billing-checkout]', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

export const config = { path: '/api/billing/checkout' };
