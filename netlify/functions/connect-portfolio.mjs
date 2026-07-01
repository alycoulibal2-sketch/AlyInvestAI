// Shared by both CSV import (parsed client-side, sent here as JSON) and the
// manual-entry form. Either way we just get a normalized holdings array.

import * as portfolioLib from './_lib/portfolio.mjs';
import * as brokerConnection from './_lib/brokerConnection.mjs';

function validateHoldings(holdings) {
  if (!Array.isArray(holdings) || holdings.length === 0) return 'At least one holding is required.';
  for (const h of holdings) {
    if (!h.ticker || typeof h.ticker !== 'string') return 'Every row needs a ticker symbol.';
    if (!(Number(h.shares) > 0)) return `${h.ticker}: shares must be a positive number.`;
    if (h.avgCost != null && Number(h.avgCost) < 0) return `${h.ticker}: average cost can't be negative.`;
  }
  return null;
}

export default async (req) => {
  try {
    const { holdings, cash, source } = await req.json();
    const err = validateHoldings(holdings);
    if (err) return Response.json({ error: err }, { status: 400 });

    const normalized = holdings.map(h => ({
      ticker: String(h.ticker).toUpperCase().trim(),
      name: h.name ? String(h.name).trim() : String(h.ticker).toUpperCase().trim(),
      shares: Number(h.shares),
      avgCost: h.avgCost != null ? Number(h.avgCost) : Number(h.price) || 0,
      price: h.price != null ? Number(h.price) : (h.avgCost != null ? Number(h.avgCost) : 0),
    }));

    const state = await portfolioLib.saveSnapshot({ holdings: normalized, cash: Number(cash) || 0 });

    await brokerConnection.set({
      type: 'manual',
      source: source === 'csv' ? 'csv' : 'manual',
      lastSyncedAt: new Date().toISOString(),
    });

    return Response.json({ ok: true, holdingsCount: state.holdings.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }
};

export const config = { path: '/api/connect/portfolio' };
