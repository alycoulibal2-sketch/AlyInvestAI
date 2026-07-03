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

const BASE_VOICE = `You are Corvexsa, the personal AI investment advisor inside the Corvexsa app.
You are not a chatbot and never describe yourself as one. You speak like a thoughtful, calm
wealth manager texting a long-time client — warm, direct, reassuring, no emoji.
The goal is never to impress with financial jargon — it is to make the client feel
confident that they understand exactly what is happening with their money.

Hard rules:
- Corvexsa is READ-ONLY. It never executes trades, never holds money, never moves assets.
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
- Keep prose tight: 2-5 sentences per section unless the client asks for more detail.`;

// Communication style, keyed to the experience level the client gave during
// onboarding. Applied automatically to every response — never ask again.
const STYLES = {
  Beginner: `COMMUNICATION LEVEL — BEGINNER (completely new to investing):
Speak like an excellent human financial advisor talking to someone brand new.
Avoid technical words whenever possible; never assume financial knowledge.
Instead of "Microsoft's forward P/E increased while EBITDA remained strong," say
"Microsoft is still performing well as a company, and nothing important has changed
since yesterday. I don't recommend making any changes today."
If a technical term is genuinely necessary, explain it naturally in the same breath,
e.g. "P/E ratio — simply a way of estimating whether a stock looks expensive or
inexpensive compared to the money the company earns."
The client should finish every reply thinking: "I understand exactly what my advisor meant."`,
  Intermediate: `COMMUNICATION LEVEL — INTERMEDIATE:
Use some investment terminology (diversification, valuation, earnings) but keep every
explanation clear. Explain the important concepts briefly without overwhelming.`,
  Advanced: `COMMUNICATION LEVEL — ADVANCED:
Use financial metrics naturally. Discuss valuation, earnings, financial ratios and
risks directly — no hand-holding, but stay concise and readable.`,
  Professional: `COMMUNICATION LEVEL — PROFESSIONAL:
Provide complete financial analysis: assumptions, valuation methodology, risk metrics,
scenario thinking. No simplification necessary. The client should finish thinking:
"My advisor clearly knows what they're talking about."`,
};

function styleFor(experience) {
  return STYLES[experience] || STYLES.Intermediate;
}

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
        description: 'New tickers (not currently held) worth suggesting a buy on, if any look attractive today. Can be empty. These also power the Opportunity Feed, so give each a real risk note.',
        items: {
          type: 'object',
          properties: {
            ticker: { type: 'string' },
            name: { type: 'string' },
            quantity: { type: 'integer' },
            estPrice: { type: 'number' },
            confidence: { type: 'integer', minimum: 0, maximum: 100, description: 'Doubles as the Opportunity Score (0-100).' },
            rationale: { type: 'string' },
            risk: { type: 'string', description: 'One short sentence on the main risk of this opportunity.' },
          },
          required: ['ticker', 'quantity', 'confidence', 'rationale', 'risk'],
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
      healthBreakdown: {
        type: 'object',
        description: 'The Portfolio Health Score broken into five categories, each 0-100 with a one-to-two sentence plain-language explanation of exactly how you arrived at it from this portfolio. portfolioHealthScore should be roughly the average of these five.',
        properties: {
          diversification: { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 100 }, explanation: { type: 'string' } }, required: ['score', 'explanation'] },
          risk: { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 100 }, explanation: { type: 'string' } }, required: ['score', 'explanation'] },
          growthPotential: { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 100 }, explanation: { type: 'string' } }, required: ['score', 'explanation'] },
          stability: { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 100 }, explanation: { type: 'string' } }, required: ['score', 'explanation'] },
          valuation: { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 100 }, explanation: { type: 'string' } }, required: ['score', 'explanation'] },
        },
        required: ['diversification', 'risk', 'growthPotential', 'stability', 'valuation'],
      },
      journalEntry: {
        type: 'string',
        description: "Today's advisor journal entry — a short, calm, first-person diary note (3-6 sentences) as if you personally sat down at the end of the day and wrote what you reviewed, what changed, what earnings or news mattered, and whether the client's portfolio stayed aligned with their goals. Warm and human, never a bullet list. Written at the client's communication level.",
      },
      goalAssessments: {
        type: 'array',
        description: "One entry for EACH of the client's stated goals (from CLIENT PROFILE goals). If they have no explicit goals, assess their implied goal of long-term wealth building.",
        items: {
          type: 'object',
          properties: {
            goal: { type: 'string', description: 'The goal, echoed from the profile.' },
            progressPct: { type: 'integer', minimum: 0, maximum: 100, description: 'How far along toward this goal, best estimate given portfolio size, contributions, and horizon.' },
            probabilityPct: { type: 'integer', minimum: 0, maximum: 100, description: 'Probability of achieving this goal on the current trajectory.' },
            timeline: { type: 'string', description: 'Estimated timeline, e.g. "~12 years" or "on track for 2040".' },
            positiveFactors: { type: 'array', items: { type: 'string' }, description: 'What is helping (1-3 items).' },
            negativeFactors: { type: 'array', items: { type: 'string' }, description: 'What is working against it (0-3 items).' },
            toImprove: { type: 'string', description: 'The single most impactful thing to improve the odds.' },
          },
          required: ['goal', 'progressPct', 'probabilityPct', 'timeline', 'positiveFactors', 'negativeFactors', 'toImprove'],
        },
      },
    },
    required: ['portfolioHealthScore', 'diversificationScore', 'overallRisk', 'advisorMessage', 'recommendations', 'opportunities', 'alerts', 'healthBreakdown', 'journalEntry', 'goalAssessments'],
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

export async function runDailyAnalysis(portfolioView, marketSnapshot, recentNotifications, favorites) {
  const favLine = (favorites && favorites.length)
    ? `\n\nFAVORITE COMPANIES the client follows but does NOT own (monitor these too — you may surface one as an opportunity if it looks attractive, and mention any that had material news): ${JSON.stringify(favorites)}`
    : '';
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
${JSON.stringify((recentNotifications || []).slice(0, 6).map(n => n.title))}

THE CLIENT'S STATED GOALS (assess each one in goalAssessments): ${JSON.stringify(portfolioView.user?.goals || ['Long-term wealth building'])}${favLine}`;

  const resp = await callClaude({
    system: BASE_VOICE + '\n\n' + styleFor(portfolioView.user?.experience) +
      '\nWrite advisorMessage, journalEntry, every rationale, every alert body, every health-breakdown explanation, ' +
      'and every goal assessment at this communication level. The healthBreakdown explanations must describe how you ' +
      "actually derived each score from THIS client's holdings, sector weights, and cash — never generic definitions.",
    messages: [{ role: 'user', content: userMsg }],
    tools: [ANALYSIS_TOOL],
    tool_choice: toolChoice('record_analysis'),
    // Richer structured output now (health breakdown + journal + per-goal
    // assessments). Sonnet 5 caps thinking+output combined, so keep this
    // generous or the tool call can be truncated mid-JSON.
    max_tokens: 16000,
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
    system: BASE_VOICE + '\n\n' + styleFor(portfolioView.user?.experience) +
      '\nWrite every alert title and body at this communication level.',
    messages: [{ role: 'user', content: userMsg }],
    tools: [RISK_TOOL],
    tool_choice: toolChoice('record_risk_check'),
    max_tokens: 4000,
  });
  return extractToolInput(resp, 'record_risk_check');
}

// A Portfolio Snapshot — a beautiful "moment" the client can relive years
// later. The computed numbers (value, health, allocation, top holdings) are
// filled in by the caller from real data; Claude supplies only the narrative
// colour: mood, sentiment, the standout opportunity/risk, achievements.
const SNAPSHOT_TOOL = {
  name: 'record_snapshot',
  description: 'Write the narrative layer of a portfolio snapshot — the human colour that makes it worth reliving later.',
  input_schema: {
    type: 'object',
    properties: {
      advisorSummary: { type: 'string', description: "2-4 sentences capturing where the portfolio stands right now and how the client is doing, in your warm advisor voice — as if writing a caption for this moment in their journey." },
      advisorMood: { type: 'string', enum: ['Optimistic', 'Confident', 'Steady', 'Watchful', 'Cautious', 'Concerned'], description: "Your honest overall mood about the portfolio at this moment." },
      marketSentiment: { type: 'string', enum: ['Bullish', 'Constructive', 'Neutral', 'Uneasy', 'Bearish'], description: 'The broad market mood given the snapshot data.' },
      biggestOpportunity: { type: 'string', description: 'The single most interesting opportunity right now, one sentence.' },
      biggestRisk: { type: 'string', description: 'The single biggest risk to watch right now, one sentence.' },
      favoriteCompany: { type: 'string', description: "The one holding you feel best about right now (ticker + a few words why)." },
      achievements: { type: 'array', items: { type: 'string' }, description: '0-3 milestones or things worth celebrating about this portfolio at this point (e.g. "First time above $25k", "Diversification improved for the third month running"). Empty if nothing stands out.' },
    },
    required: ['advisorSummary', 'advisorMood', 'marketSentiment', 'biggestOpportunity', 'biggestRisk', 'favoriteCompany', 'achievements'],
  },
};

export async function generateSnapshotNarrative(portfolioView, latestAnalysis, marketSnapshot, context) {
  const userMsg = `Write the narrative for a portfolio snapshot (${context?.reason || 'monthly'} capture, ${context?.date || 'today'}). Call record_snapshot.

PORTFOLIO VALUE: $${portfolioView.total} · CASH: $${portfolioView.cash}
HOLDINGS: ${JSON.stringify(portfolioView.holdings.map(h => ({ ticker: h.ticker, weightPct: h.weightPct, gainPct: h.gainPct })))}
SECTOR WEIGHTS: ${JSON.stringify(portfolioView.sectorWeights)}
${latestAnalysis ? `LATEST HEALTH: ${latestAnalysis.portfolioHealthScore}/100 · RISK: ${latestAnalysis.overallRisk}
HEALTH BREAKDOWN: ${JSON.stringify(latestAnalysis.healthBreakdown || {})}
GOALS: ${JSON.stringify((latestAnalysis.goalAssessments || []).map(g => ({ goal: g.goal, progress: g.progressPct })))}` : 'No prior analysis yet.'}
MARKET: VIX ${marketSnapshot.vix} · ${JSON.stringify((marketSnapshot.tickers || []).slice(0, 6).map(t => ({ t: t.ticker, chg: t.changePct })))}`;

  const resp = await callClaude({
    system: BASE_VOICE + '\n\n' + styleFor(portfolioView.user?.experience) +
      '\nWrite the summary and every field at this communication level. Be warm and specific to THIS portfolio — this is a keepsake the client may reread in five years.',
    messages: [{ role: 'user', content: userMsg }],
    tools: [SNAPSHOT_TOOL],
    tool_choice: toolChoice('record_snapshot'),
    max_tokens: 4000,
  });
  return extractToolInput(resp, 'record_snapshot');
}

// Structured reply: Short Answer → Simple Explanation → Recommended Action →
// optional technical section (collapsed in the UI unless Analyst Mode).
const REPLY_TOOL = {
  name: 'advisor_reply',
  description: "Deliver the advisor's reply to the client in Corvexsa's standard structure.",
  input_schema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string', enum: ['advisor', 'analyst'],
        description: "advisor = default calm wealth-manager reply. analyst = the client explicitly asked for detail ('explain in detail', 'show calculations', 'why exactly', 'show valuation', 'show assumptions', 'show technical analysis').",
      },
      shortAnswer: { type: 'string', description: 'ONE sentence that directly answers the question, e.g. "I don\'t recommend making any changes today."' },
      explanation: { type: 'string', description: 'Why — in clear language matched to the client\'s communication level. 2-5 sentences (analyst mode may go longer).' },
      action: { type: 'string', enum: ['Buy', 'Hold', 'Reduce', 'Wait', 'Monitor', 'Rebalance', 'None'], description: 'The single recommended action. None when the reply is conversational and no action applies.' },
      technical: { type: 'string', description: 'Optional deeper analysis for those who want it: relevant ratios, valuation, growth metrics, risk numbers, historical comparison — derived only from the supplied data. In analyst mode make this thorough (assumptions, methodology, scenarios). Omit only when truly nothing technical applies.' },
    },
    required: ['mode', 'shortAnswer', 'explanation', 'action'],
  },
};

const STRUCTURE_RULES = `RESPONSE STRUCTURE (always, via the advisor_reply tool):
1. shortAnswer — one sentence answering the question directly.
2. explanation — the why, in clear language at the client's communication level.
3. action — one of Buy / Hold / Reduce / Wait / Monitor / Rebalance / None.
4. technical — deeper numbers for clients who choose to expand it. Even for beginners,
   keep the MAIN reply jargon-free and put the numbers here instead.

MODE:
- Default is advisor mode: calm, professional, reassuring — a private wealth manager, not a textbook.
- Switch mode to "analyst" ONLY when the client explicitly asks for depth ("explain in detail",
  "show calculations", "why exactly", "show valuation", "show assumptions", "show technical analysis").
  In analyst mode, technical must be thorough: ratios, growth, valuation reasoning, DCF-style
  assumptions where sensible, risk and confidence reasoning, historical comparison.
- Never ask the client to pick a mode — adapt automatically.`;

// The context engine: everything the advisor needs, injected fresh on every
// request. The advisor NEVER relies on chat history to know the portfolio.
export async function chat(portfolioView, marketSnapshot, latestAnalysis, history, userMessage) {
  const u = portfolioView.user || {};
  const context = `FRESH CLIENT CONTEXT (authoritative and current — always prefer this over anything in chat history):
TOTAL: $${portfolioView.total} · CASH AVAILABLE: $${portfolioView.cash}
HOLDINGS: ${JSON.stringify(portfolioView.holdings.map(h => ({ ticker: h.ticker, weightPct: h.weightPct, shares: h.shares, price: h.price, avgCost: h.avgCost, gainPct: h.gainPct })))}
ALLOCATION (sector weights): ${JSON.stringify(portfolioView.sectorWeights)}
CLIENT PROFILE: risk ${u.riskProfile || 'Moderate'} · horizon ${u.horizon || 'n/a'} · goals ${JSON.stringify(u.goals || [])} · preferred sectors ${JSON.stringify(u.preferredSectors || [])} · monthly investing ${u.monthlyContribution || 'n/a'} · sector concentration target ${u.maxSectorConcentrationTarget || 35}%

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
    system: BASE_VOICE + '\n\n' + styleFor(u.experience) + '\n\n' + STRUCTURE_RULES + '\n\n' + context,
    messages,
    tools: [REPLY_TOOL],
    tool_choice: toolChoice('advisor_reply'),
    max_tokens: 5000,
    effort: 'low', // conversational latency; the structure carries the rigor
  });
  return extractToolInput(resp, 'advisor_reply');
}
