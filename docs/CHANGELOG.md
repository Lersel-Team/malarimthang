# Changelog

## Sprint 1: Grill prototype (2026-10-24)
- Vite + Phaser 3.90 + TypeScript scaffold; `npm run dev / build / test`.
- Grill rules (`src/core/cooking.ts`): two sides, raw → almost → perfect → charred → burnt zones per item window, per-slot heat, fanning, fatty flare-ups, cheese burst. 35 unit tests.
- Grill screen: night street, 4 coal slots with visible heat, cooler with 4 starter skewers, tap to place and flip, drag to tray to serve (raw is blocked), drag to bin, hold to fan, water bottle for flare-ups, doneness ring toggle, quality stats.
- Synthesised WebAudio SFX (sizzle follows doneness, flip, ding, flare, spray, bin); demo at `/sfx-demo.html`.
- PM playtest in Chrome: place, cook, flip, serve (quality scored), burn, bin all work; no console errors. Fixed pork belly vs crab stick looking alike.

## Sprint 0: Research & design (2026-10-24)
- Soi Sizzle teardown, GDD, `data/balance.json`, economy simulator, sprint plan.
