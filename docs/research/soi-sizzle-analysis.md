# Soi Sizzle: Game Design Teardown

- **Target:** https://soi-sizzle.pages.dev ("Soi Sizzle, ร้านเด็ดในซอย", tagline "ผัด · ตำ · ชง · ลวก", labelled "Open Beta")
- **Method:** static reading of the shipped, minified bundle (`main-MEt6XSVS.js`, game section around 270 KB after the Phaser library), `index.html`, `manifest.webmanifest`, `og.jpg`. The game was not played. I reformatted the bundle with prettier and read it; none of its code was run.
- **Convention:** numbers are quoted from the code. Wherever the text says **(inference)**, it is my reading of the design intent or of behaviour I could not confirm in the code.
- **Date of analysis:** 2026-10-24

---

## 1. Tech stack and presentation

| Aspect | Finding |
|---|---|
| Engine | Phaser 3.88.2, `type: AUTO`, `pixelArt: true`, `roundPixels: true`, `fps.target: 60` |
| Resolution | Logical 360×740 portrait, rendered at **3×** (`width: 360*3`, `height: 740*3`) with `Scale.FIT` and `CENTER_BOTH`. Text uses `setResolution(3*2)` |
| Projection | Isometric grid with 64×32 px tiles (`Be=64`, `ye=32`). Shop origin is (196,226) for the street stall and (184,252) for the shophouse |
| Scenes | 3 Phaser scenes: `shop` (main game, about 8,000 formatted lines), `city` (pannable, pinch-zoomable map of neighbouring player shops, zoom 0.5) and `cityui` (overlay for the city) |
| Assets | Separate PNG frames, no atlases: `assets/<anim>_<n>.png`, e.g. `cook_0..8`, `vidle_0..3`. Each customer type has `_wsw`/`_wne` walk ×8, `_sit` ×5, `_seat_eat` ×9 and `_eatne` ×8. Chef outfits are swapped by folder (`assets/chef1/`, `chef2/`, `chef3/`). Food icons are at `assets/icons/food_<id>.png`, decor at `assets/dec_<id>.png`, city tiles at `assets/city2/` |
| Art style | Pixel art with a lofi palette. The cover/OG image is a painterly pixel scene: a woman at a wok under string lights, a tuk-tuk on a wet street at dusk. Background `#1c1426`, gold UI text `#f6d8a0` |
| Font | `"Noto Sans Thai","Sukhumvit Set","Thonburi","Leelawadee UI",Tahoma`. The game waits up to 2.5 s for the font before booting |
| Audio | **No audio files.** All music and SFX are synthesised with the Web Audio API (oscillators, biquad filters, noise buffers). There are two procedural lofi songs: "day" at 88 bpm, swing 0.12, lowpass 3400 Hz, and "night" at 76 bpm, swing 0.18, lowpass 1900 Hz. Each has a 32-step melody over 4 seventh-chord progressions with bass and kick patterns. SFX include tap, coin, sizzle loop, rain loop, angry and tones |
| Lighting/FX | A `lofi` post layer handles colour grade, point lights (stove light strength 0.15 idle and 0.75 when cooking), dust motes, rain plus splash, film grain and vignette. Sky colour comes from 11 keyframes over 24 h |
| Clock | **Real-world time drives the scene.** A shift starts at the device's current local hour, and the 180-second shift (`de=180`) advances the in-game clock by 5 hours. Rain falls on about 27% of days after day 2 (deterministic hash of the day number) |
| Hosting | Cloudflare Pages. Cloudflare Turnstile (invisible "interaction-only") guards anonymous sign-up |
| PWA | Manifest with `display: fullscreen` and `orientation: portrait`, iOS web-app meta tags, maskable icons. I saw no service-worker registration in the game code |
| Boot UX | Plain-HTML cover in the same 360×740 frame, with a progress bar and rotating flavour lines ("กำลังจุดเตา...", "หั่นพริกขี้หนู (ระวังเข้าตา)...", "ปลุกแมวหน้าร้าน..."). The first tap unlocks audio. `?visit=` and "return home" trips get their own cover art (`visit.png`, `home.png`) and skip the tap |
| Photo | The player can take a shop photo (`takePhoto`) and share it with `navigator.share`, or download it |

---

## 2. Core loop

### 2.1 Session structure

```
Title/menu → (Market: buy ingredient sets) → Open shop → 180-s shift → Close: P&L panel → quests/goals/fame check → Title
```

- **Shift length:** 180 s of game time. No new walk-ins arrive in the last 12 s (`clock < de-12`) and no riders in the last 25 s. After 180 s the shop waits for seated customers to finish and pay.
- **Early close:** if everything is sold out (nothing orderable and nothing in the kitchen) and no customer is active, the shop closes early with "🎉 ขายหมดเกลี้ยง! ปิดร้านก่อนเวลา".
- One shift = one "day" (`save.day += 1`). Days are not tied to the calendar, so a player can play many days in a row. Market stock, quests, the wheel and streaks **are** tied to the calendar: they reset at midnight Bangkok time, computed as `Date.now() + 7h`.

### 2.2 Input: tap only

Every gameplay action is a **tap**. Drag appears only in decor editing and in city/shop panning; pinch appears only in the city map. There are no hold or swipe minigames for cooking.

1. A customer walks in, sits and shows a speech bubble with a dish icon and a patience bar (30 px wide, green >60%, yellow >30%, red below). The dish is chosen at random from the dishes that are currently orderable.
2. The player **taps a menu card** (bottom kitchen panel) to cook that dish. This uses up 1 portion from the pantry and 1 clean plate.
3. The **vendor walks to the station** (wok, bar, pot, mortar, dessert, grill, sushi or prep) and works automatically while a progress bar fills. Each station has its own animation (`cook`, `v_pour`, `v_blanch`, `v_pound`, `v_slice`, `v_grill`, `v_sushi`, `v_prep`). The wok adds fire particles, sizzle audio and stove light.
4. The finished plate goes to the **counter**, which has 3 ready slots (`ie=3`). The cook queue holds up to 2 more orders (`Ci=2`). When the queue is full the vendor says "คิวเต็ม! เสิร์ฟก่อน".
5. To serve, the player **taps the customer**, or taps a plate on the counter, which auto-targets the matching waiting customer with the lowest patience. If a waiter is hired, the waiter walks the plate over.
6. The customer eats for 4.5 s (`Ei`). DIY table dishes such as mookata and shabu take 4.5 × 2.6 = 11.7 s. At 35% of the meal, a mookata/shabu customer asks for a **refill** (coal or soup). Tapping them for the refill adds a +10 ฿ tip (`ks`).
7. The customer then shows the bill "💵N". The player **taps to collect**. If nobody collects within 16 s (`Lr`), the customer leaves the money **without the tip or combo bonus**. A cash desk makes customers queue there and lets one tap collect from everyone. A QR sign (600 ฿) makes customers pay by themselves.
8. **Dishwashing:** each served plate becomes dirty. The player taps 🧽 to wash one at a time. With no clean plates, cooking is blocked ("จานหมด!"). Plates start at 10 (`ai`).

A **waste mechanic** is included: a plate that no customer wants can be discarded with a tap, and the vendor complains.

### 2.3 Customer system

| Parameter | Value |
|---|---|
| Base patience (s) | `(32 − min(day−1, 10) × 0.9) × (ceiling fan ? 1.25 : 1)`, so 32 s on day 1, falling to 23 s from day 11 |
| Patience modifiers | Radio +10% and water dispenser +10% (shop-wide). Floor fan within 2 tiles of a table: that table drains at 1/1.25 the rate. Customers waiting on a bench drain at **0.5×** |
| VIP patience multipliers | Food reviewer `rv` 0.9, socialite `hs` 0.75, MP/politician `pl` 0.85 |
| Spawn interval (s) | `max(2.4, 8 − day×0.12 − (seats−4)×0.3) × U(0.7, 1.3) × (rain ? 1.25 : 1) ÷ (menu-board ? 1.15 : 1)`. The first spawn comes 1.5 s after opening |
| Seat requirement | A customer spawns only if a seat or bench spot is free and a walking path exists. Otherwise the spawn is skipped (no off-screen queue) |
| Order choice | Random among dishes with stock remaining. The calculation counts portions already promised to waiting customers, so stock-outs show up early |
| Give-up | Patience reaches 0. The customer leaves, records a **1★ rating**, resets the combo and plays an angry bark |
| Rating per serve | 5★ if patience >60%, 4★ if >30%, else 3★. A condiment shelf within 2 tiles adds +1, capped at 5. The day's average is shown as ⭐ x.x |
| Customer types | 11 sprite types: `m, f, fl, gr` (locals), `of, st, mt, un` (office worker, student, motorbike-taxi rider, uncle in a polo shirt), `rv, hs, pl` (VIPs). Fame tier sets the pool. Spawn weights: normal 1, rv 0.5, hs 0.45, pl 0.35 |
| Barks | Large pools of humorous Thai lines per state (arrive, bench, impatient, angry, mutter, eat, happyLeave, checkBill, payWait). There are dish-specific lines, e.g. kaprao wait "ไปปลูกกะเพราอยู่เหรอ", and VIP-specific arrive/eat/slow lines |

**Delivery riders** are unlocked by purchase. A rider spawns every 26 s (15 s with 2 apps) × U(0.75, 1.25) × 0.6 when it rains. Patience is a fixed 50 s, the rider needs no table and pays the dish price × (1 − 25% GP). Riders give stars 5/4/3 at patience thresholds 50%/25%.

### 2.4 Money per plate

```
bill = dishPrice + recipeBonus + tip + comboBonus
tip  = (patience>60% ? 15 : patience>30% ? 5 : 0) × vipTipMult × (1 + chefTip + petTip)
comboBonus = combo>1 ? min(40, (combo−1)×5) : 0     // combo = serves within 6 s of each other
```

- VIP tip multipliers: rv ×2, hs ×3, pl ×4.
- Chef rank tip: +0%, +15%, +30%, +50%.
- Pets: +4% tip each, +8% if fed today (tap the pet once per day).
- A good review from the food reviewer (served at >60% patience) gives +3 fame.

### 2.5 Kitchen speed

`cookTime = baseCook × stationLevelMult × (drink/dessert ? fridge/cooler mult) × (kaprao ? herb-pot 0.85) × (1 − 0.08×"fast" skill) × (cooking 2 at once ? 1.25)`

- Station level multipliers for levels 1–5: `[1, 0.85, 0.72, 0.62, 0.54]`.
- Fridge near the bar: 0.6 (0.85 if farther away). Cooler near the bar: 0.8.
- Hired helpers start slower: `1.35 − 0.035×min(daysWorked, 10)`, so 35% slower on day 0 and equal to the vendor after 10 days.

---

## 3. Stations and recipes

### 3.1 Stations (`Ft`)

| id | Thai name | Verb | Notes |
|---|---|---|---|
| wok | เตาฟู่ | กำลังผัด | always present (ผัด) |
| bar | บาร์ชง | กำลังชง | always present (ชง) |
| pot | หม้อก๋วยเตี๋ยว | กำลังลวกเส้น | (ลวก) |
| mortar | ครกส้มตำ | กำลังตำ | (ตำ) |
| dessert | โต๊ะของหวาน | กำลังจัด | |
| grill | เตาถ่าน | กำลังย่าง | relevant to the mala game |
| sushi | เคาน์เตอร์ซูชิ | กำลังปั้น | |
| prep | ตู้เตรียมชุด | กำลังจัดชุด | for DIY table dishes (mookata/shabu) |

The **"tonight's menu" constraints** are a strategic layer. A shift can sell at most **8 dishes** (`ce=8`) and use at most **3 extra stations** besides wok and bar (`Ge=3`), because the stations mount on the kitchen wall. The game frames this as choosing the shop's concept for the night.

### 3.2 Menu data

Price is the base sell price in ฿. Cook is base seconds. Unlock is the recipe purchase price. Ingredient cost is my sum of the per-plate ingredient prices from the ingredient table. Margin is (price − ingredient cost)/price. The recipe tier columns give the upgrade cost for +5/+10/+15 ฿ per plate, using the formulas `300+4p`, `900+12p` and `2000+20p`.

| dish | station | price | cook s | unlock ฿ | ingr ฿/plate | margin | ฿ per cook-second | recipe tiers ฿ |
|---|---|---|---|---|---|---|---|---|
| kaprao ผัดกะเพรา | wok | 50 | 2.0 | start | 18 | 64% | 16.0 | 500/1500/3000 |
| friedrice ข้าวผัด | wok | 50 | 2.2 | start | 18 | 64% | 14.5 | 500/1500/3000 |
| omelet ข้าวไข่เจียว | wok | 40 | 1.6 | start | 12 | 70% | 17.5 | 460/1380/2800 |
| thaitea ชาเย็น | bar | 30 | 1.2 | start | 7 | 77% | 19.2 | 420/1260/2600 |
| oliang โอเลี้ยง | bar | 25 | 0.9 | 150 | 6 | 76% | 21.1 | 400/1200/2500 |
| kana คะน้าหมูกรอบ | wok | 60 | 2.6 | 200 | 25 | 58% | 13.5 | 540/1620/3200 |
| limetea ชามะนาว | bar | 30 | 1.0 | 200 | 8 | 73% | 22.0 | 420/1260/2600 |
| redsoda น้ำแดงโซดา | bar | 30 | 1.0 | 200 | 7 | 77% | 23.0 | 420/1260/2600 |
| noodle ก๋วยเตี๋ยวหมู | pot | 55 | 2.4 | 250 | 17 | 69% | 15.8 | 520/1560/3100 |
| icecoffee กาแฟเย็น | bar | 35 | 1.2 | 250 | 8 | 77% | 22.5 | 440/1320/2700 |
| somtam ส้มตำ | mortar | 45 | 2.2 | 300 | 12 | 73% | 15.0 | 480/1440/2900 |
| cocoa โกโก้เย็น | bar | 35 | 1.2 | 300 | 9 | 74% | 21.7 | 440/1320/2700 |
| mango ข้าวเหนียวมะม่วง | dessert | 70 | 1.4 | 350 | 23 | 67% | 33.6 | 580/1740/3400 |
| greentea ชาเขียวนม | bar | 40 | 1.3 | 350 | 11 | 72% | 22.3 | 460/1380/2800 |
| larb ลาบหมู | mortar | 60 | 2.2 | 400 | 19 | 68% | 18.6 | 540/1620/3200 |
| coconutjuice น้ำมะพร้าว | bar | 45 | 1.4 | 400 | 18 | 60% | 19.3 | 480/1440/2900 |
| gaiyang ไก่ย่าง | grill | 60 | 2.8 | 450 | 21 | 65% | 13.9 | 540/1620/3200 |
| bubbletea ชาไข่มุก | bar | 45 | 1.5 | 450 | 11 | 76% | 22.7 | 480/1440/2900 |
| kohmoo คอหมูย่าง | grill | 70 | 2.6 | 550 | 23 | 67% | 18.1 | 580/1740/3400 |
| maki ข้าวม้วนมากิ | sushi | 60 | 2.0 | 600 | 12 | 80% | 24.0 | 540/1620/3200 |
| plapao ปลาเผา | grill | 120 | 3.6 | 800 | 36 | 70% | 23.3 | 780/2340/4400 |
| sushi ซูชิแซลมอน | sushi | 89 | 2.4 | 800 | 26 | 71% | 26.2 | 656/1968/3780 |
| sashimi แซลมอนซาชิมิ | sushi | 99 | 1.8 | 1000 | 39 | 61% | 33.3 | 696/2088/3980 |
| shabu ชาบูหมู | prep | 109 | 2.4 | 1100 | 30 | 72% | 32.9 | 736/2208/4180 |
| mookata หมูกระทะ | prep | 119 | 2.6 | 1200 | 29 | 76% | 34.6 | 776/2328/4380 |

Menus are grouped into themed "packs": tamsang, noodle, isan, drink, sweet, sushi, mookata. A "coming soon" pack "🍲 ลาบ·ก้อย·ต้ม·ซอยจุ" is teased in the shop.

**Balance observations (inference):**
- Margins sit in a narrow 58–80% band. Profit per plate grows with price, but cook time grows more slowly, so later dishes earn much more per second of vendor time: mookata 34.6 vs kana 13.5. That makes recipe unlocks the main growth lever.
- Real throughput is limited by customer spawn rate and seats, not by cook time. A 2-second cook against a spawn every 2.4–8 s means cooking is rarely the bottleneck in early days. The pressure comes from walking between stations, the 3-slot counter, plates and washing.
- Ingredient cost is roughly 20–40% of price, so selling every plate is always profitable. Losses come from wages and over-buying.

### 3.3 Ingredients and the market

The player buys **ingredient "sets" per dish**, where **1 set = 10 plates** (`_t=10`). Individual ingredients (35 entries, e.g. rice 3 ฿, pork 10, egg 4, chicken 14, pork neck 16, whole tilapia 30, salmon 18, charcoal 2, broth 4) feed only the set price: `setPrice = Σ(ingredient price × qty) × 10 × marketMult`.

- **Daily market fluctuation**, seeded by day number: every dish gets a ×0.90–1.15 multiplier. One "deal" dish is ×0.65 (🏷) and one "dear" dish is ×1.35 (📈).
- **Supply cap:** 3 sets per dish per calendar day (`Yi=3`), restocked at Bangkok midnight. When all sets are bought, "ตลาดวายแล้ว".
- **Storage cap:** 30 plates per dish (`ps`), or 50 with a drinks fridge (`Je`). Stock never spoils ("ของไม่เน่าเสีย").
- **"🧺 เติมเท่าที่ขายเมื่อวาน"** auto-fills the cart to max(10, ceil(yesterday's sales × 1.2)) for each dish, clipped by the caps.
- **Thrift skill:** 15% (or 30%) chance per cooked plate that the portion is refunded.
- **Starting pantry:** kaprao 12, friedrice 10, omelet 10, thaitea 12 plates.
- **Starting cash:** `bank: 0`. The first streak reward (60 ฿) and the starter pantry carry the first day.

---

## 4. Economy constants

| Constant | Value |
|---|---|
| Starting bank | 0 ฿ (plus day-1 streak reward of 60 ฿) |
| Starting tables / chairs per table | 2 tables, 2 chairs |
| Starting plates | 10 |
| Helper (station cook) wage | 150 ฿/day each, paid at close. A helper whose station is unused tonight is not paid. Hiring has no upfront fee |
| 2nd waiter wage | 120 ฿/day |
| Dishwasher auntie wage | 100 ฿/day. She washes one plate every 3.2 s, or every 1.2 s with the 1,800 ฿ machine |
| Rider GP | 25% of the plate price |
| Combo window / cap | 6 s / +40 ฿ per plate |
| Refill tip | +10 ฿ |
| Gift "thanks" | +30 ฿ per friend who received your gift (`Hs`) |
| Local-mode sales cap per reported day | 6,000 ฿ (`Math.min(sales, 6e3)`) |

The close-of-day panel shows: income (food, tips, combo), expenses (ingredients bought since the last close plus wages), profit, plates served, walk-outs, plates discarded, average ⭐, sold-out flag, bank and best day.

---

## 5. Upgrades and cost curves (the 🛒 shop)

One data-driven list of `{id, cat, chain, price, owned(), can(), buy(), why()}` entries. `why()` supplies the lock reason, e.g. "🔒 ขยายแผงก่อน" or "🎓 เชฟขั้น 2". The categories follow.

### 5.1 Area / venue (`cat: area`)
| Upgrade | Price ฿ | Effect |
|---|---|---|
| ขยายแผง (expand stall) | 500 | street stall area 2, up to 4 tables |
| ย้ายเข้าห้องแถว 1 คูหา | 1,500 | move to a shophouse with a roof. Decor goes back to storage. Allows the ceiling fan |
| ห้องแถว 2 คูหา | 6,000 | wider room, up to 8 tables, horizontal panning |
| Rider app 1 / 2 apps | 600 / 1,600 | delivery orders, 1 or 2 rider slots |
| 2nd waiter | 700 | 2 waiters deliver in parallel (120 ฿/day) |

### 5.2 Tables / chairs
- Tables 3 and 4: 300 and 600 ฿. Tables 5–8: `600 + (n−4)×300`, i.e. 900, 1,200, 1,500, 1,800. Tables 5+ need the 2-unit shophouse.
- Chairs: 3 per table for 350 ฿, 4 per table for 800 ฿.
- Seat count also speeds up spawns by −0.3 s per seat above 4.

### 5.3 Kitchen
- **Station levels 2→5**, cost by station:
  - wok: 300 / 700 / 1,400 / 2,600
  - bar, pot, mortar, dessert: 250 / 600 / 1,200 / 2,200
  - grill: 300 / 700 / 1,400 / 2,400
  - sushi and prep: 350 / 800 / 1,600 / 2,800
  
  Speed multipliers for levels 1–5 are 1, 0.85, 0.72, 0.62, 0.54, so level 5 is 46% faster. Each level has flavour names, e.g. grill: เตาถ่านดินเผา → ตะแกรงสแตนเลส → ถ่านไม้โกงกาง → เตาย่างรางยาว → เตาถ่านสูตรเจ้าดังอีสาน.
- **Plates:** 16 / 22 / 28 total for 200 / 450 / 800 ฿.
- **Dishwasher:** auntie 300 ฿ (+100 ฿/day), then machine 1,800 ฿.
- **Auto-kitchen** 🤖: 5,000 ฿. Orders start cooking automatically without tapping menu cards. It requires at least 3 staff covering every non-wok station in use. (Inference: this is the late-game automation reward that turns the game into a management sim.)

### 5.4 Menu / chef
- **Recipe purchase:** each dish's `unlock` price (150–1,200 ฿).
- **Recipe tiers** (สูตรเด็ด / สูตรลับแม่ / สูตรตำรับเชฟ): +5 / +10 / +15 ฿ per plate with no extra ingredients. Costs are `300+4p`, `900+12p`, `2000+20p`. Tier N requires chef rank ≥ N.
- **Chef courses** (real-time gated):

| Rank | Title | Course price ฿ | Min day | Duration | Tip bonus | Outfit |
|---|---|---|---|---|---|---|
| 0 | แม่ค้าริมทาง | – | – | – | 0 | – |
| 1 | เชฟประจำซอย | 1,200 | 4 | **1 real day** | +15% | white apron, red headscarf |
| 2 | เชฟมือทอง | 3,500 | 10 | **2 real days** | +30% | chef shirt, brown apron |
| 3 | เชฟระดับตำนาน | 8,000 | 18 | **3 real days** | +50% | gold-button chef suit, tall toque |

### 5.5 Skills (training for the vendor and for each helper)
| Skill | Prices ฿ | Effect |
|---|---|---|
| ⚡ มือไว (fast) | 300 / 700 / 1,300 | −8% cook time per level |
| 🌿 ไม่เสียของ (thrift) | 400 / 900 | 15% per level chance to refund a portion |
| 👐 ทำทีละ 2 (double) | 1,200 (needs fast) | If the same dish is ordered while cooking (<60% done), cook 2 at once at ×1.25 time |

Each training session finishes **the next real calendar day** (`done = today+1`).

### 5.6 Staff
Four named helpers: น้องบอย, ป้าศรี, ลุงชัย, น้องฝน. Each is assigned to one non-wok station, gains "days worked" (★ display, speed penalty decays) and can be trained. Firing a trained helper asks for confirmation.

### 5.7 Equipment and decor (placed on the iso grid)
Function decor (`equip`), bought into stock and then placed:

| Item | ฿ | Effect |
|---|---|---|
| fan พัดลมตั้งพื้น | 90 | tables within 2 tiles: patience +25% |
| menuboard ป้ายเมนู | 80 | placed at the shop front: spawn rate +15% |
| bench ม้านั่งรอคิว | 110 | 1 queue spot when tables are full, patience drains at half rate |
| fridge ตู้แช่ | 250 | drinks/dessert 40% faster near the bar (15% if far). Storage 30→50 per dish |
| cooler กระติกน้ำแข็ง | 60 | drinks 20% faster near the bar |
| water ตู้น้ำดื่ม | 160 | shop-wide patience +10% |
| herbs กระถางกะเพรา | 50 | kaprao 15% faster near the wok |
| shelf ชั้นเครื่องปรุง | 120 | tables within 2 tiles: +1★ |
| cashdesk โต๊ะคิดเงิน | 400 | pay queue frees seats immediately, one tap collects from all |
| radio วิทยุโบราณ | 200 | shop-wide patience +10% (one is enough) |
| Ceiling fan + chandelier (shophouse) | 350 | all customers +25% patience |
| QR pay sign | 600 | customers pay by themselves |

Beauty decor (19 items, 60–350 ฿, beauty 1–6) includes lantern, banana plant, bougainvillea, dragon jar, antique bicycle, soda crates, rice sacks, candy jars, coconut-ice-cream cart, 80s wooden TV, jukebox, and more. Only the **first 2 copies** of an item count toward beauty (`Un=2`). Some decor is unlocked only by achievements: trophy, jukebox, cat, lotus basin, string lights, birdcage.

**Placement validation** (good UX worth copying): the game rejects any placement that blocks the customer path from the entrance to a table, blocks the waiter's path, sits too close to a table for the opposite chair, or blocks a bench. It uses A* pathfinding with a turn penalty of 0.6 and shows Thai error messages.

**Pets:** orange cat (free, arrives at fame tier 1), black cat 600, Thai dog 800, calico 900 ฿. Each gives +4% tips, or +8% if fed that day.

---

## 6. Progression

### 6.1 Fame tiers (ชื่อเสียง) unlock customer types
Fame gain: +rating/5 per plate served, +0.5 per rider order, +3 for a reviewer served fast, +10 for a perfect day (no walk-outs with ≥10 served).

| Tier | Name | Fame needed | New guests |
|---|---|---|---|
| 0 | ร้านหน้าใหม่ | 0 | locals (m, f, fl, gr) |
| 1 | ร้านประจำซอย | 30 | office worker, student, moto-taxi, uncle |
| 2 | ร้านดังในย่าน | 150 | food reviewer (tip ×2) |
| 3 | ร้านดังโซเชียล | 450 | hi-so socialite (tip ×3, impatient) |
| 4 | ร้านระดับตำนาน | 1,200 | MP politician (tip ×4) |

### 6.2 Long-term goals (achievements), reward in ฿ plus decor unlocks
| Goal | Tiers | Rewards ฿ |
|---|---|---|
| Plates served | 50, 150, 400, 1k, 2.5k, 5k, 10k | 150, 250, 400, 600, 900, 1,300, 2,000 (tier 1 gives the trophy) |
| Total earned | 3k, 10k, 30k, 80k, 200k, 500k | 200, 350, 600, 900, 1,400, 2,200 (jukebox) |
| Days open | 3, 7, 14, 30, 60, 100, 200 | 150 … 2,500 (cat) |
| Perfect days | 1, 5, 15, 30, 60 | 150 … 1,200 (lotus) |
| Best combo | 3, 5, 8, 12, 16 | 100 … 800 (string lights) |
| VIPs served | 3, 15, 40, 100, 250 | 200 … 1,500 (birdcage). Shown only from fame tier 2 |
| Rider orders | 10, 50, 150, 400, 1k | 150 … 1,200 |
| Beauty points | 8, 20, 35, 55, 80 | 150 … 1,200 |

### 6.3 Dish stamps (collection layer)
Each dish earns bronze/silver/gold stamps at 10 / 50 / 150 plates sold, worth 40 / 120 / 300 ฿. Completing a whole pack at a tier pays 300 / 800 / 2,000 ฿.

### 6.4 Daily quests
- 3 quests per calendar day, chosen by a seeded RNG (date + friend code) with weights: serve 3, dish 3, fast 2, combo 2, earn 2, perfect 2 (day ≥2), stars 1.5 (day ≥3), rider 2.5 (if riders are owned), upgrade 1.5 (day ≥2).
- Targets scale with day d (capped at 40): serve `15+1.2d` (rounded to 5), dish `4+⌊d/5⌋`, fast `8+0.5d`, combo `min(6, 3+⌊d/8⌋)`, earn `450+70d` (rounded to 50), rider `3+⌊d/6⌋`.
- Base rewards are 80–140 ฿, multiplied by `1+0.06d`. Completing all three adds a bonus box worth `round((200 + 15·min(d,40))/10)×10` ฿, i.e. 210 on day 1 and 800 at d=40.

### 6.5 Daily retention hooks
- **Login streak:** 60, 90, 120, 160, 200, 260, **500** ฿ over a 7-day cycle. Missing a day resets the count with the message "ลูกค้าประจำถามหาเลยนะ".
- **Daily wheel** (once per calendar day), weights in parentheses: 50 ฿ (26), ingredient set (20), 100 ฿ (20), decor ≤200 ฿ (6), 200 ฿ (12), 2 sets (9), 500 ฿ (3), 80 ฿ (4).
- **Weekly league** (ISO week): bronze, silver, gold, platinum, diamond. The **top 30% are promoted**. Weekly payout is `[800, 500, 300][rank−1] ?? 100` × (1 + 0.5×tier), paid only if sales > 0.

---

## 7. Social and meta systems

- **Friend codes:** 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (ambiguous characters removed). Added through the RPC `add_friend(code)`.
- **Visiting** `?visit=<shopId>`: a full page reload into a read-only copy of the friend's shop, built from the `shop_snapshots` JSON. It shows the layout, menu, chef outfit, pets and simulated customers. The visit runs in "unlimited" mode with no stock or plates and no effect on saves. The HUD shows "👀 เยี่ยมร้าน".
  - **Like** ❤️: once per shop per week.
  - **Review**: the visitor **picks from 12 preset compliments** (`Ls`: "อร่อยมาก!", "ร้านสวยจัง", "ไฟสวยมาก", "สู้ๆ นะ!", ...). Only a `message_id` is stored. This avoids moderation of free text (inference: a deliberate choice).
  - **Gift** 🎁: once per day per shop, max 5 shops per day. The friend receives a dish set (plates) when they next open the game. The sender earns +30 ฿ "น้ำใจ" when it is claimed (`claim_gifts` and `claim_thanks` RPCs).
- **City map** ("🗺 ดูเมือง"): a pannable, pinch-zoom isometric street of up to 30 recently active shops (`profiles` ordered by `updated_at`), with walking NPCs and traffic. Tapping a shop visits it.
- **Rankings:** weekly sales leaderboard (`weekly_sales` view, top 50, all players or friends only) and the league board.
- **Shop-name validation:** 2–20 characters plus a small Thai/English profanity blocklist.
- **Offline / local fallback:** when Supabase fails (6-s timeout) the game uses a `localStorage` backend that seeds 6 fake neighbour shops, e.g. "ก๋วยเตี๋ยวเรือป้าจิต" and "หมูกระทะลุงชัย", with realistic stats, so the social screens never look empty.
- **Feedback form:** inserts into the `feedback` table (≤1,000 characters).

---

## 8. Auth and save system

### 8.1 Auth flow
1. If no Supabase session exists, the HTML cover asks the player to choose **"เข้าด้วยบัญชี Google"** or **"เล่นแบบ Guest"**, with a hint that a Guest shop lives on one device and can be linked to Google later.
2. Google uses `signInWithOAuth({provider:'google', redirectTo: origin+path})`. Guest uses `signInAnonymously` with a **Cloudflare Turnstile** captcha token (invisible unless challenged). Either way every player is a real Supabase user, so leaderboards and gifts work for guests.
3. Upgrading a guest uses `linkIdentity` (anonymous user → Google). If that Google account already owns a shop, the game offers to switch ("บัญชี Google นี้มีร้านอยู่แล้ว ... ร้าน Guest ในเครื่องนี้จะถูกแทนที่").
4. The game boots within a 6-s timeout, otherwise it falls back to local-only mode.

### 8.2 Persistence
| Where | Key / table | Content |
|---|---|---|
| localStorage | `raanded_v1` | full save JSON (authoritative locally, written on every change) |
| localStorage | `soisizzle_settings` | `{music, sfx, fx, tips}` |
| localStorage | `soisizzle_online_local` | offline-mode fake backend DB (version 4) |
| localStorage | `soisizzle_switch`, `soisizzle_linking` | OAuth round-trip flags |
| localStorage | `soisizzle_feedback` | offline feedback queue (last 50) |
| sessionStorage | `soi_boot`, `soisizzle_toast` | cross-reload UI hints (visit name, toast) |
| Supabase | `profiles` | id, shop_name, friend_code, venue, beauty, best, day, updated_at |
| Supabase | `saves` | user_id, data (JSON), day, updated_at. Cloud copy of the save |
| Supabase | `shop_snapshots` | user_id, data. The public subset for visits (venue, area, tables, chairs, kit, tablesAt, decor, menu, today, units, staff, fan, day, chef, pets) |
| Supabase | `day_results` | user_id, day, sales, served, stars (one insert per shift) |
| Supabase | `weekly_sales` (view, inferred) | id, shop_name, venue, beauty, best, stars, likes, sales, days, week |
| Supabase | `friends`, `likes(from_id,to_id,week)`, `reviews(from_id,to_id,message_id)`, `feedback` | social |
| Supabase RPC | `send_gift`, `gifted_today`, `claim_gifts`, `claim_thanks`, `my_league`, `league_board`, `add_friend` | server-side rules (rate limits, league maths) |

**Sync strategy:**
- localStorage is written immediately and the cloud push is **debounced 1.5 s** (`pushSave`). Important actions (market purchase, wheel) push immediately.
- On boot the cloud save is pulled. It replaces the local save if the local save is missing, if the player just switched accounts, or if `cloud.day > local.day` (the "highest day wins" conflict rule).
- `pushShop` (snapshot plus profile stats) runs at end of shift.
- A **migration function** (`on()`) back-fills missing fields for old saves.
- "Start over" requires a confirm dialog **plus** typing "เริ่มใหม่".

**Trust model (inference):** the client is authoritative for money and progress. Only `day_results` sales feed the leaderboard, and the local mode caps sales at 6,000 per day. A modified client could inflate weekly sales unless the server validates `day_results`, which I could not see.

---

## 9. Onboarding and UX notes
- Day-1 scripted tutorial: "ลูกค้าคนแรกกำลังเดินมา!" → tap ผัดกะเพรา → "เสิร์ฟ" → "กินเสร็จแล้ว! แตะที่ลูกค้าเพื่อเก็บเงิน 💵".
- **Contextual one-time tips** (each shown once, stored in `save.tips`, can be turned off): first walk-out, first VIP, first rider, rain, dirty plates ≥3, sold-out dish, new station (hire a helper), menu exceeding 8 dishes, chef course available, orphan plate on the counter, city map. Each tip has a spotlight frame on the relevant UI.
- The title menu is a hub: 🛠 decorate, 🧑‍🍳 kitchen team, 🍽 tonight's menu (n/8), 🗺 city, 👥 friends & ranking, 🧺 market (⚠️ if stock is empty), 🛒 shop/upgrades, 📋 quests (n/3 🎁), 🏆 goals & stamps, plus a wheel button with a pulsing dot.
- Before opening, the game warns when some dishes are out of stock and offers "🧺 ตลาด" or "เปิดเลย".
- Ambient life: tuk-tuks, motorbikes and taxis drive past the street stall every 5–12 s, the radio emits ♪ notes, and the vendor makes idle barks after 14 s without work.

---

## 10. Lessons for a หม่าล่าเสียบไม้ (mala skewer) grill game

### Copy (proven, cheap, fits our genre)
1. **Tap-only loop with automatic cooking and progress bars:** tap order → worker walks to station → bar fills → plate on counter → tap customer → tap to collect bill. It is readable in portrait at 360 px wide and plays one-handed.
2. **Short fixed shifts (about 3 min) followed by a P&L panel.** Showing income split into food, tips and combo against ingredients and wages teaches the economy without a tutorial.
3. **Patience → tip → stars:** thresholds at 60% and 30% (15/5/0 ฿ tip, 5/4/3★), a walk-out records 1★ and breaks the combo. A colour-banded bar under the order bubble.
4. **A 6-s combo window with a capped bonus** (+5 ฿ per step, cap 40). It rewards batching without punishing slower players.
5. **Market of "sets = 10 portions"** with per-dish storage caps, a daily supply cap, a seeded daily deal/dear price, and a "refill what sold yesterday ×1.2" button. It gives a planning decision without inventory micromanagement.
6. **Data-driven upgrade list** (`owned/can/buy/why`) with readable lock reasons. **Station levels using the 1 → 0.54 speed curve**, plus flavour names for each level.
7. **Equipment with spatial effects** (fan near tables, menu board at the shop front, shelf +1★) and **path-blocking validation**, which turns decorating into light strategy.
8. **Retention stack:** a 7-day streak (60…500), a daily wheel, 3 seeded daily quests with a scaling bonus box, a weekly league with top-30% promotion, long-term goals that unlock exclusive decor, and dish stamps (10/50/150).
9. **Social without moderation risk:** friend codes without ambiguous characters, `?visit=` read-only snapshots, weekly likes, **preset-message reviews**, daily gifts of ingredient sets that also reward the sender.
10. **Auth:** Supabase anonymous users for guests (Turnstile-protected) plus `linkIdentity` to Google later. localStorage as the primary save with a debounced cloud push, a local fake-backend fallback with seeded NPC shops, and a 6-s boot timeout.
11. **Presentation:** HTML cover screen before the bundle loads (with Thai jokes in the loading lines), procedural WebAudio lofi (zero audio assets), real-clock day/night lighting, rain nights, humorous Thai barks per state and per dish.

### Adapt (change for skewers)
1. **Skewer grilling should be a real minigame.** Soi Sizzle's cooking is passive (a bar fills), so a skewer grill can add depth through **doneness and flipping**. Skewers on a grill rack have raw → perfect → burnt states, and the player taps to flip or drags to move them. Keep it tap-first. Make "perfect" give a tip bonus like the 60% patience band, and make "burnt" waste the portion like the discard mechanic.
2. **Self-service skewer picking:** mala shops have customers pick skewers from a fridge and pay by count or stick colour. Orders can be **multi-item baskets** (e.g. 5 sticks plus a drink) in place of one dish per customer. Price by stick tier (e.g. 5/10/15/20 ฿ sticks) and add a spice level (เผ็ดน้อย/กลาง/มาก) as an order modifier.
3. **Stations to use:** grill (main, the equivalent of the wok), fryer (ทอด), mala sauce/powder station, drink bar (ชาเย็น/น้ำแดง/เบียร์), and possibly a หม่าล่าหม้อไฟ pot later, which parallels the mookata/shabu DIY table dishes with refill requests for charcoal or soup.
4. **Charcoal as a consumable:** Soi Sizzle prices charcoal at 2 ฿ inside the set price. We could make the grill's heat level a resource that drops over the shift, so the player taps to add charcoal or upgrades to a gas grill.
5. **Use a 3-tier recipe system** for mala powder and sauce quality (+5/+10/+15 ฿), with costs `300+4p / 900+12p / 2000+20p` as a starting point. Prices are lower per stick, so re-tune these to per-basket value.
6. **Customer archetypes:** late-night drinkers (big baskets, patient), students (cheap sticks), delivery riders (GP 25%), and VIPs such as food TikTokers (tip ×2–4).
7. **Night market setting:** the game's real-time clock makes evenings beautiful. Mala skewers are a night food, so we could open the shift at dusk regardless of the real time, or keep the real-time sky but bias it to night.

### Avoid / watch out
1. **Real-calendar gates on core upgrades** (1–3 days for chef courses, next-day training) feel slow for a casual web game with no notifications. If we use them, keep them optional or let currency skip them.
2. **Client-authoritative economy and leaderboard:** validate `day_results` on the server (rate limits, max sales per shift derived from seats × time) or use an RPC that recomputes caps. Otherwise the weekly league is trivially cheatable.
3. **"Highest day wins" save merging** can lose progress, e.g. when a player resets on one device. Prefer `updated_at` plus a conflict prompt.
4. **Too many overlapping systems for a beta:** quests, goals, stamps, wheel, streak, league, pets, chefs, skills, staff, decor and city. Ship the loop, market, upgrades and streak first, then add the social layer.
5. **Tiny per-frame PNGs** (hundreds of requests, e.g. 11 customer types × 6 animations × 5–9 frames) slow down the first load. Use texture atlases.
6. **Narrow margin band (58–80%):** price differences mostly come from scale. Give skewer tiers clearer trade-offs (expensive sticks have long grill times and burn risk) so choosing a menu matters.
7. Do **not** copy brand names, character names, the asset look or the text strings verbatim. Take the mechanics and numbers as references only.

---

## Appendix: other constants found
- Counter ready slots 3, cook queue 2, helper queue 2. The "double" skill only applies when ready slots < 2.
- Eat time 4.5 s (DIY tables ×2.6). Bill wait 16 s. Rider patience 50 s.
- Vehicles spawn every 5–12 s on the street venue. Vendor walking speed 52, customers 36, waiter 70 (px/s, inference).
- Max 8 dishes per night, max 3 non-wok/bar stations. Tables per venue: street area 1 = 2, area 2 = 4; shophouse 1 unit = 4, 2 units = 8.
- Decor beauty counts at most 2 copies per item type.
- Friend code length 6. Shop name 2–20 characters. Feedback ≤1,000 characters.
