# PLAT-005 NOTES — Editor UX Loose Ends

Status: the three items the orchestrator scoped are **done in code and covered by specs** —
variant persistence (§2), suggestion quality (§3), the dashboard-routing bug (§4). None of the
three has been seen working in a running editor; §6 lists exactly what a human has to click, and
that list is the honest remainder of this task.

The spec's own history is the theme here. Its headline premise was stale, the 2026-07-24 re-scope
note that corrected it was *also* partly stale, and the one existing spec that named the analyzer's
worst false positive asserted the opposite of its own title. Everything below was verified against
the code before being acted on; §1 records where the documents were wrong.

## 1. Where the spec was wrong

| Claim | Where | Reality |
|---|---|---|
| "the STYLE-005 banner is not wired into the property panel" | Spec body, Current State table | Stale, and the re-scope note already said so. `propertyeditor.ts:144` mounts `ElementStyleSectionHost`. |
| "`ElementConfigRegistry` has no `addVariant`" | 2026-07-24 re-scope note | True of `ElementConfigRegistry`, but it led the note to the wrong fix. `ProjectModel.addVariant` exists (`projectmodel.ts:1165`) and **that** is the real variant system — see §2. |
| "implement variant persistence (`ElementConfigRegistry.addVariant` …)" | Scope, In Scope item 1 | Would not have worked. `ElementConfigRegistry` is a module-level `Map` filled at import time from four hardcoded files; nothing it holds is written to the project, so an `addVariant` on it could not persist anything. Corrected in the spec. |
| "0px … currently flagged. This is expected." | `tests/models/StyleAnalyzer.test.ts`, in a spec **titled** *does NOT flag zero* | The spec asserted `toHaveSize(1)` under a title promising the opposite, with a comment deferring the fix. Flipped — see §3. |
| Cause of the routing bug = "Phase 3 TASK-001B (Electron store migration)" | phase-0 PROGRESS.md, and both phase-3 issue docs | Wrong in all three, propagated by copying. Actual cause in §4. |

## 2. Variant persistence — the real bug

### 2.1 What it did

`SuggestionActionHandler.applyVariantAction()` was, in full:

```ts
node.setParameter('_variant', vc.suggestedVariantName);
```

under a doc comment claiming it "saves a node's custom overrides as a named variant on its element
config". It did not save anything.

`_variant` is a marker parameter belonging to the STYLE-002 `ElementConfigRegistry` — read back by
`propertyeditor.renderElementStyleSection()` (line 127) to preselect an entry in a picker whose
options come from `ElementConfigRegistry.getVariantNames()`, i.e. from four hardcoded config files.
Writing a name into it therefore produced:

- a variant picker displaying a value that is not one of its own options;
- the node's overrides still sitting inline on the node, unchanged;
- nothing whatsoever after a restart, because `_variant` is the only thing that was written and the
  variant it names has never existed.

There are two unrelated things called "variant" in this codebase and the stub picked the one that
cannot persist.

### 2.2 What it does now

The other one — `ProjectModel.variants` / `VariantModel` — is the real, serialised system, created
via `NodeGraphNode.createNewVariant` and surfaced by the property panel's Variants editor. Its
semantics are exactly what the suggestion promises: copy the node's parameters onto a named
variant, then clear them from the node so the node inherits them.

`applyVariantAction` now calls `node.createNewVariant(name, { undo: true })`, and:

- **uniquifies the name first.** `ProjectModel.createNewVariant` returns early and silently when a
  variant of that name already exists for the type, so an un-uniquified name makes the second
  "Save as Variant" a no-op with a success return. `uniqueVariantName()` appends `-2`, `-3`, …
- **verifies afterwards.** `createNewVariant` bails silently on several paths (node not attached to
  a project among them). The handler now confirms with `project.findVariant()` before returning
  `true`. Reporting an unverified success is how the original stub survived this long.

### 2.3 A second bug found underneath it

`NodeGraphNode.createNewVariant`'s own undo entry was broken, and had been since it was written:

```ts
undo: () => { project.deleteVariant(variantName, type); … }
```

`ProjectModel.deleteVariant(variant)` locates its target with `findIndex(v => v === variant)` — an
identity check against the variant **object**. A name string never matches, so undo left an orphan
variant in the project. Redo was broken as a consequence: it called `createNewVariant` again, which
hit the "already exists" early return and did nothing.

Both fixed. Redo no longer routes back through `createNewVariant` either — that built a fresh
`VariantModel` each time, stranding the object the undo closure holds; it now re-adds the same
object. This affects the existing Variants editor UI as well as the suggestion path.

### 2.4 Token application was not undoable either

Not in the task text, but the success criterion "applying a suggestion is undoable" covers it and it
was false for the other two suggestion types. `applyTokenAction` called `setToken` without
`{ undo: true }` and `setParameter` with no `args` at all, so accepting a suggestion that rewrote
thirty parameters across a project was a one-way door.

It now builds one `UndoActionGroup` covering the token write *and* every rewrite, and pushes it
once — one Ctrl+Z reverses the whole accept, not one parameter of it. If nothing could be rewritten
(a stale suggestion), the group is rolled back rather than leaving an orphan token and an empty
undo entry.

## 3. Suggestion-quality verdict

**Verdict: the detector was sound in outline and noisy in practice.** The thresholds and the
var()-skipping were right; four defects between them meant a live project would surface suggestions
that were false, unhelpful, or actively harmful to accept. All four are fixed. The banner is live,
so each of these was already on screen.

| # | Defect | Why it matters | Fix |
|---|---|---|---|
| 1 | **Token-name collisions.** `suggestTokenName` *deleted* every char outside `[A-Za-z0-9-]`, so `1.5rem` and `15rem` both became `--spacing-15rem`; `50%` and `50` both became `--spacing-50`. | Two suggestions sharing a name: accepting the second overwrites the first token's value underneath the nodes already pointing at it. Silent corruption. | Separators are mapped, not dropped (`.` → `-`, `%` → `pct`). |
| 2 | **`count` was occurrences, not elements.** The banner said "16px is used in 4 elements" for *one* node with four matching paddings, and a single node could trip a threshold meant to need three. | A false statement in the UI, and the commonest source of spacing noise. | `count` = distinct nodes; occurrences kept as `occurrences`. |
| 3 | **Zero and unitless numbers were tokenisable.** `marginTop: 0` on three nodes was a suggestion. Noodl stores many parameters as numbers and `scanNode` stringifies them, so `borderWidth: 1` arrived as `"1"`. | `--spacing-0px` is meaningless; rewriting every zero in a project to `var(--spacing-0px)` is a net loss. Worse, accepting the unitless case writes the *string* `var(--spacing-1)` into a port expecting a number. | New `isTokenisableSpacingValue()`. |
| 4 | **Every variant candidate was named `custom`.** `suggestVariantName` returned the literal `'custom'` whenever `backgroundColor` was raw — which is most candidates, a raw background being the commonest way to reach three overrides. | Five over-styled buttons → five suggestions all named `custom`. First accept created it; every later accept hit the silent "already exists" return. | Derived from the node's label, falling back to the last segment of its typename; §2.2's uniquifier is the backstop. |

Defect 3's fix is deliberately a **separate predicate**, not a narrowing of `isRawSpacingValue`.
That function is also used by the AI authoring loop's `styleLint.countStyleValues` to measure
raw-vs-on-system rate (AIX-002's A/B primitive), where the broad question — "is this a literal?" —
is the right one. Narrowing it in place would have silently moved that measurement. A spec pins
this so the next person does not merge them.

### 3.1 Known limitations, not fixed

- **Cross-property bucketing.** Values are bucketed by literal alone, so `fontSize: 16px`,
  `paddingTop: 16px` and `borderRadius: 16px` are one suggestion, and accepting it rewrites all
  three to the same `var(--spacing-16px)`. Defensible as a spacing scale, wrong as type scale ∪
  radius scale. Splitting the buckets changes the `RepeatedValue` shape and is a judgement call
  better made looking at a real project.
- **`width`/`height`/`min*`/`max*` live in `SPACING_PROPERTIES`,** so a repeated card width is
  offered as a "spacing" token. Plausible enough to leave, wrong enough to record.
- **`rgb(59,130,246)` and `rgb(59, 130, 246)`** are distinct values that still map to one token
  name. Harmless — they are the same colour — but it is the residue of defect 1.

## 4. The dashboard-routing bug

**It still reproduced. It is fixed.** Full write-up in
`dev-docs/tasks/phase-3-editor-ux-overhaul/TASK-001B-launcher-fixes/ISSUE-routing-error.md`, now
closed; the companion `INVESTIGATE-routing-error.md` is marked superseded because every hypothesis
in it is wrong.

Short version: the editor has no URL router — `router.tsx` is a two-state machine that never touches
`window.location`. The renderer is loaded off disk (`win.loadURL('file:///' + appPath + …)`), so
`window.location` is a host-less `file:` URL. `Launcher.tsx` assigned
`url.pathname = '/dashboard/<tab>'` to it on every tab change, which yields literally
`file:///dashboard/projects`, and pushed that into session history with `replaceState`. The *next*
reload asked the filesystem root for it. Introduced by `73b5a42` (2025-12-31), untouched through six
later commits to the file.

Guarded rather than deleted — under a real http(s) origin (Storybook, hosted preview) the write is
harmless. Nothing depended on it: `usePersistentTab` already persists the tab in localStorage.

Three documents had carried the same wrong attribution ("TASK-001B, Electron store migration") for
six months, each copying the last. Nobody had opened `Launcher.tsx`.

## 5. Verification

`packages/noodl-editor` — `npm run test:ci` (webpack + Electron/Jasmine; **not** plain jest).

**41 new specs**, all passing:

| File | Specs | Covers |
|---|---|---|
| `tests/services/SuggestionActionHandler.test.ts` | 14 | §2 — variant actually created, overrides moved, `_variant` no longer written, one-step undo, uniquification, token undo, stale-suggestion rollback. This file had **no specs at all** before. |
| `tests/services/StyleAnalyzerQuality.test.ts` | 22 | §3 — all four defects, plus fixtures asserting the filters are not a blanket mute. |
| `tests/launcher/deeplink-url.test.ts` | 5 | §4 — the guard, and the `file:` URL behaviour that caused it, as executable documentation. |

Plus one existing spec corrected (`tests/models/StyleAnalyzer.test.ts`, the zero case in §1).

### 5.1 Trap: the base commit does not compile

`npm run test:ci` **cannot pass at cline-dev tip `7779cd6`**, before any of this work. The live
NodePicker session's `NodeLibrary.tsx` and `tests/nodepicker/NodePickerReducer.test.ts` import six
modules that do not exist in the commit (`components/NodePickerCategory`, `NodePickerSection`,
`NodePicker.selectors`, …). Those files are in PLAT-005's do-not-touch list, so the breakage is left
alone — but it means the full suite could not be the gate.

Worked around with a temporary scoped webpack entry pulling in `services`, `models`, `ai`,
`launcher` and the reachable `nodegraph` specs, skipping the barrels that reach NodePicker
(`nodegraph/propertyeditor.js` gets there via propertyeditor → NodeGraphContext → nodegrapheditor →
InteractionController → createnewnodepanel → NodePicker). Both temporary files were deleted before
committing.

**Result: 474 specs, 2 failures.** Both failures are in `tests/nodegraph/export.js` and are
**pre-existing** — verified by stashing every source change and re-running the same two specs
against pristine `7779cd6`, where they fail identically:

```
FAILED: export tests can export an index that includes pages and for each nodes
FAILED: export tests calculated dependencies for bundles
```

Not investigated further; unrelated to this task, and unowned as far as these notes can tell.

### 5.2 Trap: a required field breaks other sessions' specs

Adding `occurrences` to `RepeatedValue` as a required property broke every hand-built
`RepeatedValue` literal in the existing specs — including `tests/ai/authoring-style.test.ts`, which
a parallel session owns. Made optional instead. `analyzeNodes` always populates it; nobody else has
to be edited.

## 6. Live QA owed — the exact click-through

Nothing below has been done. PLAT-005 ran from a git worktree, and `lerna exec` runs from the main
checkout, so driving the editor from here would have driven the wrong tree.

**A. Variant persistence (§2) — the important one.**

1. Open any project. Add a Button; set `backgroundColor`, `color` and `borderRadius` to raw values
   (not tokens) in the property panel.
2. The suggestion banner should appear under the style controls: *"This button has 3 custom values.
   Save as a reusable variant?"* Click **Save as Variant**.
3. Check the property panel's **Variants** section: a variant named `<label>-custom` (e.g.
   `sign-up-custom`, or `button-custom` if the Button is unlabelled) should now exist and be
   selected on the node.
4. Confirm the three parameters are no longer set *on the node* — they should read as inherited
   from the variant, not as local overrides.
5. **Ctrl+Z once.** The variant should disappear from the Variants list and the three raw values
   should be back on the node. (This is the §2.3 fix; before it, undo left an orphan variant.)
6. **Ctrl+Shift+Z** to redo, then **save, close and reopen the project.** The variant must still be
   there — that is the whole point, and the only step that proves persistence.
7. Repeat steps 1–2 on a *second* identically-labelled Button. The second variant must be created
   as `…-custom-2`, not silently skipped.

**B. Token suggestions (§2.4, §3).**

8. Give three different Groups the same raw `backgroundColor`. Accept the *"used in 3 elements"*
   suggestion; confirm the wording says **3**, not a larger occurrence count.
9. All three nodes should now read `var(--color-…)`, and the token should appear in the design-token
   panel.
10. **Ctrl+Z once** must reverse all three rewrites *and* remove the token together.
11. Set `marginTop: 0` on three nodes and confirm **no** suggestion appears (§3 defect 3).

**C. Dashboard routing (§4).**

12. `npm run clean:all && npm run dev`. In the launcher, click through Projects / Learn / Templates.
13. Reload the window (Cmd+R). It must reload the launcher; the console must **not** contain
    `Failed to load URL: file:///dashboard/... ERR_FILE_NOT_FOUND`.
14. Confirm the tab you were on is still selected after the reload (localStorage, not the URL).

**D. Regression surface.** The property panel is used constantly and §2.3 changed
`NodeGraphNode.createNewVariant`, which the *existing* Variants editor also uses. Create and undo a
variant through the normal Variants UI (not the banner) and confirm it behaves as before.

## 7. Deliberately not done

- **CLEANUP-000H migration-wizard polish** and the **phase-3/phase-0 UX triage** — explicitly cut by
  the orchestrator. Phases 23/24 (UIX/PAR) have been reworking editor chrome since that list was
  written, so several items are likely already fixed and chasing them would be chasing ghosts.
- **The `_variant` / `ElementConfigRegistry` system itself.** Now that the suggestion path uses real
  variants, the editor has two variant concepts sitting side by side in the same panel — the
  hardcoded element-config presets and the real project variants. That is confusing and worth
  reconciling, but it is a design decision, not a bug fix, and it is not this task's.
- **The two pre-existing `export` spec failures** (§5.1) and the **NodePicker compile breakage**
  (§5.1) — both outside this task's boundary.

---

## 8. Live QA — what was run, 2026-07-27

The §6 click-through was attempted against a real editor (`npm run dev:debug`, driven over
CDP). **Part C passes in full. Parts A, B and D are still owed**, and the reason is worth
recording because it is not "ran out of time" — it is that §6's script assumes a human
clicking, and the substitute for that does not drive the code under test.

### 8.1 Part C — dashboard routing (steps 12–14): **PASS**

| Step | Result |
|---|---|
| 12. Click Projects / Learn / Templates | `location.href` stays `file:///…/editor/index.html` throughout. Nothing writes `/dashboard/…` into the URL — the §4 fix holds |
| 13. Reload | Lands on the launcher. **No `ERR_FILE_NOT_FOUND`, no `Failed to load URL`** in `.logs/dev.log` after the reload point |
| 14. Tab survives the reload | `localStorage['noodl-launcher-active-tab'] === 'templates'`, and the Templates tab renders selected. Screenshot confirms the underline is on Templates, not a default |

### 8.2 Persistence of node parameters: **PASS** (the mechanism behind step 6)

A Button created with `backgroundColor: #3B5BFF`, `color: #FFFFFF`, `borderRadius: 7px`
survived save → close → reopen with all three values intact. That is the save/reopen half
of step 6 proven, on ordinary parameters. It is **not** the variant half, which is what §2's
fix is actually about.

### 8.3 Parts A and B — blocked, and on what

The suggestion banner never rendered, and the run could not establish why. Three candidate
causes were separated as far as scripting allows:

1. **Programmatic selection does not mount the style section.** `__nodeGraphEditor.selector.select([view])`
   selects the node on the canvas, but after a fresh editor load it left
   `[class*=SizePicker]` and `[class*=VariantSelector]` absent from the DOM — so
   `ElementStyleSectionHost`, which is what renders the banner, was never mounted. The
   property editor listens for something the selector alone does not emit. **A future run
   needs real trusted clicks on the node's canvas rectangle**, via
   `Input.dispatchMouseEvent`, not the selector API.
2. **The analyzer only ever runs once per React root, and the root is deliberately
   reused.** `useStyleSuggestions` calls `refresh()` in a `useEffect` with a stable
   dependency — i.e. on mount only — while `propertyeditor.ts`'s `renderElementStyleSection`
   documents itself as *"Safe to call multiple times — reuses the existing React root"*.
   Together those mean the banner cannot appear in response to edits made while the panel
   is open: an author who types three raw values sees nothing until the root is torn down.
   This was observed (setting three values with the panel open produced no banner, and
   re-selecting did not change that) but **not** isolated from cause 1, so it is a strong
   suspicion rather than a confirmed defect.
3. **The analyzer itself is not the problem.** `tests/services/StyleAnalyzer.test.ts` and
   `StyleAnalyzerQuality.test.ts` carry 45 specs between them, including variant-candidate
   cases asserting `overrideCount: 4`, and all of them pass in `npm run test:ci`
   (1573 specs / 0 failures). The rule that §6 step 1 exercises — three raw values on a
   Button, `backgroundColor` and `color` from `COLOR_PROPERTIES`, `borderRadius` from
   `SPACING_PROPERTIES`, against `variantCandidateMinOverrides: 3` — is covered and green.

So the risk that remains is **entirely in the wiring between the analyzer and the panel**,
which is exactly the part unit tests cannot reach. Steps 1–11 and part D are still owed and
should be run by hand, or by a script that clicks the canvas the way a user does.

### 8.4 A side benefit: PLAT-006's live pass

This session doubles as the live editor pass PLAT-006 owed. The whole run was against a
runtime whose entry point, `model`, `collection`, `cloudfile` and `configservice` had just
been converted to TypeScript, with the react viewer resolving declarations rather than
sources. Across launcher render, project open, canvas paint, node creation, parameter
writes, save, a full window reload and reopen: **zero `renderer:exception` lines in
`.logs/dev.log`**, and the preview webview attached normally.
