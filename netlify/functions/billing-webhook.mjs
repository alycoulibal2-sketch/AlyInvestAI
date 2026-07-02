// Stripe webhook — the ONLY place membership flips to subscribed, and the
// place it lapses again when a subscription truly ends. No Firebase auth
// here (Stripe is the caller); authenticity comes from signature
// verification against STRIPE_WEBHOOK_SECRET on the raw body.

import { stripe } from './_lib/stripe.mjs';
import * as membership from './_lib/membership.mjs';
import * as notifications from './_lib/notifications.mjs';

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
        const userId = session.client_reference_id;
        if (userId && session.mode === 'subscription') {
          await membership.subscribe(userId, {
            customerId: session.customer,
            subscriptionId: session.subscription,
          });
          await notifications.add(userId, {
            tag: 'update',
            title: 'Welcome to Corvexsa Premium',
            body: 'Your subscription is active. Your advisor is watching your portfolio every day — thank you for being part of Corvexsa.',
          });
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
            title: 'Your Premium subscription has ended',
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
