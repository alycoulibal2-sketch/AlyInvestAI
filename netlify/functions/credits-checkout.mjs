// Creates a one-time Stripe Checkout Session for a Corvexsa Credits pack and
// returns its URL; the frontend redirects there. Credits are only granted when
// the webhook confirms payment — never here. Any signed-in user can top up
// (buying credits is not membership-gated).

import { withAuth } from './_lib/auth.mjs';
import * as membership from './_lib/membership.mjs';
import { stripe, creditPack, ensureCreditsPrice } from './_lib/stripe.mjs';

export default withAuth(async (req, context, user) => {
  try {
    const { pack: packId } = await req.json();
    const pack = creditPack(packId);
    if (!pack) return Response.json({ error: 'Unknown credits pack.' }, { status: 400 });

    // Reuse the account's Stripe customer if we already have one (from Premium),
    // else let Checkout collect the email — keeps one customer per person.
    const m = await membership.ensure(user.id);
    const price = await ensureCreditsPrice(pack);
    const origin = new URL(req.url).origin;

    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: user.id,
      customer: m.stripeCustomerId || undefined,
      customer_email: m.stripeCustomerId ? undefined : (user.email || undefined),
      payment_intent_data: { metadata: { userId: user.id, kind: 'credits', pack: pack.id, credits: String(pack.credits) } },
      metadata: { userId: user.id, kind: 'credits', pack: pack.id, credits: String(pack.credits) },
      success_url: `${origin}/?credits=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?credits=cancelled`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error('[credits-checkout]', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

export const config = { path: '/api/credits/checkout' };
