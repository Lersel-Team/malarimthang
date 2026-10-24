// Dev page /art-items.html: all items x stages, tools, skewer sprites. ?view=items|tools|skewers
import Phaser from 'phaser';
import { RES } from '../engine/hidpi';
import { TOOL_ART } from './items/tools';
import { CHUNK_H, CHUNK_W, ITEM_IDS, STAGES, drawSkewerSprite, itemKey, preloadItems } from './items';

const view = new URLSearchParams(location.search).get('view') ?? 'items';
const W = view === 'tools' ? 560 : view === 'skewers' ? 760 : 560;
const H = view === 'tools' ? 760 : view === 'skewers' ? 300 : 22 * 46 + 30;

class Sheet extends Phaser.Scene {
  constructor() {
    super('sheet');
  }
  create() {
    const cam = this.cameras.main;
    cam.setViewport(0, 0, W * RES, H * RES).setZoom(RES).centerOn(W / 2, H / 2);
    cam.setBackgroundColor(view === 'items' ? '#2a1d47' : '#3a2a30');
    const t0 = performance.now();
    void preloadItems(this).then(() => {
      const ms = performance.now() - t0;
      (window as unknown as { __artMs: number }).__artMs = ms;
      this.add.text(4, 2, `preload ${ms.toFixed(0)} ms RES=${RES} textures=${this.textures.getTextureKeys().length}`, { fontSize: '10px', color: '#fff' });
      if (view === 'items') this.items();
      else if (view === 'tools') this.tools();
      else this.skewers();
      (window as unknown as { __ready: boolean }).__ready = true;
    });
  }
  private items() {
    const cols = [...STAGES, 'oil', 'glaze'] as const;
    ITEM_IDS.forEach((id, r) => {
      const y = 36 + r * 46;
      this.add.text(4, y - 6, id, { fontSize: '9px', color: '#f6d8a0' });
      cols.forEach((c, i) => {
        const x = 70 + i * 68;
        this.add.rectangle(x, y + 8, 64, 42, i === 6 ? 0x3a2a30 : 0x1b1230, 0.5);
        this.add.image(x, y + 8, itemKey(id, c as never)).setDisplaySize(CHUNK_W * 1.45, CHUNK_H * 1.45);
      });
    });
  }
  private tools() {
    let x = 6, y = 20, rowH = 0;
    for (const t of TOOL_ART) {
      if (t.key === 'station-counter' || t.key === 'grill-body') continue;
      if (x + t.w + 4 > W) { x = 6; y += rowH + 8; rowH = 0; }
      this.add.rectangle(x + t.w / 2, y + t.h / 2, t.w + 2, t.h + 2, 0x24183a);
      this.add.image(x + t.w / 2, y + t.h / 2, t.key).setDisplaySize(t.w, t.h);
      this.add.text(x, y + t.h + 1, t.key.slice(0, 18), { fontSize: '7px', color: '#ccc' });
      x += t.w + 6;
      rowH = Math.max(rowH, t.h + 8);
    }
    y += rowH + 10;
    this.add.image(6 + 170, y + 81, 'grill-body').setDisplaySize(340, 162);
    for (let i = 0; i < 4; i++) {
      this.add.image(16 + i * 82 + 41, y + 130, 'coal-cold').setDisplaySize(78, 28);
      this.add.image(16 + i * 82 + 41, y + 130, 'coal-hot').setDisplaySize(78, 28).setAlpha(i / 3);
      this.add.image(16 + i * 82 + 41, y + 130, 'grill-grate').setDisplaySize(78, 28);
      this.add.image(16 + i * 82 + 41, y + 118, 'fx-glow').setDisplaySize(78, 30).setBlendMode(Phaser.BlendModes.ADD).setAlpha(i / 3);
    }
  }
  private skewers() {
    const ids = ['fishball', 'shrimp', 'wagyu', 'squid', 'cheeseball', 'nugget', 'enoki', 'scallop'];
    STAGES.forEach((st, c) => drawSkewerSprite(this, 'squid').setStage(st).setPosition(30 + c * 60, 100).setScale(0.8));
    ids.forEach((id, c) => drawSkewerSprite(this, id).setStage('perfect').setPosition(330 + c * 52, 100).setScale(0.8));
    // second row: crossfade, oil, sauce, burst, compact
    ids.slice(0, 6).forEach((id, c) => {
      const s = drawSkewerSprite(this, id, { compact: c === 5 }).setPosition(30 + c * 90, 240).setScale(0.6);
      if (c === 0) s.setStage('almost', 'perfect', 0.5);
      if (c === 1) s.setStage('perfect').setOiled(true);
      if (c === 2) s.setStage('perfect').setOiled(true).setSauce('good', 0x9a3a22, 0.6);
      if (c === 3) s.setStage('charred').setSauce('good', 0x3a1a10, 0.8);
      if (c === 4) s.setStage('burnt').setBurst(true);
      if (c === 5) s.setStage('perfect');
    });
  }
}

new Phaser.Game({
  type: Phaser.CANVAS,
  parent: 'game',
  width: W * RES,
  height: H * RES,
  backgroundColor: '#1b1230',
  scene: Sheet,
  scale: { mode: Phaser.Scale.NONE },
});
const cv = document.querySelector('canvas');
if (cv) { cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
void CHUNK_H;
