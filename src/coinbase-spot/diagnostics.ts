import { attributeHolds, orderReservesCurrency, spendableBalance } from './reservation.ts';
import { markToMarket, replayActivity, type InventoryMovement, type VerifiedBid } from './ledger.ts';
import type { Journal, JournalState } from './journal.ts';
import type { AccountSnapshot, FillRecord, OpenOrder, SpotProductId } from './types.ts';

export async function importActivity(
  journal: Journal,
  input: { fills?: FillRecord[]; movements?: InventoryMovement[] },
): Promise<{ addedFills: number; duplicateFills: number; addedMovements: number; duplicateMovements: number; unscoped: number }> {
  const book = await journal.load();
  let addedFills = 0;
  let duplicateFills = 0;
  let addedMovements = 0;
  let duplicateMovements = 0;
  let unscoped = 0;
  for (const fill of input.fills ?? []) {
    if (!fill.portfolioId || !fill.fillId) {
      unscoped += 1;
      continue;
    }
    if (book.fills.some((existing) => existing.fillId === fill.fillId)) {
      duplicateFills += 1;
      continue;
    }
    await journal.append({ type: 'fill', at: fill.observedAt || new Date(0).toISOString(), fill });
    book.fills.push(fill);
    addedFills += 1;
  }
  for (const movement of input.movements ?? []) {
    if (!movement.movementId) continue;
    if (book.movements.some((existing) => existing.movementId === movement.movementId)) {
      duplicateMovements += 1;
      continue;
    }
    await journal.append({ type: 'movement', at: movement.observedAt, movement });
    book.movements.push(movement);
    addedMovements += 1;
  }
  return { addedFills, duplicateFills, addedMovements, duplicateMovements, unscoped };
}

function sourceOf(state: JournalState): 'paper' | 'unknown' | 'coinbase_advanced_trade_import' {
  const sources = new Set(state.fills.map((fill) => fill.source ?? 'unknown'));
  if (sources.size === 0) return 'unknown';
  if (sources.size === 1 && sources.has('paper')) return 'paper';
  if (sources.size === 1 && sources.has('coinbase_advanced_trade')) return 'coinbase_advanced_trade_import';
  return 'unknown';
}

export function buildDiagnostics(input: {
  state: JournalState;
  nowMs: number;
  maxMarkAgeMs: number;
  bids?: Partial<Record<SpotProductId, VerifiedBid>>;
  exitFeeRate?: string | null;
  accounts?: AccountSnapshot[];
  openOrders?: OpenOrder[];
  portfolioId?: string;
}): Record<string, unknown> {
  const ledger = replayActivity(input.state.fills, input.state.movements, {
    bids: input.bids,
    nowMs: input.nowMs,
    maxAgeMs: input.maxMarkAgeMs,
  });
  const products: SpotProductId[] = ['BTC-USD', 'XRP-USD'];
  const marks = Object.fromEntries(products.map((productId) => {
    const bid = input.bids?.[productId];
    const fresh = bid ? input.nowMs - bid.observedAtMs <= input.maxMarkAgeMs : false;
    const marked = markToMarket(ledger, productId, fresh && bid ? bid.bid : null, input.exitFeeRate ?? null);
    return [productId, { bidFresh: fresh, bidObservedAtMs: bid?.observedAtMs ?? null, ...marked }];
  }));
  let reservationHeadroom: Record<string, unknown> = { status: 'unknown', reason: 'Balances were not supplied. This report does not call Coinbase.' };
  if (input.accounts && input.openOrders && input.portfolioId) {
    const rows = [];
    for (const account of input.accounts.filter((item) => item.portfolioId === input.portfolioId)) {
      const orders = input.openOrders.filter((order) => order.portfolioId === input.portfolioId && orderReservesCurrency(order, account.currency));
      const attribution = attributeHolds(account, orders);
      if (!attribution.ok) {
        rows.push({ currency: account.currency, status: 'blocked', reason: attribution.message });
        continue;
      }
      const spendable = spendableBalance(account, []);
      rows.push({ currency: account.currency, status: 'known', spendable: spendable.spendable, hold: account.hold, attributedHold: attribution.attributed });
    }
    reservationHeadroom = { status: 'known', currencies: rows };
  }
  return {
    asOf: new Date(input.nowMs).toISOString(),
    accountVerified: false,
    liveEngine: false,
    source: sourceOf(input.state),
    realized: {
      status: ledger.realizedStatus,
      grossQuote: ledger.realizedGrossQuote,
      netQuote: ledger.realizedNetQuote,
      note: ledger.realizedStatus === 'partial' ? 'Net quote omits fills whose fees or inventory basis could not be verified.' : null,
    },
    paidFees: ledger.paidFees,
    externalFlows: { status: ledger.externalFlowStatus, quote: ledger.externalFlowStatus === 'complete' ? ledger.externalFlowsQuote : null },
    missingBasisBase: ledger.unknownBasisBase,
    unknownBasisSold: ledger.unknownBasisSold,
    marks,
    reservationHeadroom,
    feeChurn: {
      paidFeeRows: ledger.paidFees.length,
      cancelCount: null,
      cancelStatus: 'unknown',
      reason: 'Cancel counts are unknown unless a venue cancel report was imported. None is inferred from open orders.',
    },
  };
}
