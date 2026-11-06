import { add, alignDown, cmp, mul, sub } from './decimal.ts';
import { LiveSubmissionDisabledError, SpotError } from './errors.ts';
import { classifyOrderStatus } from './adapter.ts';
import type { CoinbaseSpotAdapter } from './adapter.ts';
import type {
  AccountSnapshot,
  BookTop,
  FillRecord,
  OpenOrder,
  OrderSnapshot,
  PreviewRequest,
  ProductMetadata,
  SpotProductId,
  SubmitRequest,
} from './types.ts';

export interface MockBook {
  bestBid: string;
  bestAsk: string;
  observedAtMs: number;
}

export interface MockExchangeOptions {
  portfolioId: string;
  accounts: AccountSnapshot[];
  products: ProductMetadata[];
  books: Record<SpotProductId, MockBook>;
  /** Fixture only. The orchestrator does not apply this rate itself. */
  commissionRate: string;
  now?: () => number;
}

/**
 * In-memory venue used by tests. It is not a Coinbase connection.
 * Fills and balances exist only inside this object.
 */
export class MockCoinbaseExchange implements CoinbaseSpotAdapter {
  readonly executionMode = 'mock' as const;
  allowsOrderSubmission = true;
  private orders = new Map<string, OrderSnapshot>();
  private fills: FillRecord[] = [];
  private sequence = 0;
  nextStatusOverride: string | null = null;

  constructor(private readonly options: MockExchangeOptions) {}

  setAccounts(accounts: AccountSnapshot[]): void {
    this.options.accounts = accounts;
  }

  seedOpenOrder(order: OrderSnapshot): void {
    this.orders.set(order.orderId, order);
  }

  setBook(productId: SpotProductId, book: MockBook): void {
    this.options.books[productId] = book;
  }

  orderCount(): number {
    return this.orders.size;
  }

  firstOrderId(): string {
    const id = this.orders.keys().next().value;
    if (!id) throw new Error('no mock order');
    return id;
  }

  previewDelayMs = 0;

  async getProduct(productId: SpotProductId): Promise<ProductMetadata> {
    const product = this.options.products.find((item) => item.productId === productId);
    if (!product) throw new SpotError('PRODUCT_REJECTED', `Mock venue has no ${productId}`);
    return product;
  }

  async getBook(productId: SpotProductId): Promise<BookTop> {
    const book = this.options.books[productId];
    if (!book) throw new SpotError('BOOK_UNAVAILABLE', `No book for ${productId}`);
    return { productId, ...book };
  }

  async listAccounts(): Promise<AccountSnapshot[]> {
    return this.options.accounts.map((account) => ({ ...account }));
  }

  async getPortfolio() {
    return { portfolioId: this.options.portfolioId, name: 'mock-portfolio', portfolioType: 'CONSUMER' };
  }

  async getFeeSummary() {
    return { makerFeeRate: this.options.commissionRate, takerFeeRate: this.options.commissionRate, totalFees: null };
  }

  async listOpenOrders(productId?: SpotProductId): Promise<OpenOrder[]> {
    return [...this.orders.values()]
      .filter((order) => order.status === 'OPEN' && (productId === undefined || order.productId === productId))
      .map((order) => ({
        orderId: order.orderId,
        clientOrderId: order.clientOrderId,
        portfolioId: order.portfolioId,
        productId: order.productId,
        side: order.side,
        status: order.status,
        limitPrice: order.limitPrice,
        baseSize: order.baseSize,
        filledBase: order.filledBase,
        outstandingHoldAmount: order.outstandingHoldAmount,
      }));
  }

  async previewOrder(order: PreviewRequest) {
    if (this.previewDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.previewDelayMs));
    const quote = mul(order.baseSize, order.limitPrice);
    const commission = alignDown(mul(quote, this.options.commissionRate), '0.000000000000000001');
    const orderTotal = add(quote, commission);
    return {
      baseSize: order.baseSize,
      limitPrice: order.limitPrice,
      orderTotal,
      commissionTotal: commission,
      commissionCurrency: 'USD' as const,
    };
  }

  async submitOrder(order: SubmitRequest): Promise<OrderSnapshot> {
    if (!this.allowsOrderSubmission) throw new LiveSubmissionDisabledError();
    const existing = [...this.orders.values()].find((item) => item.clientOrderId === order.clientOrderId);
    if (existing) return existing;
    const status = this.nextStatusOverride ?? 'OPEN';
    this.nextStatusOverride = null;
    const snapshot: OrderSnapshot = {
      orderId: `mock-order-${++this.sequence}`,
      clientOrderId: order.clientOrderId,
      portfolioId: order.portfolioId,
      productId: order.productId,
      side: order.side,
      status,
      limitPrice: order.limitPrice,
      baseSize: order.baseSize,
      filledBase: '0',
      averageFilledPrice: null,
      totalFees: '0',
      feeCurrency: null,
      outstandingHoldAmount: null,
    };
    if (classifyOrderStatus(status) === 'unknown') {
      snapshot.status = status;
    }
    this.orders.set(snapshot.orderId, snapshot);
    if (status === 'OPEN' && order.side === 'BUY') {
      const held = mul(order.baseSize, order.limitPrice);
      snapshot.outstandingHoldAmount = held;
      this.moveAvailableToHold('USD', held);
    }
    if (status === 'OPEN' && order.side === 'SELL') {
      snapshot.outstandingHoldAmount = order.baseSize;
      this.moveAvailableToHold(order.productId === 'BTC-USD' ? 'BTC' : 'XRP', order.baseSize);
    }
    return snapshot;
  }

  async cancelOrders(): Promise<never> {
    throw new LiveSubmissionDisabledError();
  }

  async getOrder(orderId: string): Promise<OrderSnapshot> {
    const order = this.orders.get(orderId);
    if (!order) throw new SpotError('ORDER_UNKNOWN', `No mock order ${orderId}`);
    return { ...order };
  }

  async listFills(orderId: string): Promise<FillRecord[]> {
    return this.fills.filter((fill) => fill.orderId === orderId).map((fill) => ({ ...fill }));
  }

  /** Test helper. Applies a full fill and the matching balance change. Not a live trade. */
  fillOrder(orderId: string, price: string): FillRecord {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('missing order');
    const remaining = order.baseSize;
    const quote = mul(remaining, price);
    const commission = alignDown(mul(quote, this.options.commissionRate), '0.000000000000000001');
    const fill: FillRecord = {
      fillId: `mock-fill-${++this.sequence}`,
      orderId,
      clientOrderId: order.clientOrderId,
      productId: order.productId,
      side: order.side,
      baseSize: remaining,
      price,
      commission,
      commissionCurrency: 'USD',
      portfolioId: order.portfolioId,
      observedAt: new Date(this.options.now?.() ?? Date.now()).toISOString(),
    };
    this.fills.push(fill);
    order.status = 'FILLED';
    order.filledBase = remaining;
    order.averageFilledPrice = price;
    order.totalFees = commission;
    order.feeCurrency = 'USD';
    order.outstandingHoldAmount = '0';
    if (order.side === 'BUY') {
      this.releaseHold('USD', mul(order.baseSize, order.limitPrice));
      this.debitAvailable('USD', add(quote, commission));
      this.credit(order.productId === 'BTC-USD' ? 'BTC' : 'XRP', remaining);
    } else {
      this.releaseHold(order.productId === 'BTC-USD' ? 'BTC' : 'XRP', order.baseSize);
      this.debitAvailable(order.productId === 'BTC-USD' ? 'BTC' : 'XRP', remaining);
      this.credit('USD', sub(quote, commission));
    }
    return fill;
  }

  private account(currency: AccountSnapshot['currency']): AccountSnapshot {
    const account = this.options.accounts.find(
      (item) => item.portfolioId === this.options.portfolioId && item.currency === currency,
    );
    if (!account) throw new Error(`mock account missing ${currency}`);
    return account;
  }

  private moveAvailableToHold(currency: AccountSnapshot['currency'], amount: string): void {
    this.debitAvailable(currency, amount);
    const account = this.account(currency);
    account.hold = add(account.hold, amount);
  }

  private releaseHold(currency: AccountSnapshot['currency'], amount: string): void {
    const account = this.account(currency);
    if (cmp(account.hold, amount) < 0) throw new Error('mock hold underflow');
    account.hold = sub(account.hold, amount);
    account.available = add(account.available, amount);
  }

  private debitAvailable(currency: AccountSnapshot['currency'], amount: string): void {
    const account = this.account(currency);
    if (cmp(account.available, amount) < 0) throw new Error(`mock ${currency} underflow`);
    account.available = sub(account.available, amount);
  }

  private credit(currency: AccountSnapshot['currency'], amount: string): void {
    const account = this.account(currency);
    account.available = add(account.available, amount);
  }
}
