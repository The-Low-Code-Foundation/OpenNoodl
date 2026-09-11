# NOTES — VFN-007 and VFN-008, the save-block dialog

**Session:** 2026-08-13 · branch `vfn-saveblock` (worktree, forked from `cline-dev` at `76dfece7`)
**Gate:** `cd packages/noodl-editor && npx jest` — **159 suites / 2318 passing**, up from the
157/2265 baseline by exactly the two suites and 53 tests added here. `npx tsc -p tsconfig.json
--noEmit` is clean.

🔴 **Nothing in this branch has been driven — and that is still true after the merge.** No editor
was launched, no screenshot taken, no click delivered. Everything below distinguishes what a spec
proved from what still needs a drive, and the distinction is the point of the file.

⚠️ **Status at close-out, 2026-08-13:** both tasks are **merged** into `cline-dev` (VFN-007/008
`136fa3be` via `7411c265`; VFN-008's ports fix `bf4529d7` via `ad02b43c`). **VFN-008's ports fix has
since been driven** (DRIVE-C: the migrate path and the OUTPUTS rail). **Everything in *this* file —
the shelf picker and the description — is still entirely undriven.** The owed list at the foot stands
as written. Consolidated in [NEXT-SESSION-2026-08-13-F.md](NEXT-SESSION-2026-08-13-F.md).

---

## What was built

### VFN-007 — the shelf picker is no longer a native radio group

`MyBlocksSaveDialog.tsx`'s two `<input type="radio">` are gone. The picker is an ARIA
radiogroup of themed option cards:

- `myblocks/shelfChoice.ts` (new) — the two options as data (value, label, consequence note) and
  `shelfAfterKey`, the arrow/Space/Enter model. Pure, so a runner can read both.
- `MyBlocksSaveDialog.tsx` — `role="radiogroup"` / `role="radio"`, `aria-checked`, roving
  `tabIndex`, `onClick` on the whole row, `onKeyDown` through `shelfAfterKey`.
- `MyBlocksSaveDialog.module.scss` — card, chosen card, and a ring/dot mark on design-system
  tokens.

**Why cards and not a fixed `name`.** A per-instance `name` would also have worked and would have
kept native keyboard behaviour for free. It was rejected because it repaints the instance and
leaves the class: the next native radio group anyone adds inside a `BaseDialog` has the same
defect. A card owns its selected state entirely through React state — which was **correct
throughout the original bug** — so there is no second authority to disagree with it.

**What did *not* survive, and it is a real change.** The `<label>` wrapper is gone. A `<label>`
with no labelable control inside it labels nothing, so keeping the tag would have been cargo. The
property the label bought — *the whole row, including the consequence note, is the click target*
— is kept and is asserted (`clicking anywhere in the row selects it, including the consequence
note`). `DEFAULT_SCOPE` is untouched and is asserted to still be `'project'`.

### VFN-008 — the block describes itself

- **Asked for.** A `Description (optional)` field under the name, capped at
  `MAX_BLOCK_DESCRIPTION_LENGTH` (200), normalised through `normaliseBlockDescription` so blank
  is `undefined` and never `''`.
- **Stored.** Straight into the `SaveChoice.description` and `MyBlockDefinition.description` that
  already existed. No format change.
- **Shown on the block.** `setTooltip` now takes a **function**, resolved when the tooltip is
  shown rather than in `init()` where the state is still a stub. It prefers the live definition
  and falls back to the block's own `extraState`.
- **Shown in the flyout.** Each definition gets `kind: 'label'` entries above its block carrying
  the shape sentence, the description, and the variable warning.
- **Shown in the dialog.** `describeCallPreview` renders the block's actual face —
  `▣ Discount   price   rate` — under the shape card, using the same `MY_BLOCKS_BLOCK_GLYPH` the
  call block's header field renders.
- **The variable hazard.** `collectVariableReferences` (in `references.ts`) finds Blockly
  workspace variables by their `VAR` field, in both the `{id}` and bare-name spellings, and
  `describeVariableWarning` says *"This uses the variable `n`, which will not travel with the
  block."* It is shown at save time **and** in the call block's tooltip. Noodl variables
  (`noodl_get_variable` / `noodl_set_variable`) are deliberately not flagged — they are global and
  they do travel, and a false alarm on the mechanism that works is worse than no alarm.

Every sentence rendered anywhere is produced by `myblocks/saveIntent.ts` and asserted in the
plain-Node runner, which is criterion 5.

---

## ✅ FINDING — VFN-008's criterion 4 was false as written · **FIXED 2026-08-13 on `vfn-c-ports`**

> **The fix is a third route neither this note nor the task file considered: the call block states
> its definition's ports in `extraState.ports`, and `detectIO` reads them.** The workspace stays the
> single source of truth and nothing outside it is consulted.
>
> 🔴 **The route this note recommends first — plumb the definitions through to port detection —
> was rejected, and the evidence is decisive.** The project shelf *does* reach the viewer
> (`GraphModel.setSettings` carries the whole settings bag), but the **backpack** shelf lives in
> `EditorSettings` and never can. That route would publish ports for a project-scoped block and not
> for a backpack-scoped one, and **the block that produced this finding is backpack-only**, so it
> would have fixed nothing that was reported.
>
> ⚠️ **This note understated the blast radius**: `interfaceRails.ts` and `benchModel.ts` read
> `detectInterface`, the sibling projection of the same traversal, so the rails and VFN-011's bench
> were blind too.
>
> Full design note, the rejected routes, the controls watched red, and what still needs a drive:
> [`NOTES-ports.md`](NOTES-ports.md). The section below is left as it was written.

### As filed, 2026-08-13

> *"Placing a call block for a definition that sets an output gives the host node that output
> port after the next generate."*

**It does not.** Measured, and pinned by
`tests-unit/vfn-008/self-describing-block.test.ts` → *"🔴 FINDING: a placed saved block publishes
no ports"*.

The task file's reasoning is that the workspace is the single source of truth for ports and a
saved block's body is inlined at generate time. Both halves are true. The conclusion does not
follow, because **the two things happen to different copies of the workspace**:

- `updatePorts` → `detectIO(workspace)` reads the **raw** serialised workspace, the same string
  persisted as the node's `workspace` parameter;
- `expandWorkspace` runs inside `generateWithMyBlocks`, and its expanded copy is discarded the
  moment the JavaScript is generated.

`detectIO` has never heard of `myblocks_call_value` / `myblocks_call_statement`, so a call block
contributes no port mentions at all. Proved both ways in the spec:

```
detectIO(workspace containing the call block)  → outputs: []
detectIO(the same body, inlined)               → outputs: [{ name: 'total', type: '*' }]
generateWithMyBlocks(...)                      → 'Outputs["total"] = 7;\n'
```

So the **program is right and the node is deaf**: the generated code writes `Outputs["total"]`
and there is no `total` port for anyone to wire. A builder saves a block that sets an output,
drops it in another Visual Function, and the output they were promised never appears.

**Not fixed here, on purpose.** The fix is not local: `detectIO` lives in `noodl-runtime` and has
no access to the definition shelves, which live in `project.json` settings and `EditorSettings`.
Either the definitions have to be plumbed through to port detection, or the expansion has to
happen before the workspace parameter is written — and the second would destroy the property that
makes the workspace the source of truth. That is a design decision, not a patch, and it belongs
in its own task with LGC-007's constraints in front of it.

The spec asserts the **true** behaviour, with a comment saying so, so that whoever fixes it gets a
line that goes red at exactly the right moment.

## ⚠️ SECOND FINDING — `BaseDialog`'s measuring copy is tab-reachable

`.MeasuringContainer` is `pointer-events: none; height: 0; opacity: 0` — it is hidden from the
mouse and from the eye, and **not** from the keyboard. Every focusable element in every dialog in
the app therefore exists twice in the tab order, invisible copy first.

This is not new and is not mine: the Save and Cancel buttons in this very dialog have had it
since they were written. But it does mean VFN-007's criterion 4 is only half-closable — the
picker is one tab stop *within its own group*, and there are two groups.

A one-attribute fix exists — `inert` (React 19 supports the prop) or `aria-hidden` on the
measuring container — and it would close the whole class across every dialog in the editor. It is
deliberately **not** done here: `BaseDialog` is on every dialog surface in the app, three sibling
sessions are working alongside this one, and the change cannot be verified without a drive.
Recommended as its own small task with a drive attached.

---

## What is proved, and by what

### VFN-007

| Criterion | Status |
|---|---|
| 1. Reproduce | ✅ done before this session; written into the task file's top block |
| 2. Indicator ≥ 3:1 in both themes | ✅ **measured**, `tests-unit/vfn-007` — see below |
| 3. Whole row clickable, note included | 🟡 **structure proved**, delivery needs a drive |
| 4. Tab / arrows / focus | 🟡 **model and markup proved**, delivery needs a drive |
| 5. Lands on the chosen shelf | ✅ asserted against `scopeOf`, not against the toast |

**Criterion 2 is a real number, not a screenshot.** `tests-unit/support/themeTokens.ts` (new)
resolves `colors.css` for both themes — following `var()` chains through the base palette — and
computes the WCAG ratio. The pairs the stylesheet actually names:

| Pair | dark | light |
|---|---|---|
| `--theme-color-primary` on `--theme-color-bg-3` (the chosen dot and ring) | **6.45** | **3.99** |
| `--theme-color-border-control` on `--theme-color-bg-2` (the empty ring) | **3.66** | **3.43** |
| `--theme-color-primary` on `--theme-color-bg-2` (the chosen row's border) | **6.45** | **4.33** |

A separate test asserts the stylesheet still *names* those tokens, so the measurement cannot
quietly become a measurement of a rule nobody uses.

⚠️ What this instrument cannot see, and a drive still owes: composited translucency, anything a
theme overrides outside `colors.css`, and whether the indicator is painted at all rather than
covered by something. `scripts/devtools/icon-contrast.js` remains the authority on rendered
pixels — this is a source-level gate that runs on every commit, not a replacement for it.

### VFN-008

| Criterion | Status |
|---|---|
| 1. Description survives a reload, reaches tooltip and flyout | 🟡 **JSON round trip + both surfaces proved**; a real editor restart needs a drive |
| 2. No description degrades, does not blank | ✅ proved, with its negative control |
| 3. Variable warning at save time | ✅ proved (and it also reaches the tooltip) |
| 4. Ports after placement | 🔴 **FALSE AS WRITTEN — see the finding above.** The second half ("no port for internal variables") ✅ holds |
| 5. Every sentence from `saveIntent.ts`, asserted | ✅ |
| 6. Old definitions load and render with no diagnostic | ✅ |

Criterion 1's gap is specific and worth naming: the spec round-trips a saved definition through
`JSON.parse(JSON.stringify(...))` and `validateLibrary`, which is the same journey `project.json`
puts it through — but it does not restart Electron. The task file is right that a tooltip built
from an in-memory definition and one built from a definition that came off disk are different
claims. This proves the second up to the point where `ProjectModel` takes over.

---

## 🔴 The negative controls, which are the reason to believe any of it

Both new suites are largely suites of **absences** — "no native radio group", "no lost choice",
"the absence degrades" — and a suite of absences is indistinguishable from an instrument that
measured nothing. Four controls, each of which goes red on demand:

1. **`vfn-007` — the parser convicts the picker as it was.** The pre-fix JSX is pasted into the
   spec and the *same* extraction functions are run over it: they find `type="radio"`,
   `name="myblocks-shelf"` and no `role="radio"`, and the row extractor returns a non-empty
   string, so it is not passing by finding nothing.
2. **`vfn-007` — the contrast instrument scores a known-low pair below the floor.**
   `--theme-color-border-default` on `--theme-color-bg-1` returns 1.25 (dark) / 1.27 (light) —
   correctly below 3, because a decorative card edge is not an indicator. It proves the resolver
   can return a number under the floor.
3. **`vfn-007` — a token that does not exist throws** rather than scoring 0. A gate that reads a
   field its source lacks is a gate that passes forever.
4. **`vfn-008` — the tooltip as it was fails the assertions.** The old hard-coded string is run
   through the same checks: it *does* end with the propagation note (which is exactly why that
   assertion alone proves nothing), and it does not name the block, does not carry a description,
   and is byte-identical for two definitions that share nothing.

**Verified end to end**, not just asserted: the fix was temporarily reverted in the working tree
(`role="radio"` → `type="radio" name="myblocks-shelf"`, and the function tooltip → the old
hard-coded string) and the two suites went **6 failed / 47 passed**. Restored, and back to
53/53.

Also note the *positive* control hiding in `collectVariableReferences`: the "does not warn about
Noodl variables" test is an absence, and its control is the sibling test that shows the same
walker *does* return a Blockly variable from a body that has one.

---

## What still needs a drive, in the order it is worth doing

1. **Open the save dialog and click the backpack row.** The whole point. Confirm the chosen card
   paints, in both themes, and that the check now lands where the click did.
   ⚠️ **The measuring copy makes every dialog assertion double-count** — `document.body.innerText`
   reports each dialog's text twice, and every element appears twice with the phantom *above* the
   real one, so a click at a centre point can land on the wrong copy. Filter with
   `:not([class*=MeasuringContainer])` and hit-test with `elementFromPoint` before clicking. This
   cost a previous session about an hour.
2. **Tab into the picker and press the arrows.** Expect an extra, invisible tab stop first — that
   is the `BaseDialog` finding above, not a regression in this work.
3. **`scripts/devtools/icon-contrast.js` on the rendered picker**, to confirm the painted pixels
   match the token maths. The numbers above are what the source says; that tool is what the
   screen says.
4. **Save a block with a description, quit the editor, reopen it**, hover the call block and open
   the My Blocks category. This is the half of VFN-008 criterion 1 a runner cannot reach.
5. **Screenshot both themes with each option selected**, so the *difference* is in the artefact
   rather than asserted. 🔴 A screenshot alone is not the proof — the number above is.

---

## Files

**New**
- `packages/noodl-editor/src/editor/src/views/BlocklyEditor/myblocks/shelfChoice.ts`
- `packages/noodl-editor/tests-unit/support/themeTokens.ts`
- `packages/noodl-editor/tests-unit/vfn-007/shelf-picker.test.ts`
- `packages/noodl-editor/tests-unit/vfn-008/self-describing-block.test.ts`

**Changed**
- `.../BlocklyEditor/MyBlocksSaveDialog.tsx` — cards, description field, preview, variable warning
- `.../BlocklyEditor/MyBlocksSaveDialog.module.scss` — card and mark, on tokens
- `.../BlocklyEditor/MyBlocksBlocks.ts` — function tooltip, injected definition source, flyout labels
- `.../BlocklyEditor/BlocklyWorkspace.tsx` — injects the store as that definition source
- `.../BlocklyEditor/myblocks/saveIntent.ts` — every new sentence
- `.../BlocklyEditor/myblocks/references.ts` — `collectVariableReferences`
- `packages/noodl-editor/tests-unit/lgc-007/saveAsBlock.test.ts` — the flyout now emits a label
  *and* a block per definition, so the assertion finds the block rather than assuming index 0

⚠️ **`MyBlocksBlocks.ts` does not import `MyBlocksShelves`, and must not.** It is in the import
graph of the `lgc-007` specs in the plain-Node runner, and `myBlocksStore` reaches `ProjectModel`
and `EditorSettings` — one import there fails two suites *to run*, which counts as a failure and
does not look like one. The definition source is injected from `BlocklyWorkspace` instead.
