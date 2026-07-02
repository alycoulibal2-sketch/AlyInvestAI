// Stripe Customer Portal: self-service cancellation, payment method updates,
// invoices. Keeps Corvexsa out of the business of building billing UI.

import { withAuth } from './_lib/auth.mjs';
import * as membership from './_lib/membership.mjs';
import { stripe } from './_lib/stripe.mjs';

export default withAuth(async (req, context, user) => {
  try {
    const m = await membership.ensure(user.id);
    if (!m.stripeCustomerId) {
      return Response.json({ error: 'No billing profile on this account yet.' }, { status: 400 });
    }
    const origin = new URL(req.url).origin;
    const session = await stripe().billingPortal.sessions.create({
      customer: m.stripeCustomerId,
      return_url: origin + '/',
    });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error('[billing-portal]', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

export const config = { path: '/api/billing/portal' };
