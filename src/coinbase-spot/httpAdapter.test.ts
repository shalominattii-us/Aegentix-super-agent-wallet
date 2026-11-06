import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { describe, it } from 'node:test';
import { createCoinbaseHttpAdapter, MUTATION_ARM_PHRASE } from './http.ts';
import { authorizeOperator, guardedRead } from './httpRoutes.ts';
import { createOrchestrator } from './orchestrator.ts';
import { MemoryJournal } from './journal.ts';
import { attributeHolds } from './reservation.ts';
import type { FetchLike } from './http.ts';
import type { OpenOrder } from './types.ts';

const PORTFOLIO = '11111111-1111-4111-8111-111111111111';
const KEY_NAME = 'organizations/org/apiKeys/key';

function key() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return { keyName: KEY_NAME, keySecret: privateKey.export({ type: 'sec1', format: 'pem' }).toString() };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function claims(authorization: string): { uri: string } {
  const token = authorization.slice('Bearer '.length);
  const part = token.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

function account(available: string, hold: string) {
  return {
    uuid: 'acct-usd',
    currency: 'USD',
    retail_portfolio_id: PORTFOLIO,
    available_balance: { value: available, currency: 'USD' },
    hold: { value: hold, currency: 'USD' },
  };
}

function order(id: string, hold: string | null, base = '1', price = '10'): Record<string, unknown> {
  return {
    order_id: id,
    client_order_id: `client-${id}`,
    product_id: 'BTC-USD',
    side: 'BUY',
    status: 'OPEN',
    retail_portfolio_id: PORTFOLIO,
    filled_size: '0',
    outstanding_hold_amount: hold,
    order_configuration: { limit_limit_gtc: { base_size: base, limit_price: price, post_only: false } },
  };
}

describe('HTTP contract', () => {
  it('signs the path only and parses paginated accounts, fees, book, orders, fills, and preview', async () => {
    const calls: { url: string; method: string; authorization: string; body: string | undefined }[] = [];
    const fetch: FetchLike = async (url, init) => {
      const method = init?.method ?? 'GET';
      const authorization = String(init?.headers && (init.headers as Record<string, string>).Authorization || '');
      calls.push({ url, method, authorization, body: typeof init?.body === 'string' ? init.body : undefined });
      const parsed = new URL(url);
      if (parsed.pathname === '/api/v3/brokerage/accounts') {
        assert.equal(claims(authorization).uri, 'GET api.coinbase.com/api/v3/brokerage/accounts');
        assert.equal(parsed.searchParams.get('retail_portfolio_id'), PORTFOLIO);
        if (!parsed.searchParams.get('cursor')) {
          return json(200, { accounts: [account('40', '0')], has_next: true, cursor: 'page-2' });
        }
        assert.equal(parsed.searchParams.get('cursor'), 'page-2');
        return json(200, {
          accounts: [{ ...account('60', '0'), uuid: 'acct-usd-2', currency: 'BTC', available_balance: { value: '0.5', currency: 'BTC' }, hold: { value: '0', currency: 'BTC' } }],
          has_next: false,
        });
      }
      if (parsed.pathname === '/api/v3/brokerage/transaction_summary') {
        assert.equal(claims(authorization).uri, 'GET api.coinbase.com/api/v3/brokerage/transaction_summary');
        assert.equal(parsed.searchParams.get('product_type'), 'SPOT');
        return json(200, { fee_tier: { maker_fee_rate: '0.004', taker_fee_rate: '0.006' }, total_fees: '1.25' });
      }
      if (parsed.pathname === '/api/v3/brokerage/products/BTC-USD') {
        return json(200, {
          product_id: 'BTC-USD', product_type: 'SPOT', trading_disabled: false,
          base_increment: '0.00000001', quote_increment: '0.01', price_increment: '0.01',
          base_min_size: '0.00001', quote_min_size: '1',
        });
      }
      if (parsed.pathname === '/api/v3/brokerage/product_book') {
        assert.equal(parsed.searchParams.get('product_id'), 'BTC-USD');
        assert.equal(claims(authorization).uri, 'GET api.coinbase.com/api/v3/brokerage/product_book');
        return json(200, { pricebook: { product_id: 'BTC-USD', time: new Date().toISOString(), bids: [{ price: '9', size: '1' }], asks: [{ price: '10', size: '1' }] } });
      }
      if (parsed.pathname === '/api/v3/brokerage/orders/historical/batch') {
        return json(200, { orders: [], has_next: false });
      }
      if (parsed.pathname === '/api/v3/brokerage/orders/preview') {
        assert.equal(claims(authorization).uri, 'POST api.coinbase.com/api/v3/brokerage/orders/preview');
        const body = JSON.parse(String(init?.body));
        assert.equal(body.leverage, undefined);
        assert.equal(body.order_configuration.limit_limit_gtc.base_size, '1');
        return json(200, { base_size: '1', order_total: '10.06', commission_total: '0.06', errs: [] });
      }
      if (parsed.pathname === '/api/v3/brokerage/orders/historical/fills') {
        return json(200, { fills: [{ entry_id: 'fill-1', order_id: 'o1', product_id: 'BTC-USD', side: 'BUY', size: '1', price: '10', commission: '0.06', retail_portfolio_id: PORTFOLIO, trade_time: '2026-01-01T00:00:00Z' }], has_next: false });
      }
      return json(404, { message: 'unexpected' });
    };
    const adapter = createCoinbaseHttpAdapter({
      fetch,
      credentials: { load: () => key() },
      portfolioId: PORTFOLIO,
      now: () => 1_700_000_000_000,
    });
    const accounts = await adapter.listAccounts();
    assert.equal(accounts.length, 2);
    const fees = await adapter.getFeeSummary();
    assert.equal(fees.takerFeeRate, '0.006');
    const product = await adapter.getProduct('BTC-USD');
    assert.equal(product.baseMinSize, '0.00001');
    const book = await adapter.getBook('BTC-USD');
    assert.equal(book.bestAsk, '10');
    const preview = await adapter.previewOrder({ portfolioId: PORTFOLIO, productId: 'BTC-USD', side: 'BUY', baseSize: '1', limitPrice: '10' });
    assert.equal(preview.commissionCurrency, 'USD');
    assert.equal(preview.orderTotal, '10.06');
    const fills = await adapter.listFills('o1');
    assert.equal(fills[0]?.fillId, 'fill-1');
    assert.equal(calls.some((call) => call.url.includes('/orders') && call.method === 'POST' && !call.url.includes('preview')), false);
  });

  it('retries one short 429, fails closed without Retry-After, and times out', async () => {
    let limited = 0;
    const fetch: FetchLike = async (url, init) => {
      if (url.includes('/accounts')) {
        limited += 1;
        if (limited === 1) return json(429, { message: 'slow' }, { 'retry-after': '0' });
        return json(200, { accounts: [], has_next: false });
      }
      return json(200, {});
    };
    const adapter = createCoinbaseHttpAdapter({ fetch, credentials: { load: () => key() }, portfolioId: PORTFOLIO, sleep: async () => undefined });
    assert.equal((await adapter.listAccounts()).length, 0);
    assert.equal(limited, 2);

    const once: FetchLike = async () => json(429, { message: 'slow' });
    const blocked = createCoinbaseHttpAdapter({ fetch: once, credentials: { load: () => key() }, portfolioId: PORTFOLIO });
    await assert.rejects(() => blocked.listAccounts(), /429/);

    const hanging: FetchLike = (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
    const slow = createCoinbaseHttpAdapter({ fetch: hanging, credentials: { load: () => key() }, portfolioId: PORTFOLIO, timeoutMs: 20 });
    await assert.rejects(() => slow.getFeeSummary(), /timed out/);
  });

  it('does not send create or cancel even when the arming phrase matches', async () => {
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls += 1;
      return json(200, {});
    };
    const disarmed = createCoinbaseHttpAdapter({ fetch, credentials: { load: () => key() }, portfolioId: PORTFOLIO });
    await assert.rejects(() => disarmed.submitOrder({ portfolioId: PORTFOLIO, productId: 'BTC-USD', side: 'BUY', baseSize: '1', limitPrice: '10', clientOrderId: 'c1' }), /disarmed/);
    const armed = createCoinbaseHttpAdapter({
      fetch,
      credentials: { load: () => key() },
      portfolioId: PORTFOLIO,
      mutationPolicy: { armed: true, confirmPhrase: MUTATION_ARM_PHRASE, portfolioId: PORTFOLIO },
    });
    await assert.rejects(() => armed.cancelOrders(['order-1']), /cannot submit/i);
    const wrong = createCoinbaseHttpAdapter({
      fetch,
      credentials: { load: () => key() },
      portfolioId: PORTFOLIO,
      mutationPolicy: { armed: true, confirmPhrase: 'yes', portfolioId: PORTFOLIO },
    });
    await assert.rejects(() => wrong.submitOrder({ portfolioId: PORTFOLIO, productId: 'BTC-USD', side: 'BUY', baseSize: '1', limitPrice: '10', clientOrderId: 'c1' }), /disarmed/);
    assert.equal(calls, 0);
  });

  it('blocks ambiguous overlapping holds and allows an exact sum without subtracting it twice', async () => {
    const base = (holdAmount: string): OpenOrder => ({
      orderId: 'a', clientOrderId: 'client-a', portfolioId: PORTFOLIO, productId: 'BTC-USD', side: 'BUY', status: 'OPEN',
      limitPrice: '10', baseSize: '1', filledBase: '0', outstandingHoldAmount: holdAmount,
    });
    const second: OpenOrder = { ...base('25'), orderId: 'b', clientOrderId: 'client-b', baseSize: '2.5' };
    const account = { accountId: 'acct-usd', portfolioId: PORTFOLIO, currency: 'USD' as const, available: '100', hold: '35' };
    assert.equal(attributeHolds(account, [base('10'), second]).ok, true);
    assert.equal(attributeHolds({ ...account, hold: '30' }, [base('10'), second]).ok, false);

    const calls: string[] = [];
    const fetch: FetchLike = async (url, init) => {
      calls.push(new URL(url).pathname);
      const path = new URL(url).pathname;
      if (path.endsWith('/accounts')) return json(200, { accounts: [{ uuid: 'acct-usd', currency: 'USD', retail_portfolio_id: PORTFOLIO, available_balance: { value: '100', currency: 'USD' }, hold: { value: '35', currency: 'USD' } }], has_next: false });
      if (path.endsWith('/products/BTC-USD')) return json(200, { product_id: 'BTC-USD', product_type: 'SPOT', base_increment: '0.00000001', quote_increment: '0.01', price_increment: '0.01', base_min_size: '0.00001', quote_min_size: '1' });
      if (path.endsWith('/product_book')) return json(200, { pricebook: { time: new Date().toISOString(), bids: [{ price: '9', size: '1' }], asks: [{ price: '10', size: '2' }] } });
      if (path.endsWith('/historical/batch')) return json(200, { orders: [order('a', '10', '1', '10'), order('b', '25', '2.5', '10')], has_next: false });
      if (path.endsWith('/preview')) {
        const requested = JSON.parse(String(init?.body)).order_configuration.limit_limit_gtc.base_size;
        return json(200, { base_size: requested, order_total: String(Number(requested) * 10), commission_total: '0', errs: [] });
      }
      return json(404, {});
    };
    const orchestrator = createOrchestrator({
      adapter: createCoinbaseHttpAdapter({ fetch, credentials: { load: () => key() }, portfolioId: PORTFOLIO }),
      portfolioId: PORTFOLIO,
      journal: new MemoryJournal(),
      now: () => Date.now(),
    });
    await orchestrator.releaseKillSwitch('test');
    const staged = await orchestrator.stage({
      clientIntentId: 'new-buy', productId: 'BTC-USD', side: 'BUY', baseSize: '7', limitPrice: '10', maxSlippageBps: 0, maxQuoteAgeMs: 5_000,
    });
    assert.equal(staged.ok, true);
    if (staged.ok) assert.equal(staged.stagedBaseSize, '7');

    const ambiguous = createCoinbaseHttpAdapter({
      fetch: async (url) => {
        const path = new URL(url).pathname;
        if (path.endsWith('/accounts')) return json(200, { accounts: [{ uuid: 'acct-usd', currency: 'USD', retail_portfolio_id: PORTFOLIO, available_balance: { value: '100', currency: 'USD' }, hold: { value: '30', currency: 'USD' } }], has_next: false });
        if (path.endsWith('/products/BTC-USD')) return json(200, { product_id: 'BTC-USD', product_type: 'SPOT', base_increment: '0.00000001', quote_increment: '0.01', price_increment: '0.01', base_min_size: '0.00001', quote_min_size: '1' });
        if (path.endsWith('/product_book')) return json(200, { pricebook: { time: new Date().toISOString(), bids: [{ price: '9', size: '1' }], asks: [{ price: '10', size: '1' }] } });
        if (path.endsWith('/historical/batch')) return json(200, { orders: [order('a', '10'), order('b', '25')], has_next: false });
        return json(200, { base_size: '1', order_total: '10', commission_total: '0', errs: [] });
      },
      credentials: { load: () => key() },
      portfolioId: PORTFOLIO,
    });
    const blocked = createOrchestrator({ adapter: ambiguous, portfolioId: PORTFOLIO, journal: new MemoryJournal(), now: () => Date.now() });
    await blocked.releaseKillSwitch('test');
    const result = await blocked.stage({
      clientIntentId: 'blocked', productId: 'BTC-USD', side: 'BUY', baseSize: '1', limitPrice: '10', maxSlippageBps: 0, maxQuoteAgeMs: 5_000,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'HOLD_AMBIGUOUS');
  });

  it('fail-closes a stale book and stays behind the kill switch', async () => {
    let calls = 0;
    const fetch: FetchLike = async (url) => {
      calls += 1;
      const path = new URL(url).pathname;
      if (path.endsWith('/products/BTC-USD')) return json(200, { product_id: 'BTC-USD', product_type: 'SPOT', base_increment: '0.00000001', quote_increment: '0.01', price_increment: '0.01', base_min_size: '0.00001', quote_min_size: '1' });
      if (path.endsWith('/product_book')) return json(200, { pricebook: { time: '2020-01-01T00:00:00Z', bids: [{ price: '9', size: '1' }], asks: [{ price: '10', size: '1' }] } });
      return json(200, { accounts: [], orders: [], has_next: false });
    };
    const orchestrator = createOrchestrator({
      adapter: createCoinbaseHttpAdapter({ fetch, credentials: { load: () => key() }, portfolioId: PORTFOLIO }),
      portfolioId: PORTFOLIO,
      journal: new MemoryJournal(),
      now: () => Date.parse('2026-01-01T00:00:00Z'),
    });
    const killed = await orchestrator.stage({
      clientIntentId: 'k', productId: 'BTC-USD', side: 'BUY', baseSize: '1', limitPrice: '10', maxSlippageBps: 0, maxQuoteAgeMs: 1_000,
    });
    assert.equal(killed.ok, false);
    if (!killed.ok) assert.equal(killed.code, 'KILL_SWITCH');
    assert.equal(calls, 0);
    await orchestrator.releaseKillSwitch('test');
    const stale = await orchestrator.stage({
      clientIntentId: 's', productId: 'BTC-USD', side: 'BUY', baseSize: '1', limitPrice: '10', maxSlippageBps: 0, maxQuoteAgeMs: 1_000,
    });
    assert.equal(stale.ok, false);
    if (!stale.ok) assert.equal(stale.code, 'STALE_QUOTE');
  });

  it('keeps network reads disabled and requires the operator token', async () => {
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls += 1;
      return json(200, {});
    };
    const env = { COINBASE_SPOT_OPERATOR_TOKEN: 'operator-token-value', COINBASE_PORTFOLIO_ID: PORTFOLIO, COINBASE_API_KEY_NAME: KEY_NAME, COINBASE_API_KEY_SECRET: 'secret' };
    assert.equal((await guardedRead(env, fetch, undefined)).status, 401);
    assert.equal((await guardedRead(env, fetch, 'Bearer operator-token-value')).status, 403);
    assert.equal(calls, 0);
    assert.equal(authorizeOperator('Bearer short', { COINBASE_SPOT_OPERATOR_TOKEN: 'short' })?.status, 503);
  });
});
