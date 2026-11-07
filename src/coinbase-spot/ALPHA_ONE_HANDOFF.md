# Handoff to alpha_one_trader.py

This repository does not contain `alpha_one_trader.py` or the Edge worker that the screenshot labels as Alpha One. No URL, socket path, or function name was inferred. Until that source is present and explicitly accepts `alpha-one-intent-relay/1`, relay status stays `integrationBlocked` and `liveExecutionReady: false`. A screenshot total is not a ledger entry and is not treated as verified PnL.

Alpha One is the only accredited live executor. This wallet and any Edge module here are observation and intent relay. They do not hold Coinbase or XRPL signing keys for order placement, and the existing adapter `submitOrder` and `cancelOrders` methods still throw before a request.

## What this repo added

- `src/coinbase-spot/alphaOneContract.ts` — typed intent, hash, stable `client_order_id`, HMAC envelope.
- `src/coinbase-spot/alphaOneCoordinator.ts` — outbox, lease, fencing, and fail-closed dispatch. The default transport does not open a socket.
- `src/coinbase-spot/alphaOneReceiverReference.ts` — a journal the real trader can be compared against. It is not installed into Alpha One and it does not place orders.
- `GET /api/coinbase-spot/alpha-one` — authenticated observation of that status. It does not submit.

Configuration, all required before a relay can leave `integrationBlocked`. Missing any one fails closed:

| Name | Meaning |
|---|---|
| `ALPHA_ONE_RELAY_URL` | Exact destination. Not invented by this code. |
| `ALPHA_ONE_RELAY_ALLOWLIST` | Comma-separated exact URLs. The destination must match one entry. |
| `ALPHA_ONE_RELAY_SIGNING_KEY` | HMAC key of at least 16 characters. Not a Coinbase key. Never logged. |
| `ALPHA_ONE_RELAY_JOURNAL_PATH` | Durable relay journal. |
| `ALPHA_ONE_OWNER_ID` | Must be `alpha_one_trader`. |

`readRelayConfig` still reports `integrationBlocked: true` after those are set, because this process has no handshake from the real program.

Observation only:

```bash
npm run coinbase-spot:alpha-one-status
```

## Required changes once alpha_one_trader.py and the Edge worker are on disk

1. Edge worker: forward only a signed `RelayRequest` to the allowlisted URL. Do not add Coinbase or XRPL private keys to that worker. Do not add a second order route.
2. Alpha One, before any venue call: persist `intentId + accountId + productId` to the stable `client_order_id` from this contract. On every retry, load that row. Do not generate a new id.
3. Alpha One: reject a lower epoch for an intent that already has a higher epoch. Do not let another owner advance the epoch.
4. Alpha One: if the venue response is missing or unrecognized, store `unknown` and stop. Do not resubmit under a new id.
5. Alpha One: acknowledge with the stored `client_order_id`, the payload hash, the epoch, and `ownerId=alpha_one_trader`.
6. Wallet ledger: accept fills only from those acknowledgements. Coinbase reads stay observational and must not place or cancel.

Execute-once is not a property of HTTP. It exists only after step 2 is in the real trader. This reference proves the checks; it does not prove the live process does them. Collision freedom is not claimed.
