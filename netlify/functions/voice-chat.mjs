// One voice conversation turn: same advisor brain as /api/chat (same context
// engine, structured reply, experience-level adaptation, and persistence — so
// spoken turns show up in the text conversation too), plus neural audio of the
// spoken answer returned inline as base64. One round trip.
//
// Premium-gated: Founding + subscribed members can talk; lapsed members get the
// paywall (402), same as text chat. Voice and text share the same monthly
// Advisor Interactions quota on Essential — this endpoint draws from the exact
// same counter as chat.mjs.

import * as market from './_lib/market.mjs';
import * as analysisCore from './_lib/analysisCore.mjs';
import * as claude from './_lib/claude.mjs';
import * as chatStore from './_lib/chatStore.mjs';
import { withAuth } from './_lib/auth.mjs';
import * as membership from './_lib/membership.mjs';
import * as interactions from './_lib/interactions.mjs';
import * as voice from './_lib/voice.mjs';

const LIMIT_REACHED_MESSAGE = "You've used all of your Advisor Interactions for this month. Your advisor will continue monitoring your portfolio in the background, and you'll still receive important notifications and alerts. Upgrade to Premium for unlimited conversations.";

export default withAuth(async (req, context, user) => {
  try {
    const mem = await membership.ensure(user.id);
    if (!(await membership.isActive(user.id))) {
      return Response.json({ error: 'Your Founding Member access has ended. Resume your subscription to talk with your advisor — it remembers everything.', code: 'membership_required' }, { status: 402 });
    }

    const { message, voice: voiceId } = await req.json();
    if (!message || !message.trim()) {
      return Response.json({ error: 'Nothing was said.' }, { status: 400 });
    }

    const ent = membership.entitlements(mem);
    const quota = await interactions.checkAndConsume(user.id, ent.interactionsPerMonth);
    if (!quota.allowed) {
      const chosenVoice = voice.resolveVoice(voiceId);
      const audio = await voice.synthesize(LIMIT_REACHED_MESSAGE, chosenVoice);
      return Response.json({
        limitReached: true,
        message: LIMIT_REACHED_MESSAGE,
        spoken: LIMIT_REACHED_MESSAGE,
        voice: chosenVoice,
        audio: audio.toString('base64'),
        interactions: { used: quota.used, limit: quota.limit },
      });
    }

    const snapshot = market.getDailySnapshot();
    const [portfolioView, latestAnalysis, stored] = await Promise.all([
      analysisCore.currentPortfolioView(user.id, snapshot, user),
      analysisCore.getLatestAnalysis(user.id),
      chatStore.list(user.id),
    ]);

    const history = stored.slice(-12).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

    const reply = await claude.chat(portfolioView, snapshot, latestAnalysis, history, message);

    await chatStore.append(user.id, [
      { role: 'user', text: message },
      { role: 'advisor', text: reply.shortAnswer + '\n\n' + reply.explanation, data: reply },
    ]);

    // Spoken text = answer + reasoning + a gentle action line (never the
    // technical block). Voice = the turn's explicit choice, else the account's
    // saved preference, else the default.
    const spoken = voice.composeSpokenText(reply);
    const chosen = voice.resolveVoice(voiceId || portfolioView.user?.voice);
    const audio = await voice.synthesize(spoken, chosen);

    return Response.json({ reply, spoken, voice: chosen, audio: audio.toString('base64'), interactions: { used: quota.used, limit: quota.limit } });
  } catch (err) {
    console.error('[voice-chat]', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

export const config = { path: '/api/voice/chat' };
