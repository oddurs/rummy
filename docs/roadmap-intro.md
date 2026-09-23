<!-- Spliced above the generated roadmap by `cairn render`. Edit this file, not ROADMAP.md. -->

**The goal:** the best-looking ASCII renderer on the web, the one that makes people
open devtools to find out what it is, at a cost small enough that nobody has to think
twice about putting it behind a headline.

### What "stunning" has to mean

A goal like that needs a bar someone can check. Every release is judged against these:

- **Every still is a poster.** Each built-in scene, in every look, makes a screenshot
  worth sharing. The [contact sheet](https://oddurs.github.io/rummy/shots.html) is how
  we check.
- **Motion reads as motion.** No shimmer, no crawling edges, nothing that looks like
  noise at a hero's slow pace.
- **It costs next to nothing.** Under 2 ms of GPU time per frame at 1080p on a
  laptop, measured with timer queries rather than estimated.
- **It is small.** One ES module, no dependencies, with a size gate in CI.
- **It drops in anywhere.** One tag on any site, and it never breaks a page on
  hardware it can't run on.
- **It is kind.** Reduced motion, off-screen pausing, readable copy on top.

### The pillars

Each item's `pillar` field says which part of that it serves:

| pillar | what it covers |
|---|---|
| look | image quality and art direction: glyph choice, tone, colour, glow |
| motion | stability, transitions, scroll and pointer, intros |
| content | anyone's content: their logo, their three.js scene, new scenes |
| speed | GPU time, bundle size, graceful degradation |
| reach | npm, CDN, web component, frameworks, fallbacks, accessibility |
| craft | the tools that make the rest possible: screenshots, benchmarks, CI |
| launch | a frozen API, docs, playground, gallery, the launch itself |

### Working on it

The roadmap lives in `cairn/items/` as Markdown, one file per item, managed with
[cairn](https://github.com/oddurs/cairn). `cairn next` shows what can be started now;
`cairn board` shows everything by status. Visual work moves through `review` before
`shipped`: someone has to look at the before/after and agree it's better.
