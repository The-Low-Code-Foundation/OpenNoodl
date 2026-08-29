# Phase 80 — next session

## State: DEF-001, 002, 003, 004, 006, 016, **017** closed. **DEF-007 is 🟡 partial.**

**s9 (2026-08-29)** took DEF-007 and drove its one flagged reading. Nothing in product source
changed — **this session is documentation only**, so every gate stands where s8 left it and none
was re-run. If you are picking up DEF-007, read **§2.1**, **§6** and **§6.1**; §3's item 3 is
struck through and §2's bullet list is superseded by §2.1.

| commit | what |
|---|---|
| `7655c7ea` | **DEF-007** — §2.1 the empty population, §6 the seam from disk, §6.1 AC3 measured at 56 |
| `fc4ebe45` | §2.1 widened to 340 manifests, and the modules qualification that changes the fix |
| `0ab7dc8d` | register: DEF-007 → 🟡 partial, and the ruling §2.1 raised |

---

## 🔴 The finding, in one paragraph

**The task asked for a fix whose population is empty, and the real gap was sitting next to it
unnamed.** §3.3 said to give `PlatformTemplateProvider` the `rootNodeId` resolution
`EmbeddedTemplateProvider` has. The mechanism reading was true — it does no resolution — but the
*consequence* does not follow: the editor's writer emits `rootNodeId` and **never** `rootComponent`,
so the name-shaped input that resolver exists for cannot reach the curated path, whose input is a
real project's files uploaded verbatim. Across **340** manifests on this machine, exactly **2**
carry `rootComponent` and both carry an id beside it — **the set carrying a name with no id is
empty**. What *is* missing is any check that a template has a home **at all**: no publish gate, no
install rescue, while `noodl-preview` already has the guess-and-warn the editor path lacks.

## What to do next

**DEF-007's §3.2** — the migration half, which is now the whole of the task. §1.1 already forced
its decision (a modern template must carry explicit `runOnChange-*` values, because the migration
will keep reversing an unstated intent on every load). §6.1 prices it: **56 decisions, not a flag.**
🔴 **Do not start by editing `site-builder.content.json` or its generator** — that artefact is
phase 77's active file, moved by SBR-017 today. Sequence after their work lands, or pick a
different artefact.

Also open: **DEF-008**, **DEF-009**, **DEF-014**, **DEF-015**, and the four carried from phase 76
by reference (**DEF-010/011/012/013** — three say their fix needs a corpus sweep, and that sweep is
shared work to be done **once**). **DEF-005** is 🔒 on a Richard ruling.

🔴 **The standing instruction still pays — six sessions running.** *Find the claim in your task
that is a reading rather than a measurement, and drive that one first.* s4 deleted two of three
rows, s5 found a defect the file did not contain, s6 found the defect had been fixed the day
before, s7 found the rule was wrong about two of eleven cases, s8 found the recommended fix ships
an accessibility defect, **s9 found a scope item with no population behind it**.

## 🔴 What this session paid for, that the next one should not re-buy

- 🔴 **"Does no X" is a fact about a mechanism; "therefore X is broken" needs the input shape.**
  Both providers were graded against the same checklist and only one of them *takes the input the
  checklist is about*. `EmbeddedTemplateProvider` resolves a name because its input is a
  hand-authored TS object (`hello-world.template.ts:40`, `rootComponent: 'App'`);
  `PlatformTemplateProvider` receives a saved project's bytes. ✅ **Before porting a fix between two
  implementations of an interface, read what each one is handed** — the asymmetry was deliberate
  and the file never said so.
- ✅ **The absence was measured, not assumed, because the counter demonstrably fired.** It found
  the 2 projects carrying `rootComponent`; that is the known-firing signal beside the zero. A count
  of "0 with a name and no id" from a detector that had found nothing at all would have been worth
  nothing.
- 🔴 **Widening a denominator can strengthen one claim and correct another in the same pass.**
  97 → 340 left the `rootComponent` claim intact but exposed that **63 have no home and most are
  modules and prefabs, which have no home by design.** That single fact changes the fix: a
  publish-time check keyed on `rootNodeId` would refuse every module. ✅ **The narrow denominator
  was the right one for "how many broken projects" and the wide one for "does this shape exist" —
  they are different questions and one number cannot serve both.**
- ✅ **The whole seam is one call.** `applyPatches(content)` immediately before
  `ProjectModel.fromJSON(content)`, and `fromJSON` does not apply patches itself. Two paths apply
  it (editor open `projectmodel.editor.ts:24`, VC snapshot `snapshotProject.ts:112`); headless
  render, code export, MCP authoring and template generation do not. ⚠️ **Three `fromJSON` call
  sites inherit rather than decide** (`compilation.ts:83`, `exportProjectComponents.ts:88` operate
  on an already-loaded project; `projectmodel.ts:218` `fromLocalStorage` has no pass at all) —
  counting them as "does not apply" would have made the seam look wider than it is.
- ✅ **`planRunOnValueChangeMigration` imports nothing**, so the disk-vs-load pair can be measured
  over any artefact with `ts-node --transpile-only` and no editor. That is how §6.1 got a number in
  minutes. Anchor it to an **md5**, not a path — the artefact moves.

## Traps carried

- ⚠️ **Doc-only session: no gate was run and none needed to be.** s8's readings stand and are the
  ones to quote — `test:ci` **2889 specs / 4 failures**, all four `AIX-006 style vocabulary` by
  name, seed 74947. 🔴 **Do not quote that as evidence about anything committed today**; it
  predates these commits and measures nothing in them. Re-run before any source change lands.
- 🔴 **`catalog:examples` is still a PR gate (`pr.yml:210`) and still RED**, 60/62,
  `comp-repeater-set-item-object` and `fn-aggregate-stats-function`, owner **`NONE`**, ~20 minutes,
  both diagnostics carry their own `suggestion`. **It fails every PR until somebody takes it.**
  Unchanged and unmeasured this session — no source moved.
- ⚠️ **`typecheck:mcp` red on one peer error** (`TOKEN_PRELUDE` in `noodl-mcp/tests/tpl001Cloud.ts`)
  and **2 failures in `tpl001Template.test.ts`** from a peer's uncommitted
  `templates/members-area.security.json`. **Neither is phase 80's.** As recorded by s8; not
  re-measured.
- ⚠️ **`site-builder.content.json` is phase 77's, and it moved today** (mtime 12:44, commit
  `cdd842fc`). §6.1's 56 is anchored to md5 `56e03abf8bb583cec6b038f5e12ed11e`. The **port names**
  in D11 have already drifted since it was filed — the phenomenon persists, the specific ports do
  not. Re-run the planner before quoting the breakdown.
- ✅ **The checkout was idle**: no editor, no suite. The Electron processes matching
  `electron/dist` were all **MCP servers** — attribute by PPID, not by name. The modified
  `noodl-core-ui` SCSS and phase-75 docs in `git status` are a **peer's border sweep**, untouched
  here.
