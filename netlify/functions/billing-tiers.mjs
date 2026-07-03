// The three subscription tiers, for the frontend pricing cards — a single
// source of truth shared with billing-checkout.mjs, so the price shown can
// never drift from the price actually charged.

import { withAuth } from './_lib/auth.mjs';
import { TIERS, TIER_ORDER, toPublic } from './_lib/tiers.mjs';

export default withAuth(async () => {
  return Response.json({ tiers: TIER_ORDER.map(id => toPublic(TIERS[id])) });
});

export const config = { path: '/api/billing/tiers' };
