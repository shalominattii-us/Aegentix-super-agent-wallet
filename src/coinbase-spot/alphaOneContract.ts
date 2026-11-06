import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isSpotProduct, type SpotProductId } from './types.ts';

/** Control-plane contract. Not a venue order API and not a discovered Alpha One URL. */
export const ALPHA_ONE_CONTRACT_VERSION = 'alpha-one-intent-relay/1';
export const ACCREDITED_TRADER = 'alpha_one_trader';

export interface ExecutionIntent {
  contractVersion: typeof ALPHA_ONE_CONTRACT_VERSION;
  intentId: string;
  accountId: string;
  productId: SpotProductId;
  side: 'BUY' | 'SELL';
  baseSize: string;
  limitPrice: string;
}

export interface RelayRequest {
  intent: ExecutionIntent;
  epoch: number;
  ownerId: string;
}

export interface SignedEnvelope<T> {
  payload: T;
  payloadHash: string;
  nonce: string;
  sentAtMs: number;
  signature: string;
}

export type VenueStatus = 'not_sent' | 'unknown' | 'accepted' | 'rejected' | 'partial' | 'filled' | 'cancelled';

export interface TraderAck {
  contractVersion: typeof ALPHA_ONE_CONTRACT_VERSION;
  intentId: string;
  accountId: string;
  productId: SpotProductId;
  clientOrderId: string;
  payloadHash: string;
  epoch: number;
  ownerId: string;
  disposition: 'accepted_reference' | 'duplicate' | 'fenced' | 'foreign_actor' | 'replay' | 'rejected';
  venueStatus: VenueStatus;
}

export interface TraderFillNotice {
  contractVersion: typeof ALPHA_ONE_CONTRACT_VERSION;
  intentId: string;
  accountId: string;
  productId: SpotProductId;
  clientOrderId: string;
  fillId: string;
  ownerId: string;
  epoch: number;
  baseSize: string;
  price: string;
}

export function scopeKey(accountId: string, productId: string, intentId: string): string {
  return `${accountId}|${productId}|${intentId}`;
}

export function canonicalIntentBytes(intent: ExecutionIntent): string {
  return JSON.stringify({
    accountId: intent.accountId,
    baseSize: intent.baseSize,
    contractVersion: intent.contractVersion,
    intentId: intent.intentId,
    limitPrice: intent.limitPrice,
    productId: intent.productId,
    side: intent.side,
  });
}

export function requestHash(request: RelayRequest): string {
  return createHash('sha256').update(JSON.stringify({
    epoch: request.epoch,
    intent: {
      accountId: request.intent.accountId,
      baseSize: request.intent.baseSize,
      contractVersion: request.intent.contractVersion,
      intentId: request.intent.intentId,
      limitPrice: request.intent.limitPrice,
      productId: request.intent.productId,
      side: request.intent.side,
    },
    ownerId: request.ownerId,
  })).digest('hex');
}

export function canonicalJsonHash(value: unknown): string {
  const canonicalize = (item: unknown): string => {
    if (Array.isArray(item)) return `[${item.map(canonicalize).join(',')}]`;
    if (item && typeof item === 'object') {
      const entries = Object.entries(item as Record<string, unknown>).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
      return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`).join(',')}}`;
    }
    return JSON.stringify(item);
  };
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

export function signedBodyHash(value: object): string {
  const copy = { ...(value as Record<string, unknown>) };
  delete copy.payloadHash;
  return canonicalJsonHash(copy);
}

export function payloadHash(intent: ExecutionIntent): string {
  return createHash('sha256').update(canonicalIntentBytes(intent)).digest('hex');
}

/** Stable for the life of the intent. Never derived from time or from a retry counter. */
export function stableClientOrderId(accountId: string, productId: string, intentId: string): string {
  const digest = createHash('sha256').update(scopeKey(accountId, productId, intentId)).digest('hex').slice(0, 32);
  return `ao${digest}`;
}

export function validateIntent(intent: ExecutionIntent): string | null {
  if (intent.contractVersion !== ALPHA_ONE_CONTRACT_VERSION) return 'CONTRACT_VERSION';
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(intent.intentId)) return 'INTENT_ID';
  if (!/^[A-Za-z0-9-]{16,80}$/.test(intent.accountId)) return 'ACCOUNT';
  if (!isSpotProduct(intent.productId)) return 'PRODUCT';
  if (intent.side !== 'BUY' && intent.side !== 'SELL') return 'SIDE';
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(intent.baseSize) || intent.baseSize === '0') return 'SIZE';
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(intent.limitPrice) || intent.limitPrice === '0') return 'PRICE';
  return null;
}

export function signEnvelope<T>(payload: T, payloadHashHex: string, key: string, sentAtMs: number, nonce = randomBytes(16).toString('hex')): SignedEnvelope<T> {
  const signature = createHmac('sha256', key).update(`${sentAtMs}.${nonce}.${payloadHashHex}`).digest('hex');
  return { payload, payloadHash: payloadHashHex, nonce, sentAtMs, signature };
}

export function verifyEnvelope(envelope: SignedEnvelope<unknown>, key: string, nowMs: number, maxSkewMs: number): string | null {
  const expected = createHmac('sha256', key).update(`${envelope.sentAtMs}.${envelope.nonce}.${envelope.payloadHash}`).digest('hex');
  const left = Buffer.from(envelope.signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return 'BAD_SIGNATURE';
  if (!Number.isFinite(envelope.sentAtMs) || Math.abs(nowMs - envelope.sentAtMs) > maxSkewMs) return 'STALE_OR_FUTURE';
  return null;
}

export interface RelayConfig {
  destinationConfigured: boolean;
  allowlisted: boolean;
  signingKeyPresent: boolean;
  durableJournal: boolean;
  ownerId: string | null;
  integrationBlocked: boolean;
  liveExecutionReady: false;
  collisionFreedomGuaranteed: false;
  alphaOneSourceIntegrated: false;
  reason: string;
}

export function readRelayConfig(env: NodeJS.ProcessEnv): RelayConfig {
  const destination = env.ALPHA_ONE_RELAY_URL?.trim() ?? '';
  const allowlist = (env.ALPHA_ONE_RELAY_ALLOWLIST ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  const allowlisted = destination.length > 0 && allowlist.includes(destination);
  const signingKeyPresent = (env.ALPHA_ONE_RELAY_SIGNING_KEY?.trim().length ?? 0) >= 16;
  const durableJournal = Boolean(env.ALPHA_ONE_RELAY_JOURNAL_PATH?.trim());
  const ownerId = env.ALPHA_ONE_OWNER_ID?.trim() || null;
  const ownerOk = ownerId === ACCREDITED_TRADER;
  let reason = 'Alpha One source is not on this computer. No relay URL was inferred.';
  if (!destination || !allowlisted) reason = 'ALPHA_ONE_RELAY_URL is missing or not an exact ALPHA_ONE_RELAY_ALLOWLIST entry.';
  else if (!signingKeyPresent) reason = 'ALPHA_ONE_RELAY_SIGNING_KEY is missing.';
  else if (!durableJournal) reason = 'ALPHA_ONE_RELAY_JOURNAL_PATH is missing.';
  else if (!ownerOk) reason = 'ALPHA_ONE_OWNER_ID must be alpha_one_trader. No other executor is accredited.';
  else reason = 'Config is present, but alpha_one_trader.py has not accepted this contract. integrationBlocked stays true until that handshake exists.';
  return {
    destinationConfigured: destination.length > 0,
    allowlisted,
    signingKeyPresent,
    durableJournal,
    ownerId: ownerOk ? ownerId : null,
    integrationBlocked: true,
    liveExecutionReady: false,
    collisionFreedomGuaranteed: false,
    alphaOneSourceIntegrated: false,
    reason,
  };
}
