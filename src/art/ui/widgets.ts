// UI kit widgets. Convention: every x,y is the CENTRE of the widget (uiPanel can opt into topLeft).
// All return Phaser containers; add them to the scene display list automatically.
import Phaser from 'phaser';
import { RES } from '../../engine/hidpi';
import { GAME_H, GAME_W } from '../../config';
import { OUTLINE, PALETTE } from '../palette';
import { FONT, FONT_FUN, uiSound, uiTheme, type UiSoundKind } from './theme';
import { SLICE, type BarKind, type BtnKind, type PillKind } from './textures';
import type { UiIconName } from './icons';

const T = uiTheme;
export const baht = (n: number) => `฿${Math.round(n).toLocaleString('en-US')}`;

// ------------------------------------------------------------------ helpers
type SliceKey = keyof typeof SLICE;
/** NineSlice laid out in logical px (texture is RES x bigger, so the object is scaled 1/RES). */
export function nine(scene: Phaser.Scene, tex: string, w: number, h: number, sliceKey?: SliceKey): Phaser.GameObjects.NineSlice {
  const key = (sliceKey ?? (tex.replace(/-(wood|glass|cream|dark|lamp|red|green|xp|primary|secondary|ghost|disabled)(-down)?$/, '') as SliceKey)) as SliceKey;
  const sl = SLICE[key];
  const [l, r, t, b] = sl.s;
  const n = scene.add.nineslice(0, 0, tex, undefined, w * RES, h * RES, l * RES, r * RES, t * RES, b * RES);
  n.setScale(1 / RES);
  return n;
}
function nineResize(n: Phaser.GameObjects.NineSlice, w: number, h: number) {
  n.setSize(w * RES, h * RES);
}
/** Soft drop shadow under a w x h box centred at (0,0) of its container. */
export function uiShadow(scene: Phaser.Scene, w: number, h: number, dx = 2, dy = 4, alpha = 0.55): Phaser.GameObjects.NineSlice {
  const s = nine(scene, 'ui-shadow', w + 28, h + 28, 'ui-shadow');
  return s.setPosition(dx, dy).setAlpha(alpha);
}
const txt = (scene: Phaser.Scene, x: number, y: number, s: string, style: Phaser.Types.GameObjects.Text.TextStyle) => scene.add.text(x, y, s, style);

/** Shrinks a Text's font size until it fits maxW (min 9). */
export function fitText(t: Phaser.GameObjects.Text, maxW: number, minSize = 9): Phaser.GameObjects.Text {
  let fs = parseInt(String(t.style.fontSize), 10) || 16;
  while (t.width > maxW && fs > minSize) t.setFontSize(--fs);
  return t;
}

export function uiIcon(scene: Phaser.Scene, x: number, y: number, name: UiIconName, size = 24): Phaser.GameObjects.Image {
  return scene.add.image(x, y, `ui-ic-${name}`).setDisplaySize(size, size);
}

// ------------------------------------------------------------------ panels
export type PanelVariant = 'wood' | 'glass' | 'cream' | 'tag' | 'receipt' | 'ticket';
export interface PanelOpts {
  /** 'center' (default) or 'topLeft': what x,y refer to. */
  origin?: 'center' | 'topLeft';
  shadow?: boolean;
  /** receipt/ticket: seed for the torn edge */
  seed?: number;
  /** ticket: y of the side notches as a fraction of height (default .32) */
  notch?: number;
  /** ticket: draw the tape strip on top (default true) */
  tape?: boolean;
  /** ticket: accent colour of the header stripe */
  accent?: number;
}
export interface UiPanel extends Phaser.GameObjects.Container {
  /** Content-area rectangle relative to the container centre (padding already applied). */
  inner: { x: number; y: number; w: number; h: number };
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Receipt outline polygon with a torn (zig-zag) top and bottom, centred on (0,0). */
function tornPoints(w: number, h: number, seed: number): Phaser.Math.Vector2[] {
  const r = rng(seed);
  const pts: Phaser.Math.Vector2[] = [];
  const v = (x: number, y: number) => pts.push(new Phaser.Math.Vector2(x, y));
  const l = -w / 2, rr = w / 2, t = -h / 2, b = h / 2;
  for (let x = l; x < rr; ) {
    const sw = 5 + r() * 5;
    v(x, t + 1 + r() * 2);
    v(Math.min(rr, x + sw * 0.5), t + 5 + r() * 3);
    x += sw;
  }
  v(rr, t + 2);
  v(rr, b - 2);
  const bottom: Phaser.Math.Vector2[] = [];
  for (let x = rr; x > l; ) {
    const sw = 5 + r() * 5;
    bottom.push(new Phaser.Math.Vector2(x, b - 1 - r() * 2));
    bottom.push(new Phaser.Math.Vector2(Math.max(l, x - sw * 0.5), b - 5 - r() * 3));
    x -= sw;
  }
  pts.push(...bottom);
  v(l, b - 2);
  v(l, t + 2);
  return pts;
}

/** Rounded rect polygon with optional semicircle notches on both sides. */
function ticketPoints(w: number, h: number, rad: number, notchY: number, notchR: number): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number, steps = 7) => {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  };
  const l = -w / 2, rr = w / 2, t = -h / 2, b = h / 2, ny = t + h * notchY;
  const P = Math.PI;
  arc(l + rad, t + rad, rad, P, P * 1.5);
  arc(rr - rad, t + rad, rad, P * 1.5, P * 2);
  if (notchR > 0) arc(rr, ny, notchR, P * 1.5, P * 0.5, 10); // clockwise bite into the right edge
  arc(rr - rad, b - rad, rad, 0, P * 0.5);
  arc(l + rad, b - rad, rad, P * 0.5, P);
  if (notchR > 0) arc(l, ny, notchR, P * 0.5, -P * 0.5, 10);
  return pts;
}

export function uiPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, variant: PanelVariant = 'wood', o: PanelOpts = {}): UiPanel {
  const cx = o.origin === 'topLeft' ? x + w / 2 : x;
  const cy = o.origin === 'topLeft' ? y + h / 2 : y;
  const c = scene.add.container(cx, cy).setSize(w, h) as UiPanel;
  const shadow = o.shadow !== false;
  let padIn = 12;
  if (variant === 'wood' || variant === 'glass' || variant === 'cream' || variant === 'tag') {
    if (shadow) c.add(uiShadow(scene, w, h));
    c.add(nine(scene, variant === 'tag' ? 'ui-panel-cream' : `ui-panel-${variant}`, w, h, `ui-panel-${variant === 'tag' ? 'cream' : variant}` as SliceKey));
    if (variant === 'tag') {
      const g = scene.add.graphics();
      g.lineStyle(1.6, 0xc89a5a, 0.95);
      g.beginPath();
      g.moveTo(-w / 2 + 11, -h / 2 + 10);
      g.lineTo(-w / 2 + 3, -h / 2 - 7);
      g.strokePath();
      c.add([g, scene.add.image(-w / 2 + 11, -h / 2 + 10, 'ui-hole').setDisplaySize(11, 11)]);
    }
  } else if (variant === 'receipt') {
    padIn = 18;
    const pts = tornPoints(w, h, o.seed ?? 7);
    const g = scene.add.graphics();
    for (const [dx, dy, a] of [[3, 6, 0.18], [2, 4, 0.2], [1, 2, 0.22]] as const) {
      g.fillStyle(0x0a0612, a);
      g.fillPoints(pts.map((p) => new Phaser.Math.Vector2(p.x + dx, p.y + dy)), true);
    }
    g.fillStyle(0xf3e8cc, 1);
    g.fillPoints(pts, true);
    g.fillGradientStyle(0xfdf6e3, 0xfdf6e3, 0xebdfbf, 0xebdfbf, 1);
    g.fillRect(-w / 2, -h / 2 + 8, w, h - 16);
    g.lineStyle(1.2, OUTLINE.color, 0.6);
    g.strokePoints(pts, true);
    // faint fold shadow near the top, and a warm top-edge highlight
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(-w / 2 + 1, -h / 2 + 8, w - 2, 1.5);
    c.add(g);
  } else {
    padIn = 14;
    const pts = ticketPoints(w, h, 10, o.notch ?? 0.32, 8);
    const g = scene.add.graphics();
    for (const [dx, dy, a] of [[2, 5, 0.2], [1, 3, 0.24]] as const) {
      g.fillStyle(0x0a0612, a);
      g.fillPoints(pts.map((p) => new Phaser.Math.Vector2(p.x + dx, p.y + dy)), true);
    }
    g.fillStyle(0xf5e8c6, 1);
    g.fillPoints(pts, true);
    g.fillStyle(0xffffff, 0.45).fillRect(-w / 2 + 12, -h / 2 + 7, w - 24, 1.5);
    g.fillStyle(0xb89560, 0.18).fillRect(-w / 2 + 12, h / 2 - 7, w - 24, 5);
    g.lineStyle(OUTLINE.width, OUTLINE.color, OUTLINE.alpha);
    g.strokePoints(pts, true);
    g.fillStyle(o.accent ?? 0xd6342b, 1);
    g.fillRect(-w / 2 + 11, -h / 2 + 2, w - 22, 5);
    // dashed tear line under the header
    g.lineStyle(1, 0xb89560, 0.7);
    const ty = -h / 2 + h * (o.notch ?? 0.32);
    for (let dx = -w / 2 + 14; dx < w / 2 - 14; dx += 8) g.lineBetween(dx, ty, dx + 4, ty);
    c.add(g);
    if (o.tape !== false) c.add(scene.add.image(0, -h / 2 + 1, 'ui-tape').setDisplaySize(40, 15).setAngle(-3));
  }
  c.inner = { x: -w / 2 + padIn, y: -h / 2 + padIn, w: w - padIn * 2, h: h - padIn * 2 };
  return c;
}

// ------------------------------------------------------------------ button
export type ButtonVariant = 'primary' | 'secondary' | 'green' | 'ghost' | 'icon';
export interface ButtonOpts {
  variant?: ButtonVariant;
  icon?: UiIconName;
  fontSize?: number;
  disabled?: boolean;
  /** Sound kind on press; null to silence. Default 'tap' ('confirm' for primary). */
  sound?: UiSoundKind | null;
  onClick?: () => void;
  /** Called when a disabled button is tapped (e.g. to toast why). */
  onDisabledClick?: () => void;
  textColor?: string;
  /** false: purely visual (no input); the owner handles hits and calls press() for feedback. Default true. */
  interactive?: boolean;
}
export interface UiButton extends Phaser.GameObjects.Container {
  label: Phaser.GameObjects.Text;
  setLabel(s: string): UiButton;
  setEnabled(on: boolean): UiButton;
  readonly enabled: boolean;
  /** Programmatic click with the same feedback as a tap. */
  click(): void;
  /** Press-and-release animation only (no onClick); for non-interactive faces. */
  press(): void;
}

export function uiButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, o: ButtonOpts = {}): UiButton {
  const variant = o.variant ?? 'primary';
  const H = o.interactive === false ? h : Math.max(T.minTap, h);
  const W = o.interactive === false ? w : Math.max(variant === 'icon' ? T.minTap : 56, w);
  const kind: BtnKind = variant === 'icon' ? 'secondary' : variant;
  const c = scene.add.container(x, y).setSize(W, H) as UiButton;
  const shadow = kind === 'ghost' ? null : uiShadow(scene, W - 4, H - 6, 1, 5, 0.5);
  const up = nine(scene, `ui-btn-${kind}`, W, H, 'ui-btn');
  const down = nine(scene, `ui-btn-${kind === 'ghost' ? 'ghost' : kind}-down`, W, H, 'ui-btn').setVisible(false);
  const off = nine(scene, 'ui-btn-disabled', W, H, 'ui-btn').setVisible(false);
  if (shadow) c.add(shadow);
  c.add([up, down, off]);
  const lift = kind === 'ghost' ? 0 : -2; // body sits above the 4 px lip
  const style = { ...T.text.button, fontSize: `${o.fontSize ?? (H >= 56 ? 22 : 18)}px`, color: o.textColor ?? T.text.button.color, stroke: kind === 'ghost' ? undefined : '#5a1410', strokeThickness: kind === 'primary' ? 3 : kind === 'green' ? 3 : 0 };
  if (kind === 'secondary') style.stroke = '#1b1230', style.strokeThickness = 2;
  if (kind === 'green') style.stroke = '#1d4a30';
  if (o.disabled) style.strokeThickness = 0;
  const lab = txt(scene, 0, lift, label, style).setOrigin(0.5);
  c.label = lab;
  let ic: Phaser.GameObjects.Image | null = null;
  const layout = () => {
    fitText(lab, W - 20 - (ic ? 24 : 0));
    if (ic) {
      const tw = lab.width;
      const gap = lab.text ? 6 : 0;
      const total = 22 + gap + tw;
      ic.setPosition(-total / 2 + 11, lab.y);
      lab.setX(label ? -total / 2 + 22 + gap + tw / 2 : 0);
    } else lab.setX(0);
  };
  if (o.icon) ic = uiIcon(scene, 0, lift, o.icon, 22);
  c.add(lab);
  if (ic) c.add(ic);
  layout();

  let enabled = !o.disabled;
  let pressed = false;
  const apply = (p: boolean) => {
    pressed = p;
    up.setVisible(enabled && !p);
    down.setVisible(enabled && p);
    off.setVisible(!enabled);
    const dy = lift + (p && enabled && kind !== 'ghost' ? 2 : 0);
    lab.setY(dy);
    ic?.setY(dy);
    lab.setAlpha(enabled ? 1 : 0.9).setColor(enabled ? (o.textColor ?? T.text.button.color) : '#c9bfdc');
    lab.setStroke(enabled ? (kind === 'green' ? '#1d4a30' : kind === 'secondary' ? '#1b1230' : '#5a1410') : '#1b1230', enabled ? (kind === 'ghost' ? 0 : kind === 'secondary' ? 2 : 3) : 2);
    ic?.setAlpha(enabled ? 1 : 0.5);
    shadow?.setAlpha(p ? 0.3 : enabled ? 0.5 : 0.3);
  };
  const squash = (to: { sx: number; sy: number }, dur: number, ease: string) => {
    scene.tweens.killTweensOf(c);
    scene.tweens.add({ targets: c, scaleX: to.sx, scaleY: to.sy, duration: dur, ease });
  };
  apply(false);
  const sound = () => {
    const snd = o.sound === undefined ? (variant === 'primary' ? 'confirm' : 'tap') : o.sound;
    if (snd) uiSound(snd);
  };
  const release = () => {
    if (!pressed) return;
    apply(false);
    squash({ sx: 1, sy: 1 }, 220, 'Back.easeOut');
  };
  if (o.interactive !== false) {
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      if (!enabled) return;
      apply(true);
      squash({ sx: 1.03, sy: 0.93 }, 70, 'Quad.easeOut');
      sound();
    });
    c.on('pointerout', release);
    c.on('pointerup', () => {
      if (!enabled) {
        o.onDisabledClick?.();
        return;
      }
      const was = pressed;
      release();
      if (was) o.onClick?.();
    });
  }
  c.press = () => {
    if (!enabled) return;
    apply(true);
    squash({ sx: 1.03, sy: 0.93 }, 70, 'Quad.easeOut');
    sound();
    scene.time.delayedCall(90, release);
  };
  c.setLabel = (s: string) => {
    lab.setText(s);
    lab.setFontSize(o.fontSize ?? (H >= 56 ? 22 : 18));
    layout();
    return c;
  };
  c.setEnabled = (on: boolean) => {
    enabled = on;
    apply(false);
    return c;
  };
  Object.defineProperty(c, 'enabled', { get: () => enabled });
  c.click = () => {
    if (!enabled) return o.onDisabledClick?.();
    apply(true);
    squash({ sx: 1.03, sy: 0.93 }, 70, 'Quad.easeOut');
    scene.time.delayedCall(90, () => {
      release();
      o.onClick?.();
    });
  };
  return c;
}

// ------------------------------------------------------------------ scene transitions
const FADE = [16, 10, 28] as const;
/** Call right after setupCamera() in create(): fades the scene in from night. */
export function uiFadeIn(scene: Phaser.Scene, ms = 260): void {
  scene.cameras.main.fadeIn(ms, ...FADE);
}
/** Fades out, then starts another scene. Ignores input meanwhile and ignores repeat calls. */
export function uiGoto(scene: Phaser.Scene, key: string, data?: object, ms = 220): void {
  const cam = scene.cameras.main;
  if (cam.fadeEffect.isRunning && !cam.fadeEffect.isComplete) {
    // fading in: let the new fade-out take over
  }
  if ((scene as unknown as { __going?: boolean }).__going) return;
  (scene as unknown as { __going?: boolean }).__going = true;
  scene.input.enabled = false;
  cam.fadeOut(ms, ...FADE);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    (scene as unknown as { __going?: boolean }).__going = false;
    scene.input.enabled = true;
    scene.scene.start(key, data);
  });
}

/** Quick press-feedback squash for custom hit-areas (e.g. manual list buttons). */
export function uiPop(scene: Phaser.Scene, target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, amount = 0.12): void {
  scene.tweens.killTweensOf(target);
  const sx = target.scaleX, sy = target.scaleY;
  scene.tweens.add({ targets: target, scaleX: sx * (1 - amount), scaleY: sy * (1 - amount), duration: 60, yoyo: true, ease: 'Quad.easeOut', onComplete: () => target.setScale(sx, sy) });
}

// ------------------------------------------------------------------ pills / badges / money
export interface PillOpts {
  kind?: PillKind;
  icon?: UiIconName;
  h?: number;
  minW?: number;
  style?: Phaser.Types.GameObjects.Text.TextStyle;
  /** 'center' (default) | 'left' | 'right': which side of the pill x is anchored to when the text changes. */
  anchor?: 'center' | 'left' | 'right';
}
export interface UiPill extends Phaser.GameObjects.Container {
  text: Phaser.GameObjects.Text;
  setText(s: string): UiPill;
  pillWidth: number;
}
const pillText = (k: PillKind): string => (k === 'lamp' || k === 'cream' || k === 'green' ? '#2a1608' : '#fff7ea');

export function uiPill(scene: Phaser.Scene, x: number, y: number, label: string, o: PillOpts = {}): UiPill {
  const kind = o.kind ?? 'dark';
  const h = o.h ?? 26;
  const c = scene.add.container(x, y) as UiPill;
  const bg = nine(scene, `ui-pill-${kind}`, 40, h, 'ui-pill');
  const t = txt(scene, 0, -1, label, { ...T.text.bodyBold, fontSize: `${Math.round(h * 0.55)}px`, color: pillText(kind), ...(o.style ?? {}) }).setOrigin(0.5);
  const ic = o.icon ? uiIcon(scene, 0, 0, o.icon, h - 6) : null;
  c.add([bg, t]);
  if (ic) c.add(ic);
  const anchor = o.anchor ?? 'center';
  const layout = () => {
    const gap = ic ? 4 : 0;
    const content = t.width + (ic ? h - 6 + gap : 0);
    const w = Math.max(o.minW ?? h, content + h * 0.9);
    nineResize(bg, w, h);
    const off = anchor === 'left' ? w / 2 : anchor === 'right' ? -w / 2 : 0;
    bg.x = off;
    const left = off - content / 2;
    if (ic) {
      ic.x = left + (h - 6) / 2;
      t.x = left + h - 6 + gap + t.width / 2;
    } else t.x = off;
    c.pillWidth = w;
    c.setSize(w, h);
  };
  c.setText = (s: string) => {
    t.setText(s);
    layout();
    return c;
  };
  c.text = t;
  layout();
  return c;
}

/** Round counter badge ("3", "NEW"), e.g. on a corner of a card. */
export function uiBadge(scene: Phaser.Scene, x: number, y: number, label: string, kind: PillKind = 'red'): UiPill {
  return uiPill(scene, x, y, label, { kind, h: 22, minW: 22, style: { fontSize: '12px' } });
}

/** Deal ribbon ("ถูกวันนี้" / "แพงวันนี้"). */
export function uiRibbon(scene: Phaser.Scene, x: number, y: number, label: string, deal: 'cheap' | 'dear'): UiPill {
  const p = uiPill(scene, x, y, label, { kind: deal === 'cheap' ? 'green' : 'red', icon: deal === 'cheap' ? 'fire' : undefined, h: 22, style: { fontSize: '12px' } });
  return p.setAngle(-4) as UiPill;
}

export interface MoneyOpts {
  value?: number;
  h?: number;
  anchor?: 'center' | 'left' | 'right';
  /** use a plain text (no pill background) e.g. on paper */
  bare?: boolean;
  style?: Phaser.Types.GameObjects.Text.TextStyle;
  fmt?: (n: number) => string;
}
export interface UiMoney extends Phaser.GameObjects.Container {
  value: number;
  /** Count up/down to n (ms duration, default scaled by delta). animate=false jumps. */
  setValue(n: number, animate?: boolean, ms?: number): UiMoney;
}
/** Baht chip: coin icon + number that counts up. */
export function uiMoney(scene: Phaser.Scene, x: number, y: number, o: MoneyOpts = {}): UiMoney {
  const h = o.h ?? 30;
  const fmt = o.fmt ?? baht;
  const pill = o.bare ? null : uiPill(scene, 0, 0, fmt(o.value ?? 0), { kind: 'dark', icon: 'money', h, anchor: o.anchor, style: { color: T.color.gold, fontSize: `${Math.round(h * 0.6)}px`, ...(o.style ?? {}) } });
  const c = scene.add.container(x, y) as UiMoney;
  let bareT: Phaser.GameObjects.Text | null = null;
  if (pill) c.add(pill);
  else {
    bareT = txt(scene, 0, 0, fmt(o.value ?? 0), { ...T.text.number, ...(o.style ?? {}) }).setOrigin(o.anchor === 'left' ? 0 : o.anchor === 'right' ? 1 : 0.5, 0.5);
    c.add(bareT);
  }
  c.value = o.value ?? 0;
  let shown = c.value;
  const show = (v: number) => {
    shown = v;
    if (pill) pill.setText(fmt(v));
    else bareT!.setText(fmt(v));
  };
  let counter: Phaser.Tweens.Tween | null = null;
  c.setValue = (n: number, animate = true, ms?: number) => {
    counter?.stop();
    c.value = n;
    if (!animate || Math.round(n) === Math.round(shown)) {
      show(n);
      return c;
    }
    const from = shown;
    const dur = ms ?? Phaser.Math.Clamp(Math.abs(n - from) * 3, 350, 1100);
    counter = scene.tweens.addCounter({
      from, to: n, duration: dur, ease: 'Cubic.easeOut',
      onUpdate: (tw) => show(tw.getValue() ?? n),
      onComplete: () => show(n),
    });
    return c;
  };
  return c;
}

// ------------------------------------------------------------------ stars
export interface UiStars extends Phaser.GameObjects.Container {
  setValue(v: number, animate?: boolean): UiStars;
}
export function uiStars(scene: Phaser.Scene, x: number, y: number, value: number, o: { size?: number; gap?: number; max?: number; animate?: boolean } = {}): UiStars {
  const size = o.size ?? 20, gap = o.gap ?? 2, max = o.max ?? 5;
  const c = scene.add.container(x, y) as UiStars;
  const total = max * size + (max - 1) * gap;
  const offs: Phaser.GameObjects.Image[] = [];
  const ons: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < max; i++) {
    const sx = -total / 2 + size / 2 + i * (size + gap);
    const off = scene.add.image(sx, 0, 'ui-star-off').setDisplaySize(size, size);
    const on = scene.add.image(sx, 0, 'ui-ic-star').setDisplaySize(size, size);
    offs.push(off);
    ons.push(on);
    c.add([off, on]);
  }
  const fill = (v: number) => {
    ons.forEach((on, i) => {
      const f = Phaser.Math.Clamp(v - i, 0, 1);
      on.setVisible(f > 0.04);
      const fw = on.frame.width;
      on.setCrop(0, 0, fw * f, on.frame.height);
    });
  };
  c.setValue = (v: number, animate = false) => {
    fill(animate ? 0 : v);
    if (animate) {
      ons.forEach((on, i) => {
        const f = Phaser.Math.Clamp(v - i, 0, 1);
        if (f <= 0.04) return;
        on.setVisible(false);
        scene.time.delayedCall(120 * i, () => {
          const base = size / on.frame.width;
          on.setVisible(true).setCrop(0, 0, on.frame.width * f, on.frame.height).setScale(base * 1.7);
          scene.tweens.add({ targets: on, scale: base, duration: 260, ease: 'Back.easeOut' });
          uiSound('coin');
        });
      });
    }
    return c;
  };
  c.setValue(value, o.animate);
  return c;
}

// ------------------------------------------------------------------ bar
export interface UiBar extends Phaser.GameObjects.Container {
  value: number;
  setValue(v: number, animate?: boolean, ms?: number): UiBar;
}
export function uiBar(scene: Phaser.Scene, x: number, y: number, w: number, o: { h?: number; kind?: BarKind; value?: number; shine?: boolean } = {}): UiBar {
  const h = o.h ?? 14;
  const c = scene.add.container(x, y).setSize(w, h) as UiBar;
  const track = nine(scene, 'ui-bar-track', w, h, 'ui-bar-track');
  const fill = nine(scene, `ui-bar-${o.kind ?? 'xp'}`, w, h, 'ui-bar-fill');
  const shine = scene.add.image(0, 0, 'ui-shine').setDisplaySize(20, h - 4).setAlpha(0);
  c.add([track, fill, shine]);
  let shineTw: Phaser.Tweens.TweenChain | null = null;
  const draw = (v: number) => {
    c.value = v;
    const fw = Math.max(h, (w - 2) * Phaser.Math.Clamp(v, 0, 1));
    fill.setVisible(v > 0.005);
    nineResize(fill, fw, h - 2);
    fill.x = -w / 2 + 1 + fw / 2;
    return fw;
  };
  const startShine = (fw: number) => {
    shineTw?.stop();
    shine.setAlpha(0);
    if (o.shine === false || fw < 40) return;
    const x0 = -w / 2 + 4, x1 = -w / 2 + fw - 12;
    shine.x = x0;
    shineTw = scene.tweens.chain({
      targets: shine,
      loop: -1,
      tweens: [
        { delay: 900, x: x1, alpha: { from: 0.9, to: 0.9 }, duration: 700, ease: 'Sine.easeInOut' },
        { alpha: 0, duration: 120 },
        { x: x0, duration: 1 },
      ],
    });
  };
  let counter: Phaser.Tweens.Tween | null = null;
  c.setValue = (v: number, animate = true, ms = 900) => {
    counter?.stop();
    if (!animate) {
      startShine(draw(v));
      return c;
    }
    const from = c.value;
    shine.setAlpha(0);
    counter = scene.tweens.addCounter({ from, to: v, duration: ms, ease: 'Cubic.easeOut', onUpdate: (tw) => draw(tw.getValue() ?? v), onComplete: () => startShine(draw(v)) });
    return c;
  };
  c.value = 0;
  startShine(draw(o.value ?? 0));
  c.once('destroy', () => shineTw?.stop());
  return c;
}

// ------------------------------------------------------------------ toast
export interface ToastOpts {
  icon?: UiIconName;
  kind?: PillKind;
  x?: number;
  y?: number;
  hold?: number;
}
/** Pill toast: slides up while fading in, holds, then floats away. Returns the container. */
export function uiToast(scene: Phaser.Scene, msg: string, o: ToastOpts = {}): Phaser.GameObjects.Container {
  const x = o.x ?? GAME_W / 2;
  const y = o.y ?? GAME_H * 0.72;
  const p = uiPill(scene, x, y + 14, msg, { kind: o.kind ?? 'dark', icon: o.icon, h: 36, style: { fontSize: '16px', color: o.kind === 'lamp' || o.kind === 'cream' || o.kind === 'green' ? '#2a1608' : '#fff4dc' } });
  const sh = uiShadow(scene, p.pillWidth, 34, 1, 4, 0.5);
  p.addAt(sh, 0);
  p.setDepth(T.depth.toast).setAlpha(0).setScale(0.92);
  uiSound(o.icon === 'close' ? 'error' : 'toast');
  scene.tweens.chain({
    targets: p,
    tweens: [
      { y, alpha: 1, scale: 1, duration: 220, ease: 'Back.easeOut' },
      { delay: o.hold ?? 900, y: y - 18, alpha: 0, duration: 380, ease: 'Sine.easeIn' },
    ],
    onComplete: () => p.destroy(),
  });
  return p;
}

// ------------------------------------------------------------------ divider / section header / stamp
export function uiDivider(scene: Phaser.Scene, x: number, y: number, w: number, style: 'line' | 'dashed' | 'dots' = 'line', color = 0xf6e7c8, alpha = 0.3): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  if (style === 'line') {
    g.lineStyle(1, color, alpha).lineBetween(-w / 2, 0, w / 2, 0);
    g.lineStyle(1, 0xffffff, alpha * 0.4).lineBetween(-w / 2, 1, w / 2, 1);
  } else if (style === 'dashed') {
    g.lineStyle(1.4, color, alpha + 0.2);
    for (let dx = -w / 2; dx < w / 2 - 3; dx += 7) g.lineBetween(dx, 0, dx + 3.5, 0);
  } else {
    g.lineStyle(1, color, alpha).lineBetween(-w / 2, 0, -8, 0).lineBetween(8, 0, w / 2, 0);
    g.fillStyle(PALETTE.ember.hex, 1).fillTriangle(0, -4, 4, 0, 0, 4).fillTriangle(0, -4, -4, 0, 0, 4);
  }
  return scene.add.container(x, y, [g]);
}

export function uiSectionHeader(scene: Phaser.Scene, x: number, y: number, label: string, o: { w?: number; icon?: UiIconName; color?: string } = {}): Phaser.GameObjects.Container {
  const w = o.w ?? 300;
  const t = txt(scene, 0, 0, label, { ...T.text.heading, color: o.color ?? T.color.lamp }).setOrigin(0.5);
  const c = scene.add.container(x, y);
  const half = t.width / 2 + (o.icon ? 16 : 0) + 10;
  const g = scene.add.graphics();
  g.lineStyle(1.4, PALETTE.lamp.hex, 0.5);
  g.lineBetween(-w / 2, 0, -half, 0).lineBetween(half, 0, w / 2, 0);
  g.fillStyle(PALETTE.lamp.hex, 0.7).fillCircle(-half - 3, 0, 1.8).fillCircle(half + 3, 0, 1.8);
  c.add([g, t]);
  if (o.icon) {
    t.x = 12;
    c.add(uiIcon(scene, -t.width / 2 - 2, 0, o.icon, 20));
  }
  return c;
}

export interface UiStamp extends Phaser.GameObjects.Container {
  /** Slam-in animation with a little shake. */
  slam(delay?: number): UiStamp;
}
/** Rubber-stamp: double border + rotated text, in `color` (css). */
export function uiStamp(scene: Phaser.Scene, x: number, y: number, label: string, color: string, o: { angle?: number; size?: number; w?: number } = {}): UiStamp {
  const size = o.size ?? 26;
  const t = txt(scene, 0, 0, label, { fontFamily: FONT_FUN, fontStyle: 'bold', fontSize: `${size}px`, color }).setOrigin(0.5);
  const w = o.w ?? t.width + 28, h = size + 22;
  const g = scene.add.graphics();
  const col = Phaser.Display.Color.HexStringToColor(color).color;
  g.lineStyle(3, col, 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
  g.lineStyle(1.2, col, 0.8).strokeRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 5);
  const c = scene.add.container(x, y, [g, t]) as UiStamp;
  t.setAlpha(0.92);
  c.setAngle(o.angle ?? -8).setAlpha(0).setScale(2.2);
  c.slam = (delay = 0) => {
    scene.time.delayedCall(delay, () => {
      uiSound('stamp');
      scene.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 170, ease: 'Quad.easeIn', onComplete: () => scene.cameras.main.shake(90, 0.0035) });
    });
    return c;
  };
  return c;
}

// ------------------------------------------------------------------ modal
export interface UiModal {
  root: Phaser.GameObjects.Container;
  panel: UiPanel;
  /** Container at the panel's centre: add your content here (coordinates relative to the panel centre). */
  body: Phaser.GameObjects.Container;
  close(): void;
}
export function uiModal(scene: Phaser.Scene, o: { w: number; h: number; title?: string; variant?: PanelVariant; onClose?: () => void; closable?: boolean }): UiModal {
  const root = scene.add.container(0, 0).setDepth(T.depth.modal);
  const dim = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x0a0612, 0.7).setOrigin(0).setInteractive();
  const cy = GAME_H / 2;
  const panel = uiPanel(scene, GAME_W / 2, cy, o.w, o.h, o.variant ?? 'glass');
  const body = scene.add.container(GAME_W / 2, cy);
  root.add([dim, panel, body]);
  if (o.title) {
    const h = uiSectionHeader(scene, 0, -o.h / 2 + 28, o.title, { w: o.w - 40 });
    body.add(h);
  }
  const close = () => {
    scene.tweens.add({ targets: root, alpha: 0, duration: 140, onComplete: () => root.destroy() });
    o.onClose?.();
  };
  if (o.closable) {
    const x = uiButton(scene, o.w / 2 - 26, -o.h / 2 + 26, 44, 44, '', { variant: 'icon', icon: 'close', onClick: close });
    body.add(x);
  }
  root.setAlpha(0);
  panel.setScale(0.92);
  body.setScale(0.92);
  scene.tweens.add({ targets: root, alpha: 1, duration: 140 });
  scene.tweens.add({ targets: [panel, body], scale: 1, duration: 220, ease: 'Back.easeOut' });
  return { root, panel, body, close };
}

// ------------------------------------------------------------------ banner / confetti
/** Celebration banner ("เลเวลอัป!"): lamp-gold pill with stars; gently pulses. */
export function uiBanner(scene: Phaser.Scene, x: number, y: number, label: string, w = 280): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const bg = nine(scene, 'ui-pill-lamp', w, 44, 'ui-pill');
  const t = txt(scene, 0, -1, label, { fontFamily: FONT_FUN, fontStyle: 'bold', fontSize: '20px', color: '#3a1604' }).setOrigin(0.5);
  fitText(t, w - 90);
  c.add([uiShadow(scene, w, 40, 1, 5, 0.5), bg, t, uiIcon(scene, -w / 2 + 24, 0, 'star', 26), uiIcon(scene, w / 2 - 24, 0, 'star', 26)]);
  scene.tweens.add({ targets: c, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return c;
}

/** One-shot confetti burst from (x,y), falling. Self-cleaning. */
export function uiConfetti(scene: Phaser.Scene, x: number, y: number, count = 36): void {
  uiSound('levelup');
  for (const k of ['r', 'a', 'g', 'c', 'p']) {
    const em = scene.add.particles(x, y, `ui-confetti-${k}`, {
      speed: { min: 120, max: 340 },
      angle: { min: 215, max: 325 },
      gravityY: 520,
      lifespan: { min: 1100, max: 1900 },
      rotate: { min: 0, max: 360 },
      scaleX: { start: 1 / RES, end: 0.2 / RES },
      scaleY: { start: 1 / RES, end: 1 / RES },
      quantity: Math.ceil(count / 5),
      emitting: false,
    });
    em.setDepth(T.depth.toast);
    em.explode(Math.ceil(count / 5));
    scene.time.delayedCall(2200, () => em.destroy());
  }
}
export { FONT };
