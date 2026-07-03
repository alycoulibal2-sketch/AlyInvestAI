// Plays a fixed advisor line in the requested voice, so the settings voice
// picker can preview each option before the client commits to it. Returns raw
// MP3 audio. Gated the same as the rest of voice — Founding + any active
// subscription tier (voice is included, metered, even on Essential).

import { withAuth } from './_lib/auth.mjs';
import * as membership from './_lib/membership.mjs';
import * as voice from './_lib/voice.mjs';

export default withAuth(async (req, context, user) => {
  try {
    if (!(await membership.isActive(user.id))) {
      return Response.json({ error: 'Resume your subscription to use voice.', code: 'membership_required' }, { status: 402 });
    }
    const { voice: voiceId } = await req.json().catch(() => ({}));
    const audio = await voice.synthesize(voice.PREVIEW_LINE, voiceId);
    return new Response(audio, {
      status: 200,
      headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' },
    });
  } catch (err) {
    console.error('[voice-preview]', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

export const config = { path: '/api/voice/preview' };
