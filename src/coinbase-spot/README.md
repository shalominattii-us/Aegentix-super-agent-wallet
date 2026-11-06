# Coinbase Advanced Trade spot slice

This is a read-capable Coinbase Advanced Trade adapter for one portfolio and only `BTC-USD` and `XRP-USD`. Order create and cancel are implemented as guarded methods and throw before any request. No strategy edge is calculated.

The OmniCyberDEX page in the browser is a simulation. Its numbers are not this adapter and are not live profit. Server routes under `/api/coinbase-spot` and `/api/omnicyberdex` require `Authorization: Bearer $COINBASE_SPOT_OPERATOR_TOKEN`.

## Operator configuration

Set these in the server environment. Do not commit them and do not print the secret.

| Name | Required | Meaning |
|---|---|---|
| `COINBASE_API_KEY_NAME` | For a future read | `organizations/{org_id}/apiKeys/{key_id}` |
| `COINBASE_API_KEY_SECRET` | For a future read | P-256 PEM, or Ed25519 base64 of 32 or 64 bytes, as accepted by `coinbase-advanced-py` |
| `COINBASE_PORTFOLIO_ID` | For a future read | The single portfolio uuid |
| `COINBASE_SPOT_OPERATOR_TOKEN` | For the HTTP routes | At least 16 characters |
| `COINBASE_SPOT_ALLOW_NETWORK_READ` | Leave unset | `POST /api/coinbase-spot/read` calls Coinbase only when this is `1` |
| `COINBASE_SPOT_JOURNAL_PATH` | For diagnostics | Append-only journal file. If unset, `POST /api/coinbase-spot/diagnostics` returns 409 and does not invent a book |

Signing follows the official REST client: the JWT `uri` is `{METHOD} api.coinbase.com{path}` and does **not** include the query string. Query parameters are sent on the URL only. That matches `coinbase-advanced-py` `RESTBase.set_headers`. It has been checked with generated keys and a mock fetch, not against a funded account.

## Safe readiness command

This command does not call Coinbase and does not print secret values. Exit 0 means the four required names are present. Exit 2 means at least one is missing. `accountVerified` is always false.

```bash
npm run coinbase-spot:readiness
```

Tests, also with no network:

```bash
npm run test:coinbase-spot
```

Accounting is local. `POST /api/coinbase-spot/diagnostics` replays the journal only. It does not call Coinbase. Deposits and transfers are external flows, not profit. A sell with no cost basis stays unknown and is not given a zero cost. Unrealized value uses a fresh bid. Net unrealized also needs an exit fee rate you supply; none is assumed. `POST /api/coinbase-spot/candidate-check` compares a candidate with the commissions and slippage you send. A gap from the mid price is not reported as an edge.

The accredited live executor is Alpha One (`alpha_one_trader`), which is not in this repository. This process does not submit orders and does not invent that program's URL. See `ALPHA_ONE_HANDOFF.md`. Observation:

```bash
npm run coinbase-spot:alpha-one-status
```

## Still not account-verified

- No request has been made to `api.coinbase.com` from this workspace.
- A passing arming phrase (`ARM_COINBASE_SPOT_MUTATIONS` plus the same portfolio id) still does not send `POST /api/v3/brokerage/orders` or `POST /api/v3/brokerage/orders/batch_cancel`.
- Open-order holds must sum exactly to the account hold. Otherwise new spending is blocked.
- Preview responses in the public schema omit `commission_currency`. For these two USD pairs, a missing currency is recorded as USD. Any other currency fails closed.
- Product-book time is required. A missing timestamp is not treated as fresh.
- Realized PnL is FIFO from fills already recorded. Unrealized PnL is unknown until a mark is supplied.
