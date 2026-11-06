import { scopeKey, signEnvelope, stableClientOrderId, validateIntent, verifyEnvelope, payloadHash, requestHash, signedBodyHash, ACCREDITED_TRADER, type ExecutionIntent, type RelayRequest, type SignedEnvelope, type TraderAck, type TraderFillNotice } from './alphaOneContract.ts';
import { ackOf, type IntentRecord, type RelayStore } from './alphaOneStore.ts';

export interface RelayTransport {
  deliver(envelope: SignedEnvelope<RelayRequest>): Promise<TraderAck | null>;
}

/** Default transport. It does not open a socket and does not place an order. */
export class DisabledRelayTransport implements RelayTransport {
  calls = 0;
  async deliver(): Promise<null> {
    this.calls += 1;
    return null;
  }
}

export interface CoordinatorOptions {
  store: RelayStore;
  ownerId: string;
  now: () => number;
  leaseMs: number;
  destination: string | null;
  allowlist: readonly string[];
  signingKey: string | null;
  handshakeAccepted?: boolean;
  transport?: RelayTransport;
  maxSkewMs?: number;
}

function fenceKey(intent: ExecutionIntent): string {
  return scopeKey(intent.accountId, intent.productId, intent.intentId);
}

export function createAlphaOneCoordinator(options: CoordinatorOptions) {
  const transport = options.transport ?? new DisabledRelayTransport();
  let chain: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(task: () => Promise<T> | T): Promise<T> => {
    const run = chain.then(task, task);
    chain = run.then(() => undefined, () => undefined);
    return run;
  };
  const allowlisted = Boolean(options.destination) && options.allowlist.includes(options.destination as string);
  const configured = allowlisted && (options.signingKey?.length ?? 0) >= 16 && options.ownerId === ACCREDITED_TRADER;
  const integrationBlocked = !configured || options.handshakeAccepted !== true;

  function proposeUnlocked(intent: ExecutionIntent) {
    const invalid = validateIntent(intent);
    if (invalid) return { ok: false as const, code: invalid, integrationBlocked };
    const snapshot = options.store.load();
    const key = fenceKey(intent);
    const existing = snapshot.intents.get(key);
    const hash = payloadHash(intent);
    if (existing) {
      if (existing.payloadHash !== hash) {
        return { ok: false as const, code: 'INTENT_CONFLICT', integrationBlocked, clientOrderId: existing.clientOrderId };
      }
      return { ok: true as const, record: existing, created: false, integrationBlocked };
    }
    const record: IntentRecord = {
      intent,
      payloadHash: hash,
      clientOrderId: stableClientOrderId(intent.accountId, intent.productId, intent.intentId),
      epoch: 1,
      ownerId: ACCREDITED_TRADER,
      outbox: 'reserved' as const,
      venueStatus: 'not_sent' as const,
      leasedUntilMs: options.now() + options.leaseMs,
      renewal: 'held' as const,
    };
    options.store.saveIntent(record);
    return { ok: true as const, record, created: true, integrationBlocked };
  }

  function status() {
    const snapshot = options.store.load();
    const lease = [...snapshot.intents.values()][0];
    const renewalUnknown = [...snapshot.intents.values()].some((record) => record.renewal === 'unknown' || record.renewal === 'lost');
    return {
      integrationBlocked,
      liveExecutionReady: false as const,
      collisionFreedomGuaranteed: false as const,
      alphaOneSourceIntegrated: false as const,
      destinationAllowlisted: allowlisted,
      signingKeyPresent: (options.signingKey?.length ?? 0) >= 16,
      accreditedOwner: options.ownerId === ACCREDITED_TRADER,
      handshakeAccepted: options.handshakeAccepted === true,
      effectsBlocked: integrationBlocked || renewalUnknown || (lease ? options.now() > lease.leasedUntilMs && lease.renewal !== 'held' : false),
      intentCount: snapshot.intents.size,
    };
  }

  function effectsBlocked(): boolean {
    if (integrationBlocked) return true;
    return [...options.store.load().intents.values()].some((record) => record.renewal === 'unknown' || record.renewal === 'lost');
  }

  return {
    status,
    propose(intent: ExecutionIntent) {
      return exclusive(() => proposeUnlocked(intent));
    },
    async dispatch(intent: ExecutionIntent) {
      return exclusive(async () => {
        const proposed = await proposeUnlocked(intent);
        if (!proposed.ok) return proposed;
        if (integrationBlocked || !options.signingKey || !options.destination) {
          return { ok: false as const, code: 'INTEGRATION_BLOCKED', integrationBlocked: true, clientOrderId: proposed.record.clientOrderId };
        }
        const current = options.store.load().intents.get(fenceKey(intent)) ?? proposed.record;
        if (current.outbox === 'dispatch_unknown' || current.venueStatus === 'unknown') {
          return { ok: false as const, code: 'DISPATCH_UNKNOWN', integrationBlocked: false, clientOrderId: current.clientOrderId };
        }
        if (effectsBlocked() || current.renewal !== 'held' || options.now() > current.leasedUntilMs) {
          current.renewal = 'lost';
          current.outbox = 'blocked';
          options.store.saveIntent(current);
          return { ok: false as const, code: 'LEASE_LOST', integrationBlocked: false, clientOrderId: current.clientOrderId };
        }
        const body: RelayRequest = { intent, epoch: current.epoch, ownerId: ACCREDITED_TRADER };
        const envelope = signEnvelope(body, requestHash(body), options.signingKey, options.now());
        let ack: TraderAck | null = null;
        try {
          ack = await transport.deliver(envelope);
        } catch {
          ack = null;
        }
        if (!ack) {
          current.outbox = 'dispatch_unknown';
          current.venueStatus = 'unknown';
          current.renewal = 'unknown';
          options.store.saveIntent(current);
          return { ok: false as const, code: 'LOST_ACK', integrationBlocked: false, clientOrderId: current.clientOrderId };
        }
        current.outbox = 'acked';
        current.venueStatus = ack.venueStatus;
        current.epoch = ack.epoch;
        options.store.saveIntent(current);
        return { ok: true as const, record: current, ack, integrationBlocked: false };
      });
    },
    observeAck(envelope: SignedEnvelope<TraderAck>) {
      return exclusive(() => {
        if (!options.signingKey) return { ok: false as const, code: 'INTEGRATION_BLOCKED' };
        const bad = verifyEnvelope(envelope, options.signingKey, options.now(), options.maxSkewMs ?? 0);
        if (bad || signedBodyHash(envelope.payload) !== envelope.payloadHash) return { ok: false as const, code: bad ?? 'BAD_SIGNATURE' };
        const snapshot = options.store.load();
        const inboxKey = `${envelope.nonce}.${envelope.payloadHash}`;
        if (snapshot.inbox.has(inboxKey)) return { ok: true as const, duplicate: true };
        options.store.saveInbox(inboxKey);
        if (envelope.payload.ownerId !== ACCREDITED_TRADER) return { ok: false as const, code: 'FOREIGN_ACTOR' };
        const key = scopeKey(envelope.payload.accountId, envelope.payload.productId, envelope.payload.intentId);
        const record = snapshot.intents.get(key);
        if (!record) return { ok: true as const, unmatched: true };
        if (envelope.payload.epoch < record.epoch) return { ok: false as const, code: 'STALE_FENCE', clientOrderId: record.clientOrderId };
        if (envelope.payload.clientOrderId !== record.clientOrderId) return { ok: false as const, code: 'CLIENT_ORDER_ID_MISMATCH', clientOrderId: record.clientOrderId };
        record.outbox = 'acked';
        record.venueStatus = envelope.payload.venueStatus;
        record.renewal = 'held';
        options.store.saveIntent(record);
        return { ok: true as const, record };
      });
    },
    observeFill(envelope: SignedEnvelope<TraderFillNotice>) {
      return exclusive(() => {
        if (!options.signingKey) return { ok: false as const, code: 'INTEGRATION_BLOCKED' };
        const bad = verifyEnvelope(envelope, options.signingKey, options.now(), options.maxSkewMs ?? 0);
        if (bad || signedBodyHash(envelope.payload) !== envelope.payloadHash) return { ok: false as const, code: bad ?? 'BAD_SIGNATURE' };
        const snapshot = options.store.load();
        const inboxKey = `fill:${envelope.nonce}.${envelope.payloadHash}`;
        if (snapshot.inbox.has(inboxKey)) return { ok: true as const, duplicate: true };
        options.store.saveInbox(inboxKey);
        if (envelope.payload.ownerId !== ACCREDITED_TRADER) return { ok: false as const, code: 'FOREIGN_ACTOR' };
        const key = scopeKey(envelope.payload.accountId, envelope.payload.productId, envelope.payload.intentId);
        const record = snapshot.intents.get(key);
        if (!record || envelope.payload.epoch < record.epoch) {
          options.store.saveUnmatched(envelope.payload);
          return { ok: true as const, unmatched: true };
        }
        if (envelope.payload.clientOrderId !== record.clientOrderId) {
          options.store.saveUnmatched(envelope.payload);
          return { ok: false as const, code: 'CLIENT_ORDER_ID_MISMATCH' };
        }
        record.venueStatus = 'filled';
        options.store.saveIntent(record);
        return { ok: true as const, record };
      });
    },
    renewLease(intent: ExecutionIntent, known: boolean) {
      return exclusive(() => {
        const snapshot = options.store.load();
        const record = snapshot.intents.get(fenceKey(intent));
        if (!record) return { ok: false as const, code: 'UNKNOWN_INTENT' };
        if (!known) {
          record.renewal = 'unknown';
          record.outbox = 'blocked';
          options.store.saveIntent(record);
          return { ok: false as const, code: 'RENEWAL_UNKNOWN', clientOrderId: record.clientOrderId };
        }
        if (record.ownerId !== ACCREDITED_TRADER) return { ok: false as const, code: 'FOREIGN_ACTOR' };
        record.epoch += 1;
        record.leasedUntilMs = options.now() + options.leaseMs;
        record.renewal = 'held';
        options.store.saveIntent(record);
        return { ok: true as const, record };
      });
    },
  };
}
