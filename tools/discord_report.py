#!/usr/bin/env python3
"""Post a sprint update to Discord as a Components V2 message.

    python3 tools/discord_report.py report.json

report.json:
{
  "title": "Sprint 1 — Grill prototype",
  "status": "In progress",            # shown under the title
  "color": "#e0582c",                 # container accent
  "sections": [
    {"heading": "Done", "lines": ["S1-2 cooking rules — 35 tests ✅"]},
    {"heading": "Next", "lines": ["..."]}
  ],
  "progress": [3, 4],                 # optional: done / total tickets
  "footer": "commit 08f9e28",
  "links": [{"label": "Repo", "url": "https://github.com/..."}]
}

Reads DISCORD_WEBHOOK_URL from the environment or .env.local.
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IS_COMPONENTS_V2 = 1 << 15


def webhook_url():
    if os.environ.get("DISCORD_WEBHOOK_URL"):
        return os.environ["DISCORD_WEBHOOK_URL"]
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if line.startswith("DISCORD_WEBHOOK_URL="):
            return line.split("=", 1)[1].strip()
    sys.exit("DISCORD_WEBHOOK_URL not set")


def text(content):
    return {"type": 10, "content": content}


def separator(big=False):
    return {"type": 14, "divider": True, "spacing": 2 if big else 1}


def progress_bar(done, total, width=12):
    filled = round(width * done / total) if total else 0
    return "🟧" * filled + "⬛" * (width - filled) + f"  **{done}/{total}**"


def build(report):
    inner = [text(f"# {report['title']}\n-# {report.get('status', '')}")]
    if report.get("progress"):
        inner.append(text(progress_bar(*report["progress"])))
    for sec in report.get("sections", []):
        inner.append(separator())
        body = "\n".join(f"- {l}" for l in sec.get("lines", []))
        inner.append(text(f"### {sec['heading']}\n{body}"))
    if report.get("footer"):
        inner.append(separator(big=True))
        inner.append(text(f"-# {report['footer']}"))
    if report.get("links"):
        inner.append({"type": 1, "components": [
            {"type": 2, "style": 5, "label": l["label"], "url": l["url"]} for l in report["links"]
        ]})
    color = int(report.get("color", "#e0582c").lstrip("#"), 16)
    return {"flags": IS_COMPONENTS_V2, "components": [{"type": 17, "accent_color": color, "components": inner}]}


def main():
    report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    req = urllib.request.Request(
        webhook_url() + "?with_components=true&wait=true",
        data=json.dumps(build(report)).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "MalaRimThang-report/1.0"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            print("sent", json.loads(r.read())["id"])
    except urllib.error.HTTPError as e:
        sys.exit(f"Discord {e.code}: {e.read().decode()}")


if __name__ == "__main__":
    main()
