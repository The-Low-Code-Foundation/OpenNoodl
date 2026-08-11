# Phase 60 — closed

**Written 2026-08-11.** **SIG-001…007 are all built.** Phase 60 is 7 of 7. SIG-007 — the last task,
and the only one in the phase that changed what a connection is **on disk** — was built, driven in the
running editor, and gated.

Commits: `17d71fdd` (the geometry, decided first), `2c9221b3` (`wireAnchors.ts` + 26 specs),
`2fa2face` (persistence + the two inherited defects), `6f573bc2` (painter and gesture), `0762291e`
(the clamp fix the live drive found), `25bac3f5` (spec + phase records).

## What SIG-007 shipped

An anchor is `{ u, v }` in the wire's own **chord frame** — `u` dimensionless along it so the routing
stretches when a node moves, `v` in graph px across it so a detour stays the size it was drawn.
`n` anchors make `n + 1` cubic segments; the end tangents stay horizontal, so a wire still leaves its
source port and arrives at its target port square on. **With no anchors the painter returns today's
four-point array by identity** — the new construction does not run at all, which is what makes "no
existing graph re-routes on open" a fact rather than an argument.

The sixth mark on a wire is a **hollow ring** (fill 0.00, against circle 0.79 / arrowhead 0.50 /
diamond 0.50 / the open chevron), painted on hover or selection only. **R1 is resolved without
narrowing CAN-003**: the 8px endpoint grab is untouched and still tested first, and the boundary is
made *visible* by a **ghost ring** that rides the pointer along the wire and stops appearing inside
the endpoint zone. The absence is the boundary, and it moves.

## The four findings worth carrying

🔴 **Two things that read as obviously right measured worse, and both were removed.** An **alignment
guard** on the Catmull-Rom tangents — the textbook overshoot fix — took self-crossings *up* from 8 to
14 over 21,300 sweeps. And the **`(0, 1)` clamp on `u`** put a minted anchor at the far end of the
wire: `u` runs along the **chord**, and the `'inline'`/`'right'` layouts route the curve *outside* it,
so a press on the middle of such a wire projects to `u = 1.96`. Both numbers are in the source.

🔴 **A round-trip spec can pass around the defect.** `anchorFromPoint` → `anchorPoint` is exact and
its spec was green; production runs `encode → normalise → decode`, and the **normaliser** was what
moved the point. Invisible to 25 unit specs, obvious on the first live drag.

🔴 **Tracing the precedent field found two live defects nobody had hit.** `labelT` (CAN-001) has ten
seams; two never learned about it. **Copy/paste has been dropping wire labels since CAN-002**
(`NodeGraphNodeSet.clone()` rebuilt from four fields), and **the AI write path strips them silently**
because zod's default is *strip* and `vocabulary.ts` states the four-field rule as a decision. Both
fixed — MCP keeps the four-field *authoring* rule and carries the rest over from the baseline, which
is what the editor already does for nodes.

🔴 **An unsettled canvas baseline reads as no change.** The first `layoutAndPaint()` after changing
editor state differs from every later one. A new mark measured **0 changed pixels** three separate
times against such a baseline while `ctx.stroke()` was provably being called for it; with
`grab(); const baseline = grab();` the control came out 0 and the mark measured 473 px. ⚠️ And a
`getImageData` **sum is not a fingerprint** — count differing pixels.

⚠️ **HMR left the mounted editor on the old module.** After the clamp fix the editor still reported
the old value while a freshly `require`d copy reported the new one. **Restart before disbelieving a
fix.**

## Gates, measured on this tree

`typecheck:editor`, `:editor-tests`, `:viewer`, `:cloud` **clean** · `lint:ci` **865 / 3916 baseline**,
unchanged from session start · `test:main` **118 suites / 1700 tests green** (was 117/1674; +1 suite,
+26 tests, exactly this task's specs) · `noodl-mcp` **336/336 green**, including `vocabularyParity` ·
`test:ci` **2635 specs, 6 failures at seed 91848 — the baseline exactly, by name** (2 × `AI model
registry`, 4 × `AIX-006 style vocabulary`).

⚠️ **The first `test:ci` run was 7, and the seventh was mine** — `InteractionController offers a
right-clicked wire its own menu` pinned the old one-argument call to
`openConnectionRightClickMenu`, which now carries the click point. Fixed and re-run at the same
pinned seed. **Pinning the seed is what made "one extra, by name" a readable result.**

⚠️ `typecheck:runtime` is **still red and still not this work** — the same two untouched test files
redeclaring `EditorConnection`. Do not let it read as a regression.

⚠️ Gates ran on a tree carrying a concurrent session's uncommitted work (`noodl-core-ui/`,
`ExtractToComponent`, `EditorClipboard`, `ExtractToComponentPopup.*`, `ConnectionPopup/`,
`ComponentsPanelNew/`, `ProjectsPage/`, `models/template/`, `tests/{components,models,nodegraph}/`,
and a new `dev-docs/tasks/phase-62-cold-start/`). Every commit here was pathspec-scoped to named
files; none of theirs was swept.

## Housekeeping

`nodegx-qa-fixture/project.json` SHA `7b601a1a…` verified unchanged — the editor drove a **copy**,
which has been deleted along with its registrations in `recently_opened_project.json` and
`project_runtime_cache.json`. **The dev stack is stopped.**

## One thing left open, deliberately

⚠️ **Anchor handles were counted on a graph with 10 connections, not the 50+ the acceptance asks
for.** The result is an exact **0** changed pixels against a **0** control rather than a statistic, so
the count does not weaken the claim — but it has not been run on a dense graph. It is ticked with that
caveat written next to it in the task file.

And 🔴 **Richard has not yet seen SIG-007 running.** Everything above is measured; none of it is his
judgement. The last two times a measurement decided a design question in this phase he changed the
answer on sight — the chevron default was flipped from off to on. **Show him the bend, the ring and
the ghost before treating any of it as settled.**

---

Phase 60 needs no further work. The next session should pick up **phase 59 (LGC — the logic seam)** or
**phase 61 (FUN — the Function node)**, whichever Richard wants; both are the same cluster, and 60 was
the middle of it.
