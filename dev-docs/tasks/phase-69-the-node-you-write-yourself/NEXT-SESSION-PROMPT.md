# Phase 69 — next session

**Written 2026-08-17, session 15.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first. **s15 cleared the entire driving
backlog.** CN-018 is closed, CN-007's D8 obligation is driven, both owed re-records are done, and two
standing questions were answered by measurement. **CN-008 is the next build — but one of its premises
is false; see §4.**

---

## 0. Where the phase is

| Task | Built | Driven | Note |
|---|---|---|---|
| **CN-001** … **CN-006** | ✅ | ✅ | Closed in sessions 4–11 |
| **CN-019** | ✅ s13 | ✅ s13 | Closed |
| **CN-018** | ✅ s12 | ✅ **s15** | **CLOSED** — §1 |
| **CN-007** | ✅ s14 | ✅ **s15** (D8) | AC1/3/4/5 met and D8 driven; **AC2 still not started** — §2 |
| CN-006b, CN-008 … CN-017 | 📋 | — | **CN-008 is the natural next build** — §4 |

**Nothing in this phase is now blocked on a running editor.** That has not been true since s11.

---

## 1. 🔴 The one lesson from s15, and it is not about kits

Three handovers (s12, s13, s14) recorded CN-018 and the two re-records as **blocked on a viewer
build**. The reasoning was sound — the editor loads its viewer from
`packages/noodl-editor/src/external/viewer`, which is gitignored build output (`.gitignore:197`).

**A build carrying the fix had existed since 2026-08-16 21:57** — five minutes after the fix
committed at 21:52 (`2d8f8e02`). The blocker was inherited by relay for three sessions and cost every
one of them the drive.

Checking it took two commands: the file's mtime, and then its **contents** (`moduleNodesByKit`
appears as compiled code at 5 sites in `noodl.viewer.js`, line 66784 — not a comment, not a
sourcemap). Timing alone would have been suggestive; content is what made it safe to drive.

✅ **"Blocked on a build" is a claim about an artefact, and an artefact has an mtime and contents.
Check both before inheriting the blocker.**

## 2. ✅ What s15 measured

All readings and their discriminators are in the notes; the headlines:

**[CN-018 AC4/AC5](notes/cn-018-picker-drive.md)** — three kits in one project
(`NodeGX test projects/cn069-s15-drive`) draw three separately-named picker headings with their own
counts; the two `Stat Tile` cards are distinguishable without `data-test`.

🔴 **The two modes carry the kit name on different elements, and I nearly filed a false defect
over it.** Browsing: the *group heading* is the kit, and the card's meta line reads `External
libraries` (the category). Searching: the *heading* is the category and the *card's second line* is
the kit. Reading only browse-mode cards looks exactly like the fix not reaching the card. **Check
both modes before calling a two-mode surface broken.** AC5 was measured rather than argued: the kit
heading and the built-in `Logic` heading are identical in tag, class, and every computed typographic
property.

**[CN-007 D8](notes/cn-007-d8-token-drive.md)** — positive pills paint **`rgb(22,163,74)`**
(`--green-600`) with no colour parameter set anywhere. Not the old `#1F8A4C`; and **not
`rgba(0,0,0,0)`**, which is the exclusion that mattered: s14 removed the in-JSX
`props.positiveColor || '#1F8A4C'` fallbacks on the reasoning that a declared `default` is assigned
to props at initialize, and had that been wrong every pill, band and banner would have rendered with
no background. Both banner arms measured by flipping the driving value.

🔴 **Observation O3 was retired as unmeasurable, and this is worth more than the pass.** It asked for
`var(--` to appear 0 times in computed colour values. A planted unresolvable token proves the sweep
**cannot fire**: CSS `var()` is substituted at computed-value time, so a colour property yields
`rgba(0,0,0,0)`, never the literal string. "0 leaks" is equally true of a perfect page and of one
where every token is broken. ⚠️ **Its liveness control did not save it** — "the document's CSS text
contains `var(--` somewhere" is true of any tokenised stylesheet. **A control must be a known-broken
input fed to the instrument itself, not a sign of life taken from nearby.**

**[The mid-session pickup question](notes/cn-006-midsession-kit-pickup.md)** — carried since s11 as
deliberately-not-claimed. Now measured on an undisturbed tree: a kit scaffolded into the **open**
project is absent from `ProjectModel.modules` and the node library immediately and at every 5s poll
to **t+30s**; a **viewer reload** picks it up (177 → 178 types, correctly named). So **CN-014's
spec hypothesis is false** — no watcher delivers it — and `KitsSection`'s "reload by hand" is
necessary *and* sufficient.

## 3. ✅ Both owed re-records are done

1. `packages/noodl-editor/tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json` — re-recorded
   from a running editor. ⚠️ **The ~400-line diff is pure reordering, not a rewrite.** Compared by
   name: identical 177-name set, exactly **two** content differences (`demo.kit.Badge` and
   `demo.kit.Meter` went `module: 'Unknown Module'` → `'Demo Kit'`), ports byte-identical. The JSON
   header records this so a reviewer is not misled by the line count.
2. `packages/noodl-mcp/tests/kitAgreement.test.ts` — expectation is now `['Demo Kit', 'Demo Kit']`,
   the describe block renamed off "the one thing the two routes do not agree about", and the fossil
   comment rewritten to record *why* it was a fossil.

Gates: `kitAgreement` **9 passed**, `noodl-editor tests-unit/cn-003` **22 passed**.

## 4. 🔴 CN-008 is next, and one of its premises is FALSE

CN-008 plans to include, per node, *"what it is for (the `docs` string authors already write)"*.

**`packages/nodegx-kit-scaffold/src/index.js` contains no `docs` key at all.** Every scaffolded
node's picker preview reads *"No documentation yet."* — observed live on both scaffolded kits.
Authors do **not** already write one on the path this phase tells them to start from; the cashflow
kit has `docs` on every node only because it was hand-written.

Two honest options, and the task should pick one out loud: treat `docs` as usually-absent and say
what the handout does instead, or have **CN-006's scaffold emit one** — which is also the P2-shaped
answer, since the scaffold exists to model good practice.

⚠️ Otherwise CN-008 is unblocked: `AuthoringContextBuilder` and the prompt builders are pure, and
ERG-002's `libraryOverview()` is the pattern to follow exactly (`charge()`, absent-means-omitted,
cache-stable half of `referenceBlocks`).

## 5. ⚠️ Carried, unresolved

🔴 **The cashflow kit is OUTSIDE the repo, and s15 made the risk concrete.** It lives in
`NodeGX test projects/cashflow-command-centre` — **unversioned, covered by no gate**. And the copies
have already diverged: `cashflow-command-centre` is tokenised (18 × `var(--`), while
`cn001-kit-drive` and `cn019-drive` still carry the pre-D8 kit (0 × `var(--`, 6 × live `#1F8A4C`).
**Driving the wrong copy would have read as "the D8 change did not land".** D5 makes CN-007 depend on
this kit staying working and nothing enforces it. **Still wants a task number:** vendor it as a
fixture, or accept the risk explicitly. Right now it is neither.

⚠️ **The token vocabulary gap (from s14):** the semantic set has `--destructive` but **no `--success`
and no `--warning`**, so any kit with three status bands must reach into the palette scale for two of
them. The cashflow kit takes all three from the scale so they read as one system. Vocabulary gap, not
a kit problem, and it will recur.

⚠️ **Free and still unchecked:** whether the editor's colour picker paints a swatch for a `color`
port whose value is a `var(--token)` string. One eval with a project open; nothing depends on it.

⚠️ **From s13, still free:** `CodeFileDocument` renders **two toolbars** — its own `css.Topbar` above
`JavaScriptEditor`'s, with two separate Save buttons (visible in `notes/cn019-driven.png`).

⚠️ **From s12, still unmeasured:** `NodeLibraryImporter.mergeInByName` replaces a group **wholesale by
name** (`NodeLibraryImporter.ts:366-388`). Named groups narrow it to same-name collisions; a kit
registering nodes in both runtimes is still last-wins. Wants a look if CN-013 is picked up.

## 6. Owed by Richard

Unchanged from s7–s14, all still open:

1. **Widen the project gate to check parameter values?** `checkParameterValues` has one production
   caller, so `validate:project` / `validate_project` check parameter values for **no node of any
   provenance**. `cn004.test.ts`'s last block asserts the silence deliberately — **replace it when
   the call is taken, do not delete it.**
2. **The ungated typechecks.** `packages/noodl-mcp`'s `tsc --noEmit` is red (8) and runs in no CI
   job; seven of eleven `typecheck:*` scripts run nowhere, and `scripts/` is in none.
   ⚠️ `typecheck:runtime` is red at 2, proven pre-existing. ⚠️ `typecheck:core-ui` reports **44
   `TS2307`s**, cause unidentified — s13 guessed and the guess was wrong.
3. **Should `project`'s `find_tools` purpose line name kits?** Costs resident tokens out of the same
   57 CN-009 wants. `tests/kitTools.test.ts` has the control that fails when it changes.

Open, not caused here, still wanting task numbers: 🔴 `render-from-disk.js` answers `/` and
`/index.html` and 404s everything else, **including the start page's own `urlPath`** · 🔴 the
`@noodl/mcp` provisioning flake · 🔴 `ViewerConnection.sendRefresh()` dead at both ends.

## 7. Checkout conditions

**22 peer sessions live** at session start.

- ✅ **I launched an editor and tore it down.** 9222 was free (first open window in three sessions).
  `npm run dev:debug -- --quiet`, then `npm run dev:stop` — **"Stopped 26 process(es). Nothing left
  running."** Nothing of mine is still up.
- ⚠️ **Nobody was messaged about the launch.** `ps` showed no `test:ci` / `test:main` /
  SpecRunner / jest run in flight at the sweep, and the launcher's own `sweep()` carries the
  `NEVER_SWEEP` shields, so the reaping hazard did not exist at that moment. A 22-way broadcast was
  judged to be the noise Richard has asked to be curbed. **If a peer reports an odd suite around
  07:00–07:40 on 2026-08-17, this is the candidate.**
- ⚠️ **s15 edited two repo files**, both test-side: `packages/noodl-mcp/tests/kitAgreement.test.ts`
  and `packages/noodl-editor/tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json`. Neither is
  in the editor's webpack entry.
- ✅ Gates run: `kitAgreement` **9 passed / 1 suite**; `noodl-editor tests-unit/cn-003` **22 passed /
  2 suites**.
- 🔴 **`test:ci` was NOT run.** The floor still stands where s12 left it (`2843 / 6 @ 39393`).
  **Re-measure before quoting it**; s13, s14 and s15's commits are not in it.
- ✅ **`git commit -F <file> -- <pathspecs>`, always.**
- Whoever you tell you are starting, tell you have stopped.
