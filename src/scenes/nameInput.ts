// DOM text-input overlay (Phaser's canvas can't do Thai IME). Positioned over the game canvas.
import { DEFAULT_SHOP_NAME, session } from '../session';

export interface NameInputOpts {
  game: Phaser.Game;
  title: string;
  initial: string;
  /** Allow closing without saving (rename); false on first launch. */
  cancellable: boolean;
  confirmLabel?: string;
  /** Backdrop dim 0..1 (default .75); first launch uses less so the street shows through. */
  dim?: number;
  /** Show the skewer icon above the title (first launch). */
  skewer?: boolean;
  onDone: (name: string | null) => void;
}

const FONT = '"Kanit", "Noto Sans Thai", Tahoma, sans-serif';
const FONT_FUN = '"Mali", "Kanit", sans-serif';
const SKEWER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="56" height="56" style="display:block;margin:0 auto -0.2em;transform:rotate(-8deg)"><path d="M4 28L28 4" stroke="#c89a5a" stroke-width="3" stroke-linecap="round"/><g stroke="#1b1230" stroke-opacity=".9" stroke-width="2"><circle cx="23.5" cy="8.5" r="4.8" fill="#f6e7c8"/><circle cx="16" cy="16" r="5" fill="#d6342b"/><circle cx="8.5" cy="23.5" r="4.6" fill="#6ec28a"/></g><circle cx="22" cy="7" r="1.4" fill="#fff" opacity=".8"/></svg>`;
const CSS_ID = 'mrt-nameinput-css';
const CSS = `
.mrt-card{position:relative;width:84%;max-width:320px;box-sizing:border-box;text-align:center;padding:1.3em 1.1em 1.2em;border-radius:18px;
  background:linear-gradient(#35275c,#1b1230);border:1.5px solid rgba(27,18,48,.9);
  box-shadow:inset 0 0 0 1.5px rgba(255,178,74,.35),inset 0 2px 0 rgba(255,255,255,.18),0 10px 28px rgba(0,0,0,.55);animation:mrt-pop .22s cubic-bezier(.2,1.4,.4,1)}
@keyframes mrt-pop{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}
.mrt-title{font-family:${FONT_FUN};font-weight:700;font-size:1.3em;color:#ffb24a;margin-bottom:.7em}
.mrt-input{width:100%;box-sizing:border-box;font-size:1.2em;font-family:${FONT};padding:.5em .6em;min-height:44px;border-radius:12px;text-align:center;outline:none;
  border:1.5px solid rgba(27,18,48,.9);background:#fff6df;color:#3a2a20;box-shadow:inset 0 2px 4px rgba(90,60,20,.35)}
.mrt-input:focus{box-shadow:inset 0 2px 4px rgba(90,60,20,.35),0 0 0 2px #ffb24a}
.mrt-btn{font-family:${FONT};font-weight:700;font-size:1.1em;color:#fff7ea;min-height:44px;min-width:7em;padding:.4em 1.3em;border-radius:14px;cursor:pointer;
  border:1.5px solid rgba(27,18,48,.9);text-shadow:0 1px 0 rgba(0,0,0,.35);transition:transform .08s}
.mrt-btn:active{transform:translateY(3px);box-shadow:none!important}
.mrt-primary{background:linear-gradient(#ff6a52,#c92a22);box-shadow:0 4px 0 #7e1814,0 7px 12px rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.4)}
.mrt-secondary{background:linear-gradient(#5e4590,#3a2866);box-shadow:0 4px 0 #1e1535,0 7px 12px rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.25)}
`;
function ensureCss() {
  if (document.getElementById(CSS_ID)) return;
  const st = document.createElement('style');
  st.id = CSS_ID;
  st.textContent = CSS;
  document.head.append(st);
}
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
    background: `rgba(10,6,16,${o.dim ?? 0.75})`, fontFamily: FONT, color: '#f6e7c8',
  });
  ensureCss();
  const card = document.createElement('div');
  card.className = 'mrt-card';
  const title = document.createElement('div');
  title.className = 'mrt-title';
  title.textContent = o.title;
  const input = document.createElement('input');
  input.className = 'mrt-input';
  input.type = 'text';
  input.maxLength = NAME_MAX;
  input.value = o.initial;
  input.setAttribute('enterkeyhint', 'done');
  input.setAttribute('autocomplete', 'off');
  const row = document.createElement('div');
  Object.assign(row.style, { marginTop: '1.1em', display: 'flex', gap: '0.7em', justifyContent: 'center' });
  const mkBtn = (label: string, cls: string, fn: () => void) => {
    const b = document.createElement('button');
    b.className = `mrt-btn ${cls}`;
    b.textContent = label;
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
  row.append(mkBtn(o.confirmLabel ?? 'ตกลง', 'mrt-primary', ok));
  if (o.cancellable) row.append(mkBtn('ยกเลิก', 'mrt-secondary', () => close(null)));
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.isComposing) ok();
    else if (e.key === 'Escape' && o.cancellable) close(null);
  });
  if (o.skewer) {
    const ic = document.createElement('div');
    ic.innerHTML = SKEWER_SVG;
    card.append(ic);
  }
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
