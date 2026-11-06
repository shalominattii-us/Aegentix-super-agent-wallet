import { buildAdvancedTradeJwt, formatJwtUri, ADVANCED_TRADE_HOST, type AdvancedTradeKey } from './auth.ts';
import { LiveSubmissionDisabledError, SpotError } from './errors.ts';
import { isDecimal } from './decimal.ts';
import { classifyOrderStatus, parsePreview, parseProduct } from './adapter.ts';
import type { CoinbaseSpotAdapter } from './adapter.ts';
import {
  isSpotProduct,
  type AccountSnapshot,
  type BookTop,
  type FeeSummary,
  type FillRecord,
  type OpenOrder,
  type OrderSnapshot,
  type PortfolioSnapshot,
  type PreviewRequest,
  type ProductMetadata,
  type SpotCurrency,
  type SpotProductId,
  type SubmitRequest,
} from './types.ts';

export interface FetchLike {
  (url: string, init?: RequestInit): Promise<Response>;
}

export interface CredentialProvider {
  /** Return the key, or null when it is not configured. Must not log the secret. */
  load(): AdvancedTradeKey | null;
}

export interface HttpAdapterOptions {
  fetch: FetchLike;
  credentials: CredentialProvider;
  portfolioId: string;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Present only so tests can prove a passing policy still does not send a mutation. */
  mutationPolicy?: MutationPolicy | null;
}

export interface MutationPolicy {
  armed: boolean;
  /** Must be exactly this phrase. There is no default arming. */
  confirmPhrase: string;
  portfolioId: string;
}

export const MUTATION_ARM_PHRASE = 'ARM_COINBASE_SPOT_MUTATIONS';

const PAGE_GUARD = 100;

export function envCredentialProvider(env: NodeJS.ProcessEnv = process.env): CredentialProvider {
  return {
    load() {
      const keyName = env.COINBASE_API_KEY_NAME?.trim();
      const keySecret = env.COINBASE_API_KEY_SECRET?.replace(/\\n/g, '\n').trim();
      if (!keyName || !keySecret) return null;
      return { keyName, keySecret };
    },
  };
}

export function assertMutationPolicy(policy: MutationPolicy | null, portfolioId: string): void {
  if (!policy?.armed || policy.confirmPhrase !== MUTATION_ARM_PHRASE) {
    throw new SpotError('ARMING_REQUIRED', 'Order mutations are disarmed.');
  }
  if (policy.portfolioId !== portfolioId) {
    throw new SpotError('POLICY_REJECTED', 'Arming policy portfolio does not match the adapter portfolio.');
  }
}

function queryString(params: Record<string, string | undefined>): string {
  return Object.entries(params)
    .filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== '')
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SpotError('PAYLOAD_REJECTED', `${label} was not an object`);
  }
  return value as Record<string, unknown>;
}

function currencyOf(value: unknown, label: string): SpotCurrency {
  if (value !== 'USD' && value !== 'BTC' && value !== 'XRP') {
    throw new SpotError('PAYLOAD_REJECTED', `${label} is not USD, BTC, or XRP`);
  }
  return value;
}

function money(value: unknown, label: string): string {
  const record = asRecord(value, label);
  const amount = record.value;
  if (typeof amount !== 'string' || !isDecimal(amount)) {
    throw new SpotError('PAYLOAD_REJECTED', `${label}.value is missing`);
  }
  currencyOf(record.currency, `${label}.currency`);
  return amount;
}

function optionalDecimal(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !isDecimal(value)) {
    throw new SpotError('PAYLOAD_REJECTED', 'Expected a decimal string');
  }
  return value;
}

function limitConfig(configuration: unknown): { baseSize: string; limitPrice: string } | null {
  const body = asRecord(configuration ?? {}, 'order_configuration');
  const limit = body.limit_limit_gtc ?? body.sor_limit_ioc;
  if (!limit) return null;
  const leg = asRecord(limit, 'limit configuration');
  return {
    baseSize: optionalDecimal(leg.base_size) ?? '',
    limitPrice: optionalDecimal(leg.limit_price) ?? '',
  };
}

export function parseAccount(value: unknown): AccountSnapshot {
  const body = asRecord(value, 'account');
  const portfolioId = String(body.retail_portfolio_id ?? '');
  if (!portfolioId) throw new SpotError('PAYLOAD_REJECTED', 'Account is missing retail_portfolio_id');
  return {
    accountId: String(body.uuid ?? ''),
    portfolioId,
    currency: currencyOf(body.currency, 'account.currency'),
    available: money(body.available_balance, 'available_balance'),
    hold: money(body.hold, 'hold'),
  };
}

export function parseOpenOrder(value: unknown): OpenOrder {
  const body = asRecord(value, 'order');
  const productId = String(body.product_id ?? '');
  if (!isSpotProduct(productId)) {
    throw new SpotError('PRODUCT_REJECTED', `Open order product ${productId} is outside BTC-USD and XRP-USD`);
  }
  const side = body.side === 'BUY' || body.side === 'SELL' ? body.side : null;
  if (!side) throw new SpotError('PAYLOAD_REJECTED', 'Order side is missing');
  const configured = limitConfig(body.order_configuration);
  if (!configured?.baseSize || !configured.limitPrice) {
    throw new SpotError('HOLD_AMBIGUOUS', `Open order ${String(body.order_id ?? '')} has no limit size and price, so its hold cannot be attributed.`);
  }
  return {
    orderId: String(body.order_id ?? ''),
    clientOrderId: String(body.client_order_id ?? ''),
    portfolioId: String(body.retail_portfolio_id ?? ''),
    productId,
    side,
    status: String(body.status ?? ''),
    limitPrice: configured.limitPrice,
    baseSize: configured.baseSize,
    filledBase: optionalDecimal(body.filled_size) ?? '0',
    outstandingHoldAmount: optionalDecimal(body.outstanding_hold_amount),
  };
}

export function parseOrderSnapshot(value: unknown): OrderSnapshot {
  const open = parseOpenOrder(value);
  const body = asRecord(value, 'order');
  if (classifyOrderStatus(open.status) === 'unknown') {
    throw new SpotError('UNKNOWN_STATUS', `Venue order status ${open.status || '(empty)'} is not a known state`);
  }
  const fee = optionalDecimal(body.total_fees);
  return {
    ...open,
    averageFilledPrice: optionalDecimal(body.average_filled_price),
    totalFees: fee ?? '0',
    feeCurrency: fee ? 'USD' : null,
  };
}

export function parseFill(value: unknown): FillRecord {
  const body = asRecord(value, 'fill');
  const productId = String(body.product_id ?? '');
  if (!isSpotProduct(productId)) throw new SpotError('PRODUCT_REJECTED', 'Fill is outside BTC-USD and XRP-USD');
  const side = body.side === 'BUY' || body.side === 'SELL' ? body.side : null;
  if (!side) throw new SpotError('PAYLOAD_REJECTED', 'Fill side is missing');
  const rawCurrency = body.commission_currency;
  const commissionCurrency =
    rawCurrency === undefined || rawCurrency === ''
      ? 'USD'
      : rawCurrency === 'USD' || rawCurrency === 'BTC' || rawCurrency === 'XRP'
        ? rawCurrency
        : null;
  if (!commissionCurrency) throw new SpotError('PAYLOAD_REJECTED', 'Fill commission_currency is not supported');
  const baseSize = optionalDecimal(body.size);
  const price = optionalDecimal(body.price);
  const fillId = String(body.entry_id ?? body.trade_id ?? '');
  if (!fillId || !baseSize || !price) throw new SpotError('PAYLOAD_REJECTED', 'Fill is missing id, size, or price');
  return {
    fillId,
    orderId: String(body.order_id ?? ''),
    clientOrderId: String(body.client_order_id ?? ''),
    productId,
    side,
    baseSize,
    price,
    commission: optionalDecimal(body.commission) ?? '0',
    commissionCurrency,
    portfolioId: String(body.retail_portfolio_id ?? ''),
    observedAt: String(body.trade_time ?? body.sequence_timestamp ?? ''),
  };
}

function clip(text: string): string {
  return text.replace(/\s+/g, ' ').slice(0, 300);
}

export function createCoinbaseHttpAdapter(options: HttpAdapterOptions): CoinbaseSpotAdapter {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  if (!/^[A-Za-z0-9-]+$/.test(options.portfolioId)) {
    throw new SpotError('PORTFOLIO', 'Portfolio id must be a single unescaped path segment');
  }

  async function request(method: 'GET' | 'POST', path: string, query: Record<string, string | undefined>, body?: unknown, attempt = 0): Promise<unknown> {
    if (path.includes('?')) throw new SpotError('AUTH_PATH', 'Internal path must not contain a query string');
    const key = options.credentials.load();
    if (!key) throw new SpotError('CREDENTIALS_MISSING', 'COINBASE_API_KEY_NAME and COINBASE_API_KEY_SECRET are not both set');
    const qs = queryString(query);
    const url = `https://${ADVANCED_TRADE_HOST}${path}${qs ? `?${qs}` : ''}`;
    const signed = buildAdvancedTradeJwt({ key, method, pathAndQuery: path, nowSeconds: Math.floor(now() / 1000) });
    if (signed.uri !== formatJwtUri(method, path)) {
      throw new SpotError('AUTH_PATH', 'Signed URI drifted from the path');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await options.fetch(url, {
        method,
        headers: {
          Authorization: signed.authorization,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'aegentix-coinbase-spot/0',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      if (name === 'AbortError') throw new SpotError('TIMEOUT', `Coinbase request timed out after ${timeoutMs}ms`);
      throw new SpotError('HTTP_FAILURE', 'Coinbase request failed before a response');
    } finally {
      clearTimeout(timer);
    }
    const raw = await response.text();
    if (response.status === 429 && method === 'GET' && attempt === 0) {
      const retryAfter = Number(response.headers.get('retry-after'));
      if (Number.isFinite(retryAfter) && retryAfter >= 0 && retryAfter <= 2) {
        await sleep(retryAfter * 1000);
        return request(method, path, query, body, attempt + 1);
      }
      throw new SpotError('RATE_LIMITED', 'Coinbase returned 429 without a short Retry-After. No further attempt was made.');
    }
    if (response.status >= 500 && method === 'GET' && attempt === 0) {
      return request(method, path, query, body, attempt + 1);
    }
    if (!response.ok) {
      throw new SpotError(`HTTP_${response.status}`, clip(`Coinbase HTTP ${response.status}: ${raw}`));
    }
    if (!raw) return {};
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new SpotError('PAYLOAD_REJECTED', 'Coinbase response was not JSON');
    }
  }

  async function pages(path: string, query: Record<string, string | undefined>, listKey: string): Promise<unknown[]> {
    const seen = new Set<string>();
    const rows: unknown[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < PAGE_GUARD; page += 1) {
      const payload = asRecord(await request('GET', path, { ...query, cursor, limit: '250' }), listKey);
      const batch = payload[listKey];
      if (!Array.isArray(batch)) throw new SpotError('PAYLOAD_REJECTED', `${listKey} was not a list`);
      rows.push(...batch);
      const next = typeof payload.cursor === 'string' ? payload.cursor : '';
      if (payload.has_next !== true || !next) return rows;
      if (seen.has(next)) throw new SpotError('PAGINATION', 'Coinbase repeated a cursor. The page set is incomplete, so it was discarded.');
      seen.add(next);
      cursor = next;
    }
    throw new SpotError('PAGINATION', 'Coinbase pagination did not end. Partial results were discarded.');
  }

  function refuseMutation(policy: MutationPolicy | null): never {
    assertMutationPolicy(policy, options.portfolioId);
    throw new LiveSubmissionDisabledError();
  }

  return {
    executionMode: 'http',
    allowsOrderSubmission: false,
    async getPortfolio(): Promise<PortfolioSnapshot> {
      const payload = asRecord(await request('GET', `/api/v3/brokerage/portfolios/${encodeURIComponent(options.portfolioId)}`, {}), 'portfolio');
      const breakdown = asRecord(payload.breakdown ?? payload, 'portfolio');
      const portfolio = asRecord(breakdown.portfolio ?? breakdown, 'portfolio');
      const id = String(portfolio.uuid ?? portfolio.portfolio_uuid ?? '');
      if (id !== options.portfolioId) throw new SpotError('PORTFOLIO', 'Portfolio response did not match the configured portfolio');
      return {
        portfolioId: id,
        name: typeof portfolio.name === 'string' ? portfolio.name : null,
        portfolioType: typeof portfolio.type === 'string' ? portfolio.type : null,
      };
    },
    async getFeeSummary(): Promise<FeeSummary> {
      const payload = asRecord(await request('GET', '/api/v3/brokerage/transaction_summary', { product_type: 'SPOT' }), 'fees');
      const tier = asRecord(payload.fee_tier, 'fee_tier');
      return {
        makerFeeRate: optionalDecimal(tier.maker_fee_rate),
        takerFeeRate: optionalDecimal(tier.taker_fee_rate),
        totalFees: optionalDecimal(payload.total_fees),
      };
    },
    async getProduct(productId: SpotProductId): Promise<ProductMetadata> {
      return parseProduct(await request('GET', `/api/v3/brokerage/products/${productId}`, {}));
    },
    async getBook(productId: SpotProductId): Promise<BookTop> {
      const payload = asRecord(await request('GET', '/api/v3/brokerage/product_book', { product_id: productId, limit: '1' }), 'book');
      const book = asRecord(payload.pricebook, 'pricebook');
      if (book.product_id !== undefined && book.product_id !== productId) {
        throw new SpotError('PAYLOAD_REJECTED', 'Product book id does not match the request');
      }
      const bids = Array.isArray(book.bids) ? book.bids : [];
      const asks = Array.isArray(book.asks) ? book.asks : [];
      const bid = asRecord(bids[0], 'best bid');
      const ask = asRecord(asks[0], 'best ask');
      const observed = Date.parse(String(book.time ?? ''));
      if (!Number.isFinite(observed)) {
        throw new SpotError('STALE_QUOTE', 'Product book did not include a parseable time');
      }
      const bestBid = optionalDecimal(bid.price);
      const bestAsk = optionalDecimal(ask.price);
      if (!bestBid || !bestAsk) throw new SpotError('BOOK_UNAVAILABLE', 'Product book is missing a best bid or ask');
      return { productId, bestBid, bestAsk, observedAtMs: observed };
    },
    async listAccounts(): Promise<AccountSnapshot[]> {
      const rows = await pages('/api/v3/brokerage/accounts', { retail_portfolio_id: options.portfolioId }, 'accounts');
      return rows.map(parseAccount).filter((account) => account.portfolioId === options.portfolioId);
    },
    async listOpenOrders(productId?: SpotProductId): Promise<OpenOrder[]> {
      const rows = await pages(
        '/api/v3/brokerage/orders/historical/batch',
        {
          order_status: 'OPEN',
          product_type: 'SPOT',
          retail_portfolio_id: options.portfolioId,
          product_ids: productId,
        },
        'orders',
      );
      return rows
        .map(parseOpenOrder)
        .filter((order) => order.portfolioId === options.portfolioId && order.status === 'OPEN' && (!productId || order.productId === productId));
    },
    async previewOrder(order: PreviewRequest) {
      if (order.portfolioId !== options.portfolioId) throw new SpotError('PORTFOLIO', 'Preview portfolio does not match');
      const payload = await request('POST', '/api/v3/brokerage/orders/preview', {}, {
        product_id: order.productId,
        side: order.side,
        retail_portfolio_id: options.portfolioId,
        order_configuration: {
          limit_limit_gtc: { base_size: order.baseSize, limit_price: order.limitPrice, post_only: false },
        },
      });
      return parsePreview(payload, order.productId, order.limitPrice);
    },
    async submitOrder(_order: SubmitRequest): Promise<OrderSnapshot> {
      return refuseMutation(options.mutationPolicy ?? null);
    },
    async cancelOrders(): Promise<never> {
      return refuseMutation(options.mutationPolicy ?? null);
    },
    async getOrder(orderId: string): Promise<OrderSnapshot> {
      const payload = await request('GET', `/api/v3/brokerage/orders/historical/${encodeURIComponent(orderId)}`, {});
      const body = asRecord(payload, 'order');
      const order = parseOrderSnapshot(body.order ?? payload);
      if (order.portfolioId !== options.portfolioId) throw new SpotError('PORTFOLIO', 'Order is not in the configured portfolio');
      return order;
    },
    async listFills(orderId: string): Promise<FillRecord[]> {
      const rows = await pages(
        '/api/v3/brokerage/orders/historical/fills',
        { order_ids: orderId, retail_portfolio_id: options.portfolioId },
        'fills',
      );
      return rows.map(parseFill).filter((fill) => fill.orderId === orderId && fill.portfolioId === options.portfolioId);
    },
  };
}

export function previewRequestBody(order: PreviewRequest): unknown {
  return {
    product_id: order.productId,
    side: order.side,
    retail_portfolio_id: order.portfolioId,
    order_configuration: {
      limit_limit_gtc: { base_size: order.baseSize, limit_price: order.limitPrice, post_only: false },
    },
  };
}

export function createOrderRequestBody(order: SubmitRequest): unknown {
  return { ...previewRequestBody(order) as object, client_order_id: order.clientOrderId };
}
