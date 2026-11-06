import { timingSafeEqual } from 'node:crypto';
import { SpotError } from './errors.ts';
import { buildDiagnostics } from './diagnostics.ts';
import { assessRoundTrip, type VerifiedBid } from './ledger.ts';
import { FileJournal } from './journal.ts';
import { createCoinbaseHttpAdapter, envCredentialProvider, type FetchLike } from './http.ts';
import { coinbaseSpotPublicStatus } from './unavailable.ts';
import type { SpotProductId } from './types.ts';

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

export async function diagnosticsResponse(env: NodeJS.ProcessEnv, authorization: string | undefined, body: { nowMs?: number; maxMarkAgeMs?: number; bids?: Partial<Record<SpotProductId, VerifiedBid>>; exitFeeRate?: string | null } = {}): Promise<OperatorDecision> {
  const denied = authorizeOperator(authorization, env);
  if (denied) return denied;
  const journalPath = env.COINBASE_SPOT_JOURNAL_PATH?.trim() ?? '';
  if (!journalPath) {
    return { status: 409, body: { ok: false, code: 'JOURNAL_UNCONFIGURED', accountVerified: false, message: 'Set COINBASE_SPOT_JOURNAL_PATH. No empty book was invented.' } };
  }
  if (!Number.isInteger(body.maxMarkAgeMs) || (body.maxMarkAgeMs ?? -1) < 0) {
    return { status: 409, body: { ok: false, code: 'MARK_AGE_REQUIRED', accountVerified: false, message: 'maxMarkAgeMs is required. No freshness window is assumed.' } };
  }
  const state = await new FileJournal(journalPath).load();
  return {
    status: 200,
    body: {
      ok: true,
      ...buildDiagnostics({
        state,
        nowMs: body.nowMs ?? Date.now(),
        maxMarkAgeMs: body.maxMarkAgeMs as number,
        bids: body.bids,
        exitFeeRate: body.exitFeeRate ?? null,
      }),
    },
  };
}

export function candidateCheckResponse(authorization: string | undefined, env: NodeJS.ProcessEnv, body: Parameters<typeof assessRoundTrip>[0] | null): OperatorDecision {
  const denied = authorizeOperator(authorization, env);
  if (denied) return denied;
  if (!body) return { status: 400, body: { ok: false, code: 'BODY_REQUIRED', accountVerified: false } };
  return { status: 200, body: { ok: true, accountVerified: false, liveEngine: false, assessment: assessRoundTrip(body) } };
}
