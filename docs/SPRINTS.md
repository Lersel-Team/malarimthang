# Sprint Plan — หม่าล่าริมทาง

PM: Claude (main session). Workers: sub-agents on **Sonnet**, one per work package.
The PM reviews every agent's output (diff + tests + a playtest) before the sprint closes.

**Every sprint ends with:** something playable, tests green, `docs/CHANGELOG.md` updated, demo notes for the owner, and the owner's go/no-go for the next sprint.

## Workflow
1. PM writes the sprint's tickets (below) with acceptance criteria.
2. PM spawns agents per ticket. Independent tickets run in parallel, and each agent gets an isolated git worktree when files could clash.
3. Agent delivers code + tests + a short report.
4. PM reviews, merges, runs `npm test` and the balance sim, then playtests in Chrome.
5. Demo to the owner → feedback → next sprint.

| Agent role | Typical tickets |
|---|---|
| `engine-dev` | scenes, input, rendering, Phaser plumbing |
| `core-dev` | pure TS game rules + Vitest tests |
| `balance` | `balance.json`, simulator, tuning reports |
| `art-audio` | sprites (placeholder → final), SFX/BGM sourcing + credits |
| `qa` | Playwright smoke tests, Chrome playtest, bug list |
| `backend` | Supabase, auth, cloud save (Sprint 7) |

---

## Sprint 0 — Research & design ✅ (this sprint)
- [x] Reverse-engineer Soi Sizzle → `docs/research/soi-sizzle-analysis.md`
- [x] GDD → `docs/GDD.md`
- [x] Balance data → `data/balance.json`
- [x] Economy simulator → `tools/balance_sim.py`
- [x] Sprint plan (this file)
- [x] Owner review of GDD

## Sprint 1 — Grill prototype ("is flipping fun?") ✅
Goal: one screen, a grill, skewers you can cook, flip and burn. No customers yet.
- [x] S1-1 `engine-dev`: Vite + Phaser 3 + TS scaffold, portrait 360×740 scaling, PWA manifest stub, ESLint/Prettier, `npm run dev/build/test`.
- [x] S1-2 `core-dev`: `src/core/cooking.ts`: two-sided skewer model, zones, quality, heat per slot, flare-ups. Vitest coverage for every zone boundary.
- [x] S1-3 `engine-dev`: grill scene: 4 slots with heat glow, cooler with 4 starter items, tap to place, tap to flip, drag to bin, placeholder doneness colors, doneness ring.
- [x] S1-4 `art-audio`: placeholder skewer sprites (5 doneness frames × 4 items), sizzle loop + flip SFX (CC0).

**Done when:** you can cook 4 skewers at once on a phone, and burning is possible and obvious. Owner playtest: "is it fun to flip?"

## Sprint 2 — Customers & a full shift ✅ (S2-4 Playwright smoke moved to Sprint 3)
Goal: a 3-minute shift that ends with a money total.
- [x] S2-1 `core-dev`: orders, archetypes, patience, satisfaction, tips, rating (pure + tested).
- [x] S2-2 `engine-dev`: **shop view** (GDD §6.1): side-on 2.5D shop on the top of the screen, customers walk in from the street, queue, order bubble, takeaway vs eat-in, walk to a seat, eat, leave money on the table (tap/auto-collect), walk out. Starts with 2 plastic seats. Ambient passers-by.
- [x] S2-5 `engine-dev`: ticket rail, drag skewer → ticket, shaker seasoning, serve, walk-outs.
- [x] S2-3 `engine-dev`: HUD (clock 18:00→24:00, money, ⭐), end-of-shift.
- S2-4 `qa`: Playwright smoke: boot → shift → end.
- [x] S2-7 `engine-dev`: **oil + mala sauce brushes** on the grill (GDD §4.5): rules in cooking.ts + tests, brush pot UI with swipe-to-brush, sheen/glaze visuals, brush SFX.
- [x] S2-8 PM: customer names in Thai script, 10% foreign (done).
- [x] S2-6 `art-audio`: procedural customer sprites (5 archetypes, walk/idle/eat/happy/angry), plastic chairs, shop front.

**Done when:** a full shift is playable start to finish with real orders.

## Sprint 3 — Economy loop & saving ✅ (S3-4 sim↔game drift report deferred to Sprint 4 tuning)
Goal: day after day, with money that persists.
- [x] S3-1 `core-dev`: market (packs, daily jitter, stock, spoilage), daily costs, loan safety net.
- [x] S3-2 `engine-dev`: Market scene, Summary scene (receipt, reviews), day counter.
- [x] S3-3 `core-dev`: `SaveRepository` + `LocalSave` with schema versioning/migrations.
- [x] S3-5 `engine-dev`: **renameable shop**: name your stall on first launch (default "หม่าล่าริมทาง"), rename by tapping the sign; shown on the shop sign, receipt and boot screen. Saved with the game.
- [x] S3-6 `qa`: Playwright smoke (boot → shift → serve → receipt) using `?speed=`; carried over from S2-4.
- S3-4 `balance`: hook the simulator to the same TS rules (or port them), and report the drift between sim and game.

**Done when:** you can play 5 days in a row, close the tab, and continue.

## Sprint 4 — Look: graphics pass (owner request 2026-10-24: "improve graphic first")
Goal: the game looks like a finished cozy night-street game on a phone. Art is authored as SVG sprites rasterised at hi-DPI (docs/ART.md).
- S4-1 `engine-dev`: crisp hi-DPI canvas (RES×), pointer mapping, real fonts (Kanit + Mali bundled), palette tokens, `loadSvg` helper, subtle vignette/bloom, ART.md. (in progress)
- S4-2 `art-items`: SVG sprites for all 22 items (raw chunk + cooked-state treatment), stick, glass/cup with number tag, display box and trays, fryer pan + batter bowl, grill, coals, cooler, bin, water bottle, brushes; apply to the Shift scene's grill and tool area.
- S4-3 `art-shop`: richer shop and street: stall with depth and lighting, bunting, string lights, queue area, waiting benches, stools and tables; customers redrawn with more detail (5 archetypes × walk/idle/pick/eat/happy/angry) and variety (skin, hair, outfit colours).
- S4-4 `art-ui`: UI kit (buttons, cards, panels, toasts, badges, receipt paper, tickets), restyle Market, Summary and Name scenes, HUD, number-change juice, scene transitions.
- S4-5 PM: screenshot review, consistency pass, Discord report.

## Sprint 5 — Self-service & fryer (owner request 2026-10-24)
Goal: customers pick skewers from your display box into a numbered glass; you cook for them on the grill and the fryer. Design: GDD §4.6, §6.3.
- S5-1 `core-dev`: Shift model v2 (box state, pick phase, queue numbers, cup/ticket with raw skewers and methods, skip/in-order rules, refill) + tests; extend economy `GameState` with box layout; update balance sim.
- S5-2 `core-dev`: fry rules in `src/core/frying.ts` (batter, oil temperature, doneness, burnt, quality) + tests.
- S5-3 `engine-dev`: "จัดตู้" pre-shift scene and the in-shift display box with live counts and refill taps; picking animation into the glass; queue numbers on cups/customers.
- S5-4 `engine-dev`: kitchen rail (cups with queue numbers), load-to-grill/fryer, return-to-cup, "เรียกคิว" call-out; fryer station UI (batter bowl, pans, thermometer, bubbles); SFX (oil sizzle, batter, call-out chime).
- S5-5 `qa`: Playwright flow: stock box → customer picks → cook → call number; PM playtest and balance retune.

## Sprint 6 — Upgrades & progression
- S6-1 `core-dev`: upgrade effects (incl. displayBox, tray, fryer, batter, grill, rack, fridge, powder, seating, sign, helper), item/location unlocks, XP/levels.
- S6-2 `engine-dev`: **upgrade shop** with tabs เตา / เมนู / ร้าน / ทำเล, **new menu unlocks** (new skewers, fried items, new sauces), recommended next goal, readable lock reasons, level-up moment.
- S6-3 `engine-dev`: gas grill knob, fan, holding rack.
- S6-6 `core-dev`: **staff system** (GDD §8.4): candidates, hiring, traits, XP/levels, wages, timing-error cooking bot (reuses `cooking.ts`), forgetting, quitting/poaching + tests; removes the old `helper` upgrade.
- S6-7 `engine-dev`: staff UI: applicants panel at the market, staff cards (level, trait, wage, XP bar), staff characters working at their grill slots, take-over tap, raise/course buttons, end-of-day staff lines on the receipt.
- S6-4 `engine-dev`: **shop layout mode** between shifts: tap table/decor slots to buy, upgrade or swap; tables, seat grades and 7 decor items (GDD §6.2).
- S6-5 `balance`: tune to the GDD §8.3 targets; sim ↔ game drift report (carried over from S3-4).

## Sprint 7 — Content & ecosystem
- S5-1: all 17 skewers incl. special behaviours (cheese burst, chicken raw warning).
- S5-2: 5 locations with their own backgrounds and crowd mix.
- S5-3: event system + forecast (rain, football, payday, กินเจ, price spikes).
- S5-4: customer reviews text pool (TH), reactions.

## Sprint 8 — Polish, tutorial, ship v1.0 (guest)
- S6-1 `art-audio`: final art pass, lofi BGM, ambience, CREDITS.md.
- S6-2: juice (particles, screen shake on flare, coin pops), settings screen.
- S6-3: day-1 tutorial, boot/cover screen.
- S6-4: PWA offline, performance on a low-end Android, deploy the static build to the owner's server behind its reverse proxy at `mala.papae.dev` (DNS record + TLS needed; the domain does not resolve yet). Add `mala.papae.dev` to Supabase Auth redirect URLs.
- S6-5 `qa`: full regression + 30-min playtest report.

**Ship:** https://mala.papae.dev, guest play. Until then everything runs locally.

## Sprint 9 — Google login & cloud save
- S7-1 `backend`: Supabase project, `profiles` + `saves` tables, row-level security.
- S7-2: Google OAuth via Supabase Auth, boot choice "Google / Guest" (like Soi Sizzle).
- S7-3: `SupabaseSave` + conflict rule (newest wins, keep a backup of the other), guest → Google linking that keeps progress.
- S7-4 `qa`: login on iOS Safari / Android Chrome, device switch.

**Needs from owner:** a Supabase account/project and a Google Cloud OAuth client (I'll give step-by-step instructions).

## Sprint 10 (optional) — Social
Leaderboard (weekly revenue), visiting friends' stalls (`?visit=`), leaving reviews.

---

## Risks
| Risk | Mitigation |
|---|---|
| Too many skewers at once feels stressful, not cozy | doneness ring, ding, rack, helper; tune grill size vs spawn in Sprint 1–2 playtests |
| Art bottleneck (no artist) | strong placeholders from Sprint 1; art pass isolated in Sprint 6 |
| Sim ≠ real play | Sprint 3–4 share one rules engine, playtest-calibrate skill param |
| OAuth redirect issues on mobile in-app browsers (LINE/FB) | detect in-app browser and show "open in Chrome/Safari"; guest fallback |
