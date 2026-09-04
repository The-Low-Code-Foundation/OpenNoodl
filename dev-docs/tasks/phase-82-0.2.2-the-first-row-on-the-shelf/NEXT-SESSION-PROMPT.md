# Phase 82 — next session

**Richard's instruction, 2026-09-04 (session 38): _"Let's include all the not done stuff in the next
session prompt, tackling as many as possible one after the other."_**

So this file is a **work queue, not a status report**. §B is the queue, in the order to run it,
lowest cost and fewest dependencies first. Each job carries the findings already paid for, so no job
starts from the question. **Run down §B and stop only where a job says it needs Richard.**

Session 38 committed three things: `06839b9a` (the placeholder default that had been red for three
days), `aa223356` (both catalogs, green for the first time since 09-01), `4672d924` (the Dropdown
selects its first item). §D has the readings.

---

## 🔴 §A JOB 0 — THE UNCOMMITTED PILE. ASK, THEN 20 MINUTES.

**This is first because it is the cheapest and the riskiest thing on the board, and because one item
in it is the thing Richard said blocks the 0.2.2 cut.**

Eight separate pieces of finished, working code exist **only as uncommitted edits** in this
checkout. They are in no build. A stray `git checkout --` takes them and there is no copy.

| # | what it fixes | files, all ` M` unless noted |
|---|---|---|
| 1 | **Visual Function errored on its own default** — `done` is on `RESERVED_OUTPUTS`; now `Output1`, shared by define and send | `noodl-runtime/src/nodes/std-library/logic-builder.ts`, `logic-builder-io.ts` |
| 2 | **The error persisted after he fixed the program** — the runtime error bus raised and never withdrew | same two files |
| 3 | **"Open project folder" did nothing** — it revealed `<dir>/project.json`, which v2 projects do not have; `showItemInFolder` is a silent no-op on a missing path | `noodl-editor/src/editor/src/views/panels/SettingsPanel/ProjectSettingsTab.tsx` |
| 4 | **Workbench dropdown missed a new component** — `getComponents()` returns the live array, so React's `Object.is` bail-out discarded every re-read | `noodl-editor/src/editor/src/views/VisualCanvas/PreviewChrome.tsx` |
| 5 | **Hello World + Site Builder offered in the create modal** — `HELD_TEMPLATE_IDS` | `EmbeddedTemplateProvider.ts`, `tests-unit/sbr-001/template-needs-backend.test.ts`, `fb-005/template-shelf.test.ts`, `fb-005/template-install-path.test.ts` |
| 6 | 🔴 **REL-012 — the lesson bundles ship in no artefact a user receives.** *He said this blocks the cut: a fresh install opens Learning empty* | `?? src/editor/src/models/lessonseed.ts`, `?? tests-unit/rel-012/` |
| 7 | **REL-013 — the launcher Templates tab was a placeholder** | `ProjectsPage.tsx`, `useProjectTemplates.ts`, `LauncherContext.tsx`, `Launcher.tsx`, `views/Templates.tsx`, `?? Templates.module.scss`, `?? tests-unit/rel-013/` |
| 8 | **REL-014 — a `var()` value is destroyed by touching its field** (data loss, unrecoverable through the UI) | the `noodl-core-ui` property-panel files, `?? numberInputEdit.ts`, `?? marginPaddingEdit.ts`, `?? tests-unit/rel-014/` |

⚠️ **Their task documents were committed and their code was not** — `e39393c1` carries
`REL-012/013/014-*.md` and none of the source. That is exactly why the board reads them as 🟢.

**How this was measured, so it can be re-measured rather than believed:** every file above has an
mtime between **09-04 15:25 and 16:37**, which is Richard's testing-pass session, hours before the
21:00 commits. `git status --short` is not authorship on this shared checkout; mtime is.

### 🔴 What to do

**Richard was asked at the end of session 38 whether to commit these and answered a different
question instead — so it is still open, and it is one word.** Ask it once, first thing:

> Eight finished fixes are sitting uncommitted, including REL-012 which you said blocks the cut.
> Commit them?

- **If yes:** commit them as the logical changes they are (roughly: 1+2 together, 3, 4, 5, then
  REL-012, REL-013, REL-014 separately), `git add` the untracked paths **first** — a pathspec commit
  skips them silently — and run the gate for each package you touch. Budget 20 minutes.
- **If no answer arrives:** 🔴 **do NOT step over this and start §B.** Say in your first message
  that eight fixes including the 0.2.2 blocker are unprotected, then proceed to §B while you wait.
  Do not commit another task's source unasked.

---

# §B THE QUEUE — run these in order

## 🟢 B1 · Shape node, stage 2 — `cornerRadius` and `points`

**No human dependency. This is the one to start on.** Stage 1 shipped in `64fca4e7`;
[`NOTES`](NOTES-UNOWNED-NODE-WORK.md) §1 is the full brief and its "Sequencing" list names this as
step 2.

What exists to build on: `Circle.tsx` already has `squarePoints`/`trianglePoints` inscribed in the
size × size box, and a general **`insetPolygon`** (edge-offset + line-intersection) that reproduces
the arc functions' "render the stroke inside" trick for straight edges. `filledArc`/`arc` are
byte-for-byte untouched and must stay that way — that is what makes every pre-existing project
render identically.

🔴 **FOUR registries have to move together, and stage 1 found the fourth the hard way.** A port that
`renderCircle` reads must be tagged in all of them or an author gets a `TODO(export)` marker over
something that renders perfectly:

1. `circle.ts` — the port, plus its `dynamicports` gate.
2. `nodegx-export` `analyze/plan.ts` — `STRUCTURE_PORTS.circle`.
3. the same file's `visualDeferReason` — the literal-value defer branch.
4. `nodegx-export` `emit/style.ts` — **`CONTENT_PARAMS.Circle`**. This is the one nothing named.
   Stage 1 found it with a test that pushed a *literal default* value and asserted the output was
   byte-identical to leaving it unset; a test that only asserted the *defer* cases would have
   shipped the bug.

⚠️ **Two traps, both already paid for** ([`NOTES`](NOTES-UNOWNED-NODE-WORK.md) §1):
- The gate clause must read **`'shape = circle OR shape NOT SET'`**. Every saved Circle has no
  `shape` parameter and the rule compares `'' + getParameter(param) === value`, so without the
  `NOT SET` half the two shipped prefabs' angle ports vanish from the panel.
- **Use the clause form, never `#js`.** `portGateReason.ts` returns `undefined` for `#js`, so the
  author gets no "why is this hidden" sentence and `validation/portConditions.ts` abstains.

⚠️ **A literal count gate will move**: `tests-unit/fb-021/portGateReason.test.ts` counts every
conditionally-gated port in the shipped catalog. Stage 1 moved it 359→362 / explained 348→351 with
the derivation written out. Move it the same way, **with its reason**.

**Gates**: the two `nat-shape-00*` suites, `nodegx-export/tests/visual-controls.test.ts`, full
`noodl-viewer-react`, `tsc -p noodl-viewer-react`, `tsc -p nodegx-export`, then the catalogs (see
§C1). **Measure the reverted arm** — a source-text assertion passes on dead code.

## 🟢 B2 · Shape node, stage 3 — `svgSource`

Depends on B1 only for tidiness; the brief is [`NOTES`](NOTES-UNOWNED-NODE-WORK.md) §1 "Custom SVG
safety".

**First move the sanitiser.** `sanitizeInlineIconSvg` lives in `IconGlyph.tsx` and must be lifted
into a shared module rather than imported across the Icon boundary. It strips `<script>`,
`<foreignObject>`, every `on*` attribute, and every `href` except same-document fragments.

🔴 **It does not cover `<style>` blocks, CSS `url()`, or SMIL `<animate>`/`<set>` — which can
rewrite an attribute *after* sanitising — and the output goes through `dangerouslySetInnerHTML`.**
Its own comment makes the argument that applies here: **the set is the trust boundary, not the
author**, because authored SVG travels in kits and templates. So closing those three is part of this
job, not a follow-up: write the sanitiser's own suite with each of the three as a case.

Plus the custom export branch (a `svgSource` node defers, with a named reason).

## 🟢 B3 · Video — start and end time for mp4

**Half built already.** `Video.tsx` appends `#t=0.01` as an Android first-frame hack and guards on
`src.indexOf('#t=') === -1` — **media fragments are already the mechanism in this file**, and
start/end compose into that same string. 🔴 **The existing hack is the collision to resolve**, and
it is the whole of the difficulty: an author-set start must not be silently overwritten by the
Android workaround, and the workaround must not stop working when no start is set.

`autoplay`, `controls`, `loop`, `muted` and `volume` already exist for mp4.

## 🟡 B4 · Video — YouTube and Vimeo

🔴 **Zero support exists anywhere: there is no `<iframe>` in the viewer at all.** A pasted YouTube
link renders a broken `<video>` and fires `video/media-error`. Session 37 fixed only the *port
description* (`edccfe53`) so it names mp4 and says it is not a YouTube link.

**Split this, because half of it is buildable today and half is a decision:**

- 🟢 **Buildable now**: an iframe path driven by **URL parameters only**
  (`?start=&end=&autoplay=…`), which needs **no SDK and no new network origin logic**. That covers
  the ordinary case.
- 🔴 **Needs Richard**: a *reliable* `end` plus dependable autoplay requires the **IFrame Player
  API script**, which nothing loads. That is a **CSP and third-party-network decision**, not a port
  change — a NodeGX app would start loading Google-hosted script. **Ask before building it**, and
  frame it as: do published apps get to load a third-party player SDK?

## 🟡 B5 · Dropdown — the beginner "click plus and type" mode

**Fully researched, three directions, none chosen. This needs one sentence from Richard and then it
is buildable.** [`NOTES`](NOTES-UNOWNED-NODE-WORK.md) §3 has all five questions answered.

🔴 **It is a genuine new capability, not a convenience wrapper.** `Select.tsx` reads `i.Value` and
`i.Label` on every entry, so a bare `["a","b"]` renders `<option value="">` with nothing selectable
— the mode has to *produce* `{Label, Value}` objects from what the author types.

✅ **The exact UX he is describing already ships, on a different shape.** `proplist`
(`json-editor/utils/listValueCodec.ts`) accepts a bare string per row and mints a stable id
automatically — open a JavaScript node's **Inputs** list in the running editor to see it. It is not
a drop-in (its one author-facing field is `label` paired with an opaque `id`; Dropdown needs two
author-visible fields and no id), but it is the mechanism template.

**Recommend direction 1 when you ask him**, so the question is a yes/no rather than a design review:

1. 🟢 **A new list-port type, `optionslist`**, alongside `array`/`object`/`stringlist`/`proplist` —
   stored as `[{Label, Value}]`, one text field per row, `Value` auto-slugged from `Label` and
   independently editable (for the "Large" → `l` case). Dropdown's `items` port changes
   `type: 'array'` → `type: 'optionslist'`. Smallest, and consistent with the existing four-type
   system.
2. A schema hint on `JSONEditorProps` that `EasyMode` reads for any opted-in array-of-object port —
   more general, much more surface to design and test.
3. A Dropdown-only property row bypassing `JSONEditor` entirely — fastest, builds nothing reusable.

⚠️ Whichever mode a person last chose is remembered in **one global `localStorage` key**,
`json-editor-preferred-mode` — not per-port, not per-project. Worth knowing before adding a third.

## 🟡 B6 · The Design Tokens panel nobody can reach

Two facts, both measured: the panel is **`devMode`-gated**, so 🔴 **in a packaged build it is not
registered at all**; and `TokenPicker` is built, styled and has **zero call sites**.

🔴 **This has an owner that does not exist yet.** [FIX-015](../phase-66-0.1.7-bug-fixes/FIX-015-THE-TOKENS-NOBODY-CAN-EDIT.md)
is a **ruled scope with eight rulings** and its slice 1 is exactly this, but its successor phase was
green-lit and never created. So the job here is either *create that phase* or get told to build it
in place. **Ask which** — do not open a duplicate row in phase 82. (REL-014 took only the
*data-loss defect* from this area, which FIX-015's gap list A–J does not name, so those two do not
collide.)

## ⬜ B7 · Blocked on Richard, nothing to build

| what | what unblocks it |
|---|---|
| **Default tutorial content** (FB-012, phase 75) | his brief. Rolls forward on purpose |
| **The empty template shelf** (FB-005, phase 75) | closes on **REL-001** — publishing the members' area, which is his |
| **REL-015 AC9/AC11** | two YouTube links and one real tutorial, his content |
| **REL-004 — cut and tag `v0.2.2`** | his. `cline-dev` is **695 commits ahead of `origin/cline-dev`** (and 1669 ahead of `origin/main`), measured 2026-09-04 after session 38's three. Pushing is his own standing decision — **do not push and do not re-raise it** |
| **REL-002c/REL-010 judgement 4** | `/members` unauthenticated should navigate to `/sign-in`. **Answered by him, unbuilt, gates nothing** — arguably a 🟢 job for B-queue if anyone wants a small one |
| **The V2 "modern CSS" brief** | his seam, named 09-04. 🔴 **Must not be turned into a task by guessing** — the first piece of work is measuring which modern CSS this runtime can actually author, and he explicitly declined three readings already. See [`RICHARD-RULINGS-2026-09-04.md`](RICHARD-RULINGS-2026-09-04.md) §4.1 |

---

## 🔴 §C REGISTERED, OWNER `NONE` — real, recorded, and nobody is doing them

Listed so that fact is visible rather than implied. Each is small.

| finding | where it came from |
|---|---|
| **An authored Dropdown still collapses.** Replace `items` with your own list and never set `value`: the seeded `option-1` matches nothing, `selectedIndex` goes back to -1, and the visible span is empty again. Unchanged by `4672d924` rather than caused by it. Cheap remedy: a `placeholder`, whose label renders in exactly that case | found while building `4672d924`; [`NOTES`](NOTES-UNOWNED-NODE-WORK.md) §3 |
| **`/unsubscribe` has three left edges** — the band's eyebrow and content column at x≈305, the footer at x≈65. The same defect REL-002c fixed on `Pages/Post` and `Pages/Account`, surviving on a door page nobody re-measured after the band went on | [`RICHARD-RULINGS-2026-09-04.md`](RICHARD-RULINGS-2026-09-04.md) §6.5 |
| **Finding 6 (workbench dropdown) is fixed and UNGATED.** `@testing-library/react` is not installed, so the menu cannot be opened in a spec, and a source-text assertion was deliberately not written — it would pass on dead code. What closes it: a drive against a real editor, or that dev dependency, which would also unblock several launcher views with no render coverage | [`TESTING-PASS-2026-09-04.md`](TESTING-PASS-2026-09-04.md) §3 |
| **`/unsubscribe`'s ~220px void.** He ruled the page PASSABLE *having been told the void was still there*. 🔴 So this is a consequence of a ruling, not an open defect — **do not "fix" it without asking him** | [`RICHARD-RULINGS-2026-09-04.md`](RICHARD-RULINGS-2026-09-04.md) §6.4–6.5 |

### §C1 The catalog dance — now much cheaper than the last three handoffs said

✅ **Both catalog gates are EXIT=0 for the first time since 2026-09-01.** The §A1 work that made
in-place regeneration unsafe is all committed, so **no more hand-patching JSON hunks** — two
previous sessions did that and both wrote up why. Still:

1. `node scripts/node-catalog/generate.js --out-dir <scratch>`, **diff, confirm the delta is only
   yours**, then copy in. The reason is permanent — several tasks feed this file.
2. 🔴 **`catalog:merge` has NO `--out-dir` flag.** For `node-catalog-enriched.json`: `cp -a` aside,
   `md5`, regenerate in place, diff against the backup, restore if it swept something, `md5` again.
3. **Never `git stash` here** — it would take the ~110 other modified files in this checkout.

---

## §D SESSION 38'S READINGS — all taken 2026-09-04

| gate | reading |
|---|---|
| `noodl-mcp` full jest | **93/93 suites, 1257/1257** — was 92/93 and 1256/1257 for three days |
| `noodl-viewer-react` full jest | **91/91 suites, 1180/1180** (1175 + 5 new Dropdown rows) |
| `p82-dropdown-default-items` | **8/8 EXIT=0**; **reverted arm EXIT=1**, 4 of 5 new rows red |
| `catalog:check` | **EXIT=0** — was EXIT=1 with 7 deltas, then 2 |
| `catalog:merge:check --require-coverage` | **EXIT=0** |
| `catalog:examples` | **67/67 strict, warnings-as-errors** |
| `tsc -p noodl-viewer-react` | clean, 0 errors |

**Not run: `test:ci` or `test:main`.** Nothing committed is in their blast radius — viewer-react
node defaults and two generated JSONs — and a tree-wide `grep` confirmed nothing else pins the old
placeholder string (the two remaining hits are generated bundles; `src/external` is gitignored).
**Not driven in a running editor**: shared box, four other live sessions.

---

## 🔴 §E WHERE THE LAST HANDOFF WAS WRONG — three times, all the same shape

**A handoff's status column describes the WORKING TREE, not what shipped.** Every error below is
that one mistake:

1. 🔴 **"REL-002a was held back on purpose"** — it was not held back at all. The work was
   **complete on 2026-09-01**: two source files, one example, *and* a regenerated enriched catalog,
   all four edited within the same minute (mtime 11:34–11:35). Only `node-catalog.json` was left,
   because that is the file needing the merge dance. Nobody decided anything; it was simply never
   committed, and its test was committed without it (`ba6df3fd`, a REL-002c commit that carried an
   unrelated file along).
2. 🔴 **"`examples/ui-form-field.json` is an unrelated uncommitted edit"** — it removes
   `"placeholder": "Type here"` from an example. Same subject, same minute, same change set. Calling
   it unrelated is what left it blocking `catalog:merge` for three days.
3. 🔴 **"`node-catalog-enriched.json` is stale"** — it was not stale about REL-002a at all; it
   already carried all three of its edits. It was stale about **`64fca4e7`, `8c5e5b10` and
   `edccfe53`** — three *committed* commits whose artefact nobody regenerated. The diagnosis named
   the wrong cause and so the remedy looked expensive.

✅ **What settles this class of question**: `stat -f '%Sm'` on every file in the change set, and
`git log -1 -- <path>` to see whether the fix or only its neighbours landed. Not a status column.

---

## §F Working rules for this tree

0. 🔴 **A SPEC THAT FAILS TO *RUN* REPORTS A CLEAN TEST COUNT.** Gate on the **exit status** and the
   **suite count**, never on the absence of a `✕`. **`Tests: 0 total` can just mean the wrong
   directory.**
1. 🔴 **A COMPOUND `cd X && …` PERSISTS ITS CWD INTO LATER TOOL CALLS.** Session 38 lost a restore
   to this: after `cd packages/noodl-viewer-react`, the `cp -a` that was supposed to put the fixed
   source back used a repo-relative path, failed with `No such file or directory`, and **left the
   REVERTED source on disk**. The readings were already taken so nothing was mis-measured, but a
   later edit would have been built on the reverted file. ✅ **Restore by ABSOLUTE path, and `md5`
   the result against the backup** — which is what caught it.
2. 🔴 **A ROW THAT PASSES IN BOTH ARMS GRADES NOTHING.** Session 38 wrote
   `expect(_internal.value).toBe(props.value)`, which is a tautology when both are `undefined` — it
   passed in the reverted arm too. ✅ **Assert the LITERAL.** Running the reverted arm is what
   exposed it; a fixed-arm-only reading would have shipped a decorative spec.
3. 🔴 **A PIPE GIVES YOU THE EXIT STATUS OF ITS LAST COMMAND.** `… | tail` once reported `EXIT=0`
   for a `catalog:check` that had genuinely failed. Redirect to a log and read `$?`.
4. 🔴 **AN UNCOMMITTED TREE IS INVISIBLE TO A WORKTREE-ISOLATED AGENT, AND IT WILL NOT SAY SO.** A
   subagent in a fresh worktree confidently reported that tests which existed did not. **Never
   `isolation: worktree` on this repo**; settle questions about uncommitted state by running the
   thing in the real checkout.
5. 🔴 **`git status --short` HIDES NEW TESTS IN PLAIN SIGHT.** Read the `??` block too before
   concluding coverage is missing — and `git ls-files` on a *directory* can read TRACKED while the
   files you care about inside it are untracked. Check per file.
6. 🔴 **COMMIT BY PATHSPEC, NEVER `git add`** — except untracked paths, which a pathspec commit
   **skips silently**, so `git add` those first and check `grep '^??'`.
7. 🔴 **`git status` IS NOT AUTHORSHIP ON THIS CHECKOUT — MTIME IS.** Four other sessions are live.
   Before touching a dirty file, `stat` it and `git diff --stat` it; `scripts/devtools/render-report.js`
   carries **120 uncommitted lines from 2026-09-02** that are not this phase's. Session 38 edited
   two lines of its prose (now-false after `06839b9a`) and **deliberately did not commit the file** —
   ⚠️ **that prose fix is still uncommitted and belongs to whoever owns those 120 lines.**
8. 🔴 **A GATE IN ANOTHER PHASE THAT GOES RED IS USUALLY RIGHT.** §E's was right for three days.
   Repair by **deriving** the population, never by picking a better literal.
9. 🔴 **A LONE RED IS A FLAKE UNTIL RE-RUN ALONE.**
10. 🔴 **A `default` ON A PORT WITH A HAND-WRITTEN `set` DOES NOT REACH THE RENDER.** Seed
    `props.<name>` in `initialize()` **and** keep `default:` on the port so panel and render agree.
    This has now bitten the same node twice — `items`, then `value`.
11. 🔴 **A LITERAL COUNT GATE ONLY WORKS IF SOMEBODY RUNS IT.** Touch either template artefact ⇒
    mcp jest + its drives + `test:main` **and** `test:ci`.
12. 🔴 **NEVER OPEN `templates/members-area` OR the site-builder template IN THE EDITOR.** Use
    `npm run template:members` / `template:site-builder`.
13. ⚠️ **`test:ci`'s readout is `packages/noodl-editor/tests/test-results.json`**, not
    `packages/noodl-editor/test-results.json`. An OOM logs `0 error TS` and reads exactly like a
    pass; `134` is the V8 abort.
14. ⚠️ **`electron/dist` in `ps` matches the MCP servers.** Read `ps -o command=` before attributing
    a process to an editor.
15. 🔴 **VERIFY THE CONSEQUENCE, NOT THE MECHANISM.** `4672d924` is the case for it: the two default
    items were correct, present, and invisible, because the thing on screen was a different element
    from the one the fix populated.
