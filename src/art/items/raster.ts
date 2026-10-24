// Sheet rasteriser: one SVG decode -> many Phaser textures (cuts the per-texture decode cost).
import type Phaser from 'phaser';
import { RES } from '../../engine/hidpi';

export interface Cell {
  key: string;
  /** Logical x/y/w/h inside the sheet. */
  x: number;
  y: number;
  w: number;
  h: number;
}

function toImage(svg: string): Promise<HTMLImageElement> {
  const src = svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('items: svg rasterise failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  });
}

/** Rasterises `svg` (logical size sw x sh) at RES x and registers each cell as its own texture. */
export async function rasterSheet(scene: Phaser.Scene, svg: string, sw: number, sh: number, cells: Cell[]): Promise<void> {
  const todo = cells.filter((c) => !scene.textures.exists(c.key));
  if (todo.length === 0) return;
  const img = await toImage(svg);
  const full = document.createElement('canvas');
  full.width = Math.round(sw * RES);
  full.height = Math.round(sh * RES);
  full.getContext('2d')!.drawImage(img, 0, 0, full.width, full.height);
  for (const c of todo) {
    if (scene.textures.exists(c.key)) continue;
    if (todo.length === 1 && c.x === 0 && c.y === 0 && c.w === sw && c.h === sh) {
      scene.textures.addCanvas(c.key, full);
      continue;
    }
    const cv = document.createElement('canvas');
    cv.width = Math.round(c.w * RES);
    cv.height = Math.round(c.h * RES);
    cv.getContext('2d')!.drawImage(full, Math.round(c.x * RES), Math.round(c.y * RES), cv.width, cv.height, 0, 0, cv.width, cv.height);
    scene.textures.addCanvas(c.key, cv);
  }
}

/** Single-texture convenience. */
export function rasterOne(scene: Phaser.Scene, key: string, svg: string, w: number, h: number): Promise<void> {
  return rasterSheet(scene, svg, w, h, [{ key, x: 0, y: 0, w, h }]);
}
