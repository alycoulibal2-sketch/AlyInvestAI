// Stripe webhook — the ONLY place membership flips to subscribed, and the
// place it lapses again when a subscription truly ends. No Firebase auth
// here (Stripe is the caller); authenticity comes from signature
// verification against STRIPE_WEBHOOK_SECRET on the raw body.

import { stripe } from './_lib/stripe.mjs';
import * as membership from './_lib/membership.mjs';
import * as notifications from './_lib/notifications.mjs';
import * as credits from './_lib/credits.mjs';
import { tierByLookupKey, TIERS } from './_lib/tiers.mjs';

export default async (req) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'Webhook not configured' }, { status: 500 });

  let event;
  try {
    const raw = await req.text();
    const sig = req.headers.get('stripe-signature');
    event = await stripe().webhooks.constructEventAsync(raw, sig, secret);
  } catch (err) {
    console.error('[billing-webhook] signature verification failed:', err.message);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;

        // Subscription checkout → activate the chosen tier.
        if (userId && session.mode === 'subscription') {
          const tierId = session.metadata?.tier || null;
          await membership.subscribe(userId, {
            customerId: session.customer,
            subscriptionId: session.subscription,
            tier: tierId,
          });
          const tierName = (TIERS[tierId] || TIERS.premium).name;
          await notifications.add(userId, {
            tag: 'update',
            title: `Welcome to Corvexsa ${tierName}`,
            body: 'Your subscription is active. Your advisor is watching your portfolio every day — thank you for being part of Corvexsa.',
          });
        }

        // One-time credits purchase → top up the account's balance (idempotent
        // on session id, so a redelivered event never double-grants).
        if (userId && session.mode === 'payment' && session.metadata?.kind === 'credits') {
          const amount = parseInt(session.metadata.credits, 10) || 0;
          if (amount > 0) {
            await credits.grantForSession(userId, {
              sessionId: session.id,
              credits: amount,
              pack: session.metadata.pack || null,
              amount: session.amount_total,
            });
            await notifications.add(userId, {
              tag: 'update',
              title: `${amount} Corvexsa credits added`,
              body: 'Your credits are ready to use. Thank you for supporting Corvexsa.',
            });
          }
        }
        break;
      }
      // Plan change (upgrade/downgrade), whether initiated through our own
      // billing-checkout endpoint or Stripe's own Customer Portal. The tier
      // of record is always derived from the subscription's CURRENT price's
      // lookup_key — never trusted from metadata alone, since metadata can
      // go stale if a plan is ever changed by some other path.
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        const priceLookupKey = sub.items?.data?.[0]?.price?.lookup_key;
        const tier = priceLookupKey ? tierByLookupKey(priceLookupKey) : null;
        if (userId && tier && sub.status === 'active') {
          const before = (await membership.ensure(userId)).tier;
          await membership.setTier(userId, tier.id);
          if (before && before !== tier.id) {
            await notifications.add(userId, {
              tag: 'update',
              title: `You're now on Corvexsa ${tier.name}`,
              body: 'Your plan has changed and takes effect immediately. Thank you for being part of Corvexsa.',
            });
          }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        if (userId) {
          await membership.unsubscribe(userId);
          await notifications.add(userId, {
            tag: 'update',
            title: 'Your Corvexsa subscription has ended',
            body: 'Monitoring and analysis are paused. Your timeline and Advisor Memory are preserved — resume anytime and your advisor will remember everything.',
          });
        }
        break;
      }
      default:
        break; // unhandled event types are fine — 200 so Stripe stops retrying
    }
    return Response.json({ received: true });
  } catch (err) {
    console.error('[billing-webhook]', event.type, err.message);
    return Response.json({ error: err.message }, { status: 500 }); // 500 → Stripe retries
  }
};

export const config = { path: '/api/billing/webhook' };
