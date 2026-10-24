// Thin glue between the shop view and the art module: which sheet variant / frame a customer shows.
import type { ArchetypeId } from '../../data/balance';
import { ARCH_LIST, CH, FEET_Y, frameRef, variantFor } from '../../art/shop';
import type { FrameName } from '../../art/shop';
import type { Customer } from '../../core/shift';

export type { FrameName };
export const ARCHS: ArchetypeId[] = ARCH_LIST;
/** Feet baseline as a fraction of the frame height (Image origin y). */
export const ORIGIN_Y = FEET_Y / CH;
export { frameRef };

/** Deterministic look (0..7) for a customer: from id, foreign names pick the matching foreign-looking variants. */
export const variantOf = (c: Pick<Customer, 'id' | 'nameOrigin'>): number => variantFor(c.id, c.nameOrigin);

/** Walk-cycle frame for an accumulated walk phase. */
export const walkFrame = (phase: number): FrameName => (`walk${Math.floor(phase) & 3}` as FrameName);
