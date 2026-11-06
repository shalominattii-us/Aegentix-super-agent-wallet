# Coinbase spot execution slice

This module is a disarmed Coinbase Advanced Trade spot orchestrator for one portfolio and two products, `BTC-USD` and `XRP-USD`. It does not submit live orders, does not read credentials from the environment, and does not contain an HTTP client.

The portal OmniCyberDEX screen is a separate in-browser simulation. It was not changed. The server routes `GET /api/omnicyberdex/engines` and `POST /api/omnicyberdex/execute` now return HTTP 501 with `pnlUsd: null`. They no longer report a fill or a profit.

## What is implemented

- JWT construction for the two algorithms Coinbase documents for direct Advanced Trade REST calls:
  - ES256 for a P-256 `BEGIN EC PRIVATE KEY` or PKCS8 key. Claims match the Coinbase App sample: `iss=cdp`, `sub`, `nbf`, `exp=nbf+120`, `uri="{METHOD} api.coinbase.com{path}"`, header `kid` and a 16-byte hex nonce. No `aud` claim.
  - EdDSA for the published 64-byte base64 seed||public key, and for an Ed25519 PKCS8 PEM. Claims add `aud: ["cdp_service"]`, matching the CDP Ed25519 sample. A 32-byte seed alone is rejected.
- Account and open-order reads through an injected adapter. Spendable funds are venue `available` minus local reservations for intents the venue does not yet hold. Venue `hold` is not subtracted again.
- Staging sizes to free funds and to the product increments and minima returned by the adapter. There are no embedded tick sizes and no dollar, loss, or order-count caps.
- A buy that cannot pay the preview fee is reduced once by that fee and previewed again. If the second preview still does not fit, staging stops.
- `maxSlippageBps` and `maxQuoteAgeMs` are required on every intent. Missing values do not fall back to an approval.
- Idempotent `clientIntentId`, an append-only journal, fill and fee records, FIFO cost basis, and marked unrealized PnL only when the caller supplies a mark.
- Unknown venue status keeps the reservation and refuses another submit.
- Kill switch defaults to engaged. Releasing it does not enable a network order. The disabled adapter throws before any socket.

## What is not production ready

- No live request has been sent to `api.coinbase.com`. Signing is unit-tested offline only.
- Official samples sign a path without a query string. This code includes a query in the URI when one is present. That binding is not confirmed against the live host.
- Coinbase App SDKs accept ES256 only. Direct REST is documented to accept both ES256 and Ed25519. Use the key type that matches the product you actually call.
- Inventory accounting while an order is working releases only the notional once a single matching open order and a positive hold are visible, and keeps the preview fee reserved. Multiple overlapping open orders are not attributed, so the local reservation stays in place.
- Realized profit is not an arbitrage edge. It is FIFO inventory accounting on recorded fills. A sell larger than known inventory is `costBasisIncomplete` and does not invent a cost.
- Cross-chain movement, bridges, allowances, convert, leverage, and any other exchange are out of scope.

## Local checks

No credentials and no network are required.

```bash
npm run test:coinbase-spot
```

The status route, when the server is already running for other reasons, is `GET /api/coinbase-spot/status`. It does not arm trading. Do not point this process at a funded Coinbase key. This build has no path that spends a balance.
