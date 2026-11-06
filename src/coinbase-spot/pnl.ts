import { add, cmp, divFloor, mul, sub } from './decimal.ts';
import { SpotError } from './errors.ts';
import type { FillRecord, SpotCurrency, SpotProductId } from './types.ts';

export interface Lot {
  productId: SpotProductId;
  baseRemaining: string;
  quoteCostRemaining: string;
}

export interface PnlState {
  lots: Lot[];
  realizedQuote: string;
  fees: { currency: SpotCurrency; amount: string }[];
  costBasisIncomplete: boolean;
}

export interface MarkedPnl {
  realizedQuote: string;
  unrealized:
    | { status: 'known'; quote: string; mark: string; productId: SpotProductId }
    | { status: 'unknown'; productId: SpotProductId; reason: string };
  costBasisIncomplete: boolean;
}

export function emptyPnl(): PnlState {
  return { lots: [], realizedQuote: '0', fees: [], costBasisIncomplete: false };
}

function addFee(state: PnlState, currency: SpotCurrency, amount: string): void {
  const existing = state.fees.find((fee) => fee.currency === currency);
  if (existing) existing.amount = add(existing.amount, amount);
  else state.fees.push({ currency, amount });
}

function consumeFifo(state: PnlState, productId: SpotProductId, baseSize: string, quoteProceeds: string): void {
  let remaining = baseSize;
  let proceeds = quoteProceeds;
  const lots = state.lots.filter((lot) => lot.productId === productId && cmp(lot.baseRemaining, '0') > 0);
  for (const lot of lots) {
    if (cmp(remaining, '0') === 0) break;
    const take = cmp(lot.baseRemaining, remaining) <= 0 ? lot.baseRemaining : remaining;
    const cost =
      cmp(take, lot.baseRemaining) === 0
        ? lot.quoteCostRemaining
        : divFloor(mul(lot.quoteCostRemaining, take), lot.baseRemaining, '0.000000000000000001');
    const takeProceeds =
      cmp(take, remaining) === 0
        ? proceeds
        : divFloor(mul(proceeds, take), remaining, '0.000000000000000001');
    state.realizedQuote = add(state.realizedQuote, sub(takeProceeds, cost));
    lot.baseRemaining = sub(lot.baseRemaining, take);
    lot.quoteCostRemaining = sub(lot.quoteCostRemaining, cost);
    remaining = sub(remaining, take);
    proceeds = sub(proceeds, takeProceeds);
  }
  if (cmp(remaining, '0') > 0) {
    state.costBasisIncomplete = true;
    throw new SpotError(
      'COST_BASIS_INCOMPLETE',
      `Sell of ${baseSize} ${productId} exceeds inventory with a known cost. Realized PnL was not invented for the excess.`,
    );
  }
}

export function applyFill(state: PnlState, fill: FillRecord): PnlState {
  const next: PnlState = {
    lots: state.lots.map((lot) => ({ ...lot })),
    realizedQuote: state.realizedQuote,
    fees: state.fees.map((fee) => ({ ...fee })),
    costBasisIncomplete: state.costBasisIncomplete,
  };
  addFee(next, fill.commissionCurrency, fill.commission);
  const quoteNotional = mul(fill.baseSize, fill.price);
  if (fill.side === 'BUY') {
    const quoteCost =
      fill.commissionCurrency === 'USD' ? add(quoteNotional, fill.commission) : quoteNotional;
    let base = fill.baseSize;
    if (fill.commissionCurrency === 'BTC' || fill.commissionCurrency === 'XRP') {
      if (fill.commissionCurrency !== (fill.productId === 'BTC-USD' ? 'BTC' : 'XRP')) {
        next.costBasisIncomplete = true;
        throw new SpotError('COST_BASIS_INCOMPLETE', 'Fee currency does not match the base asset');
      }
      base = sub(base, fill.commission);
      if (cmp(base, '0') <= 0) {
        next.costBasisIncomplete = true;
        throw new SpotError('COST_BASIS_INCOMPLETE', 'Base fee consumed the entire fill');
      }
    }
    if (fill.commissionCurrency !== 'USD' && fill.commissionCurrency !== 'BTC' && fill.commissionCurrency !== 'XRP') {
      next.costBasisIncomplete = true;
      throw new SpotError('COST_BASIS_INCOMPLETE', 'Unsupported fee currency');
    }
    next.lots.push({ productId: fill.productId, baseRemaining: base, quoteCostRemaining: quoteCost });
    return next;
  }
  const proceeds = fill.commissionCurrency === 'USD' ? sub(quoteNotional, fill.commission) : quoteNotional;
  if (cmp(proceeds, '0') < 0) {
    next.costBasisIncomplete = true;
    throw new SpotError('COST_BASIS_INCOMPLETE', 'Fee exceeds sale proceeds');
  }
  consumeFifo(next, fill.productId, fill.baseSize, proceeds);
  return next;
}

export function markToMarket(state: PnlState, productId: SpotProductId, mark: string | null): MarkedPnl {
  const lots = state.lots.filter((lot) => lot.productId === productId && cmp(lot.baseRemaining, '0') > 0);
  if (!mark) {
    return {
      realizedQuote: state.realizedQuote,
      unrealized: { status: 'unknown', productId, reason: 'No mark price was supplied. Unrealized PnL is not zero.' },
      costBasisIncomplete: state.costBasisIncomplete,
    };
  }
  let market = '0';
  let cost = '0';
  for (const lot of lots) {
    market = add(market, mul(lot.baseRemaining, mark));
    cost = add(cost, lot.quoteCostRemaining);
  }
  return {
    realizedQuote: state.realizedQuote,
    unrealized: { status: 'known', quote: sub(market, cost), mark, productId },
    costBasisIncomplete: state.costBasisIncomplete,
  };
}
