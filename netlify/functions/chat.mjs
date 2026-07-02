import * as market from './_lib/market.mjs';
import * as analysisCore from './_lib/analysisCore.mjs';
import * as claude from './_lib/claude.mjs';
import * as chatStore from './_lib/chatStore.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => {
  try {
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

    await chatStore.append(user.id, [
      { role: 'user', text: message },
      { role: 'advisor', text: reply },
    ]);

    return Response.json({ reply });
  } catch (err) {
    console.error('[chat]', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

export const config = { path: '/api/chat' };
