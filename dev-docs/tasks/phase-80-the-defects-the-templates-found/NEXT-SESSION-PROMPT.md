# Phase 80 — next session

**Everything is ruled. Nothing is waiting on Richard. This session is a BUILD session.**

Read [RICHARD-RULINGS-2026-08-31.md](RICHARD-RULINGS-2026-08-31.md) first — five rulings, **two of
them against the recommendation**, and the *why* is what stops you re-arguing them.

---

## The board

**37 rows. 33 ✅ · DEF-007 🟡 · DEF-033, DEF-036, DEF-037 open — all three now RULED, none built.**

🔴 **Derive it from the STATUS COLUMN, never `grep -av '✅'`** (a ✅ in prose filters the row out):

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | awk -F'|' '{gsub(/^ +| +$/,"",$2); print $2" :: "$3}'
```

🔴 **Re-derive any "owed" list from the ROW FILES, never from a previous handoff.** s36 found the
carried "4 BUILT+UNDRIVEN" list was **three-fifths wrong** — DEF-028's "AC5" does not exist,
DEF-009's default was ruled and built on 2026-08-30, DEF-025 closed at s25 — and relayed it once
more itself before checking.

---

## The plan — ordered for throughput, cheapest-per-thing-closed first

⚠️ **Jobs 1–3 change no product source, so they owe no gate.** Do them first and bank them.
⚠️ **Jobs 4–6 do.** Group them by package so you pay one gate cycle each, not three.
🔴 **Never run two package suites at once** — the flakes read as yours.

### Job 1 — hand DEF-033 to phase 18 (~10 min, closes P80's involvement)

Ruled: **show the truth.** Align `Substring`'s *declared* default to `-1` so the panel shows what
already runs; behaviour unchanged, nothing already built moves. 🔴 **P18 owns and builds it** —
your job is to relay the ruling into `phase-18-code-export-v2/` and mark P80's row handed off.
⚠️ Check P18's files and mtimes first — a peer may be in there.

### Job 2 — the canvas-click helper (no gate, and it unblocks TWO row-halves)

The last two undriven halves in this phase both need the **property panel read out of the DOM**,
and both are blocked on the same thing: **the graph is a single `<canvas>`**, so selecting a node
needs a canvas-coordinate click — there is no DOM node to click and no `NodeGraphEditor.instance`.

Solve it once and close both:
- **DEF-031's panel half** — is the rendered `Text Overflow` row there? (*"That half of the AC is
  still owed"*, file line 136.)
- **DEF-029's panel half** — is the `File Drop` group folded into **Advanced CSS**? s35 read the
  node library, a peer reported the fold; **neither is the panel.**

✅ **Suggested shape**: add a `cdp canvasclick <component> <nodeName>` that resolves a node's canvas
x/y from the editor's own model via the webpack seam, converts to viewport coordinates, and clicks.
That is reusable by every future row and is the reason to do it properly rather than by hand.
⚠️ **Timebox it.** If the coordinate transform fights back, fall back to selecting the node through
the model and only *reading* the panel DOM — the panel content is the measurement, the click is
only the door.

### Job 3 — DEF-005's `Roles` output drive (no gate)

Undriven in a real editor (file line 158). Independent of Job 2. Cheap once a stack is up — and a
stack is already up from Job 2.

### Job 4 — DEF-007, all three parts in one pass (editor package, ONE gate cycle)

The row's remaining work is now three items that all live in the **editor** package. Doing them
together is the whole reason this is one job.

1. **AC4 — ruled.** Move §6's seam table **out of the task file** into the codebase (beside
   `applyPatches` and/or `dev-docs/reference/`), **and add a test that fails when a new path
   reaches `ProjectModel.fromJSON` without going through `applyPatches`.** 🔴 The test is the
   point, not the doc — this is a hand-maintained list of the exact kind that decayed until
   Checkbox was missed. The content is already correct: **4 of 6 load paths skip the upgrade.**
2. **Refuse at publish — ruled.** A project with no home page must not publish as a template.
   ⚠️ `shareAsTemplate.ts` and `shareTemplateForm.ts` contain **zero** references to `rootNodeId` /
   `rootComponent` today; `hasProjectManifest` only asks whether a manifest exists.
   ⚠️ **`rootComponent` and `rootNodeId` are NOT interchangeable** — `rootComponent` is the legacy
   *name* field and `project-v2.schema.json` (`additionalProperties: false`) forbids it. v2 is
   `rootNodeId`, a node id.
3. **🆕 Scream on DELETING a home page — ruled, new, on no row before today.** The existing preview
   error is *after the fact*. ⚠️ **This does not substitute for (2) and (2) does not substitute for
   it**: publish catches a project that never had a home, deletion catches one that had a home and
   lost it.

⚠️ **AC2 stays open regardless** — it needs a curated template installed *through the picker*, and
the picker cannot reach one yet. Do not count DEF-007 closed on this session's work.

### Job 5 — DEF-037, derive it (viewer-react package, ONE gate cycle)

🔴 **Rewrite AC3 FIRST.** As written it says *"the fix must not be 're-render the whole preview on
every style change'"* — that was a previous session's constraint and **the ruling supersedes it**.
Do not try to satisfy both; you will build the wrong thing.

The mechanism is fully mapped in DEF-037 §7: `react-component-node.ts` → `setStyle()`, generated
for **every** `inputCss` port, force-updates React only for a hard-coded allowlist and **skips that
allowlist entirely when a `styleTag` is set**. The four known-inert ports are named with file:line
in §7.3 (Checkbox `width`/`height`, Checkbox `borderColor`, Radio Button `borderColor`).

🧭 **The implementation reading, offered and NOT ruled on — confirm with Richard before relying on
it**: *always re-render on an **editor-driven** parameter change (human speed, nothing gained by
bypassing React), keep the DOM fast path for **runtime-driven** ones (a wire animating opacity per
frame).* That satisfies *"the preview is a true, live, auto updating view"* without making
animation slow. **If Richard means the fast path should go entirely, that is a bigger change.**

✅ **Radio Button's `width`/`height` are the known-firing control** — same shape, already fixed.
⚠️ **Drive one before fixing four**: the three new instances are read from source, not measured.

### Job 6 — DEF-036, if anything is left (largest; do NOT start it half-way through)

Ruled **B**: a wire must **not** declare a column on the accounts table. **Do not re-open by
re-arguing the 271 dropped wires** — Richard knows, and ruled on product shape, not cost.

Three parts, and **part 3 is the one to do first if you only get one**:

3. **A wire to a deleted/absent schema field stays on canvas, drawn dotted, and errors.**
   ✅ **The dash already ships** — DEF-034 built FB-021's dashed rendering for *questionable* wires
   and drove it on canvas at s35. 🔴 **But these wires are `con-no-target-port` /
   `con-no-source-port`, both `level: 'error'`, and DEF-034 kept errors deleting — so today they
   are dropped, not dashed. That gap is the work.**
2. **No backend attached or not running ⇒ no Add button, no field list, an explicit warning saying
   so.** 🔴 **This is the part that actually closes the person-sentence**, not the button — an
   empty schema today produces no ports *and no explanation*.
1. **An "Add a field" button on the data node**, jumping straight into the schema editor for the
   table already chosen in that node's dropdown.

⚠️ **Parts 1–2 are our internal DB only** — Richard said so explicitly. Do not generalise to
external backends without asking.

---

## Gates

- **Jobs 1–3 owe none** (docs, harness, drives).
- **Job 4** → editor. **Job 5** → viewer-react. 🔴 **Serially.**
- Floors, carried from s33 and unverified at this HEAD: `test:ci` **4** (all AIX-006, by name),
  2916 specs. `test:main` **5 pre-existing failures** (`sb-007`, `sb-018`, `aib-007`) — **somebody
  else's open work; do not read them as this phase's floor and do not "fix" them.**
- 🔴 **Gate on the EXIT STATUS.** An error-line count only confirms a run that finished; a crashed
  `tsc` writes zero `error TS` lines and reads as a pass.
- ⚠️ **A drive serves a BUILT bundle.** Touching `noodl-viewer-react` (Job 5) means rebuilding
  before any drive, or the change is invisible. **Verify the built bundle CONTAINS your change** —
  do not infer it from an mtime.

---

## The drive harness

- 🆕 **`cdp dropfile "<sel|x,y>" <file>[,...] [--probe=<expr>] [--leave-to=<sel|x,y>] [--no-drop]`**
  — real file drops. `--probe` reads state **mid-drag on the same connection** (a second `cdp eval`
  is always too late). ⚠️ **`--no-drop`/`dragCancel` delivers NO `dragleave`**, so hover state stays
  set — that is the instrument, not a defect; use `--leave-to` to test release.
- **Opening a project**: `LocalProjectsModel.instance.openProjectFromFolder(dir)` loads the model
  but **does not navigate** — it only adds the project to recents. The real door is then a
  `cdp click` on its launcher card (`[class*=LauncherProjectCard-module__Card]`, excluding `Ghost`).
  ⚠️ The card can be **7000px down** — `scrollIntoView({behavior:'instant'})`, then re-measure in a
  **separate** eval before clicking.
- **The webpack seam**: `window.webpackChunknoodl_editor.push([['<UNIQUE-ID>'],{},r=>window.__req=r])`
  then `__req.c['./src/editor/src/…'].exports`. ⚠️ A reused chunk id returns `undefined`. ⚠️ **Lost
  on every reload** — re-push with a new id.
- 🔴 **Hand-authored v2 files**: connections use **`fromId`/`fromProperty`/`toId`/`toProperty`** —
  any other names load silently, crash the export naming nothing, and **are written back as empty
  objects**. And `nodes.json` needs **both** sides of every parent link (`children` on the parent
  *and* `parent` on the child); writing only `children` gives a silently-wrong root count.

## Traps carried

- 🔴 **Re-derive owed-lists from the row files.** Three of four carried items were already closed.
- 🔴 **Run the control AFTER a known-firing signal.** A zero read first is indistinguishable from a
  broken harness.
- 🔴 **Rule out your instrument before reporting a defect** (the `dragCancel` hover above).
- 🔴 **Validate an extractor against an answer you already know.** s36's port extractor silently
  dropped the first key of every object literal; only two ports known by hand caught it.
- 🔴 **Two sibling nodes can carry opposite rules** — Checkbox and Radio Button declare `Width`
  identically and only one got the fix. Read the writer, not the sibling.
- ⚠️ **`cd` persists between Bash calls** — a relative `git status <pathspec>` from the wrong
  directory reports **nothing changed**, which reads exactly like a sibling having swept your work.
- 🔴 **`git add` untracked files individually, then `git commit <pathspecs>`.** Never stage tracked
  files — a sibling's commit sweeps them.

## Unowned rows — seven

[UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md). §1 disproved, §6 measured, **§7 new**.
⚠️ §7's first measurement decides its rank: *does an unresolvable id — a real field name pointing
at a deleted node — take the same crash?* That case is reachable without hand-editing anything.
**Measure one row fully before starting the next.** ⚠️ Next free id is **`DEF-038`**.
