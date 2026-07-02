import * as market from './_lib/market.mjs';
import * as analysisCore from './_lib/analysisCore.mjs';
import * as claude from './_lib/claude.mjs';
import * as chatStore from './_lib/chatStore.mjs';
import { withAuth } from './_lib/auth.mjs';
import * as membership from './_lib/membership.mjs';

export default withAuth(async (req, context, user) => {
  try {
    if (!(await membership.isActive(user.id))) {
      return Response.json({ error: 'Your Founding Member access has ended. Resume Premium to continue — your advisor remembers everything.', code: 'membership_required' }, { status: 402 });
    }

    const { message } = await req.json();
    const snapshot = market.getDailySnapshot();
    const [portfolioView, latestAnalysis, stored] = await Promise.all([
      analysisCore.currentPortfolioView(user.id, snapshot, user),
      analysisCore.getLatestAnalysis(user.id),
      chatStore.list(user.id),
    ]);

    // Context comes from the ACCOUNT's stored history, not the client —
    // the advisor remembers past conversations across devices and reloads.
    const history = stored.slice(-12).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));

    const reply = await claude.chat(portfolioView, snapshot, latestAnalysis, history, message);

    // Stored text = short answer + explanation, so Claude's future context
    // window reads naturally; the full structure rides along in `data`.
    await chatStore.append(user.id, [
      { role: 'user', text: message },
      { role: 'advisor', text: reply.shortAnswer + '\n\n' + reply.explanation, data: reply },
    ]);

    return Response.json({ reply });
  } catch (err) {
    console.error('[chat]', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

export const config = { path: '/api/chat' };
