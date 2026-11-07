import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { importActivity, buildDiagnostics } from './diagnostics.ts';
import { createCoinbaseHttpAdapter } from './http.ts';
import { FileJournal, MemoryJournal } from './journal.ts';
import { assessRoundTrip, performanceSinceBaseline, replayActivity } from './ledger.ts';
import { diagnosticsResponse } from './httpRoutes.ts';
import type { FillRecord } from './types.ts';

const PORTFOLIO = '11111111-1111-4111-8111-111111111111';

function fill(patch: Partial<FillRecord> & Pick<FillRecord, 'fillId' | 'side' | 'observedAt'>): FillRecord {
  return {
    orderId: 'order',
    clientOrderId: 'client',
    productId: 'BTC-USD',
    baseSize: '1',
    price: '100',
    commission: '0',
    commissionCurrency: 'USD',
    portfolioId: PORTFOLIO,
    source: 'coinbase_advanced_trade',
    ...patch,
  };
}

describe('ledger replay', () => {
  it('sorts out-of-order fills, ignores duplicates, and does not treat a deposit as profit', () => {
    const buy = fill({ fillId: 'buy', side: 'BUY', price: '100', commission: '1', observedAt: '2026-01-01T00:00:00Z' });
    const sell = fill({ fillId: 'sell', side: 'SELL', price: '110', commission: '1', observedAt: '2026-01-01T00:05:00Z' });
    const once = replayActivity([sell, buy, sell], [{
      movementId: 'dep',
      kind: 'deposit',
      productId: 'XRP-USD',
      baseSize: '5',
      quoteCost: '3',
      observedAt: '2026-01-01T00:01:00Z',
      provenance: { source: 'operator_import', entryId: null, tradeId: null, orderId: null, clientOrderId: null, portfolioId: PORTFOLIO },
    }]);
    assert.equal(once.realizedNetQuote, '8');
    assert.equal(once.externalFlowsQuote, '3');
    assert.equal(once.realizedStatus, 'complete');
    assert.equal(once.lots.some((lot) => lot.productId === 'XRP-USD' && lot.baseRemaining === '5'), true);
  });

  it('keeps a sell that happens before any buy as unknown basis, not zero-cost profit', () => {
    const state = replayActivity([
      fill({ fillId: 'early-sell', side: 'SELL', price: '200', observedAt: '2026-01-01T00:00:00Z' }),
      fill({ fillId: 'later-buy', side: 'BUY', price: '100', observedAt: '2026-01-02T00:00:00Z' }),
    ], []);
    assert.equal(state.realizedNetQuote, '0');
    assert.equal(state.unknownBasisSold['BTC-USD'], '1');
    assert.equal(state.realizedStatus, 'partial');
    assert.equal(state.lots[0]?.baseRemaining, '1');
  });

  it('converts a base fee only with a fresh bid and leaves portfolio performance unknown without one', () => {
    const withMark = replayActivity([
      fill({ fillId: 'fee', side: 'BUY', commission: '0.01', commissionCurrency: 'BTC', observedAt: '2026-01-01T00:00:00Z' }),
    ], [], { bids: { 'BTC-USD': { bid: '100', observedAtMs: 1_000 } }, nowMs: 1_500, maxAgeMs: 1_000 });
    assert.equal(withMark.paidFees[0]?.quoteValue, '1');
    const without = replayActivity([
      fill({ fillId: 'fee', side: 'BUY', commission: '0.01', commissionCurrency: 'BTC', observedAt: '2026-01-01T00:00:00Z' }),
    ], []);
    assert.equal(without.paidFees[0]?.quoteValue, null);
    assert.equal(without.realizedStatus, 'partial');
    const performance = performanceSinceBaseline({
      nowMs: 5_000,
      maxMarkAgeMs: 1_000,
      baselineAtMs: 1_000,
      baselineUsd: '100',
      currentUsd: '150',
      baselineBids: {},
      currentBids: { 'BTC-USD': { bid: '10', observedAtMs: 0 } },
      baselineBase: {},
      currentBase: { 'BTC-USD': '1' },
      externalFlowsQuote: '0',
    });
    assert.equal(performance.status, 'unknown');
    assert.equal(performance.performanceQuote, null);
  });

  it('does not count a deposit as performance and does not assume an exit fee', () => {
    const flat = performanceSinceBaseline({
      nowMs: 2_000,
      maxMarkAgeMs: 1_000,
      baselineAtMs: 1_000,
      baselineUsd: '100',
      currentUsd: '150',
      baselineBids: {},
      currentBids: {},
      baselineBase: {},
      currentBase: {},
      externalFlowsQuote: '50',
    });
    assert.equal(flat.performanceQuote, '0');
    const earned = performanceSinceBaseline({ ...flatInput(flat), externalFlowsQuote: '0', currentUsd: '150', baselineUsd: '100' });
    assert.equal(earned.performanceQuote, '50');
    const check = assessRoundTrip({ baseSize: '1', entryPrice: '100', exitBid: '101', entryCommissionQuote: null, exitCommissionQuote: null, slippageQuote: null, lotCostQuote: '100' });
    assert.equal(check.status, 'insufficient_evidence');
    assert.equal(check.coversRoundTripCosts, null);
    const covered = assessRoundTrip({ baseSize: '1', entryPrice: '100', exitBid: '102', entryCommissionQuote: '0.6', exitCommissionQuote: '0.6', slippageQuote: '0', lotCostQuote: '100' });
    assert.equal(covered.coversRoundTripCosts, true);
    assert.match(covered.note, /not evidence of an edge/);
  });

  it('reloads a journal after restart and paginates fills without applying another portfolio', async () => {
    const file = path.join(os.tmpdir(), `ledger-${Date.now()}.jsonl`);
    const first = new FileJournal(file);
    const imported = await importActivity(first, {
      fills: [
        fill({ fillId: 'a', side: 'BUY', observedAt: '2026-01-02T00:00:00Z' }),
        fill({ fillId: 'a', side: 'BUY', observedAt: '2026-01-02T00:00:00Z' }),
        fill({ fillId: 'b', side: 'SELL', price: '110', observedAt: '2026-01-03T00:00:00Z', portfolioId: 'other-portfolio' }),
      ],
      movements: [{
        movementId: 'open',
        kind: 'opening_balance',
        productId: 'BTC-USD',
        baseSize: '2',
        quoteCost: null,
        observedAt: '2025-12-01T00:00:00Z',
        provenance: { source: 'unknown', entryId: null, tradeId: null, orderId: null, clientOrderId: null, portfolioId: PORTFOLIO },
      }],
    });
    assert.equal(imported.addedFills, 2);
    assert.equal(imported.duplicateFills, 1);
    const reloaded = await new FileJournal(file).load();
    const replayed = replayActivity(reloaded.fills.filter((row) => row.portfolioId === PORTFOLIO), reloaded.movements);
    assert.equal(replayed.unknownBasisBase['BTC-USD'], '2');
    assert.equal(replayed.lots.find((lot) => lot.productId === 'BTC-USD')?.baseRemaining, '1');
    assert.equal(replayed.realizedNetQuote, '0');
    fs.rmSync(file, { force: true });

    let page = 0;
    const adapter = createCoinbaseHttpAdapter({
      portfolioId: PORTFOLIO,
      credentials: { load: () => ({ keyName: 'organizations/org/apiKeys/key', keySecret: pem() }) },
      fetch: async (url) => {
        page += 1;
        const cursor = new URL(url).searchParams.get('cursor');
        if (!cursor) {
          return Response.json({
            fills: [{ entry_id: 'e1', trade_id: 't1', order_id: 'o', product_id: 'BTC-USD', side: 'BUY', size: '1', price: '10', commission: '0.01', retail_portfolio_id: PORTFOLIO, trade_time: '2026-01-01T00:00:00Z' }, { entry_id: 'foreign', trade_id: 't2', order_id: 'o2', product_id: 'BTC-USD', side: 'BUY', size: '9', price: '10', commission: '0', retail_portfolio_id: 'other', trade_time: '2026-01-01T00:00:00Z' }],
            has_next: true,
            cursor: 'next',
          });
        }
        return Response.json({ fills: [{ entry_id: 'e2', trade_id: null, order_id: 'o', product_id: 'XRP-USD', side: 'SELL', size: '2', price: '1', commission: '0', retail_portfolio_id: PORTFOLIO, trade_time: '2026-01-01T00:01:00Z' }], has_next: false });
      },
    });
    const rows = await adapter.listPortfolioFills();
    assert.equal(page, 2);
    assert.deepEqual(rows.map((row) => row.fillId), ['e1', 'e2']);
    assert.equal(rows[0]?.entryId, 'e1');
    assert.equal(rows[0]?.tradeId, 't1');
    assert.equal(rows[0]?.source, 'coinbase_advanced_trade');

    const journal = new MemoryJournal();
    const again = await importActivity(journal, { fills: rows });
    const twice = await importActivity(journal, { fills: rows });
    assert.equal(again.addedFills, 2);
    assert.equal(twice.duplicateFills, 2);
    const report = buildDiagnostics({ state: await journal.load(), nowMs: Date.parse('2026-01-02T00:00:00Z'), maxMarkAgeMs: 1_000 });
    assert.equal(report.accountVerified, false);
    assert.equal(report.liveEngine, false);
    assert.equal(report.source, 'coinbase_advanced_trade_import');
  });

  it('fails closed when the journal path is unset and redacts bearer text from HTTP errors', async () => {
    const missing = await diagnosticsResponse({ COINBASE_SPOT_OPERATOR_TOKEN: 'operator-token-value' }, 'Bearer operator-token-value', { maxMarkAgeMs: 1000 });
    assert.equal(missing.status, 409);
    const adapter = createCoinbaseHttpAdapter({
      portfolioId: PORTFOLIO,
      credentials: { load: () => ({ keyName: 'organizations/org/apiKeys/key', keySecret: pem() }) },
      fetch: async () => new Response('Bearer SENTINEL-TOKEN api_key=SENTINEL-KEY', { status: 400 }),
    });
    await assert.rejects(() => adapter.listAccounts(), (error: unknown) => {
      const text = String(error);
      assert.equal(text.includes('SENTINEL-TOKEN'), false);
      assert.equal(text.includes('SENTINEL-KEY'), false);
      assert.match(text, /redacted/);
      return true;
    });
  });
});

function flatInput(result: { performanceQuote: string | null }): { nowMs: number; maxMarkAgeMs: number; baselineAtMs: number; baselineUsd: string; currentUsd: string; baselineBids: Record<string, never>; currentBids: Record<string, never>; baselineBase: Record<string, never>; currentBase: Record<string, never>; externalFlowsQuote: string | null } {
  void result;
  return { nowMs: 2_000, maxMarkAgeMs: 1_000, baselineAtMs: 1_000, baselineUsd: '100', currentUsd: '150', baselineBids: {}, currentBids: {}, baselineBase: {}, currentBase: {}, externalFlowsQuote: '0' };
}

function pem(): string {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return privateKey.export({ type: 'sec1', format: 'pem' }).toString();
}
