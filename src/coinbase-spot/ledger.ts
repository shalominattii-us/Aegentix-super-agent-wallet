import { add, cmp, divFloor, isPositive, min, mul, sub } from './decimal.ts';
import type { FillRecord, SpotCurrency, SpotProductId } from './types.ts';

export interface Lot {
  productId: SpotProductId;
  baseRemaining: string;
  quoteCostRemaining: string;
  provenanceId: string;
}

export interface Provenance {
  source: 'coinbase_advanced_trade' | 'operator_import' | 'paper' | 'unknown';
  entryId: string | null;
  tradeId: string | null;
  orderId: string | null;
  clientOrderId: string | null;
  portfolioId: string | null;
}

export interface InventoryMovement {
  movementId: string;
  kind: 'opening_balance' | 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out';
  productId: SpotProductId;
  baseSize: string;
  /** Null keeps the quantity without a cost. It is not booked at zero. */
  quoteCost: string | null;
  observedAt: string;
  provenance: Provenance;
}

export interface VerifiedBid {
  bid: string;
  observedAtMs: number;
}

export interface PnlState {
  lots: Lot[];
  unknownBasisBase: Partial<Record<SpotProductId, string>>;
  unknownBasisSold: Partial<Record<SpotProductId, string>>;
  realizedGrossQuote: string;
  realizedNetQuote: string;
  realizedStatus: 'complete' | 'partial';
  paidFees: { currency: SpotCurrency; amount: string; quoteValue: string | null }[];
  externalFlowsQuote: string;
  externalFlowStatus: 'complete' | 'partial';
  costBasisIncomplete: boolean;
}

export interface MarkedPnl {
  realizedQuote: string;
  realizedGrossQuote: string;
  realizedNetQuote: string;
  realizedStatus: 'complete' | 'partial';
  unrealized:
    | { status: 'known'; quote: string; mark: string; productId: SpotProductId; gross: true }
    | { status: 'unknown'; productId: SpotProductId; reason: string };
  unrealizedNet: { status: 'known'; quote: string } | { status: 'unknown'; reason: string };
  estimatedExitFee: { status: 'known'; quote: string } | { status: 'unknown'; reason: string };
  paidFeesQuote: { status: 'known'; quote: string } | { status: 'unknown'; reason: string };
  unknownBasisBase: string;
  costBasisIncomplete: boolean;
}

const PRODUCTS: SpotProductId[] = ['BTC-USD', 'XRP-USD'];

export function emptyPnl(): PnlState {
  return {
    lots: [],
    unknownBasisBase: {},
    unknownBasisSold: {},
    realizedGrossQuote: '0',
    realizedNetQuote: '0',
    realizedStatus: 'complete',
    paidFees: [],
    externalFlowsQuote: '0',
    externalFlowStatus: 'complete',
    costBasisIncomplete: false,
  };
}

function clone(state: PnlState): PnlState {
  return {
    ...state,
    lots: state.lots.map((lot) => ({ ...lot })),
    unknownBasisBase: { ...state.unknownBasisBase },
    unknownBasisSold: { ...state.unknownBasisSold },
    paidFees: state.paidFees.map((fee) => ({ ...fee })),
  };
}

function bump(map: Partial<Record<SpotProductId, string>>, productId: SpotProductId, amount: string): void {
  map[productId] = add(map[productId] ?? '0', amount);
}

function productOfCurrency(currency: SpotCurrency): SpotProductId | null {
  if (currency === 'BTC') return 'BTC-USD';
  if (currency === 'XRP') return 'XRP-USD';
  return null;
}

export function freshBid(mark: VerifiedBid | undefined, nowMs: number, maxAgeMs: number): string | null {
  if (!mark || !isPositive(mark.bid) || !Number.isFinite(mark.observedAtMs) || maxAgeMs < 0) return null;
  if (nowMs - mark.observedAtMs > maxAgeMs) return null;
  return mark.bid;
}

function feeQuote(fill: FillRecord, bids: Partial<Record<SpotProductId, VerifiedBid>> | undefined, nowMs: number, maxAgeMs: number): string | null {
  if (cmp(fill.commission, '0') === 0) return '0';
  if (fill.commissionCurrency === 'USD') return fill.commission;
  const product = productOfCurrency(fill.commissionCurrency);
  const bid = product ? freshBid(bids?.[product], nowMs, maxAgeMs) : null;
  return bid ? mul(fill.commission, bid) : null;
}

function consumeKnown(state: PnlState, productId: SpotProductId, baseSize: string, grossProceeds: string, netProceeds: string | null): string {
  let remaining = baseSize;
  let grossLeft = grossProceeds;
  let netLeft = netProceeds;
  for (const lot of state.lots) {
    if (lot.productId !== productId || cmp(lot.baseRemaining, '0') === 0 || cmp(remaining, '0') === 0) continue;
    const take = min(lot.baseRemaining, remaining);
    const cost = cmp(take, lot.baseRemaining) === 0 ? lot.quoteCostRemaining : divFloor(mul(lot.quoteCostRemaining, take), lot.baseRemaining, '0.000000000000000001');
    const grossPart = cmp(take, remaining) === 0 ? grossLeft : divFloor(mul(grossLeft, take), remaining, '0.000000000000000001');
    state.realizedGrossQuote = add(state.realizedGrossQuote, sub(grossPart, cost));
    if (netLeft !== null) {
      const netPart = cmp(take, remaining) === 0 ? netLeft : divFloor(mul(netLeft, take), remaining, '0.000000000000000001');
      state.realizedNetQuote = add(state.realizedNetQuote, sub(netPart, cost));
      netLeft = sub(netLeft, netPart);
    }
    lot.baseRemaining = sub(lot.baseRemaining, take);
    lot.quoteCostRemaining = sub(lot.quoteCostRemaining, cost);
    remaining = sub(remaining, take);
    grossLeft = sub(grossLeft, grossPart);
  }
  return remaining;
}

export function applyMovement(state: PnlState, movement: InventoryMovement): PnlState {
  const next = clone(state);
  if (!isPositive(movement.baseSize)) return next;
  const inbound = movement.kind === 'opening_balance' || movement.kind === 'deposit' || movement.kind === 'transfer_in';
  if (inbound) {
    if (movement.quoteCost === null) {
      bump(next.unknownBasisBase, movement.productId, movement.baseSize);
      next.costBasisIncomplete = true;
      next.externalFlowStatus = 'partial';
    } else {
      next.lots.push({
        productId: movement.productId,
        baseRemaining: movement.baseSize,
        quoteCostRemaining: movement.quoteCost,
        provenanceId: movement.movementId,
      });
      next.externalFlowsQuote = add(next.externalFlowsQuote, movement.quoteCost);
    }
    return next;
  }
  if (movement.quoteCost === null) next.externalFlowStatus = 'partial';
  else next.externalFlowsQuote = sub(next.externalFlowsQuote, movement.quoteCost);
  let remaining = movement.baseSize;
  for (const lot of next.lots) {
    if (lot.productId !== movement.productId || cmp(remaining, '0') === 0 || cmp(lot.baseRemaining, '0') === 0) continue;
    const take = min(lot.baseRemaining, remaining);
    const cost = cmp(take, lot.baseRemaining) === 0 ? lot.quoteCostRemaining : divFloor(mul(lot.quoteCostRemaining, take), lot.baseRemaining, '0.000000000000000001');
    lot.baseRemaining = sub(lot.baseRemaining, take);
    lot.quoteCostRemaining = sub(lot.quoteCostRemaining, cost);
    remaining = sub(remaining, take);
  }
  const unknown = next.unknownBasisBase[movement.productId] ?? '0';
  if (cmp(remaining, '0') > 0 && cmp(unknown, '0') > 0) {
    const take = min(unknown, remaining);
    next.unknownBasisBase[movement.productId] = sub(unknown, take);
    remaining = sub(remaining, take);
  }
  if (cmp(remaining, '0') > 0) {
    next.costBasisIncomplete = true;
    next.externalFlowStatus = 'partial';
    bump(next.unknownBasisSold, movement.productId, remaining);
  }
  return next;
}

export function applyFill(
  state: PnlState,
  fill: FillRecord,
  context?: { bids?: Partial<Record<SpotProductId, VerifiedBid>>; nowMs?: number; maxAgeMs?: number },
): PnlState {
  const next = clone(state);
  const feeInQuote = feeQuote(fill, context?.bids, context?.nowMs ?? 0, context?.maxAgeMs ?? 0);
  next.paidFees.push({ currency: fill.commissionCurrency, amount: fill.commission, quoteValue: feeInQuote });
  if (feeInQuote === null) {
    next.realizedStatus = 'partial';
    next.costBasisIncomplete = true;
  }
  const quoteNotional = mul(fill.baseSize, fill.price);
  if (fill.side === 'BUY') {
    let base = fill.baseSize;
    let quoteCost = quoteNotional;
    if (fill.commissionCurrency === 'USD' && feeInQuote !== null) quoteCost = add(quoteCost, feeInQuote);
    if ((fill.commissionCurrency === 'BTC' || fill.commissionCurrency === 'XRP') && cmp(fill.commission, '0') > 0) {
      if (fill.commissionCurrency !== (fill.productId === 'BTC-USD' ? 'BTC' : 'XRP') || cmp(fill.commission, base) >= 0) {
        next.costBasisIncomplete = true;
        next.realizedStatus = 'partial';
        bump(next.unknownBasisBase, fill.productId, base);
        return next;
      }
      base = sub(base, fill.commission);
    }
    next.lots.push({ productId: fill.productId, baseRemaining: base, quoteCostRemaining: quoteCost, provenanceId: fill.fillId });
    return next;
  }
  const netProceeds = feeInQuote === null ? null : sub(quoteNotional, feeInQuote);
  const unmatched = consumeKnown(next, fill.productId, fill.baseSize, quoteNotional, netProceeds);
  if (cmp(unmatched, '0') > 0) {
    const held = next.unknownBasisBase[fill.productId] ?? '0';
    const take = min(held, unmatched);
    if (cmp(take, '0') > 0) next.unknownBasisBase[fill.productId] = sub(held, take);
    bump(next.unknownBasisSold, fill.productId, unmatched);
    next.costBasisIncomplete = true;
    next.realizedStatus = 'partial';
  }
  return next;
}

export function replayActivity(
  fills: readonly FillRecord[],
  movements: readonly InventoryMovement[],
  context?: { bids?: Partial<Record<SpotProductId, VerifiedBid>>; nowMs?: number; maxAgeMs?: number },
): PnlState {
  const seen = new Set<string>();
  const events: { at: number; id: string; run: (state: PnlState) => PnlState }[] = [];
  for (const fill of fills) {
    const key = `fill:${fill.fillId}`;
    if (!fill.fillId || seen.has(key)) continue;
    seen.add(key);
    const at = Date.parse(fill.observedAt);
    events.push({ at: Number.isFinite(at) ? at : 0, id: fill.fillId, run: (state) => applyFill(state, fill, context) });
  }
  for (const movement of movements) {
    const key = `move:${movement.movementId}`;
    if (!movement.movementId || seen.has(key)) continue;
    seen.add(key);
    const at = Date.parse(movement.observedAt);
    events.push({ at: Number.isFinite(at) ? at : 0, id: movement.movementId, run: (state) => applyMovement(state, movement) });
  }
  events.sort((left, right) => left.at - right.at || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  return events.reduce((state, event) => event.run(state), emptyPnl());
}

export function markToMarket(state: PnlState, productId: SpotProductId, mark: string | null, exitFeeRate: string | null = null): MarkedPnl {
  const unknown = state.unknownBasisBase[productId] ?? '0';
  const paidKnown = state.paidFees.every((fee) => fee.quoteValue !== null);
  const paidFeesQuote = paidKnown
    ? { status: 'known' as const, quote: state.paidFees.reduce((sum, fee) => add(sum, fee.quoteValue ?? '0'), '0') }
    : { status: 'unknown' as const, reason: 'At least one paid fee has no fresh conversion mark.' };
  const base = {
    realizedQuote: state.realizedNetQuote,
    realizedGrossQuote: state.realizedGrossQuote,
    realizedNetQuote: state.realizedNetQuote,
    realizedStatus: state.realizedStatus,
    paidFeesQuote,
    unknownBasisBase: unknown,
    costBasisIncomplete: state.costBasisIncomplete || cmp(unknown, '0') > 0,
  };
  const knownQty = state.lots.some((lot) => lot.productId === productId && cmp(lot.baseRemaining, '0') > 0);
  if (!mark || !isPositive(mark) || !knownQty) {
    return {
      ...base,
      unrealized: {
        status: 'unknown',
        productId,
        reason: !knownQty ? 'No quantity with a known cost basis. Unrealized PnL is not zero.' : 'No fresh bid was supplied. Unrealized PnL is not zero.',
      },
      unrealizedNet: { status: 'unknown', reason: 'Net unrealized needs a fresh bid and a supplied exit fee rate.' },
      estimatedExitFee: { status: 'unknown', reason: 'No exit fee rate was supplied. None is assumed.' },
    };
  }
  let market = '0';
  let cost = '0';
  for (const lot of state.lots) {
    if (lot.productId !== productId || cmp(lot.baseRemaining, '0') === 0) continue;
    market = add(market, mul(lot.baseRemaining, mark));
    cost = add(cost, lot.quoteCostRemaining);
  }
  const gross = sub(market, cost);
  const estimated = exitFeeRate === null ? null : mul(market, exitFeeRate);
  return {
    ...base,
    unrealized: { status: 'known', quote: gross, mark, productId, gross: true },
    unrealizedNet: estimated === null ? { status: 'unknown', reason: 'Exit fee rate was not supplied, so net unrealized is not estimated.' } : { status: 'known', quote: sub(gross, estimated) },
    estimatedExitFee: estimated === null ? { status: 'unknown', reason: 'Exit fee rate was not supplied.' } : { status: 'known', quote: estimated },
  };
}

export interface RoundTripInput {
  baseSize: string;
  entryPrice: string;
  exitBid: string;
  entryCommissionQuote: string | null;
  exitCommissionQuote: string | null;
  slippageQuote: string | null;
  lotCostQuote: string | null;
}

export function assessRoundTrip(input: RoundTripInput): { status: 'known' | 'insufficient_evidence'; coversRoundTripCosts: boolean | null; netVersusCostQuote: string | null; reason: string | null; note: string } {
  const note = 'A difference from the mid price is not evidence of an edge.';
  if (input.entryCommissionQuote === null || input.exitCommissionQuote === null || input.slippageQuote === null || input.lotCostQuote === null || !isPositive(input.baseSize) || !isPositive(input.entryPrice) || !isPositive(input.exitBid)) {
    return { status: 'insufficient_evidence', coversRoundTripCosts: null, netVersusCostQuote: null, reason: 'Entry and exit commissions, slippage, and lot cost are required. No fee rate is assumed.', note };
  }
  const net = sub(sub(sub(mul(input.exitBid, input.baseSize), input.exitCommissionQuote), input.slippageQuote), input.lotCostQuote);
  const afterEntry = sub(net, input.entryCommissionQuote);
  return { status: 'known', coversRoundTripCosts: cmp(afterEntry, '0') > 0, netVersusCostQuote: afterEntry, reason: null, note };
}

export function performanceSinceBaseline(input: {
  nowMs: number;
  maxMarkAgeMs: number;
  baselineAtMs: number;
  baselineUsd: string;
  currentUsd: string;
  baselineBids: Partial<Record<SpotProductId, VerifiedBid>>;
  currentBids: Partial<Record<SpotProductId, VerifiedBid>>;
  baselineBase: Partial<Record<SpotProductId, string>>;
  currentBase: Partial<Record<SpotProductId, string>>;
  externalFlowsQuote: string | null;
}): { status: 'known' | 'unknown'; performanceQuote: string | null; portfolioValueQuote: string | null; reason: string | null } {
  if (input.externalFlowsQuote === null) {
    return { status: 'unknown', performanceQuote: null, portfolioValueQuote: null, reason: 'A deposit or transfer has no quote value, so a balance change is not performance.' };
  }
  const valueAt = (usd: string, base: Partial<Record<SpotProductId, string>>, bids: Partial<Record<SpotProductId, VerifiedBid>>, when: number) => {
    let total = usd;
    for (const productId of PRODUCTS) {
      const qty = base[productId] ?? '0';
      if (cmp(qty, '0') === 0) continue;
      const bid = freshBid(bids[productId], when, input.maxMarkAgeMs);
      if (!bid) return null;
      total = add(total, mul(qty, bid));
    }
    return total;
  };
  const currentValue = valueAt(input.currentUsd, input.currentBase, input.currentBids, input.nowMs);
  const baselineValue = valueAt(input.baselineUsd, input.baselineBase, input.baselineBids, input.baselineAtMs + input.maxMarkAgeMs);
  if (!currentValue || !baselineValue) {
    return { status: 'unknown', performanceQuote: null, portfolioValueQuote: currentValue, reason: 'A required bid is missing or older than maxMarkAgeMs.' };
  }
  return { status: 'known', portfolioValueQuote: currentValue, performanceQuote: sub(sub(currentValue, baselineValue), input.externalFlowsQuote), reason: null };
}
