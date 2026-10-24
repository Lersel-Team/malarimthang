// Procedural chibi people, stools, tables, bike, cat. Textures are generated once per Phaser game.
import Phaser from 'phaser';
import type { ArchetypeId } from '../../data/balance';

export type Pose = 'stand' | 'sit0' | 'sit1' | 'happy' | 'angry';
export const POSES: Pose[] = ['stand', 'sit0', 'sit1', 'happy', 'angry'];
export const ARCHS: ArchetypeId[] = ['student', 'office', 'family', 'tourist', 'nightowl'];
export const TEX_W = 44;
export const TEX_H = 50;
/** Feet baseline inside the texture (origin y = FEET_Y / TEX_H). */
export const FEET_Y = 46;
export const PERSON_H = 36;
export const personKey = (a: ArchetypeId, p: Pose) => `shop_p_${a}_${p}`;

interface Look {
  skin: number;
  hair: number;
  top: number;
  bottom: number;
  bare?: boolean; // arms are skin (tank top)
}

const LOOKS: Record<ArchetypeId, Look> = {
  student: { skin: 0xe8b58a, hair: 0x1a1418, top: 0xf4f4f4, bottom: 0x1c2a5a },
  office: { skin: 0xe0aa80, hair: 0x2a2020, top: 0xdfe8f2, bottom: 0x2a2a38 },
  family: { skin: 0xdca87c, hair: 0x4a2a1a, top: 0x3aa0a0, bottom: 0x3a3a4a },
  tourist: { skin: 0xf6d6b8, hair: 0x8a5a2a, top: 0xff8a3a, bottom: 0xd8c8a0 },
  nightowl: { skin: 0xc89870, hair: 0x0a0a0a, top: 0x1a1a1e, bottom: 0x3a4a6a, bare: true },
};

function person(g: Phaser.GameObjects.Graphics, a: ArchetypeId, pose: Pose, cx: number, h: number, look: Look, kid = false) {
  const sit = pose === 'sit0' || pose === 'sit1';
  const feet = FEET_Y;
  const legsTop = feet - (sit ? 0.2 : 0.3) * h;
  const torsoTop = legsTop - 0.33 * h;
  const headCy = torsoTop - 0.16 * h;
  const hr = 0.17 * h;
  const armCol = look.bare ? look.skin : look.top;

  // back items
  if (a === 'student' && !kid) {
    g.fillStyle(0x3a6ac0, 1);
    g.fillRoundedRect(cx - 0.28 * h, torsoTop, 0.16 * h, 0.3 * h, 2);
    g.fillStyle(0x24468a, 1);
    g.fillRect(cx - 0.28 * h, torsoTop + 0.16 * h, 0.16 * h, 0.04 * h);
  }
  if (a === 'tourist') {
    g.fillStyle(0x4a8a50, 1);
    g.fillRoundedRect(cx - 0.3 * h, torsoTop - 1, 0.18 * h, 0.34 * h, 3);
  }
  // legs
  g.fillStyle(look.bottom, 1);
  if (sit) {
    g.fillRect(cx - 0.07 * h, legsTop, 0.3 * h, 0.09 * h); // thigh
    g.fillRect(cx + 0.17 * h, legsTop, 0.08 * h, feet - legsTop); // shin
    g.fillStyle(0x222, 1);
    g.fillRect(cx + 0.17 * h, feet - 2, 0.14 * h, 2);
  } else if (a === 'student' && !kid) {
    g.fillRect(cx - 0.12 * h, legsTop, 0.24 * h, 0.14 * h);
    g.fillStyle(look.skin, 1);
    g.fillRect(cx - 0.09 * h, legsTop + 0.14 * h, 0.07 * h, 0.16 * h - 2);
    g.fillRect(cx + 0.03 * h, legsTop + 0.14 * h, 0.07 * h, 0.16 * h - 2);
    g.fillStyle(0xeeeeee, 1);
    g.fillRect(cx - 0.1 * h, feet - 3, 0.1 * h, 3);
    g.fillRect(cx + 0.02 * h, feet - 3, 0.1 * h, 3);
  } else {
    g.fillRect(cx - 0.12 * h, legsTop, 0.1 * h, feet - legsTop - 2);
    g.fillRect(cx + 0.02 * h, legsTop, 0.1 * h, feet - legsTop - 2);
    g.fillStyle(a === 'tourist' ? 0xc8a070 : 0x222222, 1);
    g.fillRect(cx - 0.13 * h, feet - 3, 0.13 * h, 3);
    g.fillRect(cx + 0.02 * h, feet - 3, 0.13 * h, 3);
  }
  // torso
  g.fillStyle(look.top, 1);
  g.fillRoundedRect(cx - 0.15 * h, torsoTop, 0.3 * h, 0.35 * h, 3);
  if (a === 'office' && !kid) {
    g.fillStyle(0xc0302a, 1);
    g.fillTriangle(cx + 0.03 * h, torsoTop + 1, cx + 0.09 * h, torsoTop + 1, cx + 0.06 * h, torsoTop + 0.24 * h);
    g.lineStyle(1, 0x3a8ae0, 1);
    g.lineBetween(cx - 0.02 * h, torsoTop, cx + 0.07 * h, torsoTop + 0.2 * h);
    g.fillStyle(0xffffff, 1);
    g.fillRect(cx + 0.04 * h, torsoTop + 0.2 * h, 0.07 * h, 0.08 * h);
  }
  if (a === 'tourist') {
    g.fillStyle(0xffe08a, 1);
    for (let i = 0; i < 4; i++) g.fillCircle(cx - 0.08 * h + (i % 2) * 0.12 * h, torsoTop + 0.08 * h + (i >> 1) * 0.12 * h, 1.2);
    g.fillStyle(0x151515, 1);
    g.fillRect(cx + 0.06 * h, torsoTop + 0.2 * h, 0.15 * h, 0.1 * h); // camera
    g.fillStyle(0x6aa0c0, 1);
    g.fillCircle(cx + 0.15 * h, torsoTop + 0.25 * h, 1.5);
  }
  if (a === 'nightowl') {
    g.fillStyle(look.skin, 1);
    g.fillRect(cx - 0.15 * h, torsoTop, 0.06 * h, 0.1 * h);
    g.fillRect(cx + 0.09 * h, torsoTop, 0.06 * h, 0.1 * h);
  }
  // head
  g.fillStyle(look.hair, 1);
  g.fillCircle(cx - 1, headCy - 1, hr + 0.8);
  g.fillStyle(pose === 'angry' ? 0xe8806a : look.skin, 1);
  g.fillCircle(cx + 1.2, headCy + 1.2, hr - 0.8);
  // eye + mouth (facing right)
  const ex = cx + 0.1 * h;
  g.fillStyle(0x201418, 1);
  if (pose === 'happy') {
    g.lineStyle(1.2, 0x201418, 1);
    g.beginPath();
    g.arc(ex, headCy + 1.5, 1.6, Math.PI, 0, false);
    g.strokePath();
  } else g.fillCircle(ex, headCy + 1.5, 1.2);
  g.lineStyle(1.2, 0x7a2a2a, 1);
  if (pose === 'happy' || pose === 'sit1') {
    g.fillStyle(0x7a2a2a, 1);
    g.fillCircle(ex, headCy + 0.08 * h + 1, 1.7);
  } else if (pose === 'angry') {
    g.lineBetween(ex - 2, headCy + 0.09 * h + 1, ex + 2, headCy + 0.07 * h);
    g.lineStyle(1.5, 0x201418, 1);
    g.lineBetween(ex - 3, headCy - 2.5, ex + 2, headCy - 0.5);
  } else g.lineBetween(ex - 1.5, headCy + 0.09 * h, ex + 1.5, headCy + 0.09 * h);
  // headwear
  if (a === 'tourist') {
    g.fillStyle(0xe8c878, 1);
    g.fillEllipse(cx + 1, headCy - hr * 0.55, hr * 3, 4);
    g.fillRoundedRect(cx - hr * 0.8, headCy - hr * 1.25, hr * 1.9, hr * 0.8, 3);
    g.fillStyle(0xc03a2a, 1);
    g.fillRect(cx - hr * 0.8, headCy - hr * 0.75, hr * 1.9, 1.5);
  }
  if (a === 'office' && !kid) {
    g.fillStyle(look.hair, 1);
    g.fillRect(cx - hr * 0.9, headCy - hr, hr * 1.9, 2);
  }
  // arms
  const sh = { x: cx, y: torsoTop + 0.06 * h };
  const hands: { x: number; y: number }[] = [];
  if (pose === 'stand') hands.push({ x: cx + 0.12 * h, y: torsoTop + 0.32 * h });
  else if (pose === 'sit0') hands.push({ x: cx + 0.22 * h, y: legsTop - 0.04 * h });
  else if (pose === 'sit1') hands.push({ x: cx + 0.13 * h, y: headCy + 0.14 * h });
  else if (pose === 'happy') {
    hands.push({ x: cx + 0.16 * h, y: headCy - 0.2 * h });
    hands.push({ x: cx - 0.12 * h, y: headCy - 0.16 * h });
  } else hands.push({ x: cx + 0.15 * h, y: torsoTop + 0.2 * h });
  for (const hd of hands) {
    g.lineStyle(3, armCol, 1);
    g.lineBetween(sh.x, sh.y, hd.x, hd.y);
    g.fillStyle(look.skin, 1);
    g.fillCircle(hd.x, hd.y, 1.9);
  }
  if (a === 'nightowl' && !kid && pose !== 'sit1') {
    const hd = hands[0];
    g.fillStyle(0xffb030, 0.35);
    g.fillCircle(hd.x + 1, hd.y - 4, 7);
    g.fillStyle(0xb06a14, 1);
    g.fillRect(hd.x - 1.5, hd.y - 8, 3, 8);
    g.fillRect(hd.x - 0.8, hd.y - 11, 1.6, 3);
  }
}

export function makePeopleTextures(scene: Phaser.Scene): void {
  const tx = scene.textures;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (const a of ARCHS) {
    for (const p of POSES) {
      const key = personKey(a, p);
      if (tx.exists(key)) continue;
      g.clear();
      if (a === 'family') {
        person(g, a, p, 14, PERSON_H, LOOKS.family);
        person(g, a, p === 'happy' ? 'happy' : p, 33, PERSON_H * 0.68, { skin: 0xdca87c, hair: 0x1a1418, top: 0xf2c230, bottom: 0xc05050 }, true);
      } else person(g, a, p, 22, PERSON_H, LOOKS[a]);
      g.generateTexture(key, TEX_W, TEX_H);
    }
  }
  const mk = (key: string, w: number, h: number, fn: () => void) => {
    if (tx.exists(key)) return;
    g.clear();
    fn();
    g.generateTexture(key, w, h);
  };
  mk('shop_stool', 14, 12, () => {
    g.fillStyle(0x7a1c1c, 1);
    g.fillRect(2, 5, 1.6, 7);
    g.fillRect(10.4, 5, 1.6, 7);
    g.fillStyle(0xd23a3a, 1);
    g.fillEllipse(7, 4, 13, 6);
    g.fillStyle(0xff7a6a, 0.6);
    g.fillEllipse(6, 3, 7, 2.5);
  });
  mk('shop_table', 32, 22, () => {
    g.fillStyle(0x5a4a40, 1);
    g.fillRect(14, 8, 4, 14);
    g.fillRect(8, 20, 16, 2);
    g.fillStyle(0xe8dcc0, 1);
    g.fillEllipse(16, 7, 30, 9);
    g.fillStyle(0xbdb090, 1);
    g.fillEllipse(16, 9, 30, 4);
    g.fillStyle(0xe8dcc0, 1);
    g.fillEllipse(16, 6.5, 30, 8);
    g.fillStyle(0xc0302a, 1);
    g.fillRect(10, 4, 3, 2); // little cup
  });
  mk('shop_bill', 22, 20, () => {
    g.fillStyle(0x4a8a5a, 1);
    g.fillRoundedRect(1, 8, 16, 9, 2);
    g.fillStyle(0xcfe8c0, 1);
    g.fillCircle(9, 12.5, 2.5);
    g.fillStyle(0xb88a14, 1);
    g.fillEllipse(16, 15, 11, 5);
    g.fillStyle(0xffd23a, 1);
    g.fillEllipse(16, 13.5, 11, 5);
    g.fillEllipse(16, 11, 11, 5);
    g.fillStyle(0xfff0a0, 1);
    g.fillEllipse(15, 10.5, 6, 2);
  });
  mk('shop_cat', 24, 14, () => {
    g.fillStyle(0x6a5a50, 1);
    g.fillEllipse(11, 9, 20, 9);
    g.fillCircle(19, 8, 4.5);
    g.fillTriangle(16, 5, 17.5, 0.5, 19.5, 5);
    g.fillTriangle(19, 5, 21.5, 0.5, 22.5, 6);
    g.fillStyle(0x8a7a6e, 1);
    g.fillEllipse(10, 7, 14, 4);
    g.lineStyle(2.5, 0x6a5a50, 1);
    g.beginPath();
    g.arc(3, 9, 4, 0.4, 3.6, false);
    g.strokePath();
  });
  mk('shop_moto', 44, 28, () => {
    g.lineStyle(2, 0x141018, 1);
    g.strokeCircle(9, 21, 6);
    g.strokeCircle(35, 21, 6);
    g.fillStyle(0x3a6a9a, 1);
    g.fillRoundedRect(10, 11, 22, 6, 3);
    g.fillRect(28, 6, 3, 10);
    g.fillStyle(0xffe08a, 1);
    g.fillCircle(38, 12, 2.5);
    g.fillStyle(0x6a1c1c, 1);
    g.fillRoundedRect(14, 8, 9, 4, 2);
    g.fillStyle(0x201820, 1);
    g.fillRoundedRect(17, 0, 7, 11, 2); // rider
    g.fillCircle(21, -1 + 2, 3);
    g.fillStyle(0xe8b58a, 1);
    g.fillCircle(22, 3, 3);
  });
  g.destroy();
}
