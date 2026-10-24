import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../config';
import { endDay, xpForLevel, type DaySummary, type GameState, type ShiftResult } from '../core/economy';
import { session, todayLocal } from '../session';
import { FONT } from './grill/draw';
import { renameShop } from './nameInput';
import { baht, makeBtn } from './ui';

const INK = '#3a2a20';

export class SummaryScene extends Phaser.Scene {
  private nameText!: Phaser.GameObjects.Text;
  constructor() {
    super('Summary');
  }

  create() {
    const result: ShiftResult | null = session.pendingResult;
    const before = session.state;
    if (!result || !before) {
      this.scene.start('Market');
      return;
    }
    const day = before.day;
    const { state, summary } = endDay(before, result, todayLocal());
    session.pendingResult = null;
    session.lastSummary = summary;
    void session.commit(state);
    this.build(day, result, summary, state);
  }

  private build(day: number, r: ShiftResult, sm: DaySummary, st: GameState) {
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x140d1c).setOrigin(0);
    const px = 20, py = 16, pw = 320, ph = 640;
    const g = this.add.graphics();
    g.fillStyle(0xf4ecd8, 1);
    g.fillRoundedRect(px, py, pw, ph, 10);
    // zig-zag top/bottom edge of the receipt
    g.fillStyle(0x140d1c, 1);
    for (let x = px; x < px + pw; x += 10) {
      g.fillTriangle(x, py, x + 10, py, x + 5, py + 6);
      g.fillTriangle(x, py + ph, x + 10, py + ph, x + 5, py + ph - 6);
    }
    const T = (x: number, y: number, s: string, size: number, color: string) => this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color });
    const name = this.nameText = T(GAME_W / 2, py + 14, st.shopName, 18, '#b02a1a').setOrigin(0.5, 0);
    for (let fs = 18; name.width > pw - 40 && fs > 9; fs--) name.setFontSize(fs);
    T(GAME_W / 2, py + 38, `สรุปยอดวันที่ ${day}`, 24, INK).setOrigin(0.5, 0);
    let y = py + 76;
    const dash = () => {
      T(GAME_W / 2, y - 4, '- - - - - - - - - - - - - - - - - -', 12, '#8a7a68').setOrigin(0.5, 0);
      y += 16;
    };
    const row = (k: string, v: string, color = INK, big = false) => {
      T(px + 18, y, k, big ? 19 : 15, color);
      T(px + pw - 18, y, v, big ? 19 : 15, color).setOrigin(1, 0);
      y += big ? 28 : 23;
    };
    dash();
    row('ขาย', baht(r.sales));
    row('ทิป', baht(r.tips));
    row('คอมโบ', baht(r.combo));
    row('รายรับรวม', baht(sm.revenue), INK, true);
    dash();
    row('ต้นทุนวัตถุดิบ', `-${baht(sm.ingredientCost)}`);
    row('ค่าเช่า', `-${baht(sm.rent)}`);
    row('ค่าถ่าน', `-${baht(sm.charcoal)}`);
    if (sm.wages > 0) row('ค่าจ้าง', `-${baht(sm.wages)}`);
    row('ของเน่า', `-${baht(sm.spoilage)}`);
    dash();
    row('กำไรสุทธิ', `${sm.profit < 0 ? '-' : ''}${baht(Math.abs(sm.profit))}`, sm.profit < 0 ? '#c01818' : '#1a7a3a', true);
    if (sm.loanRepaid > 0) row('คืนเงินแม่', `-${baht(sm.loanRepaid)}`, '#7a5a30');
    dash();
    const wasted = Object.values(r.wasted).reduce((a, b) => a + b, 0);
    row('ลูกค้าที่เสิร์ฟ / เดินหนี', `${r.served} / ${r.walkouts}`);
    row('ไม้ที่ขาย / เสีย', `${Object.values(r.sold).reduce((a, b) => a + b, 0)} / ${wasted}`);
    row('⭐ คะแนนวันนี้', r.avgStars === null ? '-' : r.avgStars.toFixed(1));
    row('⭐ คะแนนร้าน', `${session.ratingBefore.toFixed(1)} → ${st.rating.toFixed(1)}`);
    if (st.streak.count > 1) row('🔥 เล่นต่อเนื่อง', `${st.streak.count} วัน`, '#b05a10');
    // XP bar
    y += 4;
    const need = xpForLevel(st.level);
    T(px + 18, y, `เลเวล ${st.level}  +${r.xpEarned} XP`, 13, INK);
    T(px + pw - 18, y, `${st.xp}/${need}`, 13, INK).setOrigin(1, 0);
    y += 20;
    g.fillStyle(0xd8ccb0, 1);
    g.fillRoundedRect(px + 18, y, pw - 36, 8, 4);
    g.fillStyle(0xf0a020, 1);
    g.fillRoundedRect(px + 18, y, Math.max(4, (pw - 36) * Math.min(1, st.xp / need)), 8, 4);
    y += 20;
    if (sm.leveledUpTo !== null) {
      const b = this.add
        .text(GAME_W / 2, y + 14, `🎉 เลเวลอัป! เลเวล ${sm.leveledUpTo}`, { fontFamily: FONT, fontSize: '20px', color: '#fff', backgroundColor: '#e07a10', padding: { x: 14, y: 6 } })
        .setOrigin(0.5);
      this.tweens.add({ targets: b, scale: 1.08, duration: 500, yoyo: true, repeat: -1 });
    }
    makeBtn(this, GAME_W / 2, py + ph - 38, 'ไปตลาดวันใหม่ ▶', '#c0302a', () => this.scene.start('Market'), 22, { x: 22, y: 10 });
    const link = this.add
      .text(GAME_W / 2, py + ph + 34, 'เปลี่ยนชื่อร้าน', { fontFamily: FONT, fontSize: '14px', color: '#9a8aa8' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    link.on('pointerup', () => renameShop(this.game, (n) => {
        this.nameText.setText(n).setFontSize(18);
        for (let fs = 18; this.nameText.width > pw - 40 && fs > 9; fs--) this.nameText.setFontSize(fs);
      }));
  }
}
