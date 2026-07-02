// Creates a Stripe Checkout Session for the single Premium plan and returns
// its URL; the frontend redirects there. Membership only flips to subscribed
// when the webhook confirms payment — never here.

import { withAuth } from './_lib/auth.mjs';
import * as membership from './_lib/membership.mjs';
import { stripe, ensurePremiumPrice } from './_lib/stripe.mjs';

export default withAuth(async (req, context, user) => {
  try {
    const m = await membership.ensure(user.id);
    if (m.status === 'subscribed') {
      return Response.json({ error: 'Premium is already active on this account.' }, { status: 400 });
    }

    const price = await ensurePremiumPrice();
    const origin = new URL(req.url).origin;

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: user.id,
      customer: m.stripeCustomerId || undefined,       // returning subscriber keeps their customer
      customer_email: m.stripeCustomerId ? undefined : (user.email || undefined),
      subscription_data: { metadata: { userId: user.id } },
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
