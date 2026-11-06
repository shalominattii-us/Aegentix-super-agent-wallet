import { timingSafeEqual } from 'node:crypto';
import { SpotError } from './errors.ts';
import { createCoinbaseHttpAdapter, envCredentialProvider, type FetchLike } from './http.ts';
import { coinbaseSpotPublicStatus } from './unavailable.ts';

export interface OperatorDecision {
  status: number;
  body: Record<string, unknown>;
}

function tokenOf(authorization: string | undefined): string {
  if (!authorization?.startsWith('Bearer ')) return '';
  return authorization.slice('Bearer '.length);
}

export function authorizeOperator(authorization: string | undefined, env: NodeJS.ProcessEnv): OperatorDecision | null {
  const expected = env.COINBASE_SPOT_OPERATOR_TOKEN?.trim() ?? '';
  if (expected.length < 16) {
    return {
      status: 503,
      body: {
        ok: false,
        code: 'OPERATOR_AUTH_UNCONFIGURED',
        accountVerified: false,
        message: 'Set COINBASE_SPOT_OPERATOR_TOKEN to at least 16 characters. No account data was read.',
      },
    };
  }
  const presented = Buffer.from(tokenOf(authorization));
  const required = Buffer.from(expected);
  if (presented.length !== required.length || !timingSafeEqual(presented, required)) {
    return { status: 401, body: { ok: false, code: 'UNAUTHORIZED', accountVerified: false } };
  }
  return null;
}

export function statusPayload(env: NodeJS.ProcessEnv): Record<string, unknown> {
  return {
    ...coinbaseSpotPublicStatus(),
    accountVerified: false,
    networkCalled: false,
    networkReadEnabled: env.COINBASE_SPOT_ALLOW_NETWORK_READ === '1',
    simulation:
      'The OmniCyberDEX browser page is a local simulation. Its profit figures are not Coinbase fills and are not this status.',
    keyNamePresent: Boolean(env.COINBASE_API_KEY_NAME?.trim()),
    keySecretPresent: Boolean(env.COINBASE_API_KEY_SECRET?.trim()),
    portfolioIdPresent: Boolean(env.COINBASE_PORTFOLIO_ID?.trim()),
  };
}

export async function guardedRead(
  env: NodeJS.ProcessEnv,
  fetchImpl: FetchLike,
  authorization: string | undefined,
): Promise<OperatorDecision> {
  const denied = authorizeOperator(authorization, env);
  if (denied) return denied;
  if (env.COINBASE_SPOT_ALLOW_NETWORK_READ !== '1') {
    return {
      status: 403,
      body: {
        ok: false,
        code: 'NETWORK_READ_DISABLED',
        accountVerified: false,
        message: 'Set COINBASE_SPOT_ALLOW_NETWORK_READ=1 before a read-only call. This request did not leave the process.',
      },
    };
  }
  const portfolioId = env.COINBASE_PORTFOLIO_ID?.trim() ?? '';
  if (!portfolioId) {
    return { status: 409, body: { ok: false, code: 'PORTFOLIO_MISSING', accountVerified: false } };
  }
  try {
    const adapter = createCoinbaseHttpAdapter({
      fetch: fetchImpl,
      credentials: envCredentialProvider(env),
      portfolioId,
    });
    const [portfolio, accounts, fees] = await Promise.all([
      adapter.getPortfolio(),
      adapter.listAccounts(),
      adapter.getFeeSummary(),
    ]);
    return {
      status: 200,
      body: {
        ok: true,
        accountVerified: false,
        source: 'coinbase-advanced-trade-read',
        portfolio,
        accounts,
        fees,
        liveSubmission: false,
      },
    };
  } catch (error) {
    return {
      status: 409,
      body: {
        ok: false,
        accountVerified: false,
        code: error instanceof SpotError ? error.code : 'READ_FAILED',
        message: error instanceof Error ? error.message : 'Read failed',
      },
    };
  }
}
