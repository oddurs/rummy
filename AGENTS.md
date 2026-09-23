# Working on rummy

Library in `src/`, demo and test harness in `demo/`, website in `web/` (SvelteKit),
tooling in `scripts/`. The roadmap is in `cairn/items/` (see below).

## The loop

Every change goes through a branch and a pull request. Nothing is committed to `main`.

1. **Start:** `pnpm item <id>` fetches `origin/main`, creates a branch named after the
   cairn item, and claims the item on it. For work with no item, use
   `git switch -c <slug> origin/main`, or file one with `cairn new` first.
2. **Work, checking as you go.**
   - `pnpm check` (~1.5 s): typecheck, library build, size gate, demo build.
   - Visual change: `pnpm shots` and read `shots/current/sheet-*.png`. To see what
     you changed, save a baseline on `main` first (`pnpm shots --save-baseline`);
     later runs diff against it automatically.
   - Per-frame cost: `pnpm bench` (real GPU, headless).
   - Website: `pnpm web` serves it on http://localhost:4499 with hot reload, including
     edits to the library in `src/`. `pnpm web:check` runs svelte-check (warnings
     fail). `pnpm web:build && pnpm web:start` runs the production Node server on 4499.
3. **Record it on the item:** `cairn tick`, `cairn note` with the evidence (numbers,
   shot names), then `cairn set <id> status=review` for anything judged by eye, or
   `status=shipped` when every criterion is verified. The item change ships in the same
   PR as the code.
4. **Ship:** commit, then `pnpm pr`. It runs the checks, pushes, opens the PR from your
   commit messages, and queues it to merge once CI is green. Add `--no-merge` when a
   person should look first.
5. **CI:** `check`, `web` (svelte-check and build), `roadmap` (cairn valid,
   `ROADMAP.md` current) and `shots` (contact sheet; the base-vs-head diff lands in the
   job summary). All are required to merge.

Rules:
- One item per branch.
- Never force-push, and never push to `main`.
- Evidence goes in item notes, not only in chat.
- Commit messages carry no AI attribution trailers.

Parallel agents: each worktree gets its own branch. `dist/`, `site/` and `shots/` are
per-worktree build output and are safe to regenerate.

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
