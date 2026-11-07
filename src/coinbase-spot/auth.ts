import { createPrivateKey, createPublicKey, randomBytes, sign, verify, type KeyObject } from 'node:crypto';
import { SpotError } from './errors.ts';

/**
 * Advanced Trade REST JWT, matching Coinbase's published samples.
 *
 * Direct Advanced Trade HTTP accepts both algorithms (CDP "API key authentication" product table):
 * - ECDSA P-256 / ES256. Coinbase App JWT sample:
 *   iss=cdp, sub=key name, nbf, exp=nbf+120, uri="{METHOD} api.coinbase.com{path}".
 *   Header kid and a 16-byte hex nonce. No `aud` claim in that sample.
 * - Ed25519 / EdDSA. CDP JWT sample: the same claims plus aud=["cdp_service"].
 *   coinbase-advanced-py accepts a base64 seed of 32 bytes, or 64 bytes (seed || public key) and signs with the first 32.
 *   A 64-byte secret is checked so the public suffix matches the seed. Other lengths are rejected.
 *
 * Coinbase App SDKs accept ES256 only. This module signs requests; it does not perform them.
 */

export const ADVANCED_TRADE_HOST = 'api.coinbase.com';
const JWT_TTL_SECONDS = 120;

export type SupportedJwtAlg = 'ES256' | 'EdDSA';

export interface AdvancedTradeKey {
  /** organizations/{org}/apiKeys/{id} */
  keyName: string;
  /** PEM (EC or PKCS8) or base64 Ed25519 seed||public key. Never log this. */
  keySecret: string;
}

export interface SignedRequestParts {
  algorithm: SupportedJwtAlg;
  uri: string;
  token: string;
  authorization: string;
}

function base64Url(bytes: Buffer): string {
  return bytes.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodeJsonPart(part: string): unknown {
  const padded = part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

/**
 * JWT `uri` is `{METHOD} {host}{path}` with no query string.
 * coinbase-advanced-py `RESTBase.set_headers` signs `f"{method} {base_url}{path}"`
 * and sends query parameters separately via `requests` `params`. Confirmed against
 * that SDK source, not against a live account.
 */
export function formatJwtUri(method: string, path: string, host = ADVANCED_TRADE_HOST): string {
  if (!/^[A-Z]+$/.test(method)) {
    throw new SpotError('AUTH_METHOD', 'JWT method must be uppercase');
  }
  if (!path.startsWith('/')) {
    throw new SpotError('AUTH_PATH', 'JWT path must start with /');
  }
  if (path.includes('?') || path.includes('#')) {
    throw new SpotError('AUTH_PATH', 'JWT uri signs the path only. Do not include a query string.');
  }
  return `${method} ${host}${path}`;
}

function ed25519KeyFromRaw(secret: string): KeyObject {
  const decoded = Buffer.from(secret.replace(/\s+/g, ''), 'base64');
  if ((decoded.length !== 32 && decoded.length !== 64) || secret.includes('BEGIN ')) {
    throw new SpotError(
      'AUTH_KEY_UNSUPPORTED',
      'Ed25519 secrets must be base64 of 32 bytes (seed) or 64 bytes (seed || public key), matching coinbase-advanced-py.',
    );
  }
  const seed = decoded.subarray(0, 32);
  const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const privateKey = createPrivateKey({
    key: Buffer.concat([pkcs8Prefix, seed]),
    format: 'der',
    type: 'pkcs8',
  });
  if (decoded.length === 64) {
    const advertised = decoded.subarray(32);
    const spki = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }) as Buffer;
    const derived = spki.subarray(spki.length - 32);
    if (!derived.equals(advertised)) {
      throw new SpotError('AUTH_KEY_MISMATCH', 'Ed25519 public suffix does not match the seed');
    }
  }
  return privateKey;
}

function loadSigningKey(secret: string): { algorithm: SupportedJwtAlg; privateKey: KeyObject; includeAudience: boolean } {
  const trimmed = secret.replace(/\\n/g, '\n').trim();
  if (trimmed.includes('BEGIN ')) {
    let privateKey: KeyObject;
    try {
      privateKey = createPrivateKey(trimmed);
    } catch {
      throw new SpotError('AUTH_KEY_UNSUPPORTED', 'PEM private key could not be parsed');
    }
    if (privateKey.asymmetricKeyType === 'ec') {
      const details = privateKey.asymmetricKeyDetails;
      if (details?.namedCurve !== 'prime256v1') {
        throw new SpotError('AUTH_KEY_UNSUPPORTED', 'ES256 requires a P-256 key. Other curves are not signed.');
      }
      return { algorithm: 'ES256', privateKey, includeAudience: false };
    }
    if (privateKey.asymmetricKeyType === 'ed25519') {
      return { algorithm: 'EdDSA', privateKey, includeAudience: true };
    }
    throw new SpotError(
      'AUTH_KEY_UNSUPPORTED',
      `Key type ${String(privateKey.asymmetricKeyType)} is not an Advanced Trade ES256 or Ed25519 key`,
    );
  }
  return { algorithm: 'EdDSA', privateKey: ed25519KeyFromRaw(trimmed), includeAudience: true };
}

export function buildAdvancedTradeJwt(input: {
  key: AdvancedTradeKey;
  method: string;
  pathAndQuery: string;
  nowSeconds?: number;
  nonce?: string;
}): SignedRequestParts {
  if (!input.key.keyName.startsWith('organizations/') || !input.key.keyName.includes('/apiKeys/')) {
    throw new SpotError('AUTH_KEY_NAME', 'Key name must look like organizations/{org}/apiKeys/{id}');
  }
  const method = input.method.toUpperCase();
  const uri = formatJwtUri(method, input.pathAndQuery);
  const loaded = loadSigningKey(input.key.keySecret);
  const nbf = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const nonce = input.nonce ?? randomBytes(16).toString('hex');
  if (!/^[0-9a-f]{32}$/.test(nonce)) {
    throw new SpotError('AUTH_NONCE', 'Nonce must be 16 bytes of hex');
  }
  const header: Record<string, string> = {
    alg: loaded.algorithm,
    typ: 'JWT',
    kid: input.key.keyName,
    nonce,
  };
  const payload: Record<string, unknown> = {
    iss: 'cdp',
    nbf,
    exp: nbf + JWT_TTL_SECONDS,
    sub: input.key.keyName,
    uri,
  };
  if (loaded.includeAudience) payload.aud = ['cdp_service'];
  const signingInput = `${base64Url(Buffer.from(JSON.stringify(header)))}.${base64Url(Buffer.from(JSON.stringify(payload)))}`;
  const signature =
    loaded.algorithm === 'ES256'
      ? sign('sha256', Buffer.from(signingInput), { key: loaded.privateKey, dsaEncoding: 'ieee-p1363' })
      : sign(null, Buffer.from(signingInput), loaded.privateKey);
  const token = `${signingInput}.${base64Url(signature)}`;
  return { algorithm: loaded.algorithm, uri, token, authorization: `Bearer ${token}` };
}

export function verifyAdvancedTradeJwt(token: string, keySecret: string): { header: Record<string, unknown>; payload: Record<string, unknown> } {
  const [headerPart, payloadPart, signaturePart] = token.split('.');
  if (!headerPart || !payloadPart || !signaturePart) {
    throw new SpotError('AUTH_JWT', 'Malformed JWT');
  }
  const header = decodeJsonPart(headerPart) as Record<string, unknown>;
  const payload = decodeJsonPart(payloadPart) as Record<string, unknown>;
  const signature = Buffer.from(signaturePart.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (signaturePart.length % 4)) % 4), 'base64');
  const data = Buffer.from(`${headerPart}.${payloadPart}`);
  const loaded = loadSigningKey(keySecret);
  const publicKey = createPublicKey(loaded.privateKey);
  const ok =
    loaded.algorithm === 'ES256'
      ? verify('sha256', data, { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature)
      : verify(null, data, publicKey, signature);
  if (!ok) throw new SpotError('AUTH_JWT', 'JWT signature did not verify');
  return { header, payload };
}
