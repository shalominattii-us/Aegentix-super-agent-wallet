import fs from 'node:fs';
import path from 'node:path';
import type { ExecutionIntent, TraderAck, TraderFillNotice, VenueStatus } from './alphaOneContract.ts';
import { scopeKey } from './alphaOneContract.ts';

export interface IntentRecord {
  intent: ExecutionIntent;
  payloadHash: string;
  clientOrderId: string;
  epoch: number;
  ownerId: string;
  outbox: 'reserved' | 'dispatch_unknown' | 'acked' | 'blocked';
  venueStatus: VenueStatus;
  leasedUntilMs: number;
  renewal: 'held' | 'unknown' | 'lost';
}

export interface RelaySnapshot {
  intents: Map<string, IntentRecord>;
  inbox: Set<string>;
  unmatched: TraderFillNotice[];
  handshakeAccepted: boolean;
}

interface StoredEvent {
  kind: 'intent' | 'inbox' | 'unmatched' | 'handshake';
  at: string;
  intent?: IntentRecord;
  inbox?: string;
  unmatched?: TraderFillNotice;
  handshakeAccepted?: boolean;
}

export interface RelayStore {
  load(): RelaySnapshot;
  saveIntent(record: IntentRecord): void;
  saveInbox(key: string): void;
  saveUnmatched(notice: TraderFillNotice): void;
  saveHandshake(accepted: boolean): void;
}

export function emptySnapshot(): RelaySnapshot {
  return { intents: new Map(), inbox: new Set(), unmatched: [], handshakeAccepted: false };
}

export function reduceRelay(events: readonly StoredEvent[]): RelaySnapshot {
  const snapshot = emptySnapshot();
  for (const event of events) {
    if (event.kind === 'intent' && event.intent) snapshot.intents.set(scopeKey(event.intent.intent.accountId, event.intent.intent.productId, event.intent.intent.intentId), event.intent);
    else if (event.kind === 'inbox' && event.inbox) snapshot.inbox.add(event.inbox);
    else if (event.kind === 'unmatched' && event.unmatched) snapshot.unmatched.push(event.unmatched);
    else if (event.kind === 'handshake') snapshot.handshakeAccepted = event.handshakeAccepted === true;
    else throw new Error('Unreadable relay event');
  }
  return snapshot;
}

export class MemoryRelayStore implements RelayStore {
  private events: StoredEvent[] = [];
  constructor(seed: StoredEvent[] = []) {
    this.events = [...seed];
  }
  load(): RelaySnapshot {
    return reduceRelay(this.events);
  }
  saveIntent(record: IntentRecord): void {
    this.events.push({ kind: 'intent', at: new Date(0).toISOString(), intent: record });
  }
  saveInbox(key: string): void {
    this.events.push({ kind: 'inbox', at: new Date(0).toISOString(), inbox: key });
  }
  saveUnmatched(notice: TraderFillNotice): void {
    this.events.push({ kind: 'unmatched', at: new Date(0).toISOString(), unmatched: notice });
  }
  saveHandshake(accepted: boolean): void {
    this.events.push({ kind: 'handshake', at: new Date(0).toISOString(), handshakeAccepted: accepted });
  }
  eventCount(): number {
    return this.events.length;
  }
}

export class FileRelayStore implements RelayStore {
  constructor(private readonly filePath: string) {}
  load(): RelaySnapshot {
    if (!fs.existsSync(this.filePath)) return emptySnapshot();
    const events: StoredEvent[] = [];
    for (const [index, line] of fs.readFileSync(this.filePath, 'utf8').split('\n').entries()) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line) as StoredEvent);
      } catch {
        throw new Error(`Relay journal line ${index + 1} is unreadable. Refusing to continue.`);
      }
    }
    return reduceRelay(events);
  }
  private append(event: StoredEvent): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const fd = fs.openSync(this.filePath, 'a');
    try {
      fs.writeSync(fd, `${JSON.stringify(event)}\n`);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  }
  saveIntent(record: IntentRecord): void {
    this.append({ kind: 'intent', at: new Date().toISOString(), intent: record });
  }
  saveInbox(key: string): void {
    this.append({ kind: 'inbox', at: new Date().toISOString(), inbox: key });
  }
  saveUnmatched(notice: TraderFillNotice): void {
    this.append({ kind: 'unmatched', at: new Date().toISOString(), unmatched: notice });
  }
  saveHandshake(accepted: boolean): void {
    this.append({ kind: 'handshake', at: new Date().toISOString(), handshakeAccepted: accepted });
  }
}

export function ackOf(record: IntentRecord, disposition: TraderAck['disposition']): TraderAck {
  return {
    contractVersion: 'alpha-one-intent-relay/1',
    intentId: record.intent.intentId,
    accountId: record.intent.accountId,
    productId: record.intent.productId,
    clientOrderId: record.clientOrderId,
    payloadHash: record.payloadHash,
    epoch: record.epoch,
    ownerId: record.ownerId,
    disposition,
    venueStatus: record.venueStatus,
  };
}
