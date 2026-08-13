# Next session — Phase 64: the batch landed and was driven. One task now FAILS live.

**Read this, then [DRIVE-2026-08-13-C.md](DRIVE-2026-08-13-C.md), then [TASKS.md](TASKS.md).**
Supersedes [NEXT-SESSION-2026-08-13-C.md](NEXT-SESSION-2026-08-13-C.md), whose four-agent batch and
bundled drive are both done and merged.

## What happened

Four lanes built in parallel worktrees, all four merged into `cline-dev`, and the five
merged-but-undriven tasks were driven in the primary checkout.

**Gates on `cline-dev`: `npx jest` → 174 suites / 2606 passing, 0 failures** (baseline 165 / 2453).
`tsc` clean. **`cloud-library:check` green.**

⚠️ One flake worth knowing: `tests-unit/aib-009/turnDeadline.test.ts` failed on the first full run
and passed alone (8/8) and on the immediate re-run. It asserts on **real timers** and 174 suites now
run in ~11 s of heavy parallelism. Not a regression — but it will do this again, and the next person
to see it should not go hunting.

---

## 🔴 The thing to deal with first: VFN-004 fails live

It was merged this morning as built. **It does nothing in the running editor.** The away mark never
appears and clicking the tab neither navigates nor selects.

**Every layer is individually correct.** The event fires (recorded `["/ErgCodes", "/App"]`), the
derivation is right, and `isTabAway` is right in all three polarities — all checked before filing,
because any one of them would have made this an instrument error instead.

**The cause: `component.id` is `undefined` for most components** — 2 of 7 in each of three unrelated
projects. `isTabAway` then returns `false` forever, by its own correct rule that an absence of
knowledge must not be published as an assertion.

🔴 **Do not just swap the field.** `fullName` is what the rest of the editor uses and it is already
on the tab as `componentPath`, but a rename would silently break a tab keyed on it — which is
presumably why `id` was chosen. Key on `fullName`, assign ids on load, or persist them: **decide what
a rename should do first.** Full measurement in the drive report.

⚠️ The headless suite could not have caught this: every spec supplies a `componentId`. Any new spec
must include the **no-id** case as a control.

---

## What is now closed

| | |
|---|---|
| **VFN-011** | ✅ **The flagship works.** Typed 7 × 3, pressed Run with the app stopped, `total = 21`, and **badges painted from a bench frame** — the half flagged as most likely to be quietly wrong. Criterion 8 byte-identical on disk **and proved non-vacuous** by a control that changed the hash. The 152px rail fits (151 / 129). |
| **VFN-013** | ✅ Built **and re-swept live**: the two filed overlaps (266 and 371 px²) are **zero**. One residual on the deepest nested badge — 152 px² of body, 36 px² of a *text-less* field rect — which is the bound the lane documented. |
| **VFN-014** | ✅ Built. Criterion 5 reproduced and answered (inlined saved block; `generatedCode` is **not** stale). Inlined regions now carry a `// name` marker. |
| **the ports defect** | ✅ **Fixed and driven.** A call block states its ports in `extraState.ports`; `detectIO` reads them. An **existing** call block migrates — `loadExtraState` re-derives and the next flush carries it. `hasResult: true` on the real node. |
| **VFN-006 / VFN-009** | ✅ Built, gates green, **not driven**. |
| **`BaseDialog` `inert`** | ✅ Fixed. One tab stop instead of two; control printed 1 vs 2 both ways. |
| **VFN-012** | ✅ Flyout renders its label and button items; *Open app settings* reaches Settings → Project. |

## 🔴 Two new findings from the drive

1. **The VFN-012 button opens a panel the Logic Builder window covers.** *Open app settings* works,
   and most of the panel it opens is behind the floating window. This is **VFN-005 with a concrete
   in-feature consequence** and is a better argument for that task than the abstract 74% measurement.
   Whatever VFN-005 chooses must account for a panel opening underneath.
2. **VFN-011's strip sentence is ellipsised**, exactly as `NOTES-bench.md` predicted: *"…Press ▶ Run
   below to work them out here, with the app stop…"* — cut off at the point where it says what the
   bench is for. **Trim the copy.** Cheap, and it is the sentence that teaches the feature.

## Owed drives, in the order I would take them

Everything below is a *consequence* only the real app reports. The four lanes each listed their own;
these are the ones that could still show something does not work.

1. **VFN-009's section renders at all** — nothing in it has been driven. Does *Edit blocks* open the
   floating window while the settings panel is open? The window is a canvas overlay and whether it is
   even visible from the settings route is a question only a drive answers.
2. **VFN-006's outline painting**, and its hover trigger — the lane calls the trigger "the weakest
   thing I built" and names where it will fail (a guess about Blockly 12's menu DOM).
3. **`inert` in the running editor** — Tab into any dialog, confirm the first Tab lands on a visible
   control. Editor-wide change to a 29-consumer component.
4. **VFN-014 criteria 1–2** — one press of *View Code*, including whether the 14 lint warnings go.
5. **The ports fix, gesture 2** — drag a saved block into a *second* Visual Function. Should be
   immediate; only the migrate-an-existing-block path has been driven.
6. **VFN-012's `⚠` mark contrast** on a hue-90 block — needs a config variable declared then deleted.

## Working conditions

- **The fixture is `vfn64-drive`** (`NodeGX test projects/`), a copy of `vfn64-qa` made so the
  VFN-014 evidence in the original stays pristine. Its project name is `VFN64-DRIVE-UNIQUE`
  deliberately: the launcher had **two cards both named `lgc010-drive`** and `cdp click` takes the
  first match.
- 🔴 **The register's open-by-path recipe did not work.** The React fiber carries no
  `memoizedProps.route.router` on the **launcher** route — a 40-deep sweep found nothing and a scan
  of all 2308 modules found only app-domain routers. Drive the launcher by click; the fiber recipe
  presumably still holds once the editor route is mounted.
- 🔴 **`cdp click` on a Blockly toolbox category opened the wrong category** — measured at y=401,
  clicked at y=498, opened *Math*. It calls `scrollIntoView` and re-measures and the layout still
  moved. Use `ws.getToolbox().setSelectedItem(item)`, which is what the click handler calls anyway.
- ⚠️ **The call block is not a top-level block.** `hatMigration` wraps it in a `noodl_when_signal`
  with a derived id, so `getTopBlocks()` will not find it — use `getAllBlocks(false)`.
- **Never `npm run dev:stop`** — kill the `scripts/start.ts` pid. **Never `git add -A`**, never
  `git stash`. A third session's `PortsTab/`, `TraceSession.ts` and `port-values.spec.ts` are still
  uncommitted in this checkout and were untouched by all of the above.

⚠️ **`git stash list` shows `stash@{0}: WIP on cline-dev`.** Two separate lanes flagged it
independently. The standing rule is that popping a stash here crashes an editor a human is using —
**left alone, deliberately.** Someone should decide what it is before it is ever popped.

## The pattern that paid again

Every correction this session came from an instrument disagreeing with a story, and **three findings
this session were nearly filed backwards**:

- The VFN-014 "stale `generatedCode`" conclusion was clean, confident and wrong — two dead
  `editorSettings.json` files. Caught by grepping the disk for the definition id instead of trusting
  a path.
- A lane's criterion 5 was **passing vacuously** because Blockly fires events from a `setTimeout`, so
  a synchronous listener reports `[]` whatever you do.
- A lane's JSX scanner found **1** `{children}` site instead of 3 and would have concluded the
  children render once.

🔴 **A suite of absences is indistinguishable from an instrument that measured nothing.** Every
result above that is stated as a pass carries a control that was watched go red.
