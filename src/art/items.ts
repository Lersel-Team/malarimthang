// Item, grill, tool and container art (owner: art-items agent). See docs/ART.md.
import type Phaser from 'phaser';
import { CHUNK_H, CHUNK_W, ITEM_IDS, SHEET_CELLS, STAGES, itemKey, itemSheetSvg, type Stage } from './items/chunks';
import { rasterOne, rasterSheet, type Cell } from './items/raster';
import { TOOL_ART } from './items/tools';

export { CHUNK_H, CHUNK_W, ITEM_IDS, STAGES, itemKey, type Stage };
export { drawSkewerSprite, SkewerSprite, chunkCount, BODY_H as SKEWER_BODY_H, type Sauce, type SkewerOpts } from './items/sprite';
export type Zone = Stage;

/** Texture key of an item chunk at a cook stage. */
export const itemTex = (itemId: string, stage: Stage): string => itemKey(itemId, stage);
/** Core cooking zone -> art stage (they share names). */
export const zoneToStage = (zone: Stage): Stage => zone;

/**
 * Ticket / market icon: the appetising (perfect-stage) chunk, `size` logical px wide.
 * Same sprite as the grill, so tickets and market always match.
 */
export function itemIcon(scene: Phaser.Scene, itemId: string, size: number, stage: Stage = 'perfect'): Phaser.GameObjects.Image {
  return scene.add.image(0, 0, itemKey(itemId, stage)).setDisplaySize(size, size * (CHUNK_H / CHUNK_W));
}

/** Rasterises every item/grill/tool texture. Awaited by preloadAllArt in BootScene. */
export async function preloadItems(scene: Phaser.Scene): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const id of ITEM_IDS) {
    const cells: Cell[] = [];
    for (let i = 0; i < SHEET_CELLS; i++) {
      const key = i < STAGES.length ? itemKey(id, STAGES[i]) : itemKey(id, i === 5 ? 'oil' : 'glaze');
      cells.push({ key, x: i * CHUNK_W, y: 0, w: CHUNK_W, h: CHUNK_H });
    }
    jobs.push(rasterSheet(scene, itemSheetSvg(id), SHEET_CELLS * CHUNK_W, CHUNK_H, cells));
  }
  for (const t of TOOL_ART) jobs.push(rasterOne(scene, t.key, t.svg, t.w, t.h));
  await Promise.all(jobs);
}

