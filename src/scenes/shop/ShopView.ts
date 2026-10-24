// Side-on 2.5D shop on the top of the shift screen: street, passers-by, queue, counter, tables.
// Renders the Shift model (src/core/shift.ts); never changes it. Spec: docs/GDD.md §6.1.
import Phaser from 'phaser';
import type { Shift, ShiftEvent } from '../../core/shift';

/** Height of the shop strip in the 360×740 layout (y = 0..SHOP_H). */
export const SHOP_H = 250;

export interface ShopViewOptions {
  /** Number of seats (tables × chairs) to draw; 2 in Sprint 2. */
  seats: number;
}

export class ShopView {
  constructor(
    readonly scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    readonly w: number,
    readonly h: number,
    readonly opts: ShopViewOptions,
  ) {
    // TODO S2-2: build street, shop front, counter, tables, ambient passers-by.
  }

  /** Call every frame: moves customer sprites to match shift.customers (phase, phaseT, seat, ticketSlot). */
  update(_dt: number, _shift: Shift): void {
    // TODO S2-2
  }

  /** One-shot effects for events returned by Shift.tick/serve/collect (emoji, coins, sit down, walk out). */
  onEvents(_events: ShiftEvent[], _shift: Shift): void {
    // TODO S2-2
  }

  /** Customer id whose table money is under (x, y) in scene coords, or null. The scene then calls shift.collect(id). */
  billAt(_x: number, _y: number): number | null {
    return null; // TODO S2-2
  }

  destroy(): void {
    // TODO S2-2
  }
}
