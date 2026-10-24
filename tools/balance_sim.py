#!/usr/bin/env python3
"""Economy simulator for MalaRimThang.

Plays N days with a simple "average player" model and a greedy upgrade
policy, and prints the progression curve. Use it to sanity-check
data/balance.json after changing numbers:

    python3 tools/balance_sim.py --days 60 --skill 0.7 --seed 1
"""
import argparse
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
B = json.loads((ROOT / "data" / "balance.json").read_text(encoding="utf-8"))

ITEMS = {i["id"]: i for i in B["items"]}
UPG = {u["id"]: u for u in B["upgrades"]}
LOCS = {l["id"]: l for l in B["locations"]}
HANDLING_SEC = 1.6  # pick up, place, flip taps, season, hand over


def level_xp(level):
    return round(30 * level ** 1.6)


def rep_spawn_mult(rep):
    pts = sorted((float(k), v) for k, v in B["reputation"]["spawnMultAt"].items())
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= rep <= x1:
            return y0 + (y1 - y0) * (rep - x0) / (x1 - x0)
    return pts[0][1] if rep < pts[0][0] else pts[-1][1]


class State:
    def __init__(self):
        self.money = B["shift"]["startingMoney"]
        self.level, self.xp = 1, 0
        self.rep = B["reputation"]["start"]
        self.upg = {k: 0 for k in UPG}
        self.items = {i for i, d in ITEMS.items() if d["unlockCost"] == 0}
        self.locs = {"soi"}
        self.loc = "soi"
        self.log = []

    def val(self, uid):
        return UPG[uid]["values"][self.upg[uid]]


def item_quality(item, skill, evenness):
    """Expected (quality, burnt fraction) for one skewer of this item."""
    # wider window + better grill + better player => more perfects, fewer burns
    ease = min(1.0, skill * (0.55 + 0.45 * evenness) * (0.6 + item["window"]))
    perfect = ease
    burnt = max(0.0, (1 - ease) * (0.5 - item["window"]))
    ok = 1 - perfect - burnt
    q = B["cooking"]["quality"]
    return perfect * q["perfect"] + ok * q["ok"], burnt, perfect


def simulate_day(s, skill, rng):
    loc = LOCS[s.loc]
    minutes = B["shift"]["lengthSec"] / 60
    n_cust = rng.gauss(1, 0.08) * loc["customersPerMin"] * minutes * s.val("sign") * rep_spawn_mult(s.rep)
    n_cust = max(1, int(n_cust))
    evenness = s.val("grillType")
    price_mult = s.val("powder")
    menu = sorted(s.items)

    # demand: list of orders (archetype, [item ids])
    orders = []
    for _ in range(n_cust):
        arch_id = rng.choices(list(loc["mix"]), weights=list(loc["mix"].values()))[0]
        a = B["archetypes"][arch_id]
        weights = [a["prefs"].get(ITEMS[i]["cat"], 0.1) for i in menu]
        size = rng.randint(*a["size"])
        picks, spend = [], 0
        for _ in range(size):
            it = rng.choices(menu, weights=weights)[0]
            p = ITEMS[it]["price"] * price_mult
            if spend + p > a["maxSpend"]:
                break
            picks.append(it)
            spend += p
        if picks:
            orders.append((arch_id, picks))

    # grill throughput (skewers/shift). Utilisation grows with skill; patience
    # (seating) lets the queue absorb more of the rush.
    slots = s.val("grillSize")
    avg_side = sum(ITEMS[i]["sideTime"] for o in orders for i in o[1]) / max(1, sum(len(o[1]) for o in orders))
    util = 0.45 + 0.4 * skill
    per_skewer = 2 * avg_side + HANDLING_SEC / max(0.5, util)
    capacity = slots * util * B["shift"]["lengthSec"] / per_skewer
    capacity *= 1 + 0.25 * (s.val("seating") - 1)  # longer patience => fewer walkouts
    capacity *= 1 + 0.5 * s.val("helper")
    capacity += s.val("rack") * 3  # rack lets you pre-cook for the rush
    # eat-in seats: seated customers order extra (approximated as more revenue per order)
    seat_bonus = 1 + 0.25 * B["eatIn"]["extraOrderChance"] * min(1.0, s.val("tables") / 6)

    revenue = tips = ingredient = 0.0
    served = walked = skewers = perfects = 0
    sat_sum = 0.0
    for arch_id, picks in orders:
        if skewers + len(picks) > capacity:
            walked += 1
            continue
        a = B["archetypes"][arch_id]
        q_sum = 0
        for it in picks:
            d = ITEMS[it]
            q, burnt, perf = item_quality(d, skill, evenness)
            # burnt skewers are remade: pay ingredient again
            ingredient += d["cost"] * (1 + burnt)
            revenue += d["price"] * price_mult * seat_bonus
            q_sum += q
            perfects += perf
        q_avg = q_sum / len(picks)
        tips += sum(ITEMS[i]["price"] for i in picks) * a["tipRate"] * q_avg
        skewers += len(picks)
        served += 1
        sat_sum += q_avg

    # stock: player over-buys ~15% to not run out; leftovers spoil unless fridge
    leftover = 0.15 * ingredient
    kept = min(leftover, s.val("fridge") * 6)
    waste = leftover - kept
    fixed = loc["rent"] + B["shift"]["charcoalPerShift"] * (0.6 if s.upg["grillType"] >= 2 else 1.0)
    wages = UPG["helper"]["wagePerShift"][s.upg["helper"]]
    profit = revenue + tips - ingredient - waste - fixed - wages
    s.money += profit

    satisfaction = (sat_sum / max(1, served)) * (served / max(1, served + walked))
    target = 1 + 4 * satisfaction
    s.rep += (target - s.rep) * 0.3

    s.xp += skewers * B["progression"]["xpPerSkewer"] + perfects * B["progression"]["xpPerPerfect"]
    while s.level < B["progression"]["maxLevel"] and s.xp >= level_xp(s.level):
        s.xp -= level_xp(s.level)
        s.level += 1

    return dict(cust=len(orders), served=served, walked=walked, skewers=skewers,
                revenue=revenue, tips=tips, profit=profit, cap=capacity)


def buy_upgrades(s, last_profit):
    """Greedy: keep a reserve, then buy the best value-per-baht option."""
    reserve = 150
    bought = []
    while True:
        options = []
        for uid, u in UPG.items():
            lvl = s.upg[uid]
            if lvl >= len(u["costs"]) or s.level < u.get("unlockLevel", 1):
                continue
            prio = {"grillSize": 3, "powder": 2, "sign": 2, "seating": 1.5, "grillType": 1.5,
                    "rack": 1, "fridge": 0.8, "helper": 1.2, "tables": 1.5}[uid]
            options.append((prio / u["costs"][lvl], u["costs"][lvl], "upg", uid))
        for iid, d in ITEMS.items():
            if iid not in s.items and s.level >= d["unlockLevel"]:
                options.append((2.5 / max(1, d["unlockCost"]), d["unlockCost"], "item", iid))
        for lid, l in LOCS.items():
            if lid not in s.locs and s.level >= l["unlockLevel"]:
                options.append((4 / l["unlockCost"], l["unlockCost"], "loc", lid))
        options = [o for o in options if o[1] <= s.money - reserve]
        if not options:
            return bought
        _, cost, kind, key = max(options)
        s.money -= cost
        if kind == "upg":
            s.upg[key] += 1
            bought.append(f"{key}{s.upg[key]}")
        elif kind == "item":
            s.items.add(key)
            bought.append(f"+{key}")
        else:
            s.locs.add(key)
            s.loc = key  # newest location is always the busiest
            bought.append(f"@{key}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=60)
    ap.add_argument("--skill", type=float, default=0.7, help="0..1 player skill")
    ap.add_argument("--seed", type=int, default=1)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    s = State()
    print(f"{'day':>3} {'lvl':>3} {'loc':<11} {'rep':>4} {'cust':>4} {'walk':>4} {'skw':>4} {'cap':>4} {'profit':>7} {'money':>7}  bought")
    for day in range(1, args.days + 1):
        r = simulate_day(s, args.skill, rng)
        bought = buy_upgrades(s, r["profit"])
        print(f"{day:>3} {s.level:>3} {s.loc:<11} {s.rep:4.2f} {r['cust']:>4} {r['walked']:>4} {r['skewers']:>4} "
              f"{r['cap']:>4.0f} {r['profit']:>7.0f} {s.money:>7.0f}  {' '.join(bought)}")
    total_upg = sum(len(u["costs"]) for u in UPG.values())
    owned = sum(s.upg.values())
    print(f"\nupgrades {owned}/{total_upg}, items {len(s.items)}/{len(ITEMS)}, locations {len(s.locs)}/{len(LOCS)}")


if __name__ == "__main__":
    main()
