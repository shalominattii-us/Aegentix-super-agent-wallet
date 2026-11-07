import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { buildAdvancedTradeJwt, verifyAdvancedTradeJwt } from './auth.ts';
import { createDisabledAdapter } from './adapter.ts';
import { add, cmp } from './decimal.ts';
import { FileJournal, MemoryJournal } from './journal.ts';
import { MockCoinbaseExchange } from './mockExchange.ts';
import { createOrchestrator } from './orchestrator.ts';
import { applyFill, emptyPnl, markToMarket } from './pnl.ts';
import { spendableBalance } from './reservation.ts';
import { OMNICYBERDEX_UNAVAILABLE } from './unavailable.ts';
import type { AccountSnapshot, OperatorIntent, OrderSnapshot, ProductMetadata, SpotProductId } from './types.ts';

const PORTFOLIO = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function product(id: SpotProductId, baseMin = '0.00001'): ProductMetadata {
  return {
    productId: id,
    productType: 'SPOT',
    tradingDisabled: false,
    baseIncrement: '0.00000001',
    quoteIncrement: '0.01',
    priceIncrement: '0.01',
    baseMinSize: baseMin,
    quoteMinSize: '1',
  };
}

function accounts(usdAvailable: string, usdHold = '0', btc = '1'): AccountSnapshot[] {
  return [
    { accountId: 'usd-1', portfolioId: PORTFOLIO, currency: 'USD', available: usdAvailable, hold: usdHold },
    { accountId: 'btc-1', portfolioId: PORTFOLIO, currency: 'BTC', available: btc, hold: '0' },
    { accountId: 'xrp-1', portfolioId: PORTFOLIO, currency: 'XRP', available: '100', hold: '0' },
    { accountId: 'foreign', portfolioId: OTHER, currency: 'USD', available: '999999', hold: '0' },
  ];
}

function exchange(overrides: Partial<{ usd: string; hold: string; fee: string; btc: string; baseMin: string }> = {}) {
  const now = Date.now();
  return new MockCoinbaseExchange({
    portfolioId: PORTFOLIO,
    accounts: accounts(overrides.usd ?? '1000', overrides.hold ?? '0', overrides.btc ?? '1'),
    products: [product('BTC-USD', overrides.baseMin), product('XRP-USD', '0.1')],
    books: {
      'BTC-USD': { bestBid: '59990', bestAsk: '60000', observedAtMs: now },
      'XRP-USD': { bestBid: '0.50', bestAsk: '0.51', observedAtMs: now },
    },
    commissionRate: overrides.fee ?? '0',
    now: () => now,
  });
}

function intent(patch: Partial<OperatorIntent> = {}): OperatorIntent {
  return {
    clientIntentId: 'intent-1',
    productId: 'BTC-USD',
    side: 'BUY',
    baseSize: '0.01',
    limitPrice: '60000',
    maxSlippageBps: 0,
    maxQuoteAgeMs: 5_000,
    evidenceRef: 'research-note-1',
    ...patch,
  };
}

async function ready(ex = exchange()) {
  const orchestrator = createOrchestrator({ adapter: ex, portfolioId: PORTFOLIO, journal: new MemoryJournal(), now: () => Date.now() });
  await orchestrator.releaseKillSwitch('test');
  return { orchestrator, ex };
}

describe('auth', () => {
  it('signs and verifies an ES256 JWT with the Advanced Trade claim set', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const pem = privateKey.export({ type: 'sec1', format: 'pem' }).toString();
    const key = { keyName: 'organizations/org/apiKeys/key', keySecret: pem };
    const signed = buildAdvancedTradeJwt({
      key,
      method: 'get',
      pathAndQuery: '/api/v3/brokerage/accounts',
      nowSeconds: 1_700_000_000,
      nonce: 'ab'.repeat(16),
    });
    assert.equal(signed.algorithm, 'ES256');
    assert.equal(signed.uri, 'GET api.coinbase.com/api/v3/brokerage/accounts');
    const checked = verifyAdvancedTradeJwt(signed.token, pem);
    assert.equal(checked.header.alg, 'ES256');
    assert.equal(checked.header.kid, key.keyName);
    assert.equal(checked.header.nonce, 'ab'.repeat(16));
    assert.equal(checked.payload.iss, 'cdp');
    assert.equal(checked.payload.sub, key.keyName);
    assert.equal(checked.payload.exp, 1_700_000_120);
    assert.equal('aud' in checked.payload, false);
  });

  it('signs Ed25519 for 64-byte and 32-byte secrets and rejects a query in the uri', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const spki = publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
    const pkcs8 = privateKey.export({ format: 'der', type: 'pkcs8' }) as Buffer;
    const secret = Buffer.concat([pkcs8.subarray(pkcs8.length - 32), spki.subarray(spki.length - 32)]).toString('base64');
    const key = { keyName: 'organizations/org/apiKeys/ed', keySecret: secret };
    const signed = buildAdvancedTradeJwt({ key, method: 'POST', pathAndQuery: '/api/v3/brokerage/orders/preview', nowSeconds: 10, nonce: 'cd'.repeat(16) });
    assert.equal(signed.algorithm, 'EdDSA');
    const checked = verifyAdvancedTradeJwt(signed.token, secret);
    assert.deepEqual(checked.payload.aud, ['cdp_service']);
    const seedOnly = buildAdvancedTradeJwt({
      key: { ...key, keySecret: Buffer.from(secret, 'base64').subarray(0, 32).toString('base64') },
      method: 'GET',
      pathAndQuery: '/api/v3/brokerage/accounts',
      nowSeconds: 10,
      nonce: 'ef'.repeat(16),
    });
    assert.equal(seedOnly.algorithm, 'EdDSA');
    assert.throws(() => buildAdvancedTradeJwt({ key, method: 'GET', pathAndQuery: '/api/v3/brokerage/accounts?limit=1' }), /query string/);
    assert.throws(() => buildAdvancedTradeJwt({ key: { ...key, keySecret: Buffer.alloc(16).toString('base64') }, method: 'GET', pathAndQuery: '/api/v3/brokerage/accounts' }), /32 bytes/);
  });

  it('rejects a non-P-256 EC key instead of guessing ES256', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
    const pem = privateKey.export({ type: 'sec1', format: 'pem' }).toString();
    assert.throws(
      () => buildAdvancedTradeJwt({ key: { keyName: 'organizations/org/apiKeys/k', keySecret: pem }, method: 'GET', pathAndQuery: '/x' }),
      /P-256/,
    );
  });
});

describe('funds and sizing', () => {
  it('does not subtract venue holds that are already absent from available', () => {
    const spendable = spendableBalance(
      { accountId: 'usd-1', portfolioId: PORTFOLIO, currency: 'USD', available: '800', hold: '200' },
      [],
    );
    assert.equal(spendable.spendable, '800');
  });

  it('sizes from the portfolio free balance and ignores another portfolio', async () => {
    const ex = exchange({ usd: '800', hold: '200' });
    ex.seedOpenOrder({
      orderId: 'existing',
      clientOrderId: 'older',
      portfolioId: PORTFOLIO,
      productId: 'BTC-USD',
      side: 'BUY',
      status: 'OPEN',
      limitPrice: '100',
      baseSize: '2',
      filledBase: '0',
      averageFilledPrice: null,
      totalFees: '0',
      feeCurrency: null,
      outstandingHoldAmount: '200',
    } satisfies OrderSnapshot);
    const { orchestrator: orch } = { orchestrator: createOrchestrator({ adapter: ex, portfolioId: PORTFOLIO, journal: new MemoryJournal(), now: () => Date.now() }) };
    await orch.releaseKillSwitch('test');
    const staged = await orch.stage(intent({ baseSize: '7', limitPrice: '100', maxSlippageBps: 0 }));
    assert.equal(staged.ok, true);
    if (staged.ok) assert.equal(staged.stagedBaseSize, '7');
  });

  it('reduces a buy once so the preview fee fits the free balance', async () => {
    const { orchestrator } = await ready(exchange({ usd: '100', fee: '0.006' }));
    const staged = await orchestrator.stage(intent({ baseSize: '0.01', limitPrice: '50000', maxSlippageBps: 0 }));
    assert.equal(staged.ok, true);
    if (!staged.ok) return;
    assert.equal(staged.stagedBaseSize, '0.001988');
    assert.equal(cmp(staged.preview.orderTotal, '100') <= 0, true);
    assert.equal(cmp(staged.preview.commissionTotal, '0') > 0, true);
  });

  it('serializes concurrent reservations so they cannot exceed free funds', async () => {
    const ex = exchange({ usd: '100', baseMin: '8' });
    ex.previewDelayMs = 25;
    ex.setBook('BTC-USD', { bestBid: '9', bestAsk: '10', observedAtMs: Date.now() });
    const orchestrator = createOrchestrator({ adapter: ex, portfolioId: PORTFOLIO, journal: new MemoryJournal(), now: () => Date.now() });
    await orchestrator.releaseKillSwitch('test');
    const [first, second] = await Promise.all([
      orchestrator.stage(intent({ clientIntentId: 'a', baseSize: '8', limitPrice: '10', maxSlippageBps: 0 })),
      orchestrator.stage(intent({ clientIntentId: 'b', baseSize: '8', limitPrice: '10', maxSlippageBps: 0 })),
    ]);
    const oks = [first, second].filter((result) => result.ok);
    const fails = [first, second].filter((result) => !result.ok);
    assert.equal(oks.length, 1);
    assert.equal(fails.length, 1);
    if (!fails[0].ok) assert.equal(fails[0].code, 'INSUFFICIENT_FUNDS');
  });
});

describe('execution controls', () => {
  it('stays disarmed and refuses live submission', async () => {
    const orchestrator = createOrchestrator({
      adapter: createDisabledAdapter(),
      portfolioId: PORTFOLIO,
      journal: new MemoryJournal(),
    });
    const blocked = await orchestrator.stage(intent());
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.code, 'KILL_SWITCH');
    await orchestrator.releaseKillSwitch('reads only');
    const disabled = await orchestrator.stage(intent());
    assert.equal(disabled.ok, false);
    if (!disabled.ok) assert.equal(disabled.code, 'NETWORK_DISABLED');
    await assert.rejects(async () => createDisabledAdapter().submitOrder({
      portfolioId: PORTFOLIO,
      productId: 'BTC-USD',
      side: 'BUY',
      baseSize: '0.01',
      limitPrice: '1',
      clientOrderId: 'x',
    }), /unavailable/i);
  });

  it('requires operator slippage and replays an intent without a second reservation', async () => {
    const { orchestrator } = await ready();
    const missing = await orchestrator.stage(intent({ maxSlippageBps: undefined as unknown as number }));
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.code, 'SLIPPAGE_REQUIRED');
    const staged = await orchestrator.stage(intent());
    const replay = await orchestrator.stage(intent());
    assert.equal(staged.ok && replay.ok && replay.replayed, true);
    const third = await orchestrator.stage(intent({ clientIntentId: 'intent-2', baseSize: '0.01' }));
    assert.equal(third.ok, true);
    if (staged.ok && third.ok) {
      const reserved = add(staged.reservation?.amount ?? '0', third.reservation?.amount ?? '0');
      assert.equal(cmp(reserved, '1000') <= 0, true);
    }
  });

  it('fail-closes an unknown status and does not resubmit it', async () => {
    const { orchestrator, ex } = await ready();
    assert.equal((await orchestrator.stage(intent())).ok, true);
    ex.nextStatusOverride = 'GARBLED';
    await assert.rejects(() => orchestrator.submit('intent-1'), /not a known terminal/);
    const again = await orchestrator.stage(intent());
    assert.equal(again.ok, false);
    if (!again.ok) assert.equal(again.code, 'UNKNOWN_STATUS');
    assert.equal(ex.orderCount(), 1);
  });

  it('reconciles a mock fill into FIFO realized pnl and leaves unrealized unknown without a mark', async () => {
    const ex = exchange({ usd: '10000', fee: '0.001', btc: '0' });
    const orchestrator = createOrchestrator({ adapter: ex, portfolioId: PORTFOLIO, journal: new MemoryJournal(), now: () => Date.now() });
    await orchestrator.releaseKillSwitch('test');
    assert.equal((await orchestrator.stage(intent({ baseSize: '0.01', limitPrice: '60000' }))).ok, true);
    await orchestrator.submit('intent-1');
    const orderId = ex.firstOrderId();
    ex.fillOrder(orderId, '60000');
    const report = await orchestrator.reconcile();
    assert.equal(report.fillsApplied, 1);
    const unknownMark = await orchestrator.pnl();
    assert.equal(unknownMark['BTC-USD'].unrealized.status, 'unknown');
    const marked = await orchestrator.pnl({ 'BTC-USD': '61000' });
    assert.equal(marked['BTC-USD'].unrealized.status, 'known');
    if (marked['BTC-USD'].unrealized.status === 'known') {
      assert.equal(cmp(marked['BTC-USD'].unrealized.quote, '0') > 0, true);
    }
    assert.equal(marked['BTC-USD'].realizedQuote, '0');
  });
});

describe('pnl and journal', () => {
  it('realizes FIFO profit after a sell and leaves an uncovered sell without a zero basis', () => {
    let state = emptyPnl();
    state = applyFill(state, {
      fillId: 'b',
      orderId: 'o',
      clientOrderId: 'c',
      productId: 'BTC-USD',
      side: 'BUY',
      baseSize: '0.01',
      price: '100',
      commission: '0.10',
      commissionCurrency: 'USD',
      portfolioId: PORTFOLIO,
      observedAt: '2026-01-01T00:00:00Z',
    });
    state = applyFill(state, {
      fillId: 's',
      orderId: 'o2',
      clientOrderId: 'c2',
      productId: 'BTC-USD',
      side: 'SELL',
      baseSize: '0.01',
      price: '150',
      commission: '0.10',
      commissionCurrency: 'USD',
      portfolioId: PORTFOLIO,
      observedAt: '2026-01-01T00:01:00Z',
    });
    assert.equal(state.realizedNetQuote, '0.3');
    const marked = markToMarket(state, 'BTC-USD', null);
    assert.equal(marked.unrealized.status, 'unknown');
    const extra = applyFill(state, {
      fillId: 'extra',
      orderId: 'o3',
      clientOrderId: 'c3',
      productId: 'BTC-USD',
      side: 'SELL',
      baseSize: '0.01',
      price: '150',
      commission: '0',
      commissionCurrency: 'USD',
      portfolioId: PORTFOLIO,
      observedAt: '2026-01-01T00:02:00Z',
    });
    assert.equal(extra.realizedNetQuote, '0.3');
    assert.equal(extra.unknownBasisSold['BTC-USD'], '0.01');
    assert.equal(extra.costBasisIncomplete, true);
  });

  it('reloads a file journal without dropping a corrupt line quietly', async () => {
    const file = path.join(os.tmpdir(), `coinbase-spot-${Date.now()}.jsonl`);
    const journal = new FileJournal(file);
    await journal.append({ type: 'kill', at: '2026-01-01T00:00:00Z', engaged: false, reason: 'test' });
    const loaded = await new FileJournal(file).load();
    assert.equal(loaded.killSwitchEngaged, false);
    fs.appendFileSync(file, '{not-json}\n');
    await assert.rejects(() => new FileJournal(file).load(), /not readable/);
    fs.rmSync(file, { force: true });
  });
});

describe('removed fabricated execution', () => {
  it('publishes an unavailable OmniCyberDEX result with no profit', () => {
    assert.equal(OMNICYBERDEX_UNAVAILABLE.implemented, false);
    assert.equal(OMNICYBERDEX_UNAVAILABLE.filled, false);
    assert.equal(OMNICYBERDEX_UNAVAILABLE.pnlUsd, null);
    assert.equal(OMNICYBERDEX_UNAVAILABLE.status, 'UNAVAILABLE');
  });
});
