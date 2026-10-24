// Hi-DPI foundation. The canvas is RES x larger than the logical 360x740 space; every scene
// calls setupCamera(this) first so scene code keeps using logical coordinates.
import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';

export const RES = Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1)));

let patched = false;
/** Makes every scene.add.text crisp (Text resolution = RES) unless a style sets its own. */
function patchText(): void {
  if (patched) return;
  patched = true;
  const proto = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (x: unknown, y: unknown, t: unknown, s?: Record<string, unknown>) => Phaser.GameObjects.Text;
  };
  const orig = proto.text;
  proto.text = function (this: unknown, x: unknown, y: unknown, text: unknown, style?: Record<string, unknown>) {
    return orig.call(this, x, y, text, { resolution: RES, ...(style ?? {}) });
  };
}
patchText();

/** Zooms the main camera so logical (0..GAME_W, 0..GAME_H) exactly fills the RES x canvas. */
export function setupCamera(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  cam.setViewport(0, 0, GAME_W * RES, GAME_H * RES);
  cam.setZoom(RES);
  cam.centerOn(GAME_W / 2, GAME_H / 2); // zoom pivots on the camera centre, so centre it on the logical centre
}

/** Pointer position in logical coordinates (canvas pointer coords are already in canvas px, so divide by RES). */
export function pt(p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x / RES, y: p.y / RES };
}
