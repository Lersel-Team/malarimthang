import Phaser from 'phaser';
import { setSetting } from '../settings';
import { uiButton, uiIcon, uiItemPic, uiModal, uiTheme, type UiModal } from '../art/ui';

const T = uiTheme;
const W = 328, H = 560;
const DEMO_Y = -H / 2 + 120;

interface Slide {
  title: string;
  lines: string[];
  /** Builds the looping animation inside `c` (centred on the demo box); returns nothing, tweens die with the container. */
  demo: (scene: Phaser.Scene, c: Phaser.GameObjects.Container) => void;
}

const loop = (scene: Phaser.Scene, cfg: Phaser.Types.Tweens.TweenBuilderConfig) =>
  scene.tweens.add({ ...cfg, repeat: -1 });

function box(scene: Phaser.Scene, c: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, color: number, label?: string) {
  const g = scene.add.graphics();
  g.fillStyle(color, 0.9).fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
  g.lineStyle(2, 0xffffff, 0.25).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
  c.add(g);
  if (label) c.add(scene.add.text(x, y + h / 2 + 10, label, { ...T.text.tiny, fontSize: '11px' }).setOrigin(0.5));
}

function hand(scene: Phaser.Scene, c: Phaser.GameObjects.Container, x: number, y: number) {
  const h = scene.add.circle(x, y, 11, 0xffffff, 0.85).setStrokeStyle(3, 0xf6a04a);
  c.add(h);
  return h;
}

const SLIDES: Slide[] = [
  {
    title: 'ยินดีต้อนรับสู่ร้านหม่าล่า!',
    lines: ['คุณคือเจ้าของร้านหม่าล่าริมทาง', 'ทุกวันมี 3 ขั้น: ซื้อของที่ตลาด → เปิดร้านย่างไม้ขาย → เก็บเงินแล้วอัปเกรด', 'เป้าหมาย: ทำเงินให้มากขึ้นและรักษาเรตติ้งร้านให้ดี'],
    demo: (s, c) => {
      const icons = ['cart', 'fire', 'money'] as const;
      icons.forEach((n, i) => {
        const x = (i - 1) * 90;
        const ic = uiIcon(s, x, 0, n, 52);
        c.add(ic);
        if (i < 2) c.add(s.add.text(x + 45, 0, '→', { ...T.text.heading, fontSize: '26px' }).setOrigin(0.5));
        loop(s, { targets: ic, scale: ic.scale * 1.18, duration: 500, yoyo: true, delay: i * 450, repeatDelay: 900 });
      });
    },
  },
  {
    title: '1) ตลาดเช้า: ซื้อของ',
    lines: ['กด + เพื่อซื้อวัตถุดิบเป็นแพ็ค กด − เพื่อยกเลิก', 'ป้าย "ถูกวันนี้" = ราคาดี ซื้อเก็บไว้ได้', 'ปุ่มเติมของให้ครบ ซื้อให้พอกับลูกค้า ของเหลือจะเสียได้', 'เงินไม่พอ? กด "ยืมแม่" ได้'],
    demo: (s, c) => {
      const pic = uiItemPic(s, 'fishball', 56);
      pic.setPosition(-80, 0);
      c.add(pic);
      const plus = uiIcon(s, 40, 0, 'plus', 44);
      const minus = uiIcon(s, -10, 0, 'minus', 44);
      const n = s.add.text(15, -42, '', { ...T.text.number }).setOrigin(0.5);
      c.add([plus, minus, n]);
      const h = hand(s, c, 40, 22);
      let k = 0;
      const tick = s.time.addEvent({ delay: 700, loop: true, callback: () => {
        k = (k + 1) % 4;
        n.setText(k ? `${k} แพ็ค` : '');
        s.tweens.add({ targets: [h, plus], scale: 0.85, duration: 120, yoyo: true });
      } });
      c.once('destroy', () => tick.remove());
    },
  },
  {
    title: '2) เปิดร้าน: ดูใบสั่ง',
    lines: ['ลูกค้าเดินมาสั่งไม้ ใบสั่งจะขึ้นด้านบนจอ', 'ใบสั่ง "นั่งกิน" ให้วางจาน ส่วน "กลับบ้าน" ให้ใส่ถุง', 'มีตัวเลขบอกระดับความเผ็ดที่ลูกค้าต้องการ (🌶)', 'เร็วและตรงใจ = ได้ทิปและคอมโบ'],
    demo: (s, c) => {
      box(s, c, -70, 0, 100, 76, 0xf2e4c4);
      box(s, c, 60, 0, 100, 76, 0xf2e4c4);
      c.add(s.add.text(-70, -22, 'นั่งกิน', { ...T.text.paperBold, fontSize: '12px' }).setOrigin(0.5));
      c.add(s.add.text(60, -22, 'กลับบ้าน', { ...T.text.paperBold, fontSize: '12px' }).setOrigin(0.5));
      c.add(uiItemPic(s, 'porkbelly', 34).setPosition(-85, 8));
      c.add(uiItemPic(s, 'sausage', 34).setPosition(-55, 8));
      c.add(uiItemPic(s, 'tofu', 34).setPosition(60, 8));
      c.add(s.add.text(95, 28, '🌶×2', { ...T.text.small, color: '#b02a1a' }).setOrigin(1, 0.5));
    },
  },
  {
    title: '3) ย่างไม้: ลาก → ปิ้ง → ใส่ถุง',
    lines: ['ลากไม้ดิบจากจานของลูกค้าไปวางบนเตา', 'รอจนสุก แล้วแตะเพื่อพลิกอีกด้าน (ทั้งสองด้านต้องสุก)', 'ลากไม้ที่สุกกลับไปใส่จานหรือถุงของใบสั่งนั้น', 'ไหม้หรือแตก? ลากทิ้งถังขยะ ไฟลุก? แตะน้ำดับ'],
    demo: (s, c) => {
      box(s, c, -110, 0, 70, 50, 0xf2e4c4, 'จาน');
      box(s, c, 0, 0, 80, 50, 0x5a2a20, 'เตา');
      box(s, c, 110, 0, 70, 50, 0xd8b878, 'ถุง');
      const sk = uiIcon(s, -110, 0, 'skewer', 40).setAngle(45);
      const fire = uiIcon(s, 0, -4, 'fire', 22).setAlpha(0);
      c.add([fire, sk]);
      const h = hand(s, c, -110, 8);
      const tl = s.tweens.chain({
        loop: -1,
        tweens: [
          { targets: [sk, h], x: 0, duration: 700, delay: 500 },
          { targets: fire, alpha: 1, duration: 200 },
          { targets: sk, angle: 225, duration: 400, delay: 900 },
          { targets: [sk, h], x: 110, duration: 700, delay: 500 },
          { targets: fire, alpha: 0, duration: 10 },
          { targets: [sk, h], x: -110, duration: 10, delay: 700 },
          { targets: sk, angle: 45, duration: 10 },
        ],
      });
      void tl;
    },
  },
  {
    title: '4) น้ำมัน ซอส และผงหม่าล่า',
    lines: ['แปรงน้ำมัน: ปัดผ่านไม้ที่กำลังย่าง', 'แปรงซอส: ทาเมื่อไม้สุกทั้งสองด้านเท่านั้น (ดิบจะไหม้!)', 'แตะขวดผงบนใบสั่งเพื่อเพิ่มความเผ็ดให้ตรงที่สั่ง', 'ส่งแล้วจะมีการ์ด "คุณภาพ" บอกคะแนนทุกอย่าง'],
    demo: (s, c) => {
      const brush = uiIcon(s, -60, -10, 'brush', 40);
      const sk = uiIcon(s, 0, 20, 'skewer', 90).setAngle(0);
      const chili = uiIcon(s, 80, 0, 'chili', 36);
      c.add([sk, brush, chili]);
      loop(s, { targets: brush, x: 60, duration: 900, yoyo: true, ease: 'Sine.easeInOut' });
      loop(s, { targets: chili, y: 18, duration: 500, yoyo: true, ease: 'Sine.easeInOut' });
    },
  },
  {
    title: '5) ถ่าน ตู้โชว์ และจบวัน',
    lines: ['ไฟอ่อน? กด "ถ่าน" (เสียเงินนิดหน่อย) ไฟแรงเกิน? กด "เถ้า"', 'ตู้โชว์: แตะเพื่อเติมไม้จากตู้เย็น ลากเพื่อย่างเพิ่ม', 'หมดเวลา = จบวัน ดูสรุปรายได้ แล้วเอาเงินไป "อัปเกรด" หรือ "จ้างคนย่าง"', 'สนุกกับการขายนะ เจ้าของร้าน!'],
    demo: (s, c) => {
      const f1 = uiIcon(s, -60, 0, 'fire', 54);
      const m = uiIcon(s, 60, 0, 'money', 54);
      const st = uiIcon(s, 0, -30, 'star', 26);
      c.add([f1, m, st]);
      loop(s, { targets: f1, scale: f1.scale * 1.2, duration: 450, yoyo: true });
      loop(s, { targets: m, angle: 8, duration: 500, yoyo: true });
      loop(s, { targets: st, angle: 360, duration: 2400 });
    },
  },
];

/**
 * Thai "how to play" slideshow with looping demo animations (modal over the current scene).
 * Marks the tutorial as seen once it is closed.
 */
export function showTutorial(scene: Phaser.Scene, onClose?: () => void): UiModal {
  let i = 0;
  let page: Phaser.GameObjects.Container | null = null;
  let m!: UiModal;
  const dots = scene.add.container(0, 0);
  let back!: ReturnType<typeof uiButton>;
  let next!: ReturnType<typeof uiButton>;

  const render = () => {
    page?.destroy();
    const sl = SLIDES[i];
    const p = scene.add.container(0, 0);
    page = p;
    m.body.add(p);
    m.body.sendToBack(p);
    const demo = scene.add.container(0, DEMO_Y);
    const frame = scene.add.graphics();
    frame.fillStyle(0x1c1426, 0.85).fillRoundedRect(-W / 2 + 18, -70, W - 36, 140, 12);
    demo.add(frame);
    p.add(demo);
    const d = scene.add.container(0, 0);
    demo.add(d);
    sl.demo(scene, d);
    const title = scene.add
      .text(0, DEMO_Y + 100, sl.title, { ...T.text.heading, fontSize: '20px', align: 'center', wordWrap: { width: W - 40 } })
      .setOrigin(0.5, 0);
    const body = scene.add
      .text(-W / 2 + 24, DEMO_Y + 140, sl.lines.map((l) => `• ${l}`).join('\n'), { ...T.text.body, fontSize: '15px', lineSpacing: 6, wordWrap: { width: W - 48 } })
      .setOrigin(0, 0);
    p.add([title, body]);
    dots.removeAll(true);
    SLIDES.forEach((_, k) => dots.add(scene.add.circle((k - (SLIDES.length - 1) / 2) * 16, 0, k === i ? 5 : 3.5, 0xffe27a, k === i ? 1 : 0.35)));
    back.setVisible(i > 0);
    next.label.setText(i === SLIDES.length - 1 ? 'เริ่มเลย!' : 'ถัดไป');
  };

  const finish = () => {
    m.close();
  };

  m = uiModal(scene, { w: W, h: H, title: 'วิธีเล่น', closable: true, onClose: () => { setSetting('tutorialSeen', true); onClose?.(); } });
  m.body.add(dots);
  dots.setPosition(0, H / 2 - 82);
  back = uiButton(scene, -W / 2 + 74, H / 2 - 38, 112, 44, 'ย้อนกลับ', { variant: 'secondary', fontSize: 16, onClick: () => { i = Math.max(0, i - 1); render(); } });
  next = uiButton(scene, W / 2 - 84, H / 2 - 38, 132, 44, 'ถัดไป', { variant: 'primary', fontSize: 17, onClick: () => { if (i === SLIDES.length - 1) finish(); else { i++; render(); } } });
  m.body.add([back, next]);
  render();
  return m;
}
