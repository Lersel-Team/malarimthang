# Art direction (หม่าล่าริมทาง)

Warm lofi Thai night street. Deep indigo night, a glowing stall, cozy rather than gritty.

## Look
- Palette: `src/art/palette.ts` (`PALETTE.key.hex` for Phaser, `.css` for Text/DOM). Night `#1b1230`/`#2a1d47`, lamp `#ffb24a`, ember `#ff6a2a`, mala red `#d6342b`, chili `#b01e1e`, cream `#f6e7c8`, wood `#8a5a34`/`#5c3a20`, steel `#8c97a6`, tea-green `#6ec28a`. Do not invent off-palette hues without a reason.
- Outlines: 1.5 logical px, `#1b1230` at 85% alpha (`OUTLINE` in palette.ts).
- Light: key light from top-left; warm rim light (lamp/ember) on edges facing the stall. Soft drop shadows (offset down-right, blurred, ~25% black-indigo). Gradients are allowed and encouraged for volume.
- Fonts: `FONT` (Kanit) for UI/body, `FONT_FUN` (Mali) for signs and titles, both from `src/scenes/grill/draw.ts`. Self-hosted via @fontsource, loaded in BootScene.

## Coordinates and sharpness (foundation, `src/engine/hidpi.ts`)
- Scene code uses logical 360x740. The canvas is `RES`x larger (`RES = min(3, max(2, ceil(devicePixelRatio)))`).
- Every scene's `create()` must start with `setupCamera(this)`. Read pointers with `pt(pointer)` (logical `{x, y}`), never `pointer.x/y` directly.
- `scene.add.text` is patched to use `resolution: RES`, nothing to do.
- Postprocess: Shift camera has a vignette gated by `settings.fx` (`src/settings.ts`, default off when `hardwareConcurrency <= 4`). Bloom was tried and dimmed the whole frame, avoid it.

## Sprites
- Author as SVG strings in `src/art/**`, rasterised at `w*RES x h*RES`:
  ```ts
  import { loadSvg } from '../art/svg';
  await loadSvg(scene, 'skewer-fish', SVG, 24, 24);   // Promise<key>, cached per key
  scene.add.image(x, y, 'skewer-fish').setDisplaySize(24, 24);
  ```
  `loadSvg(scene, key, svgString, w, h)`: `w`,`h` are logical px; the SVG should have a `viewBox`. Call it during Boot (await all) so scenes find textures ready.
- Naming: kebab-case keys `<group>-<thing>[-<state>]`, e.g. `skewer-fish`, `customer-aunt-happy`, `ui-btn-primary`, `stall-sign`. One file per group under `src/art/<group>.ts` exporting SVG strings plus a `preload*(scene)` helper.
- Sizes (logical px): skewer chunk ~24, customer ~40 tall, UI button height 44, minimum tap target 44.
- All new art lives under `src/art/`. Scenes import from there and do not draw art inline.
