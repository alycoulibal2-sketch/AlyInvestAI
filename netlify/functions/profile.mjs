// Persists the onboarding answers to the account so the advisor adapts to
// them permanently — experience level, goals, risk, horizon, preferences.
// Asked once at onboarding, never again.

import * as portfolioLib from './_lib/portfolio.mjs';
import { withAuth } from './_lib/auth.mjs';
import * as voice from './_lib/voice.mjs';

const EXPERIENCE = ['Beginner', 'Intermediate', 'Advanced', 'Professional'];
const FIELDS = ['experience', 'goals', 'riskProfile', 'horizon', 'monthlyContribution', 'preferredSectors', 'recommendationPriority', 'voice'];

export default withAuth(async (req, context, user) => {
  const body = await req.json();
  const profile = await portfolioLib.loadUserProfile(user.id, user);

  for (const f of FIELDS) {
    if (body[f] === undefined) continue;
    if (f === 'experience' && !EXPERIENCE.includes(body[f])) continue;
    if (f === 'voice') { profile.voice = voice.resolveVoice(body.voice); continue; }
    profile[f] = body[f];
  }

  await portfolioLib.saveUserProfile(user.id, profile);
  return Response.json({ ok: true, profile });
});

export const config = { path: '/api/profile' };
