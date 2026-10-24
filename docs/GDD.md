# หม่าล่าริมทาง (Mala Rim Thang) — Game Design Document

> Status: **v0.1 draft (Sprint 0)** · Owner: PM · Last updated: 2026-10-24
> Reference game: [Soi Sizzle](https://soi-sizzle.pages.dev) — see `docs/research/soi-sizzle-analysis.md`
> Balance numbers live in `data/balance.json`. Verify any change with `python3 tools/balance_sim.py`.

## 1. Pitch

A cozy, lofi 2D mobile web game about running a หม่าล่าเสียบไม้ (mala skewer) stall at night.
Customers order mixed skewers with a spice level. You grill each skewer on a charcoal grill,
**flip it when the bottom side is cooked, pull it before it burns**, dust it with mala powder,
and hand it over. Profits buy a bigger grill, new skewers, a secret powder recipe and better
locations: from the mouth of your own soi to Khao San and Yaowarat.

- **Platform:** mobile-first web (PWA), portrait 360×740 logical px, also plays on desktop
- **Session:** one shift = 3 minutes (18:00–24:00 in-game). One "day" ≈ 4–5 minutes with menus
- **Audience:** Thai casual players, 15–35, play on the phone in short breaks
- **Tone:** warm night street, sizzle sounds, lofi music, cute pixel-ish art

## 2. Design pillars

1. **The grill is the game.** Two-sided cooking with real tension: every skewer is a tiny timing puzzle, and 4–12 of them run at once.
2. **Variety you can taste.** 17 skewer types that *behave* differently (thin enoki burns fast, pork belly flares up, wagyu has a tiny perfect window).
3. **Small decisions, big stall.** What to stock, where to sell, what to upgrade next. Always one clear next goal.
4. **Cozy, never cruel.** Mistakes cost a little money and a star, never the save. No soft-locks.

## 3. Core loop

```
 ┌─► ตลาดเช้า (Market) ── buy skewer packs, check prices & tomorrow's event
 │        │
 │        ▼
 │   เปิดร้าน (Shift, 180 s) ── take orders → grill → flip → season → serve
 │        │
 │        ▼
 │   สรุปยอด (Summary) ── revenue, costs, waste, tips, reviews, ⭐ rating, XP
 │        │
 │        ▼
 └── ร้านค้าอัปเกรด (Upgrades) ── grill, powder, rack, fridge, sign, unlock items/locations
```

## 4. The grill (core mechanic)

### 4.1 Skewer state
Each skewer on the grill has **two sides (A, B)**, each with a cook value `c` starting at 0.
Only the side facing the coals cooks:

```
c_down += heat(slot) × dt / item.sideTime        (top side: no change)
```

| Zone | `c` range (per side) | Look | Quality |
|---|---|---|---|
| ดิบ raw | `c < 0.85` | pale, pink | cannot serve |
| เกือบสุก almost | `0.85 – 1.0` | light | 0.7 |
| **สุกพอดี perfect** | `1.0 – 1.0 + window` | golden, steam ✨ | **1.0** |
| เกรียม charred | next `burnMargin` (0.3) | dark edges, grey smoke | 0.4 |
| ไหม้ burnt | beyond | black, thick smoke | 0, goes in the bin |

Skewer quality = average of the two sides. `window` differs per item (0.15 wagyu … 0.50 fish tofu),
and that is what makes items feel different.

### 4.2 Controls (one thumb)
| Action | Input |
|---|---|
| Put a skewer on the grill | tap item in the ตู้แช่ (cooler) → goes to the first free slot (or drag to a slot) |
| **Flip** | tap the skewer |
| Move to order tray | swipe/drag the skewer up onto an order ticket |
| Season | tap the ผงหม่าล่า shaker on a full tray; number of shakes = spice level 🌶 |
| Serve | tap the full, seasoned tray → customer pays |
| Bin it | drag to the bin (burnt or wrong) |
| Fan the coals | hold on a slot: ×1.5 heat (charcoal grills only) |
| Kill a flare-up | tap the water bottle, then the flaming slot |

### 4.3 Heat and hazards
- **Uneven charcoal:** at the start of each shift, every slot gets heat 0.7–1.3, pulled toward 1.0 by `heatEvenness`. Hot slots glow brighter. Learning the grill is part of the skill.
- **Flare-ups (fatty items):** pork belly, sausage, lamb and wagyu drip fat. 4%/s chance to flare: heat ×2.2 for 2 s. Spray water to stop it.
- **Gas grill (upgrade):** even heat, plus a global knob (low/med/high) instead of fanning.
- **ตะแกรงพักไม้ (holding rack, upgrade):** park cooked skewers without burning so you can pre-cook for the rush.

### 4.4 Feedback (juice)
Sizzle loudness and pitch follow the down side's `c`. A "ready to flip" ding plays at perfect (can be turned off in settings).
Steam particles when perfect, smoke when charred, flame sprite on flare. Burnt skewer: small sad "ฟู่" sound.
Optional doneness ring above each skewer (on in the tutorial, off by default after day 3).

## 5. Skewer roster (17)

Defined in `data/balance.json → items`. Summary:

| Tier | Items | Character |
|---|---|---|
| Starter (Lv1) | ลูกชิ้นปลา, ปูอัด, เห็ดเข็มทอง, หมูสามชั้น | cheap, forgiving; enoki burns fast; pork flares |
| Early (Lv2–5) | ไส้กรอก, เต้าหู้ปลา, ข้าวโพดอ่อน, ไก่, ไข่นกกระทา, ลูกชิ้นชีส, เห็ดออรินจิ | ไก่ is slow, ลูกชิ้นชีส *bursts* if burnt |
| Mid (Lv6–10) | ปลาหมึก, เนื้อวัว, กุ้ง, เนื้อแกะ | high margin, narrow windows |
| Premium (Lv12–15) | หอยเชลล์, เนื้อวากิว | 40–79 ฿/ไม้, very narrow window, a show-off skill check |

Margins grow with tier (fish ball 6 ฿ → wagyu 47 ฿), but so do difficulty and ingredient risk.

## 6. Customers

Each customer has an archetype, an order (2–9 skewers + spice level), a patience bar and a budget.
Archetypes (`balance.json → archetypes`):

| Archetype | Orders | Patience | Tips | Likes |
|---|---|---|---|---|
| นักเรียน student | 2–4, ≤50 ฿ | long | none | processed, cheap |
| พนักงานออฟฟิศ office | 3–6 | short | 5% | meat |
| ครอบครัว family | 5–9 | long | 3% | a bit of everything, mild |
| นักท่องเที่ยว tourist | 3–6, big budget | medium | 12% | seafood, lamb |
| สายดริ๊งค์ night-owl | 4–8 | very short | 8% | meat, very spicy |

**Satisfaction** = cook quality × correctness (right items, right spice) × wait factor.
It sets the tip, the emoji reaction, a chance of a short review ("ไก่ยังดิบอยู่เลย 😢", "หมูสามชั้นกรอบมาก!"),
and feeds the shop rating.

**Rating ⭐ (1–5):** rolling average of the last 40 customers. It scales customer spawn rate
(×0.6 at 1⭐, ×1.0 at 3⭐, ×1.45 at 5⭐). Walk-outs (patience runs out) hurt the most.

## 7. Economy & ecosystem

### 7.1 Money flow
| Sources | Sinks |
|---|---|
| skewer sales × powder multiplier | ingredients (packs of 10, bought in the morning) |
| tips (archetype × quality) | rent per shift (by location: 40 → 600 ฿) |
| event bonuses | charcoal (30 ฿/shift; −40% with gas) |
| | helper wages, spoilage, burnt remakes |
| | upgrades, item unlocks, location unlocks |

### 7.2 Market (ตลาดเช้า)
- Prices jitter ±5% daily; one seeded item is ของถูกวันนี้ (×0.65) and one is ของแพงวันนี้ (×1.35). Events push whole categories ("หมูแพง +40%").
- Perishables: meat/seafood spoil after 1 night, veg after 2, processed after 3, unless kept in the ตู้แช่ (fridge upgrade = overnight capacity).
- Running out mid-shift is allowed: the item greys out and customers who wanted it substitute or leave unhappy. This creates the stock-planning game.
- The game suggests a stock list from yesterday's sales (one tap "ซื้อเหมือนเมื่อวาน"), so casual players aren't forced to micro-manage.

### 7.3 Locations
| Location | Unlock | Rent | Customers/min | Crowd |
|---|---|---|---|---|
| ปากซอยหน้าบ้าน | start | 40 | 6 | students, office, family |
| หน้าโรงเรียน | Lv4, 1,200 ฿ | 80 | 9 | students! |
| ตลาดนัดกลางคืน | Lv7, 4,000 ฿ | 180 | 10 | mixed |
| ถนนข้าวสาร | Lv11, 12,000 ฿ | 400 | 11 | tourists, night-owls |
| เยาวราช | Lv14, 25,000 ฿ | 600 | 12 | tourists, mixed |

Moving to a new location changes *what* sells, not just how much. A wagyu-heavy menu flops in front of the school.

### 7.4 Events (rotate, forecast one day ahead)
| Event | Effect |
|---|---|
| ฝนตก rain | −30% customers, +30% patience |
| บอลคืนนี้ football night | +50% night-owls, bigger orders |
| เงินเดือนออก payday (25th–1st) | office budget +50% |
| เทศกาลกินเจ vegetarian festival (3 days) | most orders veg/tofu only |
| หมูแพง / กุ้งแพง | category price +40% at the market |
| สงกรานต์ / ลอยกระทง | crowd surge, decor |

### 7.5 Safety net
If money is below a minimal stock (~100 ฿) at the market: "แม่ให้ยืม 200 ฿", interest-free, auto-repaid as 20% of each day's profit. The player can never get stuck.

## 8. Upgrades & progression

### 8.1 Upgrades (`balance.json → upgrades`)
| Upgrade | Effect | Levels | Cost range |
|---|---|---|---|
| ขยายเตา grill size | slots 4 → 12 | 5 | 250 → 7,000 |
| เกรดเตา grill grade | heat evenness; gas = knob, infrared = perfect | 3 | 800 → 9,000 |
| ตะแกรงพักไม้ rack | hold 2/4/6 cooked skewers | 3 | 300 → 2,500 |
| ตู้แช่ fridge | keep stock overnight | 3 | 500 → 5,000 |
| สูตรผงหม่าล่า secret powder | price ×1.05 … ×1.30 | 5 | 400 → 12,000 |
| โต๊ะเก้าอี้ seating | patience ×1.15 … ×1.45 | 3 | 350 → 3,500 |
| ป้ายไฟหน้าร้าน neon sign | customers ×1.1 … ×1.35 | 3 | 450 → 5,000 |
| ลูกมือช่วยพลิก helper (Lv9) | auto-flips at 60/80/95% accuracy, costs wages | 3 | 4,000 → 22,000 |

Plus 13 skewer unlocks and 4 location unlocks.

### 8.2 Levels
XP = 1 per skewer served + 1 per perfect skewer. Level-up needs `round(30 × L^1.6)` XP, max level 20.
Levels gate unlocks, money buys them, so both skill and saving matter.

### 8.3 Balance targets (verified with `tools/balance_sim.py`, 60 days)
| Target | Average player (skill 0.7) | Weak (0.4) | Strong (0.9) |
|---|---|---|---|
| First upgrade | day 3 | day ≤5 | day 2 |
| Second location | day 16 | ~day 25 | ~day 13 |
| Level by day 30 / 60 | 9 / 14 | 8 / 12 | 10 / 16 |
| Daily profit day 1 → 60 | 290 → 2,500 ฿ | → 1,300 ฿ | → 5,300 ฿ |
| Content completion | ~80–90 days | | ~60 days |

The grill stays the main bottleneck (skewers served ≈ capacity), so grill and helper upgrades always feel good.
Skill roughly doubles income without blocking weaker players.
**Open tuning item:** Khao San/Yaowarat come too late for average players. Revisit after real playtests.

## 9. Screens & UX
1. **Boot/cover:** title, loading lines ("กำลังก่อถ่าน...", "หั่นหมูสามชั้น..."), *เข้าด้วย Google* / *เล่นแบบ Guest* (Google arrives in Sprint 7).
2. **Market:** item cards with today's price, stock owned, spoil timer, "ซื้อเหมือนเมื่อวาน".
3. **Shift:** top = street with customers and order bubbles; middle = order ticket rail (3–4 tickets); bottom = grill + cooler + shaker + bin. Clock and money in the HUD.
4. **Summary:** receipt-style breakdown, stars, 1–3 customer reviews, XP bar.
5. **Upgrade shop:** tabs เตา / เมนู / ร้าน / ทำเล, with the next recommended goal highlighted.
6. **Settings:** music/SFX, flip ding, doneness ring, language (TH first, EN later).
7. **Tutorial:** day 1 is scripted: 1 customer, 1 fish ball, then flip, then serve.

## 10. Art & audio direction
- Pixel-ish 2D, warm night palette (deep purple sky, orange lamp light, red mala powder), as cozy as Soi Sizzle's lofi feel.
- Skewer sprites: 5 doneness frames per item (raw, almost, perfect, charred, burnt), one side visible at a time, flip animation.
- Audio: layered sizzle loop, flip "tsss", shaker rattle, coin ding, lofi BGM, street ambience (moto, chatter). CC0/licensed sources only, with credits in `CREDITS.md`.

## 11. Tech
| Concern | Choice | Why |
|---|---|---|
| Engine | **Phaser 3 + TypeScript** | same stack as the reference, proven on mobile web, rich input/tween/particles |
| Build | Vite | fast dev, hashed assets, PWA plugin |
| Logic | pure TS modules in `src/core/` (cooking, orders, economy, progression), unit-tested with Vitest | balance and rules testable without a canvas |
| Data | `data/balance.json` | one file for game + simulator |
| Save | `SaveRepository` interface → `LocalSave` (localStorage, versioned schema) now, `SupabaseSave` later | Google login becomes a drop-in |
| Auth | Supabase **anonymous sign-in** for guests, Google OAuth later, `linkIdentity` to upgrade a guest without losing the save | same pattern as Soi Sizzle |
| Cloud sync | localStorage is primary, debounced push (~1.5 s) to a `saves` table; conflicts resolved by `updated_at` + a "which save?" prompt (not "highest day wins"); 6 s boot timeout → offline mode | lessons from the reference |
| Assets | texture atlases (not one PNG per frame); option to synthesise SFX/BGM with WebAudio (zero audio files) | faster first load |
| Hosting | **Local only** during development (`npm run dev`). Later: static build on the owner's server (`papae@157.85.110.84`) behind its existing reverse proxy at **https://mala.papae.dev** | owner's choice; no extra hosting cost |
| QA | Playwright smoke test + manual playtest via Chrome | |

## 12. Out of scope for v1
Multiplayer, real-money purchases, ads, visiting friends' stalls (candidate for v1.1 after login).

## 13. Lessons adopted from Soi Sizzle
From `docs/research/soi-sizzle-analysis.md` §10.

**Adopt:**
- **Patience bands:** a colour-banded bar; tip/stars step down at 60% and 30% patience left; a walk-out = 1⭐ and breaks the combo.
- **Combo:** serves within 6 s of each other add +5 ฿ per step (cap 40). This rewards batching skewers onto the grill.
- **Cozy auto-collect:** if you don't tap to collect, the money arrives anyway after a while (minus tip/combo).
- **Market:** packs of 10, one seeded "ของถูกวันนี้" (×0.65) and one "ของแพงวันนี้" (×1.35) per day, readable instead of noisy jitter. "เติมเหมือนเมื่อวาน ×1.2" button.
- **P&L receipt after every shift**; it teaches the economy without a tutorial.
- **Readable lock reasons** on every upgrade ("ต้อง Lv5", "ขาดอีก 120 ฿").
- **Retention v1:** only a 7-day login streak. Quests, league and stamps come after the core is fun.
- **HTML cover screen** that shows before the bundle loads, with Thai joke loading lines.

**Our differentiator:** Soi Sizzle's cooking is passive (a bar fills). Ours is an active flip-and-don't-burn grill. Keep it tap-first so it still plays one-handed.

**Candidates for later sprints:** drinks station (ชาเย็น, น้ำแดง, เบียร์), food-TikToker VIP customers (tip ×2–4), delivery riders (−25% GP), charcoal that runs down during the shift.

**Avoid:**
- Real-calendar waits on core upgrades.
- A client-trusted leaderboard. If we add a league, the server must check results (max sales per shift from grill slots × time).
- Copying their names, art or text. We take mechanics and numbers as references only.
