// The account's full conversation feed: stored chat turns merged with the
// analysis history, sorted chronologically. This is what the frontend
// renders on load, so the conversation persists across reloads and devices.

import * as chatStore from './_lib/chatStore.mjs';
import * as analysisCore from './_lib/analysisCore.mjs';
import { withAuth } from './_lib/auth.mjs';

export default withAuth(async (req, context, user) => {
  const [chat, analyses] = await Promise.all([
    chatStore.list(user.id),
    analysisCore.listAnalyses(user.id, 10),
  ]);

  const feed = [
    ...chat.map(m => ({ kind: 'chat', role: m.role, text: m.text, data: m.data, at: m.at })),
    ...analyses.map(a => ({
      kind: 'analysis',
      at: a.ranAt,
      advisorMessage: a.advisorMessage,
      alerts: a.alerts || [],
      recommendations: a.recommendations || [],
      opportunities: a.opportunities || [],
    })),
  ].sort((x, y) => new Date(x.at) - new Date(y.at));

  return Response.json({ feed, latestAnalysis: analyses[0] || null });
});

export const config = { path: '/api/conversation' };
