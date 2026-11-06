import { ACCREDITED_TRADER, requestHash, scopeKey, stableClientOrderId, validateIntent, verifyEnvelope, type RelayRequest, type SignedEnvelope, type TraderAck } from './alphaOneContract.ts';
import { ackOf, type IntentRecord, type RelayStore } from './alphaOneStore.ts';

/**
 * Reference journal for the accredited trader. This file is not alpha_one_trader.py
 * and it never submits a venue order. One account, product, and intent id keeps one
 * client_order_id. A later HTTP retry must hit this journal; the HTTP response itself
 * is not an execute-once guarantee.
 */
export function createReceiverReference(options: { store: RelayStore; signingKey: string; now: () => number; maxSkewMs: number }) {
  return {
    accept(envelope: SignedEnvelope<RelayRequest>): TraderAck {
      const bad = verifyEnvelope(envelope, options.signingKey, options.now(), options.maxSkewMs);
      if (bad || requestHash(envelope.payload) !== envelope.payloadHash) return rejected(envelope, 'rejected');
      const inboxKey = `${envelope.nonce}.${envelope.payloadHash}`;
      const snapshot = options.store.load();
      const key = scopeKey(envelope.payload.intent.accountId, envelope.payload.intent.productId, envelope.payload.intent.intentId);
      const existing = snapshot.intents.get(key);
      if (snapshot.inbox.has(inboxKey)) return existing ? ackOf(existing, 'replay') : rejected(envelope, 'replay');
      options.store.saveInbox(inboxKey);
      if (validateIntent(envelope.payload.intent)) return rejected(envelope, 'rejected');
      if (envelope.payload.ownerId !== ACCREDITED_TRADER) {
        return existing ? ackOf(existing, 'foreign_actor') : rejected(envelope, 'foreign_actor');
      }
      if (existing && envelope.payload.epoch < existing.epoch) return ackOf(existing, 'fenced');
      if (existing && envelope.payload.epoch > existing.epoch) {
        existing.epoch = envelope.payload.epoch;
        options.store.saveIntent(existing);
        return ackOf(existing, 'duplicate');
      }
      if (existing) return ackOf(existing, 'duplicate');
      const record: IntentRecord = {
        intent: envelope.payload.intent,
        payloadHash: envelope.payloadHash,
        clientOrderId: stableClientOrderId(envelope.payload.intent.accountId, envelope.payload.intent.productId, envelope.payload.intent.intentId),
        epoch: envelope.payload.epoch,
        ownerId: ACCREDITED_TRADER,
        outbox: 'reserved',
        venueStatus: 'not_sent',
        leasedUntilMs: options.now(),
        renewal: 'held',
      };
      options.store.saveIntent(record);
      return ackOf(record, 'accepted_reference');
    },
  };
}

function rejected(envelope: SignedEnvelope<RelayRequest>, disposition: TraderAck['disposition']): TraderAck {
  return {
    contractVersion: 'alpha-one-intent-relay/1',
    intentId: envelope.payload.intent.intentId,
    accountId: envelope.payload.intent.accountId,
    productId: envelope.payload.intent.productId,
    clientOrderId: '',
    payloadHash: envelope.payloadHash,
    epoch: envelope.payload.epoch,
    ownerId: envelope.payload.ownerId,
    disposition,
    venueStatus: 'not_sent',
  };
}
