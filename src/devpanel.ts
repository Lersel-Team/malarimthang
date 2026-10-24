// Test-stage cheat/reset panel. Shown in dev builds, or in any build with ?debug=1 (remembered in localStorage 'mrt.debug').
// Pure DOM overlay: never touches game art. Edits go through session.commit so they autosave like normal play.
import type Phaser from 'phaser';
import { newGame, xpForLevel, type GameState } from './core/economy';
import { ITEMS, LOCATIONS, UPGRADES } from './data/balance';
import { session } from './session';

const FLAG = 'mrt.debug';

export function debugEnabled(): boolean {
  try {
    if (new URLSearchParams(location.search).get('debug') === '1') localStorage.setItem(FLAG, '1');
    if (new URLSearchParams(location.search).get('debug') === '0') localStorage.removeItem(FLAG);
    return import.meta.env.DEV || localStorage.getItem(FLAG) === '1';
  } catch {
    return import.meta.env.DEV;
  }
}

type Edit = (s: GameState) => GameState;

export function mountDevPanel(game: Phaser.Game): void {
  if (!debugEnabled() || document.getElementById('mrt-dev')) return;

  const restartScene = () => {
    const sc = game.scene.getScenes(true)[0];
    if (sc) sc.scene.restart();
  };
  const apply = (edit: Edit) => async () => {
    if (!session.state) return say('ยังไม่มีเซฟ (ตั้งชื่อร้านก่อน)');
    await session.commit(edit(session.state));
    restartScene();
    say('ทำแล้ว');
  };
  const maxUpgrades = (): Record<string, number> =>
    Object.fromEntries(UPGRADES.map((u) => [u.id, u.values.length - 1]));

  const actions: [string, () => void | Promise<void>, string?][] = [
    ['🗑 รีเซ็ตทั้งหมด (เริ่มใหม่)', async () => {
      if (!confirm('ลบเซฟทั้งหมดและเริ่มใหม่?')) return;
      await session.repo?.clear();
      Object.keys(localStorage).filter((k) => k.startsWith('malarimthang_')).forEach((k) => localStorage.removeItem(k));
      location.reload();
    }, 'danger'],
    ['↺ รีเซ็ตสถิติ (เก็บชื่อร้าน)', apply((s) => ({ ...newGame(), shopName: s.shopName }))],
    ['💰 +฿1,000', apply((s) => ({ ...s, money: s.money + 1000 }))],
    ['💰 +฿10,000', apply((s) => ({ ...s, money: s.money + 10000 }))],
    ['💸 เงิน = 0', apply((s) => ({ ...s, money: 0 }))],
    ['⭐ เลเวล +1', apply((s) => ({ ...s, level: Math.min(20, s.level + 1), xp: 0 }))],
    ['⭐ เลเวล 10', apply((s) => ({ ...s, level: 10, xp: Math.floor(xpForLevel(10) / 2) }))],
    ['📅 วันถัดไป', apply((s) => ({ ...s, day: s.day + 1, bought: {} }))],
    ['📈 เรตติ้ง 5.0', apply((s) => ({ ...s, rating: 5 }))],
    ['📉 เรตติ้ง 1.0', apply((s) => ({ ...s, rating: 1 }))],
    ['🍢 ปลดล็อกทุกเมนู', apply((s) => ({ ...s, unlockedItems: ITEMS.map((i) => i.id) }))],
    ['📍 ปลดล็อกทุกทำเล', apply((s) => ({ ...s, unlockedLocations: LOCATIONS.map((l) => l.id) }))],
    ['⬆ อัปเกรดสูงสุดทุกอย่าง', apply((s) => ({ ...s, upgrades: maxUpgrades() }))],
    ['📦 เติมสต็อก 30 ทุกเมนู', apply((s) => ({ ...s, stock: Object.fromEntries(s.unlockedItems.map((id) => [id, 30])), costBasis: undefined }))],
    ['🧹 ล้างสต็อก/หนี้', apply((s) => ({ ...s, stock: {}, loan: 0, loanDay: undefined, bought: {} }))],
    ['🔥 ล้างสตรีค', apply((s) => ({ ...s, streak: { count: 0, lastDate: null } }))],
    ['📋 ดูเซฟ (JSON)', () => {
      say(JSON.stringify(session.state, null, 1).slice(0, 1800) || 'ไม่มีเซฟ');
    }],
  ];

  const css = document.createElement('style');
  css.textContent = `
    #mrt-dev-btn{position:fixed;left:6px;top:6px;z-index:99998;width:34px;height:34px;border-radius:17px;border:1.5px solid #1b1230;background:#ffb24a;color:#1b1230;font:700 15px Kanit,sans-serif;opacity:.85;cursor:pointer;touch-action:manipulation}
    #mrt-dev{position:fixed;left:6px;top:46px;z-index:99998;width:min(300px,calc(100vw - 12px));max-height:calc(100vh - 56px);overflow:auto;background:#1b1230f2;border:1.5px solid #ffb24a;border-radius:12px;padding:8px;font:500 13px Kanit,sans-serif;color:#f6e7c8;display:none;box-shadow:0 8px 24px #0008}
    #mrt-dev.open{display:block}
    #mrt-dev h4{margin:2px 4px 6px;font:700 13px Kanit,sans-serif;color:#ffb24a}
    #mrt-dev button{display:block;width:100%;margin:4px 0;padding:9px 10px;border-radius:9px;border:1px solid #5a3f8a;background:#2a1d47;color:#f6e7c8;font:500 13px Kanit,sans-serif;text-align:left;cursor:pointer;touch-action:manipulation}
    #mrt-dev button.danger{border-color:#d6342b;background:#4a1620}
    #mrt-dev button:active{background:#5a3f8a}
    #mrt-dev pre{white-space:pre-wrap;font:11px/1.35 monospace;color:#9ee0b0;margin:6px 2px 0;max-height:220px;overflow:auto}
    #mrt-dev .note{margin:2px 4px 6px;color:#b9a7d8;font-size:11px}`;
  document.head.appendChild(css);

  const btn = document.createElement('button');
  btn.id = 'mrt-dev-btn';
  btn.textContent = 'DEV';
  btn.style.fontSize = '10px';
  const panel = document.createElement('div');
  panel.id = 'mrt-dev';
  const head = document.createElement('h4');
  head.textContent = 'เมนูทดสอบ (test stage)';
  const note = document.createElement('div');
  note.className = 'note';
  note.textContent = 'แก้เซฟแล้วฉากปัจจุบันจะเริ่มใหม่ · ปิดด้วย ?debug=0';
  const out = document.createElement('pre');
  panel.append(head, note);
  for (const [label, fn, kind] of actions) {
    const b = document.createElement('button');
    b.textContent = label;
    if (kind) b.className = kind;
    b.onclick = () => void fn();
    panel.appendChild(b);
  }
  panel.appendChild(out);
  function say(msg: string) {
    out.textContent = msg;
  }
  btn.onclick = () => panel.classList.toggle('open');
  document.body.append(btn, panel);
}
