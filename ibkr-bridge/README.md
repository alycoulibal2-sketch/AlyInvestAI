# AlyInvest IBKR Bridge

Interactive Brokers has no API that works from a serverless function — the only way to
read your account is through IBKR's **Client Portal Gateway**, a process you run yourself
and log into via a browser (with 2FA). This bridge sits next to that gateway and exposes
one authenticated endpoint AlyInvest can call.

**Limitation to know up front:** the gateway session expires roughly every 24 hours and
requires you to log back in through a browser. This bridge keeps the session alive while
running, but can't automate that re-login for you.

## Setup

1. Download IBKR's [Client Portal Gateway](https://www.interactivebrokers.com/en/trading/ib-api.php#client-portal-api) and start it.
2. Open `https://localhost:5000` in a browser and log in (accept the self-signed cert warning).
3. In this folder:
   ```
   npm install
   cp .env.example .env
   ```
   Edit `.env` — set `BRIDGE_SECRET` to a long random string.
4. `npm start` — bridge runs on `http://localhost:7777` by default.
5. For AlyInvest (deployed on Netlify) to reach this bridge, it needs to be reachable from
   the internet — either run it on a small always-on machine/VPS with a public address, or
   tunnel it (e.g. `ngrok http 7777`) and use the tunnel URL.
6. In AlyInvest's Connect Portfolio screen, choose Interactive Brokers and enter the
   bridge's public URL plus the `BRIDGE_SECRET` you set.

## Endpoints

- `GET /health` — no auth, reports whether the gateway is reachable and logged in.
- `GET /positions` — requires header `x-bridge-secret: <your secret>`, returns
  `{ holdings: [...], cash: number }`.
