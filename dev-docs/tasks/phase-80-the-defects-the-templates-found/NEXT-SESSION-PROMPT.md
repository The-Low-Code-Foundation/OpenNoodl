# Phase 80 — next session

## State: DEF-001, 002, 003, 004, 006, **008**, 014, 015, 016, 017 closed. DEF-007 is 🟡 partial.

**s13 (2026-08-29)** closed **DEF-008** and took **`catalog:examples`** off the unowned list
(60/62 → **62/62 green**). Repo edits: the two example JSONs + the regenerated enriched catalog +
doc write-backs. **No editor/runtime source moved, so `test:ci` is not owed** — the floor stands at
s11's 2905/4, AIX-006 by name.

## What to do next

- **DEF-009** — the next open task. Its scope 1 is a door rule in the same family as DEF-002, and
  🔴 **DEF-010/011/013 are the same door** (`noodl-mcp/src/validate.ts` + editor `validation/`).
  **Sequence all four as one piece of work and assert cardinality where they meet**; three of them
  share one corpus sweep — do it once. DEF-009's default question is 🧭 Richard's; the diagnostic
  is not.
- **DEF-012**, **DEF-018–DEF-025** (read phase 78's register, not the TASKS.md table), **DEF-026**.
- **DEF-007 §3.2** — 56 decisions, still sequenced behind phase 77's active file.
- **DEF-005**, **DEF-013** — 🔒 on Richard rulings.

🔴 **The standing instruction has now paid ten sessions running.** *Find the claim in your task
that is a reading rather than a measurement, and drive that one first.* s13's instance: DEF-008's
§1 listed two candidate causes for D6, **both fitted and neither survived the drive** — the symptom
itself did not reproduce, and the mechanism that does produce it (a parameter on a component
instance) was in neither candidate.

## What s13 paid for, that the next session should not re-buy

- ✅ **P77 D6 is closed: `maxWidth` on `Text` works.** Driven headlessly (`withRenderedPage`, no
  editor): bare `240` → `240%` (DEF-003(a)'s coercion, `unitless-dimension` fires — driven);
  `{value:240,unit:'px'}` → `240px`; D6's exact shape (`contentSize` + `{100,'%'}`) → `100%`;
  inside a For Each-instantiated component → `240px`. 🔴 **The one measured route to `none`:
  the parameter authored on a component INSTANCE** — dropped silently at runtime, blocked at the
  door by `interfaceless-instance` (driven). Full table in DEF-008 §4; phase 77's register updated.
- ✅ **DEF-001 AC1's owed inch is paid**: a Button carrying ButtonConfig's stamps painted
  `#2563eb`/white at **5.17:1** in a real render, `--primary` verified at `:root` in the same frame.
- ✅ **`Model2`/`SetModelProperties` property ports are `prop-<field>` (value) and
  `changed-<field>` (signal)** — a wire naming the bare property resolves to the signal, which is
  the `signal-into-value-port` defect. Two shipped recipes taught it; both fixed.
- ✅ **The demo-app MCP fixture's Router has NO `pages` parameter** (the door writes it on
  `create_component`) — a hand-edited fixture renders a blank page with `router/no-pages` in the
  console until you add `pages: {startPage, routes}` to the Router node yourself.
- ✅ **The headless drive recipe**: `withRenderedPage` from `scripts/devtools/render-report.js` over
  a `demo-app` copy; probe elements by `cssClassName` → `[class*=probe-]`; read computed style +
  offsetWidth in one eval; absence beside a known-firing Group. Script:
  `def008-maxwidth-drive.js` in this session's scratchpad
  (`/private/tmp/claude-501/…/1c3384be-…/scratchpad/`).
- 🔴 **`rg -rln` is a live trap, hit again this session**: `-r` is REPLACE — `-rln` becomes
  `-r ln` and every displayed line is fabricated. The files listed are real; the line content is
  not. Use `rg -l -n` spelled out.

## Traps carried

- 🔴 **The phase-77 register (`DEFECTS-THE-SITE-BUILDER-FOUND.md`) is UNCOMMITTED and shared**: it
  holds s13's D6 update **and a peer's new D21 row** (deployed-site CORS login fix, P77 s25) in the
  same working-tree file. **Deliberately not committed by pathspec** — that would sweep the peer's
  edit. Whoever commits next takes both; do not rewrite it wholesale (`git log -5 -- <path>` first).
- 🔴 **`test:ci` floor: 2905 specs, 4 failures, AIX-006 by name** (s11's reading; s12/s13 edited no
  graded source). Re-measure with a fresh seed only when editor/runtime source moves.
- ⚠️ **`typecheck:mcp` red on one peer error** and 2 `tpl001Template.test.ts` failures from a
  peer's uncommitted fixture, as recorded by s8. Not re-measured since.
- ⚠️ **`packages/noodl-mcp/dist` is stale** — a running MCP server answers from the old bundle.
  Owner: whoever cuts the next 0.2.1 build.
- 🔴 **The editor is single-instance on this checkout**; dry-run
  `node -e "require('./scripts/devtools/dev-processes.js').sweep({dryRun:true, onLog:console.log})"`
  before any launch — it names every process a launch would reap (s13's dry-run was empty).
- ⚠️ **A pathspec commit errors on an untracked file** — `git add` new files first.

## Findings this phase carries with owner `NONE`

Rows 1–6 and 8 unchanged from s12 (in `TASKS.md`): `publishPage` refuses after publishing ·
auto-created classes get no declared columns · no `--destructive-text` token (🧭 plausibly
Richard's) · helper-step told to deploy · shared-backend deploy kills the process · nested cloud
function 404s · stale function rendered twice. **Row 7 (the card's push-only refresh) unchanged.**
**`catalog:examples` is no longer on this list — fixed s13.**
