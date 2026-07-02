const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const API_KEY = process.env.ANTHROPIC_API_KEY;
const API_URL = 'https://api.anthropic.com/v1/messages';

// On Sonnet 5, OMITTING `thinking` silently enables adaptive thinking, and
// max_tokens caps thinking + visible answer COMBINED. A small max_tokens can
// therefore be consumed entirely by thinking, yielding a response with zero
// text blocks (stop_reason: "max_tokens") — which is exactly the production
// bug this signature now guards against. Always pass generous max_tokens and,
// where latency matters, an explicit effort level.
async function callClaude({ system, messages, tools, tool_choice, max_tokens = 4096, effort }) {
  if (!API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  const body = { model: MODEL, max_tokens, system, messages, thinking: { type: 'adaptive' } };
  if (effort) body.output_config = { effort };
  if (tools) body.tools = tools;
  if (tool_choice) body.tool_choice = tool_choice;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Claude API error ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

const ADVISOR_VOICE = `You are Noce, the personal AI investment advisor inside the Noce app.
You are not a chatbot and never describe yourself as one. You speak like a thoughtful, calm
wealth manager texting a long-time client — warm, direct, plain language, no jargon dumps,
no hedging disclaimers stacked on every sentence, no emoji.

Hard rules:
- Noce is READ-ONLY. It never executes trades, never holds money, never moves assets.
  You only ever "recommend" or "suggest" — never say you bought/sold/executed anything.
- You must base every number you cite on the portfolio and market data provided to you in
  this message. Never invent a price, percentage, or holding that isn't in the supplied data.
- Recommended share quantities for a BUY must be affordable given the client's available cash.
  Recommended share quantities for a SELL/TRIM must not exceed the shares currently held.
- This rule applies to the COMBINED total of every buy you suggest in a single response — across
  both recommendations and opportunities. Add up all suggested buy costs before finalizing
  quantities; their sum must not exceed the client's stated cash available. If it would, scale
  down quantities or drop the lowest-confidence opportunity rather than exceed the cash budget.
- Respect the client's stated risk profile and sector concentration target when reasoning.
- Keep prose tight: 2-5 sentences per message unless the user asks for more detail.`;

function toolChoice(name) { return { type: 'tool', name }; }

const ANALYSIS_TOOL = {
  name: 'record_analysis',
  description: "Record today's full portfolio analysis, recommendations, opportunities, and any alerts.",
  input_schema: {
    type: 'object',
    properties: {
      portfolioHealthScore: { type: 'integer', minimum: 0, maximum: 100 },
      diversificationScore: { type: 'integer', minimum: 0, maximum: 100 },
      overallRisk: { type: 'string', enum: ['Low', 'Moderate', 'Elevated', 'High'] },
      advisorMessage: { type: 'string', description: 'A short morning message in your voice, as if texting the client right now. 2-5 sentences.' },
      recommendations: {
        type: 'array',
        description: 'One entry per currently-held ticker worth commenting on this cycle.',
        items: {
          type: 'object',
          properties: {
            ticker: { type: 'string' },
            action: { type: 'string', enum: ['buy', 'hold', 'sell', 'trim'] },
            quantity: { type: 'integer', description: 'Shares to act on; 0 for hold.' },
            estPrice: { type: 'number' },
            confidence: { type: 'integer', minimum: 0, maximum: 100 },
            rationale: { type: 'string' },
          },
          required: ['ticker', 'action', 'quantity', 'confidence', 'rationale'],
        },
      },
      opportunities: {
        type: 'array',
        description: 'New tickers (not currently held) worth suggesting a buy on, if any look attractive today. Can be empty.',
        items: {
          type: 'object',
          properties: {
            ticker: { type: 'string' },
            name: { type: 'string' },
            quantity: { type: 'integer' },
            estPrice: { type: 'number' },
            confidence: { type: 'integer', minimum: 0, maximum: 100 },
            rationale: { type: 'string' },
          },
          required: ['ticker', 'quantity', 'confidence', 'rationale'],
        },
      },
      alerts: {
        type: 'array',
        description: 'Only meaningful risk/concentration/volatility alerts. Empty array if nothing material changed.',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
            title: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['severity', 'title', 'body'],
        },
      },
    },
    required: ['portfolioHealthScore', 'diversificationScore', 'overallRisk', 'advisorMessage', 'recommendations', 'opportunities', 'alerts'],
  },
};

const RISK_TOOL = {
  name: 'record_risk_check',
  description: 'Record the result of an ad-hoc intraday risk scan of the portfolio.',
  input_schema: {
    type: 'object',
    properties: {
      riskDetected: { type: 'boolean' },
      alerts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
            title: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['severity', 'title', 'body'],
        },
      },
    },
    required: ['riskDetected', 'alerts'],
  },
};

function extractToolInput(resp, toolName) {
  const block = (resp.content || []).find(b => b.type === 'tool_use' && b.name === toolName);
  if (!block) {
    throw new Error(`Claude did not return the expected tool call (stop_reason: ${resp.stop_reason}, blocks: ${(resp.content || []).map(b => b.type).join(',') || 'none'})`);
  }
  return block.input;
}

function extractText(resp) {
  const text = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  if (!text) {
    throw new Error(`Claude returned no text (stop_reason: ${resp.stop_reason}, blocks: ${(resp.content || []).map(b => b.type).join(',') || 'none'})`);
  }
  return text;
}

export async function runDailyAnalysis(portfolioView, marketSnapshot, recentNotifications) {
  const userMsg = `Here is the client's current state. Analyze it and call record_analysis.

CLIENT PROFILE:
${JSON.stringify(portfolioView.user, null, 2)}

CURRENT HOLDINGS (with live prices already applied):
${JSON.stringify(portfolioView.holdings, null, 2)}

CASH AVAILABLE TO INVEST: $${portfolioView.cash}
TOTAL PORTFOLIO VALUE: $${portfolioView.total}
SECTOR WEIGHTS: ${JSON.stringify(portfolioView.sectorWeights)}

TODAY'S MARKET SNAPSHOT (simulated feed standing in for a live market data provider):
${JSON.stringify(marketSnapshot.tickers, null, 2)}
VIX-style volatility index: ${marketSnapshot.vix}

RECENT NOTIFICATIONS ALREADY SENT (avoid repeating the same point verbatim):
${JSON.stringify((recentNotifications || []).slice(0, 6).map(n => n.title))}`;

  const resp = await callClaude({
    system: ADVISOR_VOICE,
    messages: [{ role: 'user', content: userMsg }],
    tools: [ANALYSIS_TOOL],
    tool_choice: toolChoice('record_analysis'),
    max_tokens: 8000,
  });
  return extractToolInput(resp, 'record_analysis');
}

export async function runRiskCheck(portfolioView, marketSnapshot) {
  const userMsg = `Quick intraday check — does anything here rise to the level of a risk alert
worth interrupting the client for right now? Only flag if genuinely material (sharp move,
concentration breach, volatility spike). Be conservative — most checks should find nothing.

HOLDINGS: ${JSON.stringify(portfolioView.holdings.map(h => ({ ticker: h.ticker, weightPct: h.weightPct, gainPct: h.gainPct })))}
SECTOR WEIGHTS: ${JSON.stringify(portfolioView.sectorWeights)}
SECTOR CONCENTRATION TARGET: ${portfolioView.user.maxSectorConcentrationTarget}%
INTRADAY MARKET TICK: ${JSON.stringify(marketSnapshot.tickers.map(t => ({ ticker: t.ticker, changePct: t.changePct })))}
VIX: ${marketSnapshot.vix}`;

  const resp = await callClaude({
    system: ADVISOR_VOICE,
    messages: [{ role: 'user', content: userMsg }],
    tools: [RISK_TOOL],
    tool_choice: toolChoice('record_risk_check'),
    max_tokens: 4000,
  });
  return extractToolInput(resp, 'record_risk_check');
}

export async function chat(portfolioView, marketSnapshot, latestAnalysis, history, userMessage) {
  const context = `Client portfolio context you must ground every answer in:
TOTAL: $${portfolioView.total} · CASH AVAILABLE: $${portfolioView.cash}
HOLDINGS: ${JSON.stringify(portfolioView.holdings.map(h => ({ ticker: h.ticker, weightPct: h.weightPct, shares: h.shares, price: h.price, avgCost: h.avgCost, gainPct: h.gainPct })))}
SECTOR WEIGHTS: ${JSON.stringify(portfolioView.sectorWeights)}
RISK PROFILE: ${portfolioView.user.riskProfile} · SECTOR CONCENTRATION TARGET: ${portfolioView.user.maxSectorConcentrationTarget}%

TODAY'S MARKET (simulated feed standing in for a live market data provider):
${JSON.stringify((marketSnapshot?.tickers || []).map(t => ({ ticker: t.ticker, price: t.price, changePct: t.changePct, headline: t.headline || undefined, daysToEarnings: t.daysToEarnings })))}
VIX-style volatility index: ${marketSnapshot?.vix ?? 'n/a'}

${latestAnalysis ? `YOUR MOST RECENT DAILY REVIEW (from ${latestAnalysis.ranAt}) — stay consistent with it, or explain what changed if you now disagree:
Health ${latestAnalysis.portfolioHealthScore}/100 · Diversification ${latestAnalysis.diversificationScore}/100 · Risk ${latestAnalysis.overallRisk}
Summary: ${latestAnalysis.advisorMessage}
Recommendations: ${JSON.stringify((latestAnalysis.recommendations || []).map(r => ({ ticker: r.ticker, action: r.action, quantity: r.quantity, confidence: r.confidence })))}
Opportunities: ${JSON.stringify((latestAnalysis.opportunities || []).map(o => ({ ticker: o.ticker, quantity: o.quantity, confidence: o.confidence })))}` : 'You have not yet run a daily review for this client.'}

If asked for specific share quantities, derive them from the holdings, prices, and cash above —
never invent figures not computable from this data.`;

  const messages = [
    ...(history || []).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const resp = await callClaude({
    system: ADVISOR_VOICE + '\n\n' + context,
    messages,
    max_tokens: 4096,
    effort: 'low',
  });
  return extractText(resp);
}
