import type Phaser from 'phaser';
import { RES } from '../engine/hidpi';

const pending = new Map<string, Promise<string>>();

/**
 * Rasterises an SVG string at (w*RES x h*RES) into a Phaser texture `key`.
 * The texture is cached per key (a second call resolves immediately). Use the sprite at
 * setDisplaySize(w, h) or setScale(1 / RES) so it occupies w x h logical px.
 */
export function loadSvg(scene: Phaser.Scene, key: string, svg: string, w: number, h: number): Promise<string> {
  if (scene.textures.exists(key)) return Promise.resolve(key);
  const inflight = pending.get(key);
  if (inflight) return inflight;
  const p = new Promise<string>((resolve, reject) => {
    const src = svg.includes('xmlns') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(w * RES);
      c.height = Math.round(h * RES);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      if (!scene.textures.exists(key)) scene.textures.addCanvas(key, c);
      pending.delete(key);
      resolve(key);
    };
    img.onerror = () => {
      pending.delete(key);
      reject(new Error(`loadSvg: failed to rasterise "${key}"`));
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  });
  pending.set(key, p);
  return p;
}
