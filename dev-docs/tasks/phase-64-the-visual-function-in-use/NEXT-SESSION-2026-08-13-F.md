# Phase 64 — everything is built. This is the drive.

**Supersedes [NEXT-SESSION-2026-08-13-E.md](NEXT-SESSION-2026-08-13-E.md)**, whose phase 1 (five
build lanes) and phase 2 (merge and gate) are **done**. Its phase 3 is what remains, and this file is
that list — reconciled against `git log`, extended with the four lanes that landed after -E was
written, and with -E's still-current driving conditions carried over.

## Where the phase is

**All fourteen tasks are BUILT, spec-proved and merged into `cline-dev`.** `git branch --no-merged
cline-dev` lists no `vfn-` lane. There is no code left to write that anybody has identified.

```bash
cd packages/noodl-editor
npx jest                              # 185 suites / 2806 passing, 0 failures
npx tsc -p tsconfig.json --noEmit     # clean
npm run cloud-library:check           # up to date
```

🔴 **`--noEmit` is load-bearing and its absence is silent.** Without it `tsc` emits ~3096 `.js` /
`.js.map` files into `packages/*/src`; jest then prefers `BenchRunner.js` to `BenchRunner.ts` and
**158 of 178 suites fail to *run*** while the log prints passes and zero failures. The emitted files
are untracked, so `git status` looks unalarming. Clean-up is `git status --porcelain | grep '^??'`
filtered to `packages/.*\.(js|map)$` — **never `git clean`**, which takes the new specs with it.

## What is actually left: **one bundled drive**

🔴 **Live QA is serial across this machine.** Two editors, or an editor beside `test:ci`, manufacture
failures that look exactly like defects. One agent, in the primary checkout, one session.

⚠️ **Read the three states apart, because this phase lost track of them once and it cost a day.**
*Built* is code that exists. *Spec-proved* is a headless runner grading a decision, a string or a
geometry, with a control watched red. *Driven* is the consequence, observed in the running editor.
**VFN-004 was built, merged and spec-proved by 52 green specs, and was completely dead on screen**,
because `ComponentModel.id` was `undefined`. Nothing gets marked driven that was not.

---

## The consolidated owed list — 31 items, in descending risk

Grouped so a session can stop cleanly at a group boundary. Items marked **NEW** arrived with the
close-out lanes and are not in -E's list.

### Group 1 — surfaces nobody has ever seen (highest risk: these could simply not render)

1. **VFN-009's section renders at all.** Not one pixel of the saved-blocks manager has been on
   screen. `SavedBlocksSection` reaches `ProjectModel.instance`, `ToastLayer` and `DialogLayerModel`.
   🔴 **Does *Edit blocks* open the floating Logic Builder window while the settings panel is
   open?** The window is a canvas overlay; whether it is even visible from the settings route is a
   question only a drive answers.
2. **VFN-006's outline painting and its hover trigger.** The lane calls the trigger *"the weakest
   thing I built"* and names where it will fail: a guess about Blockly 12's menu DOM. The painting
   *is* the feature — a save preview that says "6 blocks" without showing which six is the defect.
3. **NEW — VFN-010's launcher section renders at all**, from a page that has never hosted a dialog
   of this kind. A dialog inside a dialog is ordered by `DialogLayerModel` but has not been seen.
4. **NEW — VFN-010's picker headings, screenshotted in both themes.** A `kind: 'label'` in a Blockly
   flyout has never been rendered in this editor. (VFN-012 §1's drive rendered `kind: 'label'` in a
   *dynamic category* flyout, which is adjacent evidence, not this one.)
5. **NEW — VFN-005's Park and Home.** Neither control has ever been pressed. See group 2.
6. **NEW — VFN-012 §2/§3's `Libraries & Browser` category.** Never opened.

### Group 2 — VFN-005, the placement, and it changes the geometry everything else is driven against

🔴 **Do this group early.** It moves the window and adds two title-bar buttons, so every other item's
click points depend on it. **Both `DRIVE-2026-08-13-C.md` and `-D.md` have stale coordinates.**

7. **NEW — criterion 3: `elementFromPoint` at the preview's centre, after Home.** Control first:
   drag the window over the preview and confirm the centre answers `rect.blocklyMainBackground`.
   Then press `[data-test="logic-builder-home"]` and read again — it must answer the `WEBVIEW` with
   `pointer-events: auto`. 🔴 **Read `.injectionDiv`'s width in the same breath: Home must not have
   bought clearance by shrinking the window below 640.**
8. **NEW — criterion 2: park and restore, with a workspace measurement.** Record
   `--logic-overlay-height` and `.injectionDiv`'s width/height. Press
   `[data-test="logic-builder-park"]`: `data-parked` must be `"true"`, `offsetHeight` must be the tab
   bar's, and the preview centre must answer the `WEBVIEW`. Press again: `--logic-overlay-height`
   must be **the same number** and `.injectionDiv` **non-zero and unchanged**. 🔴 That last reading
   is the **Blockly-caches-the-zero** risk and it is the only part of VFN-005 a headless runner is
   blind to. A block's on-screen position before and after is the second reading.
9. **NEW — criterion 4: a fresh profile.** Clear `logic_overlay_rect` from `localStorage`, open a
   Logic Builder tab on the default `horizontal` layout, and read the preview centre **before
   touching anything**. It must answer the `WEBVIEW`. ⚠️ The original report was measured at 74%
   because that fixture had *stored* geometry; a fresh profile is **worse**, not better.
10. **NEW — the yield, end to end.** With the window dragged over the side dock, open the App Config
    category and press *Open app settings*. The panel must be readable — `elementFromPoint` inside
    its box. **The control is the same gesture on the pre-VFN-005 placement**, where the answer is
    the window. This is DRIVE-C's finding closing itself.
11. **NEW — the title bar at 640 px** with two tabs open: the two new controls and *Done* must not
    have pushed the tab labels out. 🔴 Use **`scrollLeft`**, not `scrollWidth > clientWidth`, which
    is integer-rounded and reports a false 1 px overflow.

### Group 3 — gestures that are spec-proved and one press from being real

12. **VFN-014 criteria 1–2 — one press of *View Code***, including whether the 14 lint warnings go.
13. **VFN-007 criteria 3–4** — the radiogroup's selected state on screen in both themes, and the
    keyboard. ⚠️ `BaseDialog` renders every body twice; filter `:not([class*=MeasuringContainer])`
    and hit-test with `elementFromPoint` before clicking. This cost a previous session an hour.
14. **VFN-008 criterion 1** — save a block with a description, **quit the editor, reopen**, hover the
    call block and open the My Blocks category. The half a runner cannot reach.
15. **The ports fix, gesture 2** — drag a saved block out of the flyout into a **second** Visual
    Function and prove the port **accepts a wire**. A real drag on the canvas. 🔴 Only the *migrate*
    path is driven; the connection popup is where a dynamic port has surprised this repo before.
16. **`inert` in the running editor** — Tab into any dialog and confirm the first Tab lands on a
    visible control. An editor-wide change to a 29-consumer component.
17. **VFN-004 AC 5** — two tabs on different components, distinguishable from the labels alone.
18. **VFN-004 AC 6** — delete a component out from under an open tab: the tab and its blocks stay,
    and a **named** error toast appears. (17 and 18 both need a second Logic Builder node.)
19. **VFN-003** — the full *delete a variable in use* gesture.
20. **VFN-002 criterion 4** — the dropdowns. Never touched.

### Group 4 — VFN-011's remainder, and VFN-012's

21. **VFN-011 item 4 — criterion 7 with a preview running.** A viewer frame and a bench frame
    interleaved in one scrubber; two sources into one history, never exercised with both live.
22. **VFN-011 item 6 — the focus-preserving repaint.** Rails refresh on *every* settled Blockly
    change, so this runs constantly and is exactly the thing that measures fine and feels wrong.
23. **VFN-011 item 8 — a genuinely stale node**, for the `no-probes` strip reason. Needs a Visual
    Function whose `generatedCode` predates LGC-003 and has not been edited since; nobody has found
    one, so this may be a fixture-building job.
24. **VFN-011 item 9 — Part 1's `generatedCode` thread** end to end. Partly observed (badges carried
    values); no hop has been graded.
25. **VFN-012 §1 item 3 — the `⚠` mark's contrast on a hue-90 block.** Needs a config variable
    declared and then deleted. 🔴 **NEW: take it with §2/§3's same reading on hue 355.**
26. **VFN-012 §1 items 4–5** — the stale mark (`getText_` reads at render time; harmless direction),
    and a round trip through the runtime: declare, read in a Visual Function, run the preview.
27. **NEW — VFN-012 §2/§3: measure `Libraries & Browser` against the pane width.** 19 characters,
    four more than the next longest. 🔴 **This is exactly how VFN-011's teaching sentence was lost.**
    If it clips, **shorten the label, not the feature**.
28. **NEW — VFN-012 §2/§3, a real registered library end to end**, and `window.location.href` in the
    preview (criteria 3 and 4; only the generated string is proved). ⚠️ Also worth one look: the
    first flyout open should already say `loaded` — if a real project's first open says *"Reading
    this project's libraries…"*, the eager `refreshRegisteredLibraries()` is not landing.

### Group 5 — VFN-010's remainder, and the contrast readings a parser cannot take

29. **NEW — VFN-010 criterion 6, the half that is owed:** write a rename in the launcher, **quit
    within a second**, reopen, read the shelf. The flush is proved to exist and to be called; whether
    the bytes reach `editorSettings.json` before the process dies is only visible this way.
30. **NEW — VFN-010's remaining four:** the cross-project check against **real** v2 `components/`
    folders (the converters are graded against fixtures), the delete refusal end to end, clipboard
    import (`navigator.clipboard.readText()` in the launcher window), and the double-tab-stop caveat.
31. **NEW — the contrast readings only a running editor can take** (NOTES-contrast-sweep):
    - a **screenshot of the strip at a 640 px window** — the budget is glyph arithmetic with a ±5% band;
    - **`icon-contrast.js` against a running editor**, both themes, Logic Builder open — the source
      scan can only say nobody used the property that does nothing, not what `color` resolves to;
    - **the field editor's ring on a block**, both themes — its inner edge is proved at 3.17/3.16,
      its outer edge is over a hue and measures 1.00 (VFN-002 criterion 3's remaining half);
    - **the hollow wash composite** — 62% `bg-2` over a block body, the one mark a token arithmetic
      genuinely cannot grade;
    - 🔴 **that any of these rules win at all.** A declaration present and losing is invisible to a
      parser.

### Recorded, not owed

- **VFN-013's residual.** The deepest nested badge still overlaps 152 px² of block body and 36 px² of
  an **empty** field rect. Criterion 1 is met for readable text and not literally met for that one
  rect in the densest nesting; the layout is bounded at six candidates and there is genuinely no free
  space there. **Recorded rather than rounded up to a pass** — decide whether it is a defect, do not
  quietly re-measure it as one.

---

## Driving conditions, all of them earned

- **Fixture: `vfn64-drive`** (`NodeGX test projects/`), project name `VFN64-DRIVE-UNIQUE` —
  deliberate, because the launcher had two cards both named `lgc010-drive` and `cdp click` takes the
  first match. Component `/ErgCodes`, node `c6`.
- 🔴 **Never `npm run dev:stop`** — it kills Richard's MCP servers. `kill` the `scripts/start.ts` pid.
- 🔴 **`cdp click` takes a CSS selector, not coordinates.** Tag the element first
  (`el.setAttribute('data-drive-target','x')`), then click `[data-drive-target=x]`. **This matters
  more than it did**, because VFN-005 can move the window between two reads.
- 🔴 **`ed.selection` does not exist — it is `ed.selector._selected`.** The wrong accessor returns
  `[]`, indistinguishable from a real empty selection, and nearly filed a false failure in session D.
  Confirm a selection through a second instrument; the property panel's text says which node it is on.
- 🔴 **`cdp click` on a Blockly toolbox category opens the wrong category** — it re-measures and the
  layout still moves. Use `ws.getToolbox().setSelectedItem(item)`.
- 🔴 **Screenshots are 2× device pixels.** A CSS rect of `y=235` is pixel `y=470`.
- 🔴 **`BaseDialog` renders every dialog body twice**, and the phantom is *above* the real one:
  `innerText` double-counts and a centre click can land on the invisible copy. Filter
  `:not([class*=MeasuringContainer])`.
- ⚠️ **The launcher's open-by-path recipe does not work** — no `memoizedProps.route.router` on the
  launcher route. Drive it by click; card centres are covered by a `Chip`, so target `…__Name`.
- ⚠️ **The call block is not top-level** — `hatMigration` wraps it in a `noodl_when_signal`, so
  `getTopBlocks()` misses it. Use `getAllBlocks(false)`.
- ⚠️ **Poll, never sample once.** React has not repainted in the tick you navigated.
- ⚠️ **HMR leaves the mounted editor on the old module.** Reload after a merge.

## The standard this phase is held to

Every result stated as a pass carries **a control that was watched go red**. Not written — watched.

🔴 **A suite of absences is indistinguishable from an instrument that measured nothing.** "No
overlaps", "no events", "unchanged", "not there" — each owes the control that proves the instrument
could have seen the opposite. Session C found three findings nearly filed backwards: a clean,
confident and wrong *"stale `generatedCode`"*, a criterion passing vacuously because Blockly fires
events from a `setTimeout`, and a JSX scanner that found 1 of 3 `{children}` sites. Lane D's own
icon-host scanner missed one of the three shapes it looked for and **the self-test caught it**.

🔴 **Check the identifier before blaming the mechanism.** VFN-004 had a correct event, a correct
derivation and a correct predicate, and was dead for a day because the field they agreed on was
`undefined` on 5 of 7 components. When something "does nothing", suspect the key first.

## Housekeeping

- ⚠️ A third session's `PortsTab/`, `TraceSession.ts` and `port-values.spec.ts` are **uncommitted** in
  the primary checkout and are not ours. **Never `git add -A`.**
- ⚠️ `git stash list` shows `stash@{0}: WIP on cline-dev`, flagged by four lanes now and **left alone
  deliberately** — popping it crashes an editor a human is using. Someone should decide what it is.
- ⚠️ `MEMORY.md` is over 20 KB against a 24.4 KB read limit and needs a prune only Richard can make;
  most of the bulk is filenames, so getting under target means dropping entries, not rewording them.
