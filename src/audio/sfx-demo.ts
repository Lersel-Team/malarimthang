import { Sfx } from './sfx';

const sfx = new Sfx();
const names = ['place', 'flip', 'ding', 'burnt', 'flare', 'spray', 'bin', 'coin'] as const;
const btns = document.getElementById('btns')!;
for (const n of names) {
  const b = document.createElement('button');
  b.textContent = n;
  b.addEventListener('pointerdown', () => { sfx.unlock(); sfx[n](); });
  btns.appendChild(b);
}
const lvl = document.getElementById('lvl') as HTMLInputElement;
const cnt = document.getElementById('n') as HTMLInputElement;
const apply = () => {
  sfx.unlock();
  const l = Number(lvl.value), n = Number(cnt.value);
  for (let i = 0; i < 12; i++) sfx.setSizzle(i, i < n ? l : 0);
  document.getElementById('v')!.textContent = lvl.value;
  document.getElementById('nv')!.textContent = cnt.value;
};
lvl.addEventListener('input', apply);
cnt.addEventListener('input', apply);
(document.getElementById('mute') as HTMLInputElement).addEventListener('change', (e) => {
  sfx.unlock();
  sfx.muted = (e.target as HTMLInputElement).checked;
});
window.addEventListener('pagehide', () => sfx.stopAll());
