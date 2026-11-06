import { NetworkDisabledError, SpotError } from './errors.ts';
import { cmp, isDecimal } from './decimal.ts';
import {
  isSpotProduct,
  type AccountSnapshot,
  type BookTop,
  type OpenOrder,
  type OrderSnapshot,
  type PreviewRequest,
  type PreviewResult,
  type ProductMetadata,
  type FeeSummary,
  type FillRecord,
  type PortfolioSnapshot,
  type SpotProductId,
  type SubmitRequest,
} from './types.ts';

export interface CoinbaseSpotAdapter {
  readonly executionMode: 'disabled' | 'mock' | 'http';
  readonly allowsOrderSubmission: boolean;
  getPortfolio(): Promise<PortfolioSnapshot>;
  getFeeSummary(): Promise<FeeSummary>;
  getProduct(productId: SpotProductId): Promise<ProductMetadata>;
  getBook(productId: SpotProductId): Promise<BookTop>;
  listAccounts(): Promise<AccountSnapshot[]>;
  /** Omit productId to return every open spot order in the configured portfolio. */
  listOpenOrders(productId?: SpotProductId): Promise<OpenOrder[]>;
  previewOrder(order: PreviewRequest): Promise<PreviewResult>;
  submitOrder(order: SubmitRequest): Promise<OrderSnapshot>;
  cancelOrders(orderIds: readonly string[]): Promise<never>;
  getOrder(orderId: string): Promise<OrderSnapshot>;
  listFills(orderId: string): Promise<FillRecord[]>;
  listPortfolioFills(): Promise<FillRecord[]>;
}

const KNOWN_ORDER_STATUSES = new Set([
  'OPEN',
  'FILLED',
  'CANCELLED',
  'EXPIRED',
  'FAILED',
  'PENDING',
  'QUEUED',
]);

export function classifyOrderStatus(status: string): 'known' | 'unknown' {
  return KNOWN_ORDER_STATUSES.has(status) ? 'known' : 'unknown';
}

function requireDecimal(value: unknown, label: string): string {
  if (typeof value !== 'string' || !isDecimal(value)) {
    throw new SpotError('PAYLOAD_REJECTED', `${label} is missing a decimal string`);
  }
  return value;
}

export function parseProduct(payload: unknown): ProductMetadata {
  const body = payload as Record<string, unknown>;
  const productId = String(body.product_id ?? '');
  if (!isSpotProduct(productId)) {
    throw new SpotError('PRODUCT_REJECTED', 'Product is outside BTC-USD and XRP-USD');
  }
  if (body.product_type !== 'SPOT') {
    throw new SpotError('PRODUCT_REJECTED', 'Only SPOT products are accepted');
  }
  return {
    productId,
    productType: 'SPOT',
    tradingDisabled: body.trading_disabled === true || body.status === 'offline',
    baseIncrement: requireDecimal(body.base_increment, 'base_increment'),
    quoteIncrement: requireDecimal(body.quote_increment, 'quote_increment'),
    priceIncrement: requireDecimal(body.price_increment, 'price_increment'),
    baseMinSize: requireDecimal(body.base_min_size, 'base_min_size'),
    quoteMinSize: requireDecimal(body.quote_min_size, 'quote_min_size'),
  };
}

export function parsePreview(payload: unknown, productId: SpotProductId, requestedLimitPrice: string): PreviewResult {
  const body = payload as Record<string, unknown>;
  const errors = Array.isArray(body.errs) ? body.errs.map(String) : [];
  if (errors.length > 0) {
    throw new SpotError('PREVIEW_REJECTED', `Venue preview returned errors: ${errors.join('; ')}`);
  }
  const leverage = body.leverage;
  if (leverage !== undefined && leverage !== '' && leverage !== '0' && leverage !== 0) {
    throw new SpotError('LEVERAGE_REJECTED', 'Leverage is outside this spot scope');
  }
  const echoed = body.limit_price;
  const limitPrice = echoed === undefined || echoed === '' ? requestedLimitPrice : requireDecimal(echoed, 'limit_price');
  if (cmp(limitPrice, requestedLimitPrice) !== 0) {
    throw new SpotError('PREVIEW_MISMATCH', 'Preview limit_price does not match the requested limit');
  }
  const quote = 'USD';
  const rawCurrency = body.commission_currency;
  const commissionCurrency =
    rawCurrency === undefined || rawCurrency === ''
      ? quote
      : rawCurrency === 'USD' || rawCurrency === 'BTC' || rawCurrency === 'XRP'
        ? rawCurrency
        : null;
  if (!commissionCurrency) {
    throw new SpotError('PAYLOAD_REJECTED', 'Preview commission_currency is not USD, BTC, or XRP');
  }
  if ((productId !== 'BTC-USD' && productId !== 'XRP-USD') || (rawCurrency === undefined && quote !== 'USD')) {
    throw new SpotError('PAYLOAD_REJECTED', 'Preview commission currency cannot be inferred');
  }
  return {
    baseSize: requireDecimal(body.base_size, 'base_size'),
    limitPrice,
    orderTotal: requireDecimal(body.order_total, 'order_total'),
    commissionTotal: requireDecimal(body.commission_total, 'commission_total'),
    commissionCurrency,
  };
}

function refuse(): never {
  throw new NetworkDisabledError();
}

export function createDisabledAdapter(): CoinbaseSpotAdapter {
  return {
    executionMode: 'disabled',
    allowsOrderSubmission: false,
    getPortfolio: refuse,
    getFeeSummary: refuse,
    getProduct: refuse,
    getBook: refuse,
    listAccounts: refuse,
    listOpenOrders: refuse,
    previewOrder: refuse,
    submitOrder() {
      throw new NetworkDisabledError('Order submission is unavailable. No request was sent.');
    },
    cancelOrders() {
      throw new NetworkDisabledError('Cancel is unavailable. No request was sent.');
    },
    getOrder: refuse,
    listFills: refuse,
    listPortfolioFills: refuse,
  };
}
