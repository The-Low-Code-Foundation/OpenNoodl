# Phase 80 — next session

## State: DEF-001–004, 006, 008, **010, 011**, 014–017 closed. DEF-007 🟡 (§3.2). **DEF-009 🟡 (AC4 only)**.

**s14 (2026-08-29/30)** closed the door family as one piece of work: **DEF-010** (`44298914`),
**DEF-011** (`e6f26ffa`), and DEF-009's ACs 1–3 in the same first commit. The shared corpus
sweep the three tasks each demanded ran **once** — `npm run calibrate:door`
(`scripts/phase80-door-corpus.ts`), 178 projects across both project corpora
(`vscode_projects/NodeGX test projects` + `vscode_projects/Noodl projects`).

## What landed

- **DEF-010**: `checkComponentRefParameters` in the shared precondition set — generic over the
  catalog's `component`-typed ports; skips (`For Each`, `template`) whose owner is
  `checkRepeaterTemplate` (cardinality asserted through the FULL composed set); unresolved →
  `component-parameter-unresolved`, **promoted to blocking** on the sweep (614 parameters, 15
  hits in 6 projects, all legacy hand-authored, sampled true — LearnBook's hit verified against
  its real component list); cross-runtime → reuses `wrong-runtime-node`. SB-009 AC1's arms C/D
  inverted and pinned in `sb004RunTasksTemplate.test.ts`.
- **DEF-011**: `withAuthoredScriptPorts` (`noodl-mcp/src/scriptPorts.ts`) merges
  `scriptPortsForNode`'s derivation into Function nodes' authored `ports` at BOTH assembly seams
  (`assembleCreateFiles`/`assembleSetFiles` — all three doors). Dedupe by `(plug, name)`
  everywhere the producers meet. Bracket-form `Inputs["x"]` ports deliberately not written.
- **DEF-009**: `checkPublicWriteDoor` — public posture (graph `allowNoAuth` + configured `call`),
  record-mutating node, no `rateLimit` → `public-write-door-unlimited` (warning, never blocking).
  `security` **undefined = do-not-check ≠ null = no-policy-file**. Threaded via
  `preconditionDiagnostics(store, …)`; `def009PublicWriteDoorDrive.test.ts` grades the threading.
  Corpus: 110 public doors, 27 unlimited write doors in 23 projects — all `submitContactForm`.
  Template now sets `10/min, burst 10` on it.

## What to do next

- **DEF-012** (read SB-011 in phase 76) — a query that widens when it cannot narrow.
- **DEF-018–DEF-025** (read phase 78's register `DEFECTS-THE-TEMPLATES-FOUND.md`, not the
  TASKS.md table), **DEF-026**.
- **DEF-007 §3.2** — 56 decisions, still sequenced behind phase 77's active file. ⚠️ s14
  regenerated `site-builder.content.json` (derived ports) — **the md5 DEF-007 §6.1 anchors to
  has moved again**; the 56-parameter reading is anchored to the OLD md5, re-derive with
  `planRunOnValueChangeMigration` (imports nothing) before acting on it.
- **DEF-005, DEF-013** — 🔒 Richard rulings. 🔴 **Before spending the DEF-013 ruling, re-drive
  SB-012 §1's table at HEAD**: its middle rows ("targets checked only against disk") were
  measured 08-26, and the plan door's `components` list has since been rebuilt from
  `authoredProjectViews`, which overlays unapplied plan operations — the two-pages-that-link
  plan may now stage clean, which would shrink the ruling to the `create_component` half.
- **DEF-009 AC4** — 🧭 Richard: should a public function's `rateLimit` default to something
  rather than `null`? Registered in TASKS.md rulings. Whatever is ruled, write the reason into
  DEF-009's file.

🔴 **The standing instruction has now paid eleven sessions.** *Find the claim in your task that
is a reading rather than a measurement, and drive that one first.* s14's instance: SB-010's cost
claim ("every authored cloud component 504s for 30s") had been **half-healed since it was
written** — SBR-017's `withScriptPorts` export backstop already re-derives at deploy; the honest
standing cost was every consumer of `nodes.json` that does not re-derive. The fix was re-scoped
before it was built. **Check the tense.**

## What s14 paid for, that the next session should not re-buy

- 🔴 **A new door check re-grades every GENERATOR that authors through the door.** Both template
  parity gates went red (committed templates carried `ports: []` pre-DEF-011) — the remedy is the
  one the gates name: `npm run template:site-builder` / `template:members`, commit the result.
  And the members generator validated its components in a temp project WITHOUT its policy file,
  logging 3 limited doors as unlimited — `buildMembersTemplateProject` now seeds
  `templates/members-area.security.json` into the temp dir BEFORE authoring.
- 🔴 **A spec can pin a workaround state literally**: sb-018 asserted the contact node's `ports`
  as exactly the one hand-declared signal. Restated as its meaning (signal exactly once,
  `received` a value), not bumped.
- ✅ **`preconditionDiagnostics` now takes the store first** — six call sites (validate.ts ×3,
  planTools ×2, cn004 ×3 in tests). A new precondition option follows the undefined=skip
  convention; DEF-009's is the one where undefined and null must stay distinct.
- ✅ **tests-unit is jest and NOT in `test:ci`'s 2905** — the floor did not move when 21 specs
  were added there. `test:ci` counts `packages/noodl-editor/tests/` (electron) only.
- ⚠️ **`packages/noodl-mcp/dist` is stale AND now behind on behavior** — a running MCP server
  answers without DEF-009/010/011. Owner: whoever cuts the next 0.2.1 build.

## Gates (s14, all fresh)

`test:ci` **2905 specs / 4 failures, all `AIX-006 style vocabulary` BY NAME, seed 77684**, fresh
readout, HEAD `a94caa41` (pre-commit checkout — `gitHead` is read-time, never authorship) ·
noodl-mcp **966/966 (71 suites)** · editor jest **6398/6398** · `test:main` green ·
`typecheck:editor` + `typecheck:mcp` clean.

## Traps carried

- 🔴 **The phase-77 register (`DEFECTS-THE-SITE-BUILDER-FOUND.md`) is UNCOMMITTED and shared**
  (s13's D6 update + a peer's D21 row). Whoever commits next takes both; `git log -5 -- <path>`
  first, never rewrite wholesale.
- 🔴 **Peer uncommitted edits in the tree**: 5 `.scss` files (core-ui + AskAboutNodeDialog),
  dev-docs for phases 50/68/72/75, `border-sweep` test. Not mine, not committed by s14.
- ⚠️ **MEMORY.md is ~26.9KB against a 24.4KB read limit — the tail is invisible.** s14's line is
  net-shorter than it started; the remaining fat is peer lines whose staleness only their owners
  can judge. If your section sits near the end, file it and shorten in place.

## Findings this phase carries with owner `NONE`

Unchanged from s13 (rows in `TASKS.md`): `publishPage` refuses after publishing · auto-created
classes get no declared columns · no `--destructive-text` token (🧭 plausibly Richard's) ·
helper-step told to deploy · shared-backend deploy kills the process · nested cloud function
404s · stale function rendered twice · the card's push-only refresh.
