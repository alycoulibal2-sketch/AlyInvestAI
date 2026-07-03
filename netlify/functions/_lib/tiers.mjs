// Single source of truth for Corvexsa's paid tiers — pricing, Stripe lookup
// keys, and entitlements. Both the backend (metering, checkout) and the
// frontend (pricing cards, via GET /api/billing/tiers) read from this file,
// so the price shown to a user and the price Stripe actually charges can
// never drift apart.
//
// Entitlement notes (being explicit about what's real vs. aspirational):
//   interactionsPerMonth: null = unlimited, else the shared text+voice quota.
//   voiceUnlimited: true means voice never counts against the quota even if
//     a numeric quota exists (not currently used — Essential's voice DOES
//     share its 300, per product spec — kept for future flexibility).
//   portfolios: descriptive only today. The app supports exactly one broker
//     connection per account regardless of tier; "multiple portfolios" is
//     not wired to any real limit yet. Shown as pricing copy, not enforced.
//   priorityPush: real — controls the Web Push "Urgency" header, which
//     genuinely affects OS-level delivery timing.
//   Family/shared portfolios, custom advisor rules, experimental features,
//   advanced simulations, beta features, dedicated support: descriptive
//   entitlement flags only. No backing feature exists yet; nothing is
//   silently gated or faked — they simply aren't built.

export const TIERS = {
  essential: {
    id: 'essential',
    lookupKey: 'corvexsa_tier_essential_monthly',
    name: 'Essential',
    amount: 999, // cents
    interactionsPerMonth: 300,
    voiceUnlimited: false,
    portfolios: 1,
    priorityPush: false,
    popular: false,
    features: [
      '300 Advisor Interactions per month',
      'Voice and text share the same interaction limit',
      '1 connected portfolio',
      'Daily portfolio monitoring',
      'Portfolio Health Score',
      'Advisor Memory',
      'Investment Timeline',
      'Smart notifications',
      'Standard AI speed',
    ],
  },
  premium: {
    id: 'premium',
    lookupKey: 'corvexsa_tier_premium_monthly',
    name: 'Premium',
    amount: 1999,
    interactionsPerMonth: null,
    voiceUnlimited: true,
    portfolios: null, // "multiple" — descriptive only, see note above
    priorityPush: true,
    popular: true,
    everythingIn: 'essential',
    features: [
      'Unlimited Advisor Interactions',
      'Unlimited voice conversations',
      'Multiple connected portfolios',
      'Faster AI responses',
      'Deep company analysis',
      '"What Changed?" analysis',
      'Unlimited watchlists',
      'Priority notifications',
      'Beta features',
      'Priority support',
    ],
  },
  elite: {
    id: 'elite',
    lookupKey: 'corvexsa_tier_elite_monthly',
    name: 'Elite',
    amount: 3999,
    interactionsPerMonth: null,
    voiceUnlimited: true,
    portfolios: null,
    priorityPush: true,
    popular: false,
    everythingIn: 'premium',
    features: [
      'Family portfolios',
      'Shared portfolios',
      'Advanced simulations',
      'Custom advisor rules',
      'Experimental AI features',
      'Highest processing priority',
      'Dedicated premium support',
    ],
  },
};

export const TIER_ORDER = ['essential', 'premium', 'elite'];

export function tierById(id) {
  return TIERS[id] || null;
}

export function tierByLookupKey(lookupKey) {
  return TIER_ORDER.map(id => TIERS[id]).find(t => t.lookupKey === lookupKey) || null;
}

// The unlimited entitlement set granted during the Founding Member period —
// deliberately identical to Premium's limits ("no features locked, no
// limitations"), but reported to the client under its own label.
export const FOUNDING_ENTITLEMENTS = {
  tier: null,
  label: 'Founding Member',
  interactionsPerMonth: null,
  voiceUnlimited: true,
  priorityPush: true,
};

export function toPublic(tier) {
  return {
    id: tier.id,
    name: tier.name,
    amount: tier.amount,
    interactionsPerMonth: tier.interactionsPerMonth,
    popular: !!tier.popular,
    everythingIn: tier.everythingIn || null,
    features: tier.features,
  };
}
