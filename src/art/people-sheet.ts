// Dev page /art-people.html : every archetype x variant x frame as plain SVG. ?v=3 picks the variant for the full
// sheets, ?scale=4 zooms, ?mode=variants shows the idle frame of all 8 variants, ?mode=anim animates walk cycles.
import { ARCH_LIST, CH, CW, FRAMES, VARIANTS, sheetSvg } from './people';

const q = new URLSearchParams(location.search);
const v = Number(q.get('v') ?? 0);
const scale = Number(q.get('scale') ?? 3);
const mode = q.get('mode') ?? 'frames';
const only = q.get('arch');
const app = document.getElementById('app')!;
const url = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

function frameImg(arch: (typeof ARCH_LIST)[number], variant: number, fi: number): HTMLElement {
  const cols = 4;
  const el = document.createElement('div');
  el.style.cssText = `width:${CW * scale}px;height:${CH * scale}px;background:url("${url(sheetSvg(arch, variant))}") -${(fi % cols) * CW * scale}px -${Math.floor(fi / cols) * CH * scale}px / ${CW * cols * scale}px ${CH * 3 * scale}px;background-color:#3a2a50;position:relative`;
  return el;
}

for (const arch of ARCH_LIST) {
  if (only && only !== arch) continue;
  const h = document.createElement('h3');
  h.textContent = `${arch}  (variant ${mode === 'variants' ? 'all' : v})`;
  app.appendChild(h);
  const row = document.createElement('div');
  row.className = 'row';
  app.appendChild(row);
  if (mode === 'variants') {
    for (let k = 0; k < VARIANTS; k++) row.appendChild(frameImg(arch, k, 4));
  } else if (mode === 'anim') {
    for (let k = 0; k < VARIANTS; k++) {
      const el = frameImg(arch, k, 0);
      row.appendChild(el);
      let t = 0;
      setInterval(() => {
        t++;
        el.style.backgroundPosition = `-${(t % 4) * CW * scale}px 0`;
      }, 140);
    }
  } else {
    FRAMES.forEach((_, i) => row.appendChild(frameImg(arch, v, i)));
  }
}
