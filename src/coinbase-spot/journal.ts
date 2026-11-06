import fs from 'node:fs';
import path from 'node:path';
import type { InventoryMovement } from './ledger.ts';
import type { FillRecord, IntentState, OperatorIntent, PreviewResult, Reservation, SpotProductId } from './types.ts';

export interface StoredIntent {
  intent: OperatorIntent;
  state: IntentState;
  stagedBaseSize: string | null;
  limitPrice: string | null;
  preview: PreviewResult | null;
  reservation: Reservation | null;
  orderId: string | null;
  rawStatus: string | null;
  message: string | null;
  updatedAt: string;
}

export interface JournalEvent {
  type: string;
  at: string;
  intent?: StoredIntent;
  fill?: FillRecord;
  movement?: InventoryMovement;
  clientIntentId?: string;
  engaged?: boolean;
  reason?: string;
}

export interface JournalState {
  killSwitchEngaged: boolean;
  intents: Map<string, StoredIntent>;
  fills: FillRecord[];
  movements: InventoryMovement[];
}

export function emptyJournalState(): JournalState {
  return { killSwitchEngaged: true, intents: new Map(), fills: [], movements: [] };
}

export function reduceJournal(events: readonly JournalEvent[]): JournalState {
  const state = emptyJournalState();
  for (const event of events) {
    if (event.type === 'kill') {
      state.killSwitchEngaged = event.engaged !== false;
    } else if (event.type === 'intent' && event.intent) {
      state.intents.set(event.intent.intent.clientIntentId, event.intent);
    } else if (event.type === 'fill' && event.fill) {
      if (event.fill.fillId && !state.fills.some((fill) => fill.fillId === event.fill?.fillId)) state.fills.push(event.fill);
    } else if (event.type === 'movement' && event.movement) {
      if (event.movement.movementId && !state.movements.some((movement) => movement.movementId === event.movement?.movementId)) {
        state.movements.push(event.movement);
      }
    } else {
      throw new Error(`Unknown journal event ${event.type}`);
    }
  }
  return state;
}

export interface Journal {
  load(): Promise<JournalState>;
  append(event: JournalEvent): Promise<void>;
}

export class MemoryJournal implements Journal {
  private events: JournalEvent[] = [];

  constructor(seed: JournalEvent[] = []) {
    this.events = [...seed];
  }

  async load(): Promise<JournalState> {
    return reduceJournal(this.events);
  }

  async append(event: JournalEvent): Promise<void> {
    this.events.push(event);
  }

  snapshotEvents(): JournalEvent[] {
    return [...this.events];
  }
}

export class FileJournal implements Journal {
  constructor(private readonly filePath: string) {}

  async load(): Promise<JournalState> {
    if (!fs.existsSync(this.filePath)) return emptyJournalState();
    const raw = fs.readFileSync(this.filePath, 'utf8');
    const events: JournalEvent[] = [];
    for (const [index, line] of raw.split('\n').entries()) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line) as JournalEvent);
      } catch {
        throw new Error(`Journal line ${index + 1} is not readable. Refusing to continue with a partial book.`);
      }
    }
    return reduceJournal(events);
  }

  async append(event: JournalEvent): Promise<void> {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const fd = fs.openSync(this.filePath, 'a');
    try {
      fs.writeSync(fd, `${JSON.stringify(event)}\n`);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  }
}

export function localReservations(state: JournalState): Reservation[] {
  const reserved: Reservation[] = [];
  for (const intent of state.intents.values()) {
    if (intent.reservation && (intent.state === 'STAGED' || intent.state === 'SUBMITTED' || intent.state === 'UNKNOWN')) {
      reserved.push(intent.reservation);
    }
  }
  return reserved;
}

export function productOf(intent: StoredIntent): SpotProductId {
  return intent.intent.productId;
}
