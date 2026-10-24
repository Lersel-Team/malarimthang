# Changelog

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
