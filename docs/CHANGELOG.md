# Changelog

## Quality report (2026-10-28)
- Serving an order pops a report over the ticket: quality % (cook quality x spice penalty), oiled n/N, sauced n/N, charred count, spice right/wrong and the stars. The numbers come from `served.report` in the shift model.

## Walk-out returns (2026-10-28)
- When a customer's patience runs out, the raw skewers still on their plate go back to the fridge, but each has a `service.returnSpoilChance` (30%) of spoiling from the handling (counted as wasted). Skewers already on the grill are unaffected.

## Spare grilling and bulk buying (2026-10-28)
- Drag any item from the display bar onto the grill to grill a spare (replace a burnt skewer or a mix-up); tap still refills from the fridge. Spares can be packed into any ticket that needs that item.
- Market: up to 12 packs per item per day (was 3), "+5" quick-buy button, volume discount (5% from the 5th pack, 10% from the 9th). Fridge slots and cash are the real limit.

## Waiters, tables, fridge (2026-10-28)
- Tables seat 4 (2 tables = 8 seats to start, up to 6). Eat-in customers take a table as soon as their order is on the plate and wait there (longer patience); the grilled order goes on a plate, a waiter carries it to the table, then they eat. Takeaway orders go in a bag. Waiter upgrade: count and trip time (`waiter`).
- Tickets redrawn: raw tray, bag (takeaway) or plate (eat-in) that fills as you drop skewers in, shaker row.
- Grill starts at 12 skewers (12, 14, 16, 22, 26, 32, 48, 57).
- Start money 800. Fridge slots (`fridgeSize`, start 150 skewers = about a day) cap total stock. The display bar holds `tray` skewers per item for `displayBox` item types; customers pick from it; when an item runs out they stop picking it and buy only what they already took, so refill in time. Tap an item on the bar to refill it from the fridge.

## Self-service plates (2026-10-28)
- The grill is one open surface (no numbered slots). Customers at the counter pick their own skewers from the cooler onto a plate (`service.pickFirstSec`/`pickSec`, stock drops as they pick; sold-out items shrink the order).
- Player drags raw skewers from the ticket's plate onto the grill (tap = first free spot), grills them, drags cooked ones into the bag on the ticket, then taps to pack and send. A binned skewer is re-picked by the customer.
- Free-placement grill: drop a skewer anywhere there is room (drag to move it too); space is limited and the `grillSize` upgrade grows the grill (8, 10, 12, 14, 26, 30, 34, 57 skewers via `grillTiers`, smaller skewers on the big tiers). Fan covers an area under the finger.
- Heat control: coal level burns down over the shift; ถ่าน adds coal (฿3 per scoop, charged at day end), เถ้า ash cools it. Heat bar above the grill.
- Oil/sauce: drag a brush out of the pot and paint across skewers; eligible skewers get a pulsing ring (green = sauce ready, orange = too early).
- Rebalance: orders are 5-20 skewers (student 5-9 … family 10-20), prices and costs x0.6, patience grows with order size (`patiencePerSkewerSec`), fewer customers/min, XP per skewer halved, shift 300 s (was 180 s), base charcoal 45.
- Seated (eat-in) customers wait `eatIn.patienceMult` (1.6x) longer.

## Sprint 4: Look, the graphics pass (2026-10-24)
- Crisp hi-DPI canvas (RES x, up to 3x), bundled Kanit + Mali Thai fonts, palette + SVG sprite pipeline (`loadSvg`), subtle vignette, `docs/ART.md`.
- Items: all 22 skewers as detailed SVG sprites with 5 cook stages, oil/sauce overlays; grill grate + coals, glass-front cooler, bin, bottle, brushes, shaker. Baked for Sprint 5: cup, bucket, display box, fry pan, batter bowl.
- Shop: 8-layer night street (skyline, string lights, lantern awning, glowing sign, menu board, drinks fridge, display box), 5 customer archetypes x 8 variants x 12 frames, ambient motorbike/cat/moths.
- UI kit (`src/art/ui.ts`): panels, buttons with press feedback, ribbons, pills, stars, bars, toasts, receipt paper, stamp, confetti; Boot/Name/Market/Summary/Shift tickets+HUD restyled; fades between scenes.
- PM fixes: receipt stamp/stars overlap.
- Dev pages: /art-items.html, /art-people.html, /ui-kit.html. 9 e2e specs.

## Sprint 3: Economy loop & saving (2026-10-24)
- Day loop: Name (first launch) → Market → Shift → Summary → next day. Autosaves after every step.
- Economy (`src/core/economy.ts`): seeded daily market (one cheap, one dear item), packs of 10 with caps, "refill like yesterday", rent/charcoal/wages, overnight spoilage (fridge), mum's 200 ฿ loan, rating, XP/levels, login streak. 41 tests.
- Save: versioned localStorage save with migrations, corrupt-save backup, sanitising. 13 tests.
- Renameable shop (first launch + tap the sign/header), Thai text via DOM input.
- Shift reads stock, seats, grill size and upgrade multipliers from the saved state.
- Playwright smoke test on system Chrome (`npm run e2e`). Favicon.
- Supabase prepared but NOT wired: SQL migration, `SupabaseSave`, `docs/SUPABASE.md`.
- Known: "refill like yesterday" forgets after reload (soldYesterday is in memory); items beyond the first four use placeholder art.

## Sprint 2: Customers & a full shift (2026-10-24)
- Shift model (`src/core/shift.ts`): arrivals scaled by location/rating, queue + 3 ticket slots, patience bands (tip/stars), orders with spice, combo, eat-in seats, extra orders, table money (tap = full, auto = base only), clock 18:00–24:00, end event.
- Shop view: night street, stall, counter, queue, plastic stools, passers-by, motorbike, cat; 5 procedural customer types with walk/eat/happy/angry.
- Shift screen: order tickets (name, items, spice, patience bar, eat-in/takeaway), drag skewers to tickets, mala powder shaker, serve, collect table money, HUD, end-of-shift receipt.
- Customer names in Thai script, ~10% foreign (English, Mandarin, Cantonese, Malay); tourists mostly foreign.
- Oil + mala sauce brushes: tap/swipe to brush; unoiled = dry ×0.8, unsauced ×0.9, early sauce burns faster, oil drips can flare.
- Dev `?speed=` for slow-motion QA. 87 tests.
- PM playtest fixes: readable ticket icons, overlapping labels, tool column layout.

## Sprint 1: Grill prototype (2026-10-24)
- Vite + Phaser 3.90 + TypeScript scaffold; `npm run dev / build / test`.
- Grill rules (`src/core/cooking.ts`): two sides, raw → almost → perfect → charred → burnt zones per item window, per-slot heat, fanning, fatty flare-ups, cheese burst. 35 unit tests.
- Grill screen: night street, 4 coal slots with visible heat, cooler with 4 starter skewers, tap to place and flip, drag to tray to serve (raw is blocked), drag to bin, hold to fan, water bottle for flare-ups, doneness ring toggle, quality stats.
- Synthesised WebAudio SFX (sizzle follows doneness, flip, ding, flare, spray, bin); demo at `/sfx-demo.html`.
- PM playtest in Chrome: place, cook, flip, serve (quality scored), burn, bin all work; no console errors. Fixed pork belly vs crab stick looking alike.

## Sprint 0: Research & design (2026-10-24)
- Soi Sizzle teardown, GDD, `data/balance.json`, economy simulator, sprint plan.

## Test tools (2026-10-24)
- DEV panel (`src/devpanel.ts`): orange "DEV" button top-left. Reset everything / reset stats (keep shop name), ±money, level, next day, rating, unlock all items/locations, max upgrades, fill/clear stock, clear loan/streak, view save JSON. Shown in dev builds, and in any build with `?debug=1` (remembered; turn off with `?debug=0`). Edits autosave and restart the current scene.
