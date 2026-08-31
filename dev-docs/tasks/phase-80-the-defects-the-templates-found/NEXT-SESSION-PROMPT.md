# Phase 80 — next session

**Two rows left. Both are ruled, neither is blocked, and neither needs Richard.**
Session 37 closed DEF-037 and DEF-033 and took DEF-007's AC4.

Read [RICHARD-RULINGS-2026-08-31.md](RICHARD-RULINGS-2026-08-31.md) first — the *why* is what stops
you re-arguing rulings that went against the recommendation.

---

## The board

**37 rows. 35 ✅ · DEF-007 🟡 · DEF-036 ⬜.**

🔴 **Derive it from the STATUS COLUMN, never `grep -av '✅'`** (a ✅ in prose filters the row out):

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | awk -F'|' '{gsub(/^ +| +$/,"",$2); print $2" :: "$3}'
```

🔴 **Re-derive any "owed" list from the ROW FILES, never from this handoff.** s36 found a carried
"4 BUILT+UNDRIVEN" list was three-fifths wrong and relayed it once more before checking.

---

## What session 37 did

- ✅ **DEF-037 CLOSED — built, driven, gated.** `e1ea7f09` + `6387cc8e`. §8 of the row file has the
  full record.
- ✅ **DEF-007 AC4 CLOSED.** The seam table is now
  [`projectLoadSeam.ts`](../../../packages/noodl-editor/src/editor/src/models/ProjectPatches/projectLoadSeam.ts)
  beside `applyPatches`, **plus the test that fails when an unregistered `ProjectModel.fromJSON`
  call site appears** — mutant-proved.
- ✅ **DEF-033 handed to P18** with two riders the ruling did not name (below).

---

## The plan — two jobs, in this order

### Job 1 — DEF-007's two remaining items (editor package, ONE gate cycle)

Both ruled 2026-08-31, neither built. **They do not substitute for each other**: publish catches a
project that never had a home, deletion catches one that had a home and lost it.

1. **Refuse at publish.** A project with no home page must not publish as a template.
   - ⚠️ `shareAsTemplate.ts` and `shareTemplateForm.ts` contain **zero** references to `rootNodeId` /
     `rootComponent` today; `hasProjectManifest` only asks whether a manifest exists.
   - ⚠️ **`rootComponent` and `rootNodeId` are NOT interchangeable.** `rootComponent` is the legacy
     *name* field and `project-v2.schema.json` (`additionalProperties: false`) forbids it. v2 is
     `rootNodeId`, a node id. The editor's writer **never emits `rootComponent`** — measured 0 of
     340 manifests carrying a name without an id.
   - 🔴 **A home check must not refuse a MODULE.** §2.1 measured **6 of 97** real projects with no
     home, but the wide denominator is full of modules and prefabs, which have no home *by design*.
     "Has no `rootNodeId`" does not distinguish the two, and that is the actual design problem.
2. **Scream on DELETING a home page.** The existing preview error is *after the fact*.

⚠️ **AC2 stays open regardless** — it needs a curated template installed *through the picker*, and
the picker cannot reach one yet. **Do not count DEF-007 closed on this session's work.**

### Job 2 — DEF-036 (largest; do NOT start it half-way through a session)

Ruled **B**: a wire must **not** declare a column on the accounts table. 🔴 **Do not re-open by
re-arguing the 271 dropped wires** — Richard ruled on product shape, not cost.

Three parts, and **part 3 first if you only get one**:

3. **A wire to a deleted/absent schema field stays on canvas, drawn dotted, and errors.**
   ✅ The dash already ships (DEF-034 built FB-021's dashed rendering for *questionable* wires and
   drove it at s35). 🔴 **But these wires are `con-no-target-port` / `con-no-source-port`, both
   `level: 'error'`, and DEF-034 kept errors deleting — so today they are dropped, not dashed.
   That gap is the work.**
2. **No backend attached or not running ⇒ no Add button, no field list, an explicit warning.**
   🔴 **This is the part that closes the person-sentence**, not the button — an empty schema today
   produces no ports *and no explanation*.
1. **An "Add a field" button on the data node**, jumping into the schema editor for the table
   already chosen in that node's dropdown.

⚠️ **Parts 1–2 are our internal DB only.** Do not generalise to external backends without asking.

---

## Still owed on rows marked ✅ — say this before quoting them

- ⚠️ **DEF-037's deployed-app arm is untested end to end.** A **wire** driving a `styleTag`'d port
  in a *published* app is covered by unit test and by construction, not by a running deployed app.
- ⚠️ **DEF-037: `borderColor` on Checkbox and Radio Button were not driven** (2 of the 3 instances
  found by reading source). Same class and same code path as the driven `width`; the tick glyph
  only renders with `useIcon` on, which the fixture did not set.
- ⚠️ **DEF-007 AC4's scan cannot see a reader that never constructs a `ProjectModel`** — code
  export, the MCP server, template generation. Registered as prose in `NON_FROMJSON_READERS`;
  **nothing enforces those.**
- ⬜ **DEF-031's panel half and DEF-029's panel half are both still owed**, and both need the same
  thing: **the property panel read out of the DOM**. The graph is a single `<canvas>`, so selecting
  a node needs a canvas-coordinate click. ✅ **`cdp click` takes a SELECTOR, not `x,y`** — stamp the
  element with an id first, as this session did for the launcher card. A `cdp canvasclick` helper
  is still unbuilt.
- ⬜ **DEF-005's `Roles` output has still not been driven** in a real editor (row line 158).

---

## Gates

- **Job 1** → editor. **Job 2** → editor. 🔴 **Serially — never two package suites at once.**
- 🔴 **Gate on the EXIT STATUS.** An error-line count only confirms a run that finished; a crashed
  `tsc` writes zero `error TS` lines and reads as a pass.
- **Floors measured at `6387cc8e`, this session, by `npx jest` per package:**

  | package | result | exit |
  | --- | --- | --- |
  | `noodl-runtime` | 2610 passed, 147 suites | 0 |
  | `noodl-viewer-react` | 1138 passed, 87 suites | 0 |
  | `noodl-editor` | 6499 passed, **5 pre-existing failures** | 1 |

  The 5 are `sb-007` (2), `sb-018` (2), `aib-007` (1) — **somebody else's open work; do not read
  them as this phase's floor and do not "fix" them.**
  ⚠️ **A 6th red, `bld-004/reasoningChannel`, passed 8/8 when re-run alone** — a parallel-load
  flake, not a floor entry. **A lone red is a flake until re-run.**

---

## The drive harness — what this session added

- 🔴 **`cdp click` takes a CSS selector and NOT `x,y`** (unlike `cdp dropfile`, which takes
  `<sel|x,y>`). Passing coordinates fails with *"not a valid selector"*. ✅ **Stamp the element with
  an `id` in one eval, then `cdp click "#that-id"`.**
- 🔴 **The webpack seam is lost on NAVIGATION, not just reload.** Opening a project navigates, so
  `window.__req` goes undefined mid-drive and reads `Cannot read properties of undefined`. Re-push
  with a **new unique chunk id** — a reused id returns `undefined`.
- 🔴 **A recents card keeps the name it was added with.** The launcher card for a *copied* project
  showed the **source project's** name, so searching the card list by the new name found nothing.
  ✅ **Settle it by `_retainedProjectDirectory` on the loaded `ProjectModel`, not by the card title.**
- 🔴 **`~/Documents` here is iCloud-backed.** `du -sh` reports **placeholder** sizes (a 334-component
  project read as 728K, its `project.json` as **0B**), and `cp -R` then stalls for minutes
  materialising files. ✅ **Drive from a project under `vscode_projects/NodeGX test projects/`**, which
  is local. `def037-drive` is this session's fixture: a 300px `contentHeight` Group holding an
  overflowing `Text`, plus a `Checkbox` — the minimum for a derived-style drive.
- ✅ **`npm run dev:stop` shielded 10 peer MCP servers** while reaping 26 of its own processes.

---

## Traps carried

- 🔴 **Substring ≠ line.** A mutant meant to delete two call lines asserted on an 8-space-indented
  string and a 6-space one — **the 8-space string contains the 6-space one**, so the count read 2,
  the assert threw, the file was never mutated, and the suite passed **looking exactly like a
  surviving mutant**. ✅ **Match on `line.strip()`, and check the file actually changed.**
- 🔴 **Rule out your instrument before believing a zero.** The `styleTag` spec read 0 renders on
  every row on its first run. `getDOMElement` is itself a node method, so stubbing it *before* the
  method-binding loop let the loop overwrite it and `setStyle` took its `if (!domElement) return`
  early exit. One line of ordering, and it looked exactly like a fix that does not work.
- 🔴 **Run the control AFTER a known-firing signal.** A zero read first is indistinguishable from a
  broken harness.
- 🔴 **Validate an extractor against an answer you already know**, and **strip comments** — three
  files name `ProjectModel.fromJSON` in prose while calling nothing, and a docstring mention
  reading as a call site is the same failure that disabled a pruner for every project in VIB-012.
- 🔴 **A test that proves the fix fires is not the same as one that excludes the neighbouring wrong
  answer.** DEF-037's rows assert a **difference on one node** (editor-driven re-renders,
  wire-driven does not) — a spec proving only "setParameter re-renders" passes against all three
  mutants, including "always re-render", the change nobody costed.
- 🔴 **`git commit <pathspecs>`, never stage.** A peer's P81 commit landed between this session's
  two commits, and two peer files sat dirty in the tree throughout.
- ⚠️ **`cd` persists between Bash calls.**

## Unowned rows — seven

[UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md). §1 disproved, §6 measured, §7 new.
**Measure one row fully before starting the next.** ⚠️ Next free id is **`DEF-038`**.
