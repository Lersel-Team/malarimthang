// One 3-minute shift: customer arrivals, queue, orders, serving, seats, money.
// Pure logic, no Phaser. The scene renders `customers` and reacts to the returned events.
// Spec: docs/GDD.md §6, §6.1, §13. Numbers: data/balance.json → archetypes, locations, service, eatIn, shift, spice.
import type { ArchetypeId, LocationDef } from '../data/balance';
import type { Rng } from './cooking';

/** Seconds a customer takes to walk from the street to the counter / to a seat / out. Views tween over these. */
export const WALK_IN_SEC = 2.5;
export const WALK_SEAT_SEC = 1.5;
export const WALK_OUT_SEC = 2.5;
/** Orders being taken at the counter at once (= ticket slots). Others wait in the queue behind. */
export const MAX_TICKETS = 3;
export const MAX_QUEUE = 4;

export type Phase =
  | 'walkIn' // walking from the street to the queue
  | 'queue' // standing in line, no ticket yet (patience runs)
  | 'ordered' // has a ticket at the counter (patience runs)
  | 'toSeat' // eat-in, walking to the seat
  | 'eating' // seated, eating
  | 'bill' // eat-in finished, money waiting on the table
  | 'leaving' // walking out
  | 'gone';

export interface OrderLine {
  itemId: string;
  qty: number;
}

export interface Order {
  lines: OrderLine[];
  /** 0..4 = SPICE.levels index; number of shaker taps required. */
  spice: number;
  eatIn: boolean;
}

/** A skewer put on a ticket: which item and its cook quality 0..1 (from skewerQuality). */
export interface TicketSkewer {
  itemId: string;
  quality: number;
}

export interface Ticket {
  skewers: TicketSkewer[];
  shakes: number;
}

export interface Customer {
  id: number;
  archetype: ArchetypeId;
  order: Order;
  phase: Phase;
  /** Seconds left in the current phase (walks, eating, bill auto-collect). */
  phaseT: number;
  /** Patience left / max, seconds. Only drains in 'queue' and 'ordered'. */
  patience: number;
  patienceMax: number;
  /** Ticket slot 0..MAX_TICKETS-1 while 'ordered'. */
  ticketSlot: number | null;
  ticket: Ticket | null;
  /** Seat index while toSeat/eating/bill. */
  seat: number | null;
  /** Money waiting on the table ('bill'), or paid at the counter for takeaway. */
  bill: number;
  mood: 'happy' | 'ok' | 'sad' | 'angry' | null;
}

export interface Ledger {
  sales: number;
  tips: number;
  combo: number;
  served: number;
  walkouts: number;
  /** stars given this shift (1..5), in order */
  stars: number[];
}

export type ShiftEvent =
  | { type: 'arrive'; id: number }
  | { type: 'toCounter'; id: number; ticketSlot: number }
  | { type: 'walkout'; id: number }
  | { type: 'served'; id: number; pay: number; tip: number; combo: number; stars: number; eatIn: boolean }
  | { type: 'toSeat'; id: number; seat: number }
  | { type: 'noSeat'; id: number } // eat-in customer took it away instead
  | { type: 'extraOrder'; id: number } // seated customer ordered more: back to 'ordered' with a new small order
  | { type: 'bill'; id: number; seat: number; amount: number }
  | { type: 'collected'; id: number; amount: number; auto: boolean }
  | { type: 'leave'; id: number }
  | { type: 'end' };

export interface ShiftOptions {
  location: LocationDef;
  /** Item ids the stall sells today. */
  menu: string[];
  seats: number;
  rating: number; // 1..5, scales spawn rate (reputation.spawnMultAt)
  priceMult?: number; // mala powder upgrade
  patienceMult?: number; // seat grade
  spawnMult?: number; // sign
  rng: Rng;
}

export class Shift {
  /** Seconds elapsed, 0..SHIFT.lengthSec. */
  time = 0;
  money = 0;
  ended = false;
  customers: Customer[] = [];
  ledger: Ledger = { sales: 0, tips: 0, combo: 0, served: 0, walkouts: 0, stars: [] };
  /** Current combo steps (serves within SERVICE.comboWindowSec of each other). */
  comboSteps = 0;

  constructor(readonly opts: ShiftOptions) {
    throw new Error('TODO S2-1');
  }

  /** In-game clock "18:00".."24:00". */
  clock(): string {
    throw new Error('TODO S2-1');
  }

  /** Advances time: spawns, walks, patience, walk-outs, eating, bill auto-collect, end of shift. */
  tick(dt: number): ShiftEvent[] {
    throw new Error('TODO S2-1');
  }

  /** Customer holding ticket slot `slot`, if any. */
  atTicket(slot: number): Customer | null {
    throw new Error('TODO S2-1');
  }

  /** Can this skewer go on that ticket? (item still needed by the order). */
  canAdd(slot: number, itemId: string): boolean {
    throw new Error('TODO S2-1');
  }

  /** Puts a cooked skewer on the ticket. False if not needed. */
  addSkewer(slot: number, sk: TicketSkewer): boolean {
    throw new Error('TODO S2-1');
  }

  /** One shaker tap of mala powder on the ticket. */
  shake(slot: number): void {
    throw new Error('TODO S2-1');
  }

  /** All ordered skewers are on the ticket. */
  isComplete(slot: number): boolean {
    throw new Error('TODO S2-1');
  }

  /** Hands the ticket over. Takeaway pays now; eat-in goes to a seat (or takes away if none free). */
  serve(slot: number): ShiftEvent[] {
    throw new Error('TODO S2-1');
  }

  /** Player tapped the money on a table. */
  collect(customerId: number): ShiftEvent[] {
    throw new Error('TODO S2-1');
  }

  /** Average stars this shift (or null if none). */
  avgStars(): number | null {
    throw new Error('TODO S2-1');
  }
}
