import { statusPayload } from './httpRoutes.ts';

/**
 * Prints whether operator settings are present. Does not read secret values,
 * does not call Coinbase, and does not enable network reads.
 */
const status = statusPayload(process.env);
const operatorTokenPresent = (process.env.COINBASE_SPOT_OPERATOR_TOKEN?.trim().length ?? 0) >= 16;
const report = {
  ...status,
  command: 'coinbase-spot:readiness',
  networkCalled: false,
  accountVerified: false,
  operatorTokenPresent,
  configure: {
    COINBASE_API_KEY_NAME: 'organizations/{org_id}/apiKeys/{key_id}',
    COINBASE_API_KEY_SECRET: 'P-256 PEM or Ed25519 base64 seed. Never commit or log it.',
    COINBASE_PORTFOLIO_ID: 'The one Advanced Trade portfolio uuid allowed to be read.',
    COINBASE_SPOT_OPERATOR_TOKEN: 'At least 16 characters. Required on /api/coinbase-spot and /api/omnicyberdex routes.',
    COINBASE_SPOT_ALLOW_NETWORK_READ: 'Leave unset. Set to 1 only when you intentionally want a later read-only call.',
  },
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
const ready =
  status.keyNamePresent === true &&
  status.keySecretPresent === true &&
  status.portfolioIdPresent === true &&
  operatorTokenPresent;
process.exit(ready ? 0 : 2);
