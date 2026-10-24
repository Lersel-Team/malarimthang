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

## Sprint 1 — Grill prototype ("is flipping fun?") 🟡 built, awaiting owner playtest
Goal: one screen, a grill, skewers you can cook, flip and burn. No customers yet.
- [x] S1-1 `engine-dev`: Vite + Phaser 3 + TS scaffold, portrait 360×740 scaling, PWA manifest stub, ESLint/Prettier, `npm run dev/build/test`.
- [x] S1-2 `core-dev`: `src/core/cooking.ts`: two-sided skewer model, zones, quality, heat per slot, flare-ups. Vitest coverage for every zone boundary.
- [x] S1-3 `engine-dev`: grill scene: 4 slots with heat glow, cooler with 4 starter items, tap to place, tap to flip, drag to bin, placeholder doneness colors, doneness ring.
- [x] S1-4 `art-audio`: placeholder skewer sprites (5 doneness frames × 4 items), sizzle loop + flip SFX (CC0).

**Done when:** you can cook 4 skewers at once on a phone, and burning is possible and obvious. Owner playtest: "is it fun to flip?"

## Sprint 2 — Customers & a full shift
Goal: a 3-minute shift that ends with a money total.
- S2-1 `core-dev`: orders, archetypes, patience, satisfaction, tips, rating (pure + tested).
- S2-2 `engine-dev`: **shop view** (GDD §6.1): side-on 2.5D shop on the top of the screen, customers walk in from the street, queue, order bubble, takeaway vs eat-in, walk to a seat, eat, leave money on the table (tap/auto-collect), walk out. Starts with 2 plastic seats. Ambient passers-by.
- S2-5 `engine-dev`: ticket rail, drag skewer → ticket, shaker seasoning, serve, walk-outs.
- S2-3 `engine-dev`: HUD (clock 18:00→24:00, money, ⭐), end-of-shift.
- S2-4 `qa`: Playwright smoke: boot → shift → end.
- S2-6 `art-audio`: procedural customer sprites (5 archetypes, walk/idle/eat/happy/angry), plastic chairs, shop front.

**Done when:** a full shift is playable start to finish with real orders.

## Sprint 3 — Economy loop & saving
Goal: day after day, with money that persists.
- S3-1 `core-dev`: market (packs, daily jitter, stock, spoilage), daily costs, loan safety net.
- S3-2 `engine-dev`: Market scene, Summary scene (receipt, reviews), day counter.
- S3-3 `core-dev`: `SaveRepository` + `LocalSave` with schema versioning/migrations.
- S3-4 `balance`: hook the simulator to the same TS rules (or port them), and report the drift between sim and game.

**Done when:** you can play 5 days in a row, close the tab, and continue.

## Sprint 4 — Upgrades & progression
- S4-1 `core-dev`: upgrade effects, item/location unlocks, XP/levels.
- S4-2 `engine-dev`: Upgrade shop (tabs, recommended next goal), level-up moment.
- S4-5 `engine-dev`: **shop layout mode** between shifts: tap table/decor slots to buy, upgrade or swap; tables, seat grades and 7 decor items (GDD §6.2), each with one visible stat.
- S4-3 `engine-dev`: gas grill knob, fan, holding rack, helper auto-flip.
- S4-4 `balance`: tune to the GDD §8.3 targets, write `docs/balance-report.md`.

**Done when:** 10 in-game days show clear progression, and the sim and a real playtest agree within ~20%.

## Sprint 5 — Content & ecosystem
- S5-1: all 17 skewers incl. special behaviours (cheese burst, chicken raw warning).
- S5-2: 5 locations with their own backgrounds and crowd mix.
- S5-3: event system + forecast (rain, football, payday, กินเจ, price spikes).
- S5-4: customer reviews text pool (TH), reactions.

## Sprint 6 — Polish, tutorial, ship v1.0 (guest)
- S6-1 `art-audio`: final art pass, lofi BGM, ambience, CREDITS.md.
- S6-2: juice (particles, screen shake on flare, coin pops), settings screen.
- S6-3: day-1 tutorial, boot/cover screen.
- S6-4: PWA offline, performance on a low-end Android, deploy the static build to the owner's server behind its reverse proxy at `mala.papae.dev` (DNS record + TLS needed; the domain does not resolve yet). Add `mala.papae.dev` to Supabase Auth redirect URLs.
- S6-5 `qa`: full regression + 30-min playtest report.

**Ship:** https://mala.papae.dev, guest play. Until then everything runs locally.

## Sprint 7 — Google login & cloud save
- S7-1 `backend`: Supabase project, `profiles` + `saves` tables, row-level security.
- S7-2: Google OAuth via Supabase Auth, boot choice "Google / Guest" (like Soi Sizzle).
- S7-3: `SupabaseSave` + conflict rule (newest wins, keep a backup of the other), guest → Google linking that keeps progress.
- S7-4 `qa`: login on iOS Safari / Android Chrome, device switch.

**Needs from owner:** a Supabase account/project and a Google Cloud OAuth client (I'll give step-by-step instructions).

## Sprint 8 (optional) — Social
Leaderboard (weekly revenue), visiting friends' stalls (`?visit=`), leaving reviews.

---

## Risks
| Risk | Mitigation |
|---|---|
| Too many skewers at once feels stressful, not cozy | doneness ring, ding, rack, helper; tune grill size vs spawn in Sprint 1–2 playtests |
| Art bottleneck (no artist) | strong placeholders from Sprint 1; art pass isolated in Sprint 6 |
| Sim ≠ real play | Sprint 3–4 share one rules engine, playtest-calibrate skill param |
| OAuth redirect issues on mobile in-app browsers (LINE/FB) | detect in-app browser and show "open in Chrome/Safari"; guest fallback |
