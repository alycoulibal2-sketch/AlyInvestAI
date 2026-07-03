// The stock catalog — the universe of companies the advisor can see, scan
// for opportunities, and that users can search and follow. This stands in
// for a real market data provider's symbol list. Prices are simulated
// (deterministic per day in market.mjs) but the tickers, names and sectors
// are real US-listed companies across every sector.
//
// Each row: [ticker, name, sector, approxBasePrice]. Base prices are
// plausible round figures used to seed the simulator — they don't need to
// be exact, only stable.

const ROWS = [
  // ── Technology ──
  ['MSFT', 'Microsoft', 'Technology', 465], ['NVDA', 'NVIDIA', 'Technology', 140],
  ['AAPL', 'Apple', 'Technology', 225], ['GOOGL', 'Alphabet (Class A)', 'Technology', 178],
  ['GOOG', 'Alphabet (Class C)', 'Technology', 180], ['AVGO', 'Broadcom', 'Technology', 175],
  ['ORCL', 'Oracle', 'Technology', 175], ['CRM', 'Salesforce', 'Technology', 280],
  ['ADBE', 'Adobe', 'Technology', 520], ['AMD', 'Advanced Micro Devices', 'Technology', 160],
  ['INTC', 'Intel', 'Technology', 22], ['CSCO', 'Cisco Systems', 'Technology', 58],
  ['ACN', 'Accenture', 'Technology', 350], ['IBM', 'IBM', 'Technology', 235],
  ['TXN', 'Texas Instruments', 'Technology', 205], ['QCOM', 'Qualcomm', 'Technology', 165],
  ['NOW', 'ServiceNow', 'Technology', 1000], ['INTU', 'Intuit', 'Technology', 660],
  ['AMAT', 'Applied Materials', 'Technology', 200], ['MU', 'Micron Technology', 'Technology', 105],
  ['LRCX', 'Lam Research', 'Technology', 90], ['KLAC', 'KLA Corporation', 'Technology', 800],
  ['ADI', 'Analog Devices', 'Technology', 230], ['PANW', 'Palo Alto Networks', 'Technology', 190],
  ['SNPS', 'Synopsys', 'Technology', 490], ['CDNS', 'Cadence Design Systems', 'Technology', 300],
  ['CRWD', 'CrowdStrike', 'Technology', 350], ['FTNT', 'Fortinet', 'Technology', 95],
  ['SNOW', 'Snowflake', 'Technology', 180], ['PLTR', 'Palantir Technologies', 'Technology', 70],
  ['DELL', 'Dell Technologies', 'Technology', 120], ['HPQ', 'HP Inc.', 'Technology', 35],
  ['MRVL', 'Marvell Technology', 'Technology', 110], ['ANET', 'Arista Networks', 'Technology', 105],
  ['DDOG', 'Datadog', 'Technology', 130], ['NET', 'Cloudflare', 'Technology', 110],
  ['SHOP', 'Shopify', 'Technology', 110], ['UBER', 'Uber Technologies', 'Technology', 75],
  ['ABNB', 'Airbnb', 'Technology', 135], ['SMCI', 'Super Micro Computer', 'Technology', 45],

  // ── Communication ──
  ['META', 'Meta Platforms', 'Communication', 580], ['NFLX', 'Netflix', 'Communication', 900],
  ['DIS', 'Walt Disney', 'Communication', 110], ['CMCSA', 'Comcast', 'Communication', 40],
  ['T', 'AT&T', 'Communication', 22], ['VZ', 'Verizon', 'Communication', 43],
  ['TMUS', 'T-Mobile US', 'Communication', 230], ['SPOT', 'Spotify', 'Communication', 480],
  ['WBD', 'Warner Bros. Discovery', 'Communication', 10], ['EA', 'Electronic Arts', 'Communication', 150],
  ['TTWO', 'Take-Two Interactive', 'Communication', 200], ['PINS', 'Pinterest', 'Communication', 32],
  ['SNAP', 'Snap Inc.', 'Communication', 11],

  // ── Consumer Discretionary ──
  ['AMZN', 'Amazon', 'Consumer', 205], ['TSLA', 'Tesla', 'Consumer', 250],
  ['HD', 'Home Depot', 'Consumer', 400], ['MCD', "McDonald's", 'Consumer', 300],
  ['NKE', 'Nike', 'Consumer', 78], ['LOW', "Lowe's", 'Consumer', 250],
  ['SBUX', 'Starbucks', 'Consumer', 95], ['BKNG', 'Booking Holdings', 'Consumer', 4800],
  ['TJX', 'TJX Companies', 'Consumer', 115], ['MAR', 'Marriott International', 'Consumer', 260],
  ['GM', 'General Motors', 'Consumer', 50], ['F', 'Ford Motor', 'Consumer', 11],
  ['ORLY', "O'Reilly Automotive", 'Consumer', 1150], ['CMG', 'Chipotle Mexican Grill', 'Consumer', 58],
  ['LULU', 'Lululemon Athletica', 'Consumer', 330], ['DHI', 'D.R. Horton', 'Consumer', 165],
  ['ROST', 'Ross Stores', 'Consumer', 150], ['YUM', 'Yum! Brands', 'Consumer', 135],
  ['RCL', 'Royal Caribbean Cruises', 'Consumer', 200],

  // ── Consumer Staples ──
  ['WMT', 'Walmart', 'Consumer Staples', 85], ['PG', 'Procter & Gamble', 'Consumer Staples', 170],
  ['COST', 'Costco Wholesale', 'Consumer Staples', 900], ['KO', 'Coca-Cola', 'Consumer Staples', 62],
  ['PEP', 'PepsiCo', 'Consumer Staples', 165], ['PM', 'Philip Morris International', 'Consumer Staples', 120],
  ['MDLZ', 'Mondelez International', 'Consumer Staples', 68], ['CL', 'Colgate-Palmolive', 'Consumer Staples', 95],
  ['MO', 'Altria Group', 'Consumer Staples', 52], ['TGT', 'Target', 'Consumer Staples', 150],
  ['KMB', 'Kimberly-Clark', 'Consumer Staples', 135], ['GIS', 'General Mills', 'Consumer Staples', 65],
  ['KHC', 'Kraft Heinz', 'Consumer Staples', 33], ['KR', 'Kroger', 'Consumer Staples', 58],
  ['MNST', 'Monster Beverage', 'Consumer Staples', 52], ['STZ', 'Constellation Brands', 'Consumer Staples', 240],

  // ── Healthcare ──
  ['UNH', 'UnitedHealth Group', 'Healthcare', 512], ['JNJ', 'Johnson & Johnson', 'Healthcare', 152],
  ['LLY', 'Eli Lilly', 'Healthcare', 900], ['ABBV', 'AbbVie', 'Healthcare', 190],
  ['MRK', 'Merck', 'Healthcare', 100], ['PFE', 'Pfizer', 'Healthcare', 26],
  ['TMO', 'Thermo Fisher Scientific', 'Healthcare', 550], ['ABT', 'Abbott Laboratories', 'Healthcare', 115],
  ['DHR', 'Danaher', 'Healthcare', 240], ['AMGN', 'Amgen', 'Healthcare', 320],
  ['ISRG', 'Intuitive Surgical', 'Healthcare', 500], ['BMY', 'Bristol-Myers Squibb', 'Healthcare', 55],
  ['GILD', 'Gilead Sciences', 'Healthcare', 90], ['MDT', 'Medtronic', 'Healthcare', 85],
  ['CVS', 'CVS Health', 'Healthcare', 55], ['VRTX', 'Vertex Pharmaceuticals', 'Healthcare', 480],
  ['REGN', 'Regeneron Pharmaceuticals', 'Healthcare', 750], ['CI', 'Cigna Group', 'Healthcare', 330],
  ['ELV', 'Elevance Health', 'Healthcare', 400], ['ZTS', 'Zoetis', 'Healthcare', 175],
  ['BSX', 'Boston Scientific', 'Healthcare', 90], ['HCA', 'HCA Healthcare', 'Healthcare', 340],
  ['MRNA', 'Moderna', 'Healthcare', 55],

  // ── Financials ──
  ['BRK.B', 'Berkshire Hathaway', 'Financials', 460], ['JPM', 'JPMorgan Chase', 'Financials', 230],
  ['V', 'Visa', 'Financials', 310], ['MA', 'Mastercard', 'Financials', 500],
  ['BAC', 'Bank of America', 'Financials', 42], ['WFC', 'Wells Fargo', 'Financials', 72],
  ['GS', 'Goldman Sachs', 'Financials', 510], ['MS', 'Morgan Stanley', 'Financials', 110],
  ['AXP', 'American Express', 'Financials', 270], ['C', 'Citigroup', 'Financials', 68],
  ['SCHW', 'Charles Schwab', 'Financials', 72], ['BLK', 'BlackRock', 'Financials', 980],
  ['SPGI', 'S&P Global', 'Financials', 510], ['CB', 'Chubb', 'Financials', 280],
  ['PGR', 'Progressive', 'Financials', 250], ['PYPL', 'PayPal', 'Financials', 80],
  ['USB', 'U.S. Bancorp', 'Financials', 48], ['PNC', 'PNC Financial Services', 'Financials', 190],
  ['COF', 'Capital One Financial', 'Financials', 150], ['MMC', 'Marsh & McLennan', 'Financials', 220],
  ['ICE', 'Intercontinental Exchange', 'Financials', 160], ['CME', 'CME Group', 'Financials', 220],
  ['COIN', 'Coinbase Global', 'Financials', 220],

  // ── Industrials ──
  ['CAT', 'Caterpillar', 'Industrials', 380], ['GE', 'GE Aerospace', 'Industrials', 190],
  ['RTX', 'RTX Corporation', 'Industrials', 120], ['HON', 'Honeywell International', 'Industrials', 210],
  ['UNP', 'Union Pacific', 'Industrials', 240], ['BA', 'Boeing', 'Industrials', 180],
  ['LMT', 'Lockheed Martin', 'Industrials', 550], ['DE', 'Deere & Company', 'Industrials', 400],
  ['UPS', 'United Parcel Service', 'Industrials', 130], ['GD', 'General Dynamics', 'Industrials', 290],
  ['NOC', 'Northrop Grumman', 'Industrials', 480], ['MMM', '3M', 'Industrials', 130],
  ['FDX', 'FedEx', 'Industrials', 280], ['EMR', 'Emerson Electric', 'Industrials', 110],
  ['ETN', 'Eaton', 'Industrials', 320], ['ITW', 'Illinois Tool Works', 'Industrials', 250],
  ['CSX', 'CSX', 'Industrials', 33], ['NSC', 'Norfolk Southern', 'Industrials', 250],
  ['WM', 'Waste Management', 'Industrials', 210], ['PH', 'Parker-Hannifin', 'Industrials', 650],

  // ── Energy ──
  ['XOM', 'Exxon Mobil', 'Energy', 118], ['CVX', 'Chevron', 'Energy', 155],
  ['COP', 'ConocoPhillips', 'Energy', 105], ['SLB', 'Schlumberger', 'Energy', 43],
  ['EOG', 'EOG Resources', 'Energy', 125], ['MPC', 'Marathon Petroleum', 'Energy', 165],
  ['PSX', 'Phillips 66', 'Energy', 130], ['VLO', 'Valero Energy', 'Energy', 135],
  ['OXY', 'Occidental Petroleum', 'Energy', 52], ['WMB', 'Williams Companies', 'Energy', 50],
  ['KMI', 'Kinder Morgan', 'Energy', 25], ['HAL', 'Halliburton', 'Energy', 30],

  // ── Materials ──
  ['LIN', 'Linde', 'Materials', 470], ['SHW', 'Sherwin-Williams', 'Materials', 370],
  ['APD', 'Air Products and Chemicals', 'Materials', 300], ['ECL', 'Ecolab', 'Materials', 250],
  ['FCX', 'Freeport-McMoRan', 'Materials', 45], ['NEM', 'Newmont', 'Materials', 50],
  ['NUE', 'Nucor', 'Materials', 150], ['DOW', 'Dow Inc.', 'Materials', 45],
  ['DD', 'DuPont de Nemours', 'Materials', 85],

  // ── Utilities ──
  ['NEE', 'NextEra Energy', 'Utilities', 80], ['DUK', 'Duke Energy', 'Utilities', 110],
  ['SO', 'Southern Company', 'Utilities', 88], ['D', 'Dominion Energy', 'Utilities', 55],
  ['AEP', 'American Electric Power', 'Utilities', 100], ['EXC', 'Exelon', 'Utilities', 38],
  ['SRE', 'Sempra', 'Utilities', 80], ['XEL', 'Xcel Energy', 'Utilities', 62],

  // ── Real Estate ──
  ['PLD', 'Prologis', 'Real Estate', 115], ['AMT', 'American Tower', 'Real Estate', 200],
  ['EQIX', 'Equinix', 'Real Estate', 900], ['SPG', 'Simon Property Group', 'Real Estate', 165],
  ['O', 'Realty Income', 'Real Estate', 60], ['CCI', 'Crown Castle', 'Real Estate', 105],
  ['PSA', 'Public Storage', 'Real Estate', 340], ['WELL', 'Welltower', 'Real Estate', 130],

  // ── ETFs / Diversified ──
  ['VOO', 'Vanguard S&P 500 ETF', 'Diversified', 545], ['SPY', 'SPDR S&P 500 ETF', 'Diversified', 590],
  ['QQQ', 'Invesco QQQ Trust', 'Diversified', 500], ['VTI', 'Vanguard Total Stock Market ETF', 'Diversified', 290],
  ['SCHD', 'Schwab US Dividend ETF', 'Diversified', 84], ['VUG', 'Vanguard Growth ETF', 'Diversified', 400],
  ['VIG', 'Vanguard Dividend Appreciation ETF', 'Diversified', 200], ['IWM', 'iShares Russell 2000 ETF', 'Diversified', 230],
  ['VEA', 'Vanguard FTSE Developed Markets ETF', 'Diversified', 52], ['VWO', 'Vanguard Emerging Markets ETF', 'Diversified', 46],
  ['BND', 'Vanguard Total Bond Market ETF', 'Diversified', 74], ['VXUS', 'Vanguard Total International Stock ETF', 'Diversified', 62],
  ['JEPI', 'JPMorgan Equity Premium Income ETF', 'Diversified', 58], ['DIA', 'SPDR Dow Jones Industrial Average ETF', 'Diversified', 440],
  ['ARKK', 'ARK Innovation ETF', 'Diversified', 55],
];

export const CATALOG = {};
for (const [ticker, name, sector, base] of ROWS) {
  CATALOG[ticker] = { name, sector, base };
}

export const ALL_TICKERS = Object.keys(CATALOG);

// Search by ticker or name (case-insensitive substring). Ranks exact/prefix
// ticker matches first, then name matches. Returns up to `limit` rows.
export function search(query, limit = 12) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const scored = [];
  for (const [ticker, meta] of Object.entries(CATALOG)) {
    const tk = ticker.toLowerCase();
    const nm = meta.name.toLowerCase();
    let score = -1;
    if (tk === q) score = 100;
    else if (tk.startsWith(q)) score = 90;
    else if (nm.startsWith(q)) score = 80;
    else if (tk.includes(q)) score = 60;
    else if (nm.includes(q)) score = 50;
    if (score >= 0) scored.push({ ticker, name: meta.name, sector: meta.sector, score });
  }
  scored.sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker));
  return scored.slice(0, limit).map(({ score, ...r }) => r);
}
