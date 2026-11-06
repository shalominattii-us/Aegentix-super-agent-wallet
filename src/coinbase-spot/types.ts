export const SPOT_PRODUCTS = ['BTC-USD', 'XRP-USD'] as const;
export type SpotProductId = (typeof SPOT_PRODUCTS)[number];

export const SPOT_CURRENCIES = ['USD', 'BTC', 'XRP'] as const;
export type SpotCurrency = (typeof SPOT_CURRENCIES)[number];

export function isSpotProduct(value: string): value is SpotProductId {
  return (SPOT_PRODUCTS as readonly string[]).includes(value);
}

export function quoteCurrency(productId: SpotProductId): 'USD' {
  return productId.endsWith('-USD') ? 'USD' : 'USD';
}

export function baseCurrency(productId: SpotProductId): 'BTC' | 'XRP' {
  return productId === 'BTC-USD' ? 'BTC' : 'XRP';
}

export interface ProductMetadata {
  productId: SpotProductId;
  productType: 'SPOT';
  tradingDisabled: boolean;
  baseIncrement: string;
  quoteIncrement: string;
  priceIncrement: string;
  baseMinSize: string;
  quoteMinSize: string;
}

export interface BookTop {
  productId: SpotProductId;
  bestBid: string;
  bestAsk: string;
  observedAtMs: number;
}

export interface AccountSnapshot {
  accountId: string;
  portfolioId: string;
  currency: SpotCurrency;
  /** Free balance. Coinbase already removed open-order holds from this figure. */
  available: string;
  /** Balance already reserved by the venue for open orders. Do not subtract this again. */
  hold: string;
}

export interface OpenOrder {
  orderId: string;
  clientOrderId: string;
  portfolioId: string;
  productId: SpotProductId;
  side: 'BUY' | 'SELL';
  status: string;
  limitPrice: string;
  baseSize: string;
  filledBase: string;
  /** Null when the payload did not include outstanding_hold_amount. */
  outstandingHoldAmount: string | null;
}

export interface PreviewRequest {
  portfolioId: string;
  productId: SpotProductId;
  side: 'BUY' | 'SELL';
  baseSize: string;
  limitPrice: string;
}

export interface PreviewResult {
  baseSize: string;
  limitPrice: string;
  orderTotal: string;
  commissionTotal: string;
  commissionCurrency: SpotCurrency;
}

export interface SubmitRequest extends PreviewRequest {
  clientOrderId: string;
}

export interface OrderSnapshot {
  orderId: string;
  clientOrderId: string;
  portfolioId: string;
  productId: SpotProductId;
  side: 'BUY' | 'SELL';
  status: string;
  limitPrice: string;
  baseSize: string;
  filledBase: string;
  averageFilledPrice: string | null;
  totalFees: string;
  feeCurrency: SpotCurrency | null;
  outstandingHoldAmount: string | null;
}

export interface FeeSummary {
  makerFeeRate: string | null;
  takerFeeRate: string | null;
  totalFees: string | null;
}

export interface PortfolioSnapshot {
  portfolioId: string;
  name: string | null;
  portfolioType: string | null;
}

export interface FillRecord {
  fillId: string;
  orderId: string;
  clientOrderId: string;
  productId: SpotProductId;
  side: 'BUY' | 'SELL';
  baseSize: string;
  price: string;
  commission: string;
  commissionCurrency: SpotCurrency;
  portfolioId: string;
  observedAt: string;
  entryId?: string | null;
  tradeId?: string | null;
  source?: 'coinbase_advanced_trade' | 'paper' | 'unknown';
}

export interface OperatorIntent {
  clientIntentId: string;
  productId: SpotProductId;
  side: 'BUY' | 'SELL';
  /** Ceiling. The orchestrator may stage less when free funds require it. */
  baseSize: string;
  limitPrice: string;
  /** Required. There is no default that approves a price move. */
  maxSlippageBps: number;
  /** Required maximum age of the book used for the slippage check. */
  maxQuoteAgeMs: number;
  /** Opaque caller reference. Not interpreted as an edge or a signal. */
  evidenceRef?: string | null;
}

export type IntentState =
  | 'STAGED'
  | 'SUBMITTED'
  | 'WORKING'
  | 'FILLED'
  | 'CANCELLED'
  | 'FAILED'
  | 'UNKNOWN';

export interface Reservation {
  clientIntentId: string;
  currency: SpotCurrency;
  amount: string;
  reason: 'awaiting_exchange_hold';
}
