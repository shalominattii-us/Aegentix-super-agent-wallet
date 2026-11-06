import { add, alignDown, alignUp, cmp, divFloor, isAligned, isPositive, min, mul, sub } from './decimal.ts';
import { LiveSubmissionDisabledError, SpotError } from './errors.ts';
import { classifyOrderStatus, type CoinbaseSpotAdapter } from './adapter.ts';
import { localReservations, type Journal, type JournalState, type StoredIntent } from './journal.ts';
import { applyFill, emptyPnl, markToMarket, type MarkedPnl, type PnlState } from './pnl.ts';
import { attributeHolds, orderReservesCurrency, spendableBalance } from './reservation.ts';
import {
  baseCurrency,
  isSpotProduct,
  quoteCurrency,
  type OperatorIntent,
  type PreviewResult,
  type ProductMetadata,
  type Reservation,
  type SpotCurrency,
  type SpotProductId,
} from './types.ts';

const INTENT_ID = /^[A-Za-z0-9_-]{1,128}$/;
const PORTFOLIO_ID = /^[0-9a-fA-F-]{16,80}$/;

export interface StageSuccess {
  ok: true;
  clientIntentId: string;
  state: StoredIntent['state'];
  stagedBaseSize: string;
  limitPrice: string;
  reservation: Reservation | null;
  evidenceRef: string | null;
  preview: PreviewResult;
  replayed: boolean;
}

export interface StageFailure {
  ok: false;
  code: string;
  message: string;
  clientIntentId?: string;
  state?: StoredIntent['state'];
}

export type StageResult = StageSuccess | StageFailure;

export interface Orchestrator {
  portfolioId: string;
  engageKillSwitch(reason: string): Promise<void>;
  releaseKillSwitch(reason: string): Promise<void>;
  stage(intent: OperatorIntent): Promise<StageResult>;
  cancelStaged(clientIntentId: string): Promise<void>;
  submit(clientIntentId: string): Promise<StoredIntent>;
  reconcile(): Promise<{ unknown: string[]; fillsApplied: number }>;
  pnl(marks?: Partial<Record<SpotProductId, string>>): Promise<Record<SpotProductId, MarkedPnl>>;
  status(): Promise<{
    killSwitchEngaged: boolean;
    liveSubmission: false;
    executionMode: 'disabled' | 'mock' | 'http';
    intents: StoredIntent[];
  }>;
}

function failure(code: string, message: string, clientIntentId?: string, state?: StoredIntent['state']): StageFailure {
  return { ok: false, code, message, clientIntentId, state };
}

function createMutex() {
  let chain: Promise<unknown> = Promise.resolve();
  return function exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(task, task);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

function validateIntent(intent: OperatorIntent, portfolioId: string): StageFailure | null {
  if (!PORTFOLIO_ID.test(portfolioId)) return failure('PORTFOLIO', 'One portfolio id is required');
  if (!INTENT_ID.test(intent.clientIntentId ?? '')) return failure('INTENT_ID', 'clientIntentId must be 1-128 letters, numbers, _ or -', intent.clientIntentId);
  if (!isSpotProduct(intent.productId)) return failure('PRODUCT_REJECTED', 'Only BTC-USD and XRP-USD are in scope', intent.clientIntentId);
  if (intent.side !== 'BUY' && intent.side !== 'SELL') return failure('SIDE', 'Side must be BUY or SELL', intent.clientIntentId);
  if (!Number.isInteger(intent.maxSlippageBps) || intent.maxSlippageBps < 0) {
    return failure('SLIPPAGE_REQUIRED', 'maxSlippageBps is required and must be a non-negative integer. There is no default.', intent.clientIntentId);
  }
  if (!Number.isInteger(intent.maxQuoteAgeMs) || intent.maxQuoteAgeMs < 0) {
    return failure('QUOTE_AGE_REQUIRED', 'maxQuoteAgeMs is required. There is no default freshness window.', intent.clientIntentId);
  }
  try {
    if (!isPositive(intent.baseSize) || !isPositive(intent.limitPrice)) {
      return failure('SIZE', 'baseSize and limitPrice must be positive decimals', intent.clientIntentId);
    }
  } catch {
    return failure('SIZE', 'baseSize and limitPrice must be positive decimals', intent.clientIntentId);
  }
  return null;
}

function withinSlippage(side: 'BUY' | 'SELL', limitPrice: string, bookPrice: string, maxSlippageBps: number): boolean {
  const boundNumerator = side === 'BUY' ? 10000 + maxSlippageBps : 10000 - maxSlippageBps;
  if (boundNumerator < 0) return true;
  const bound = divFloor(mul(bookPrice, String(boundNumerator)), '10000', '0.000000000000000001');
  if (side === 'BUY') return cmp(limitPrice, bound) <= 0;
  return cmp(limitPrice, bound) >= 0;
}

export function createOrchestrator(options: {
  adapter: CoinbaseSpotAdapter;
  portfolioId: string;
  journal: Journal;
  now?: () => number;
}): Orchestrator {
  const exclusive = createMutex();
  const now = options.now ?? Date.now;
  let cached: JournalState | null = null;

  async function state(): Promise<JournalState> {
    if (!cached) cached = await options.journal.load();
    return cached;
  }

  async function writeIntent(intent: StoredIntent): Promise<void> {
    const at = new Date(now()).toISOString();
    intent.updatedAt = at;
    await options.journal.append({ type: 'intent', at, intent });
    const current = await state();
    current.intents.set(intent.intent.clientIntentId, intent);
  }

  function accountFor(accounts: Awaited<ReturnType<CoinbaseSpotAdapter['listAccounts']>>, currency: SpotCurrency) {
    const rows = accounts.filter((account) => account.portfolioId === options.portfolioId && account.currency === currency);
    if (rows.length !== 1) {
      throw new SpotError('BALANCE_UNAVAILABLE', `Expected one ${currency} account in the specified portfolio`);
    }
    return rows[0];
  }

  async function sizeToFunds(
    intent: OperatorIntent,
    product: ProductMetadata,
    spendable: string,
  ): Promise<{ baseSize: string; preview: PreviewResult } | StageFailure> {
    if (!isAligned(intent.limitPrice, product.priceIncrement)) {
      return failure('PRICE_INCREMENT', 'limitPrice is not on the venue price increment', intent.clientIntentId);
    }
    let candidate = alignDown(intent.baseSize, product.baseIncrement);
    if (intent.side === 'BUY') {
      const affordable = divFloor(spendable, intent.limitPrice, product.baseIncrement);
      candidate = min(candidate, affordable);
    } else {
      candidate = min(candidate, alignDown(spendable, product.baseIncrement));
    }
    if (!isPositive(candidate) || cmp(candidate, product.baseMinSize) < 0) {
      return failure('INSUFFICIENT_FUNDS', 'Free balance is below the venue minimum after increment rounding', intent.clientIntentId);
    }
    const quoteNotional = mul(candidate, intent.limitPrice);
    if (cmp(quoteNotional, product.quoteMinSize) < 0) {
      return failure('INSUFFICIENT_FUNDS', 'Quote notional is below the venue minimum', intent.clientIntentId);
    }

    const previewOnce = async (baseSize: string) =>
      options.adapter.previewOrder({
        portfolioId: options.portfolioId,
        productId: intent.productId,
        side: intent.side,
        baseSize,
        limitPrice: intent.limitPrice,
      });

    let preview = await previewOnce(candidate);
    const tooExpensive = () => intent.side === 'BUY' && cmp(preview.orderTotal, spendable) > 0;
    if (tooExpensive() || (intent.side === 'SELL' && preview.commissionCurrency !== 'USD' && cmp(preview.commissionTotal, '0') > 0)) {
      let step =
        intent.side === 'BUY'
          ? alignUp(divFloor(preview.commissionTotal, intent.limitPrice, product.baseIncrement), product.baseIncrement)
          : alignUp(preview.commissionTotal, product.baseIncrement);
      if (!isPositive(step)) step = product.baseIncrement;
      if (cmp(candidate, step) <= 0) {
        return failure('INSUFFICIENT_FUNDS', 'Fee leaves no size that fits the free balance', intent.clientIntentId);
      }
      candidate = sub(candidate, step);
      candidate = alignDown(candidate, product.baseIncrement);
      if (cmp(candidate, product.baseMinSize) < 0) {
        return failure('INSUFFICIENT_FUNDS', 'Fee-aware size is below the venue minimum', intent.clientIntentId);
      }
      preview = await previewOnce(candidate);
      if (intent.side === 'BUY' && cmp(preview.orderTotal, spendable) > 0) {
        return failure('PREVIEW_EXCEEDS_FUNDS', 'Confirming preview still exceeds free funds. No order was staged.', intent.clientIntentId);
      }
    }
    if (cmp(preview.baseSize, candidate) !== 0 || cmp(preview.limitPrice, intent.limitPrice) !== 0) {
      return failure('PREVIEW_MISMATCH', 'Preview size or price does not match the staged order', intent.clientIntentId);
    }
    return { baseSize: candidate, preview };
  }

  return {
    portfolioId: options.portfolioId,
    async engageKillSwitch(reason: string) {
      await exclusive(async () => {
        const at = new Date(now()).toISOString();
        await options.journal.append({ type: 'kill', at, engaged: true, reason });
        (await state()).killSwitchEngaged = true;
      });
    },
    async releaseKillSwitch(reason: string) {
      await exclusive(async () => {
        const at = new Date(now()).toISOString();
        await options.journal.append({ type: 'kill', at, engaged: false, reason });
        (await state()).killSwitchEngaged = false;
      });
    },
    stage(intent: OperatorIntent) {
      return exclusive(async () => {
        const invalid = validateIntent(intent, options.portfolioId);
        if (invalid) return invalid;
        const book = await state();
        const prior = book.intents.get(intent.clientIntentId);
        if (prior) {
          if (prior.state === 'UNKNOWN') {
            return failure('UNKNOWN_STATUS', prior.message ?? 'Intent status is unknown. It will not be staged again.', intent.clientIntentId, prior.state);
          }
          if (!prior.stagedBaseSize || !prior.limitPrice || !prior.preview) {
            return failure('INTENT_EXISTS', prior.message ?? 'Intent already exists', intent.clientIntentId, prior.state);
          }
          return {
            ok: true,
            clientIntentId: intent.clientIntentId,
            state: prior.state,
            stagedBaseSize: prior.stagedBaseSize,
            limitPrice: prior.limitPrice,
            reservation: prior.reservation,
            evidenceRef: prior.intent.evidenceRef ?? null,
            preview: prior.preview,
            replayed: true,
          };
        }
        if (book.killSwitchEngaged) {
          return failure('KILL_SWITCH', 'Kill switch is engaged. No order was staged.', intent.clientIntentId);
        }
        if (options.adapter.executionMode === 'disabled') {
          return failure('NETWORK_DISABLED', 'Market data and balances cannot be read. Live HTTP is disabled.', intent.clientIntentId);
        }
        try {
          const product = await options.adapter.getProduct(intent.productId);
          if (product.productId !== intent.productId || product.tradingDisabled || product.productType !== 'SPOT') {
            return failure('PRODUCT_REJECTED', 'Venue product is not an enabled spot market', intent.clientIntentId);
          }
          const top = await options.adapter.getBook(intent.productId);
          if (now() - top.observedAtMs > intent.maxQuoteAgeMs) {
            return failure('STALE_QUOTE', 'Book is older than maxQuoteAgeMs. Staging stopped.', intent.clientIntentId);
          }
          const reference = intent.side === 'BUY' ? top.bestAsk : top.bestBid;
          if (!isPositive(reference) || !withinSlippage(intent.side, intent.limitPrice, reference, intent.maxSlippageBps)) {
            return failure('SLIPPAGE', 'Limit price is outside the operator slippage bound versus the fresh book', intent.clientIntentId);
          }
          const accounts = await options.adapter.listAccounts();
          const currency: SpotCurrency = intent.side === 'BUY' ? quoteCurrency(intent.productId) : baseCurrency(intent.productId);
          const account = accountFor(accounts, currency);
          const openOrders = (await options.adapter.listOpenOrders()).filter(
            (order) => order.portfolioId === options.portfolioId && orderReservesCurrency(order, currency),
          );
          const attribution = attributeHolds(account, openOrders);
          if (!attribution.ok) return failure('HOLD_AMBIGUOUS', attribution.message, intent.clientIntentId);
          const covered = new Set(openOrders.map((order) => order.clientOrderId));
          const funds = spendableBalance(
            account,
            localReservations(book).filter((reservation) => !covered.has(reservation.clientIntentId)),
          );
          const sized = await sizeToFunds(intent, product, funds.spendable);
          if ('ok' in sized) return sized;
          const reserveAmount = intent.side === 'BUY' ? sized.preview.orderTotal : sized.baseSize;
          if (cmp(reserveAmount, funds.spendable) > 0) {
            return failure('INSUFFICIENT_FUNDS', 'Reservation would exceed free funds', intent.clientIntentId);
          }
          const reservation: Reservation = {
            clientIntentId: intent.clientIntentId,
            currency,
            amount: reserveAmount,
            reason: 'awaiting_exchange_hold',
          };
          const stored: StoredIntent = {
            intent,
            state: 'STAGED',
            stagedBaseSize: sized.baseSize,
            limitPrice: intent.limitPrice,
            preview: sized.preview,
            reservation,
            orderId: null,
            rawStatus: null,
            message: null,
            updatedAt: new Date(now()).toISOString(),
          };
          await writeIntent(stored);
          return {
            ok: true,
            clientIntentId: intent.clientIntentId,
            state: 'STAGED',
            stagedBaseSize: sized.baseSize,
            limitPrice: intent.limitPrice,
            reservation,
            evidenceRef: intent.evidenceRef ?? null,
            preview: sized.preview,
            replayed: false,
          };
        } catch (error) {
          const spot = error instanceof SpotError ? error : null;
          return failure(spot?.code ?? 'FAIL_CLOSED', error instanceof Error ? error.message : 'Staging failed closed', intent.clientIntentId);
        }
      });
    },
    async cancelStaged(clientIntentId: string) {
      await exclusive(async () => {
        const book = await state();
        const intent = book.intents.get(clientIntentId);
        if (!intent || intent.state !== 'STAGED') {
          throw new SpotError('NOT_CANCELLABLE', 'Only a staged intent that was not submitted can be cancelled');
        }
        intent.state = 'CANCELLED';
        intent.reservation = null;
        intent.message = 'Staged reservation released before submission';
        await writeIntent(intent);
      });
    },
    async submit(clientIntentId: string) {
      return exclusive(async () => {
        const book = await state();
        if (book.killSwitchEngaged) throw new SpotError('KILL_SWITCH', 'Kill switch is engaged');
        const intent = book.intents.get(clientIntentId);
        if (!intent || intent.state !== 'STAGED' || !intent.stagedBaseSize || !intent.limitPrice) {
          throw new SpotError('NOT_STAGED', 'Nothing staged for this intent');
        }
        if (!options.adapter.allowsOrderSubmission || options.adapter.executionMode !== 'mock') {
          throw new LiveSubmissionDisabledError();
        }
        const order = await options.adapter.submitOrder({
          portfolioId: options.portfolioId,
          productId: intent.intent.productId,
          side: intent.intent.side,
          baseSize: intent.stagedBaseSize,
          limitPrice: intent.limitPrice,
          clientOrderId: intent.intent.clientIntentId,
        });
        if (order.portfolioId !== options.portfolioId || order.clientOrderId !== intent.intent.clientIntentId) {
          intent.state = 'UNKNOWN';
          intent.message = 'Venue acknowledgement did not match the portfolio or client id';
          await writeIntent(intent);
          throw new SpotError('UNKNOWN_STATUS', intent.message);
        }
        if (classifyOrderStatus(order.status) === 'unknown') {
          intent.state = 'UNKNOWN';
          intent.orderId = order.orderId;
          intent.rawStatus = order.status;
          intent.message = 'Venue status is not a known terminal or working state. Reservation kept. No retry.';
          await writeIntent(intent);
          throw new SpotError('UNKNOWN_STATUS', intent.message);
        }
        intent.orderId = order.orderId;
        intent.rawStatus = order.status;
        intent.state = order.status === 'FILLED' ? 'FILLED' : order.status === 'FAILED' || order.status === 'CANCELLED' || order.status === 'EXPIRED' ? 'FAILED' : 'SUBMITTED';
        if (intent.state === 'FAILED') intent.reservation = null;
        await writeIntent(intent);
        return intent;
      });
    },
    async reconcile() {
      return exclusive(async () => {
        const book = await state();
        const unknown: string[] = [];
        let fillsApplied = 0;
        for (const intent of book.intents.values()) {
          if (!intent.orderId || intent.state === 'FILLED' || intent.state === 'CANCELLED' || intent.state === 'FAILED') continue;
          let order;
          try {
            order = await options.adapter.getOrder(intent.orderId);
          } catch {
            intent.state = 'UNKNOWN';
            intent.message = 'Order lookup failed. Status is unknown and the intent will not be resubmitted.';
            unknown.push(intent.intent.clientIntentId);
            await writeIntent(intent);
            continue;
          }
          if (classifyOrderStatus(order.status) === 'unknown') {
            intent.state = 'UNKNOWN';
            intent.rawStatus = order.status;
            intent.message = 'Unknown venue status. Fail closed.';
            unknown.push(intent.intent.clientIntentId);
            await writeIntent(intent);
            continue;
          }
          const fills = await options.adapter.listFills(intent.orderId);
          for (const fill of fills) {
            if (fill.portfolioId !== options.portfolioId) {
              intent.state = 'UNKNOWN';
              intent.message = 'Fill portfolio does not match the configured portfolio';
              unknown.push(intent.intent.clientIntentId);
              await writeIntent(intent);
              continue;
            }
            if (book.fills.some((existing) => existing.fillId === fill.fillId)) continue;
            await options.journal.append({ type: 'fill', at: new Date(now()).toISOString(), fill });
            book.fills.push(fill);
            fillsApplied += 1;
          }
          intent.rawStatus = order.status;
          if (order.status === 'FILLED') {
            intent.state = 'FILLED';
            intent.reservation = null;
          } else if (order.status === 'CANCELLED' || order.status === 'EXPIRED' || order.status === 'FAILED') {
            intent.state = order.status === 'FAILED' ? 'FAILED' : 'CANCELLED';
            intent.reservation = null;
          } else {
            intent.state = 'WORKING';
            if (intent.reservation) {
              const accounts = await options.adapter.listAccounts();
              const account = accounts.find(
                (item) => item.portfolioId === options.portfolioId && item.currency === intent.reservation?.currency,
              );
              const openOrders = account
                ? (await options.adapter.listOpenOrders()).filter(
                    (order) => order.portfolioId === options.portfolioId && orderReservesCurrency(order, account.currency),
                  )
                : [];
              const attribution = account ? attributeHolds(account, openOrders) : { ok: false as const, message: 'Account missing' };
              const covered = openOrders.some((order) => order.clientOrderId === intent.intent.clientIntentId);
              if (attribution.ok && covered) intent.reservation = null;
              else intent.message = attribution.ok ? intent.message : attribution.message;
            }
          }
          await writeIntent(intent);
        }
        return { unknown, fillsApplied };
      });
    },
    async pnl(marks: Partial<Record<SpotProductId, string>> = {}) {
      const book = await state();
      let pnl = emptyPnl();
      for (const fill of book.fills) {
        try {
          pnl = applyFill(pnl, fill);
        } catch (error) {
          pnl = { ...pnl, costBasisIncomplete: true };
          if (!(error instanceof SpotError) || error.code !== 'COST_BASIS_INCOMPLETE') throw error;
        }
      }
      return {
        'BTC-USD': markToMarket(pnl, 'BTC-USD', marks['BTC-USD'] ?? null),
        'XRP-USD': markToMarket(pnl, 'XRP-USD', marks['XRP-USD'] ?? null),
      };
    },
    async status() {
      const book = await state();
      return {
        killSwitchEngaged: book.killSwitchEngaged,
        liveSubmission: false as const,
        executionMode: options.adapter.executionMode,
        intents: [...book.intents.values()],
      };
    },
  };
}

export function readinessBlockers(): string[] {
  return [
    'The HTTP adapter is implemented and tested with a mock fetch only. This process has not called api.coinbase.com.',
    'JWT uri signs the path and not the query string, matching coinbase-advanced-py RESTBase.set_headers. That was checked against the SDK source and generated keys, not against a live account.',
    'Live submission stays off. A passing arming phrase still throws before any cancel or create request.',
    'Credentials are read only when a caller invokes the HTTP adapter. The readiness command prints presence flags and does not read or print secret values.',
    'Overlapping holds must sum exactly to the account hold. Any mismatch blocks a new spend.',
    'Realized PnL is FIFO from recorded fills only. Unrealized PnL stays unknown until the caller supplies a mark.',
    'The OmniCyberDEX page is labeled as browser simulation and is not this adapter.',
  ];
}
