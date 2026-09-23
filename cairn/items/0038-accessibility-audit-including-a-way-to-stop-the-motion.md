---
id: 38
title: Accessibility audit, including a way to stop the motion
type: chore
status: idea
milestone: v0.5
created: 2026-09-22
updated: 2026-09-22
priority: p1
pillar: reach
area: api
effort: s
---

Background motion has real accessibility rules, and "respects
prefers-reduced-motion" does not cover all of them.

- **WCAG 2.2.2 (Pause, Stop, Hide)**: moving content that starts automatically
  and lasts over five seconds needs a way to pause it. Ship an optional
  accessible pause control (`controls: true`), and document that sites must
  provide one if they don't use it.
- Canvas is `aria-hidden` by default and has no focusable content.
- Flicker (CRT, intros, glitch transitions) stays well under three flashes per
  second (WCAG 2.3.1).
- Verify reduced motion freezes *everything* (intros, trails, transitions,
  pointer effects), not just time.
- Document the recommended pattern for a text alternative when the scene
  carries meaning.

## Acceptance criteria

- [ ] Checklist above verified and written up in the docs
- [ ] Optional pause control is keyboard- and screen-reader-operable
- [ ] Reduced-motion test in the screenshot harness
