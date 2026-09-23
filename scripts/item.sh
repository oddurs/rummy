#!/usr/bin/env bash
# Start work on a cairn item: a fresh branch from origin/main, named after the
# item, and the item claimed on it (so the status change ships with the work).
#
#   pnpm item 18        → branch 0018-stop-glyph-boil-with-temporal-hysteresis
set -euo pipefail
id="${1:?usage: pnpm item <id>}"

slug=$(cairn show "$id" --json | node -e '
  let s = "";
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const { id, title } = JSON.parse(s);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48).replace(/-$/, "");
    console.log(`${String(id).padStart(4, "0")}-${slug}`);
  });')

git fetch -q origin main
git switch -c "$slug" origin/main
cairn claim "$id"
