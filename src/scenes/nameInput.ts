// DOM text-input overlay (Phaser's canvas can't do Thai IME). Positioned over the game canvas.
import { DEFAULT_SHOP_NAME, session } from '../session';

export interface NameInputOpts {
  game: Phaser.Game;
  title: string;
  initial: string;
  /** Allow closing without saving (rename); false on first launch. */
  cancellable: boolean;
  confirmLabel?: string;
  onDone: (name: string | null) => void;
}

const FONT = '"Kanit", "Noto Sans Thai", Tahoma, sans-serif';
export const NAME_MAX = 24;

/** Opens the overlay; returns a close function. Empty input falls back to the default name. */
export function openNameInput(o: NameInputOpts): () => void {
  const canvas = o.game.canvas;
  const host = document.createElement('div');
  let done = false;
  const place = () => {
    const r = canvas.getBoundingClientRect();
    Object.assign(host.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    host.style.fontSize = `${Math.max(10, r.width / 360 * 16)}px`;
  };
  Object.assign(host.style, {
    position: 'fixed', zIndex: '1000', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(10,6,16,0.82)', fontFamily: FONT, color: '#f6d8a0',
  });
  const card = document.createElement('div');
  Object.assign(card.style, {
    width: '84%', background: '#2a1d36', border: '2px solid #ff7a4a', borderRadius: '14px',
    padding: '1.4em 1.1em', textAlign: 'center', boxSizing: 'border-box',
  });
  const title = document.createElement('div');
  title.textContent = o.title;
  Object.assign(title.style, { fontSize: '1.35em', marginBottom: '0.8em' });
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = NAME_MAX;
  input.value = o.initial;
  input.setAttribute('enterkeyhint', 'done');
  input.setAttribute('autocomplete', 'off');
  Object.assign(input.style, {
    width: '100%', boxSizing: 'border-box', fontSize: '1.2em', fontFamily: FONT, padding: '0.5em 0.6em',
    borderRadius: '8px', border: '2px solid #6a4a7a', background: '#140d1c', color: '#ffd9a0', textAlign: 'center', outline: 'none',
  });
  const row = document.createElement('div');
  Object.assign(row.style, { marginTop: '1em', display: 'flex', gap: '0.6em', justifyContent: 'center' });
  const mkBtn = (label: string, bg: string, fn: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
      fontFamily: FONT, fontSize: '1.15em', color: '#fff', background: bg, border: 'none', borderRadius: '8px',
      padding: '0.5em 1.2em', cursor: 'pointer',
    });
    b.addEventListener('click', fn);
    return b;
  };
  const close = (name: string | null) => {
    if (done) return;
    done = true;
    window.removeEventListener('resize', place);
    host.remove();
    o.onDone(name);
  };
  const ok = () => close(input.value.trim().slice(0, NAME_MAX) || DEFAULT_SHOP_NAME);
  row.append(mkBtn(o.confirmLabel ?? 'ตกลง', '#c0302a', ok));
  if (o.cancellable) row.append(mkBtn('ยกเลิก', '#5a3a6a', () => close(null)));
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.isComposing) ok();
    else if (e.key === 'Escape' && o.cancellable) close(null);
  });
  card.append(title, input, row);
  host.append(card);
  document.body.append(host);
  window.addEventListener('resize', place);
  place();
  setTimeout(() => {
    input.focus();
    input.select();
  }, 0);
  return () => close(null);
}

/** Rename flow shared by Market / Shift / Summary. Commits via the session; calls back with the new name. */
export function renameShop(game: Phaser.Game, done: (name: string) => void, onClose?: () => void): void {
  openNameInput({
    game,
    title: 'เปลี่ยนชื่อร้าน',
    initial: session.state?.shopName ?? DEFAULT_SHOP_NAME,
    cancellable: true,
    onDone: (name) => {
      if (name && session.state) {
        void session.commit({ ...session.state, shopName: name });
        done(name);
      }
      onClose?.();
    },
  });
}
