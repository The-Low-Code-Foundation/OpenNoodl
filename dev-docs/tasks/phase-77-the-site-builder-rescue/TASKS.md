# Phase 77 — task board

Task table lives in [README.md](README.md) §5 with the dependency order. This file carries
per-task status and the session log.

## Status

| id | status | note |
|---|---|---|
| SBR-001 | ⬜ open | |
| SBR-002 | ⬜ open | |
| SBR-003 | ⬜ open | contract settled at scoping (s1) — the task is to *implement and verify* it |
| SBR-004 | ⬜ open | |
| SBR-005 | ⬜ open | |
| SBR-006 | ⬜ open | |
| SBR-007 | ⬜ open | deployed-save half blocked on SBR-008 |
| SBR-008 | ⬜ open | ruling taken: §11.4 option 1 (derive in runtime) |
| SBR-009 | ⬜ open | |
| SBR-010 | ⬜ open | |
| SBR-011 | ⬜ open | ruled BUILD, not strike |
| SBR-012 | ⬜ open | |
| SBR-013 | ⬜ open | |
| SBR-014 | ⬜ open | last; re-verifies every person-sentence AC |

## Standing gates and traps (carried from phase 76 — still live)

- **Floor: `test:ci` — 2863 specs, 4 failures**, all four `AIX-006 style vocabulary` **by
  name**. A build failure has no summary line: *not measured*, not red.
- 🔴 The template artefact and the component sets are **two populations** — edit a set ⇒
  regenerate (`npm run template:site-builder`) or `sb007Template.test.ts` reddens.
  `site-builder.security.json` is hand-edited, NOT generated. Node count moves
  `sb-007/site-template.test.ts` id count (194) and the backend helper's connection total (101).
- 🔴 The door remaps node ids (`save` ships as `save-3`) — assert template wires by node
  **label**, never id.
- 🔴 `setDynamicPorts` REPLACES a node's dynamic port list — two writers erase each other.
- 🔴 A parameter is not a connection — the export filters wires, copies parameters verbatim.
- 🔴 `sb017-deploy-connection-parity.test.ts` asserts its shortfall equals a named
  `REMOVED_BY_SB018` list — an exemption, not a relaxation. SBR-008 retires it deliberately or
  updates it deliberately; never lets it drift.
- 🔴 A poisoned jest transform cache = red specs with EMPTY failure messages; prefer artefact
  and test mutants over source mutants; `npx jest --clearCache`.
- Driving: modal renders twice (stamp the non-Measuring copy, click twice), `elementFromPoint`
  before every click, IIFE around every `cdp eval`, launcher watchdog can reap the stack —
  `npm run cdp -- health` before trusting it.
- Shared checkout: commit by pathspec (untracked ⇒ add+commit one chain), never stage-then-commit;
  announce editor launches AND teardowns; `test:ci` alone.

## Session log

- **s1 (2026-08-28)** — **Phase scoped.** Both artifacts read and challenged; the challenge
  found the platform already ships the token system the proposal wanted to invent (182 defaults,
  project overrides deployed as `:root` in index.html, `RawColorLiteral` warning) — recorded in
  README §3. Richard ruled: Studio default, Messages in scope, deploy fix = derive-in-runtime,
  **live preview BUILT not struck**, no short paths ("blow people's minds"). Wizard seam mapped
  (Explore): insertion points, the `useSwitchToDefaultComponent` trap (a previous restore
  attempt was deleted after driving — the default switcher runs unconditionally and wins; its
  spec passed on source text), `ensureLessonBackend` as the attach recipe, `TemplateItem` as the
  five-string bottleneck. Fourteen task docs written.
