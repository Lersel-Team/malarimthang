import Phaser from 'phaser';
import { setupCamera } from '../engine/hidpi';
import { GAME_H, GAME_W } from '../config';
import { endDay, xpForLevel, type DaySummary, type GameState, type ShiftResult } from '../core/economy';
import { session, todayLocal } from '../session';
import { renameShop } from './nameInput';
import { baht } from './ui';
import {
  fitText, nightStreet, uiBanner, uiBar, uiButton, uiConfetti, uiDivider, uiFadeIn, uiGoto, uiIcon, uiPanel, uiStamp, uiStars, uiTheme, uiSound,
} from '../art/ui';

const T = uiTheme;
const INK = T.color.paperInk;
const GREEN = '#1a7a3a';
const RED = '#c01818';

export class SummaryScene extends Phaser.Scene {
  private nameText!: Phaser.GameObjects.Text;
  constructor() {
    super('Summary');
  }

  create() {
    setupCamera(this);
    const result: ShiftResult | null = session.pendingResult;
    const before = session.state;
    if (!result || !before) {
      this.scene.start('Market');
      return;
    }
    uiFadeIn(this);
    const day = before.day;
    const { state, summary } = endDay(before, result, todayLocal());
    session.pendingResult = null;
    session.lastSummary = summary;
    void session.commit(state);
    this.build(day, result, summary, state);
  }

  private build(day: number, r: ShiftResult, sm: DaySummary, st: GameState) {
    nightStreet(this);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0a0612, 0.45).setOrigin(0);
    const px = 18, py = 14, pw = 324, ph = 640;
    uiPanel(this, px, py, pw, ph, 'receipt', { origin: 'topLeft', seed: 3 + day });

    const steps: (() => void)[] = []; // revealed one by one, like a printing receipt
    const objsOf: Phaser.GameObjects.GameObject[][] = [];
    const reveal = (objs: Phaser.GameObjects.GameObject[], fn?: () => void) => {
      objs.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0));
      objsOf.push(objs);
      steps.push(() => {
        for (const o of objs) this.tweens.add({ targets: o, alpha: 1, duration: 140 });
        fn?.();
      });
    };
    const text = (x: number, y: number, s: string, size: number, color: string, bold = false) =>
      this.add.text(x, y, s, { ...T.text.paper, fontStyle: bold ? 'bold' : 'normal', fontSize: `${size}px`, color });

    const name = (this.nameText = text(GAME_W / 2, py + 26, st.shopName, 18, '#b02a1a', true).setOrigin(0.5));
    name.setFontFamily(T.text.heading.fontFamily);
    fitText(name, pw - 60);
    text(GAME_W / 2, py + 58, `สรุปยอดวันที่ ${day}`, 24, INK, true).setOrigin(0.5).setFontFamily(T.text.heading.fontFamily);
    let y = py + 90;
    const dash = () => {
      const d = uiDivider(this, GAME_W / 2, y + 2, pw - 36, 'dashed', 0x7a6552, 0.6);
      reveal([d]);
      y += 12;
    };
    interface RowOpts { color?: string; big?: boolean; neg?: boolean; icon?: Parameters<typeof uiIcon>[3] }
    /** A line with a number that counts up. */
    const money = (k: string, n: number, o: RowOpts = {}) => {
      const size = o.big ? 19 : 15;
      const color = o.color ?? INK;
      const label = text(px + 20, y, k, size, color, o.big);
      const val = text(px + pw - 20, y, '', size, color, o.big).setOrigin(1, 0);
      const fmt = (v: number) => `${n < 0 ? '-' : o.neg ? '-' : ''}${baht(Math.abs(v))}`;
      val.setText(fmt(0));
      reveal([label, val], () => {
        this.tweens.addCounter({ from: 0, to: n, duration: 520, ease: 'Cubic.easeOut', onUpdate: (tw) => val.setText(fmt(tw.getValue() ?? n)), onComplete: () => val.setText(fmt(n)) });
        uiSound('tap');
      });
      y += o.big ? 28 : 22;
    };
    const plain = (k: string, v: string, o: RowOpts = {}) => {
      const label = text(px + 20, y, k, 15, o.color ?? INK);
      const val = text(px + pw - 20, y, v, 15, o.color ?? INK).setOrigin(1, 0);
      reveal([label, val]);
      y += 22;
    };
    dash();
    money('ขาย', r.sales);
    money('ทิป', r.tips);
    money('คอมโบ', r.combo);
    money('รายรับรวม', sm.revenue, { big: true });
    dash();
    money('ต้นทุนวัตถุดิบ', sm.ingredientCost, { neg: true });
    money('ค่าเช่า', sm.rent, { neg: true });
    money('ค่าถ่าน', sm.charcoal, { neg: true });
    if (sm.wages > 0) money('ค่าจ้าง', sm.wages, { neg: true });
    money('ของเน่า', sm.spoilage, { neg: true });
    dash();
    const profitY = y;
    money('กำไรสุทธิ', Math.abs(sm.profit) * (sm.profit < 0 ? -1 : 1), { big: true, color: sm.profit < 0 ? RED : GREEN });
    if (sm.loanRepaid > 0) money('คืนเงินแม่', sm.loanRepaid, { neg: true, color: '#7a5a30' });
    dash();
    const wasted = Object.values(r.wasted).reduce((a, b) => a + b, 0);
    plain('ลูกค้าที่เสิร์ฟ / เดินหนี', `${r.served} / ${r.walkouts}`);
    plain('ไม้ที่ขาย / เสีย', `${Object.values(r.sold).reduce((a, b) => a + b, 0)} / ${wasted}`);
    // star rows
    {
      const label = text(px + 20, y, 'คะแนนวันนี้', 15, INK);
      const st1 = uiStars(this, px + pw - 20 - 34 - 37, y + 12, r.avgStars ?? 0, { size: 14, gap: 1 });
      const num = text(px + pw - 20, y, r.avgStars === null ? '-' : r.avgStars.toFixed(1), 15, INK).setOrigin(1, 0);
      reveal([label, st1, num]);
      y += 22;
    }
    {
      const label = text(px + 20, y, 'คะแนนร้าน', 15, INK);
      const val = text(px + pw - 20, y, `${session.ratingBefore.toFixed(1)} → ${st.rating.toFixed(1)}`, 15, INK, true).setOrigin(1, 0);
      const ic = uiIcon(this, val.getBounds().left - 12, y + 12, 'star', 16);
      reveal([label, ic, val]);
      y += 22;
    }
    if (st.streak.count > 1) {
      const label = text(px + 20, y, 'เล่นต่อเนื่อง', 15, '#b05a10');
      const ic = uiIcon(this, px + pw - 20 - 66, y + 12, 'fire', 18);
      const val = text(px + pw - 20, y, `${st.streak.count} วัน`, 15, '#b05a10', true).setOrigin(1, 0);
      reveal([label, ic, val]);
      y += 22;
    }

    // XP bar
    y += 8;
    const need = xpForLevel(st.level);
    const leveled = sm.leveledUpTo !== null;
    {
      const l = text(px + 20, y, `เลเวล ${st.level}  +${r.xpEarned} XP`, 13, INK, true);
      const v = text(px + pw - 20, y, `${st.xp}/${need}`, 13, INK).setOrigin(1, 0);
      const startFrac = leveled ? 0 : Math.max(0, (st.xp - r.xpEarned) / need);
      const bar = uiBar(this, GAME_W / 2, y + 28, pw - 40, { value: startFrac, h: 14, kind: 'xp' });
      reveal([l, v, bar], () => {
        if (leveled) {
          bar.setValue(1, true, 700);
          this.time.delayedCall(780, () => {
            bar.setValue(0, false);
            bar.setValue(st.xp / need, true, 500);
          });
        } else bar.setValue(Math.min(1, st.xp / need), true, 800);
      });
    }
    y += 52;
    if (leveled) {
      const b = uiBanner(this, GAME_W / 2, y + 14, `เลเวลอัป! เลเวล ${sm.leveledUpTo}`, 264);
      reveal([b], () => uiConfetti(this, GAME_W / 2, y + 20, 60));
    }

    // profit / loss stamp, slammed onto the profit line
    const loss = sm.profit < 0;
    const stamp = uiStamp(this, GAME_W / 2 + 2, profitY + 13, loss ? 'ขาดทุน' : 'กำไร', loss ? RED : GREEN, { angle: loss ? -8 : -7, size: 16 });
    steps.push(() => stamp.slam(0));

    // sequence the reveal
    steps.forEach((fn, i) => this.time.delayedCall(260 + i * 70, fn));
    const total = 260 + steps.length * 70;

    // continue + rename
    const go = uiButton(this, GAME_W / 2, py + ph - 38, 280, 52, 'ไปตลาดวันใหม่', { fontSize: 22, onClick: () => uiGoto(this, 'Market') });
    go.setAlpha(0);
    this.tweens.add({ targets: go, alpha: 1, duration: 250, delay: Math.min(total, 1200) });
    const link = uiButton(this, GAME_W / 2, GAME_H - 28, 150, 44, 'เปลี่ยนชื่อร้าน', {
      variant: 'ghost', fontSize: 14, icon: 'brush',
      onClick: () =>
        renameShop(this.game, (n) => {
          this.nameText.setText(n).setFontSize(18);
          fitText(this.nameText, pw - 60);
        }),
    });
    void link;
  }
}
