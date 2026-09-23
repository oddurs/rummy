# Working on rummy

Library in `src/`, demo site in `demo/`, tooling in `scripts/`. Before calling visual
work done, run `pnpm shots` and look at the sheets in `shots/current/`; for anything
touching per-frame cost, run `pnpm bench`. `pnpm check` must pass.


<!-- cairn:begin -->
## Roadmap and issues

This project tracks its roadmap and issues with `cairn`. Every item is a Markdown file under `cairn/items`, described by the schema in `cairn.toml`.

**Do not create ad-hoc TODO, PLAN or NOTES files.** Create a cairn item instead, so the work appears on the board and in the generated roadmap.

### The loop

1. `cairn next` — what is ready to start. It excludes anything blocked by unfinished dependencies and puts work already in progress first.
2. `cairn claim <ID>` — take it before you start, so no one duplicates the work. `cairn claim --next` picks and claims the top-ranked unclaimed item in one step, and prints its body so you can begin immediately.
3. Do the work. Record what you learn: `cairn set <ID> <field>=<value>` for fields, `cairn note <ID> "<TEXT>"` for anything that needs a sentence — why you chose something, what you tried, what to watch for.
4. `cairn tick <ID> <N>` as each acceptance criterion becomes true — `cairn show <ID> --criteria` lists them numbered. Tick what is true, not what would let you close.
5. `cairn close <ID>` when it is done, or `cairn release <ID>` to hand it back.
6. `cairn check` before you report finished. It must pass.

### Commands

```sh
cairn next --json                 # ready work, ranked
cairn claim --next                # take the next ready item
cairn search <TEXT> --json        # titles, bodies and labels
cairn list --json                 # all open items
cairn list --filter 'blocked=false,priority=p0'
cairn show <ID> --json            # one item, including its body
cairn new "<TITLE>" --type <TYPE> --milestone <MILESTONE>
cairn set <ID> status=<STATUS>    # also labels+=x, or any field below
cairn note <ID> "<TEXT>"          # append reasoning; never replaces
cairn show <ID> --criteria        # acceptance criteria, numbered
cairn tick <ID> <N>               # tick one; --all for every one
cairn close <ID>
cairn check                       # validate; run before finishing
cairn render                      # regenerate ROADMAP.md
```

### Schema

- **Types**: `feature`, `look`, `scene`, `perf`, `spike`, `bug`, `docs`, `chore`, `milestone`
- **Statuses**: `idea` (open), `planned` (open), `exploring` (active), `building` (active), `review` (active), `blocked` (active), `shipped` (done), `dropped` (dropped)
- **`priority`**: one of p0, p1, p2, p3 — p0 blocks its milestone
- **`pillar`**: one of look, motion, content, speed, reach, craft, launch — which part of 'stunning' this serves; see the roadmap intro
- **`area`**: one of engine, atlas, scenes, api, adapters, demo, docs, infra — where in the code it lands
- **`effort`**: one of s, m, l, xl — rough size, not an estimate
- **`budget`**: free text — the most it may cost, e.g. '<=0.3 ms GPU at 1080p' or '+1 KB gz'
- **`breaking`**: true or false — changes the public API; goes in the release notes
- **`due`**: date, YYYY-MM-DD — when a milestone is meant to land
- **`part_of`**: names any items, by id, several allowed — a larger piece of work this belongs to
- **Milestones**: `v0.2` (due 2026-10-20), `later`, `v0.3` (due 2026-11-17), `v0.4` (due 2026-12-15), `v0.5` (due 2027-01-12), `v1.0` (due 2027-02-09)
- **Saved views** (`cairn list --view NAME`): `now`, `next`, `review`, `looks`, `speed`, `breaking`, `triage`

### Rules

1. Before starting work, find or create the item and set it to an active status.
2. Use the fields above rather than inventing new ones; add new fields to `cairn.toml` first.
3. Never hand-edit the generated roadmap file — change items and run `cairn render`.
4. `cairn check` must pass before the work is considered done.

<!-- cairn:end -->
