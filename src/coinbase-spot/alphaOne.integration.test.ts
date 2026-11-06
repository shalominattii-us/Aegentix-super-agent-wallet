import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { ACCREDITED_TRADER, ALPHA_ONE_CONTRACT_VERSION, readRelayConfig, requestHash, signEnvelope, signedBodyHash, type ExecutionIntent, type TraderAck, type TraderFillNotice } from './alphaOneContract.ts';
import { createAlphaOneCoordinator, DisabledRelayTransport } from './alphaOneCoordinator.ts';
import { createReceiverReference } from './alphaOneReceiverReference.ts';
import { FileRelayStore, MemoryRelayStore } from './alphaOneStore.ts';
import { createDisabledAdapter } from './adapter.ts';

const KEY = 'relay-signing-key';
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const ALLOWED = 'https://allowlisted.example/not-a-real-alpha-one-path';

function intent(id = 'intent-1', baseSize = '0.01'): ExecutionIntent {
  return { contractVersion: ALPHA_ONE_CONTRACT_VERSION, intentId: id, accountId: ACCOUNT, productId: 'BTC-USD', side: 'BUY', baseSize, limitPrice: '60000' };
}

function linked(now = () => 1_000) {
  const receiverStore = new MemoryRelayStore();
  const senderStore = new MemoryRelayStore();
  const receiver = createReceiverReference({ store: receiverStore, signingKey: KEY, now, maxSkewMs: 0 });
  const transport = {
    calls: 0,
    last: null as Parameters<typeof receiver.accept>[0] | null,
    async deliver(envelope: Parameters<typeof receiver.accept>[0]) {
      this.calls += 1;
      this.last = envelope;
      return receiver.accept(envelope);
    },
  };
  const coordinator = createAlphaOneCoordinator({
    store: senderStore,
    ownerId: ACCREDITED_TRADER,
    now,
    leaseMs: 1_000,
    destination: ALLOWED,
    allowlist: [ALLOWED],
    signingKey: KEY,
    handshakeAccepted: true,
    transport,
    maxSkewMs: 0,
  });
  return { coordinator, receiver, receiverStore, senderStore, transport, now };
}

describe('alpha one relay', () => {
  it('fails closed without an allowlisted destination and does not deliver', async () => {
    const transport = new DisabledRelayTransport();
    const coordinator = createAlphaOneCoordinator({
      store: new MemoryRelayStore(),
      ownerId: ACCREDITED_TRADER,
      now: () => 1_000,
      leaseMs: 1_000,
      destination: null,
      allowlist: [],
      signingKey: null,
      transport,
    });
    const result = await coordinator.dispatch(intent());
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'INTEGRATION_BLOCKED');
    assert.equal(coordinator.status().integrationBlocked, true);
    assert.equal(coordinator.status().liveExecutionReady, false);
    assert.equal(coordinator.status().collisionFreedomGuaranteed, false);
    assert.equal(transport.calls, 0);
    assert.equal(readRelayConfig({}).integrationBlocked, true);
  });

  it('serializes one client order id across a race, a conflicting payload, and a restart', async () => {
    const file = path.join(os.tmpdir(), `alpha-one-${Date.now()}.jsonl`);
    const now = () => 5_000;
    const first = createAlphaOneCoordinator({
      store: new FileRelayStore(file),
      ownerId: ACCREDITED_TRADER,
      now,
      leaseMs: 1_000,
      destination: ALLOWED,
      allowlist: [ALLOWED],
      signingKey: KEY,
      handshakeAccepted: true,
      transport: new DisabledRelayTransport(),
    });
    const [left, right] = await Promise.all([first.propose(intent()), first.propose(intent())]);
    assert.equal(left.ok && right.ok, true);
    if (left.ok && right.ok) assert.equal(left.record.clientOrderId, right.record.clientOrderId);
    const conflict = await first.propose(intent('intent-1', '1'));
    assert.equal(conflict.ok, false);
    if (!conflict.ok) assert.equal(conflict.code, 'INTENT_CONFLICT');
    const restarted = createAlphaOneCoordinator({
      store: new FileRelayStore(file),
      ownerId: ACCREDITED_TRADER,
      now,
      leaseMs: 1_000,
      destination: ALLOWED,
      allowlist: [ALLOWED],
      signingKey: KEY,
      handshakeAccepted: true,
    });
    const again = await restarted.propose(intent());
    assert.equal(again.ok && left.ok && again.record.clientOrderId === left.record.clientOrderId && again.created === false, true);
    fs.rmSync(file, { force: true });
  });

  it('covers replay, delayed ack, lost ack, stale fence, and a foreign actor', async () => {
    let clock = 8_000;
    const now = () => clock;
    const { coordinator, receiver, receiverStore, transport } = linked(now);
    const sent = await coordinator.dispatch(intent());
    assert.equal(sent.ok, true);
    if (!sent.ok) return;
    const orderId = sent.record.clientOrderId;
    assert.equal(sent.ack?.venueStatus, 'not_sent');
    assert.equal(transport.calls, 1);

    const replay = transport.last ? receiver.accept(transport.last) : null;
    assert.equal(replay?.disposition, 'replay');

    const lostTransport = { calls: 0, async deliver() { this.calls += 1; return null; } };
    const lost = createAlphaOneCoordinator({
      store: new MemoryRelayStore(), ownerId: ACCREDITED_TRADER, now, leaseMs: 5_000, destination: ALLOWED, allowlist: [ALLOWED], signingKey: KEY, handshakeAccepted: true, transport: lostTransport, maxSkewMs: 0,
    });
    const dropped = await lost.dispatch(intent('lost'));
    assert.equal(dropped.ok, false);
    if (!dropped.ok) assert.equal(dropped.code, 'LOST_ACK');
    const blocked = await lost.dispatch(intent('lost'));
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.code, 'DISPATCH_UNKNOWN');
    assert.equal(lostTransport.calls, 1);
    assert.equal(blocked.ok === false && blocked.clientOrderId === dropped.clientOrderId, true);

    const ack: TraderAck = { contractVersion: ALPHA_ONE_CONTRACT_VERSION, intentId: 'lost', accountId: ACCOUNT, productId: 'BTC-USD', clientOrderId: dropped.ok ? '' : dropped.clientOrderId ?? '', payloadHash: '', epoch: 1, ownerId: ACCREDITED_TRADER, disposition: 'accepted_reference', venueStatus: 'accepted' };
    ack.payloadHash = signedBodyHash(ack);
    const delayed = await lost.observeAck(signEnvelope(ack, ack.payloadHash, KEY, clock));
    assert.equal(delayed.ok, true);

    const higherBody = { intent: intent('fence'), epoch: 2, ownerId: ACCREDITED_TRADER };
    const accepted = receiver.accept(signEnvelope(higherBody, requestHash(higherBody), KEY, clock));
    assert.equal(accepted.disposition, 'accepted_reference');
    const lowerBody = { intent: intent('fence'), epoch: 1, ownerId: ACCREDITED_TRADER };
    const stale = receiver.accept(signEnvelope(lowerBody, requestHash(lowerBody), KEY, clock));
    assert.equal(stale.disposition, 'fenced');
    assert.equal(stale.clientOrderId, accepted.clientOrderId);

    const foreignBody = { intent: intent('foreign'), epoch: 9, ownerId: 'other_bot' };
    const foreign = receiver.accept(signEnvelope(foreignBody, requestHash(foreignBody), KEY, clock));
    assert.equal(foreign.disposition, 'foreign_actor');
    assert.equal([...receiverStore.load().intents.keys()].some((key) => key.includes('foreign')), false);

    const fill: TraderFillNotice = { contractVersion: ALPHA_ONE_CONTRACT_VERSION, intentId: 'missing', accountId: ACCOUNT, productId: 'BTC-USD', clientOrderId: 'ao-made-up', fillId: 'f1', ownerId: ACCREDITED_TRADER, epoch: 1, baseSize: '0.01', price: '1' };
    const early = await coordinator.observeFill(signEnvelope(fill, signedBodyHash(fill), KEY, clock));
    assert.equal(early.ok, true);
    if (early.ok) assert.equal('unmatched' in early && early.unmatched, true);
    clock += 10_000;
    const expired = await coordinator.dispatch(intent());
    assert.equal(expired.ok, false);
    if (!expired.ok) assert.equal(expired.code, 'LEASE_LOST');
    assert.equal(transport.calls, 1);
  });

  it('does not open a direct venue submit path', async () => {
    await assert.rejects(async () => createDisabledAdapter().submitOrder({ portfolioId: ACCOUNT, productId: 'BTC-USD', side: 'BUY', baseSize: '0.01', limitPrice: '1', clientOrderId: 'x' }), /unavailable/i);
    await assert.rejects(async () => createDisabledAdapter().cancelOrders(['x']), /unavailable/i);
  });
});
