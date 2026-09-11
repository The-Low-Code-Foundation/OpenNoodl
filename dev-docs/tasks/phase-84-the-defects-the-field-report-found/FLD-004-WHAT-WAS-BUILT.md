# FLD-004 — what was built

**Session 14, 2026-09-11. 🟢 BUILT, 6 of 6 ACs.** Five commits:

| commit | piece |
|---|---|
| `4bd8b77b4` | **(a)** say it out loud — the authoring diagnostic and the runtime one |
| `904957606` | **(b)** stop the `delete` — a value that is not a size abstains |
| `1b4d263aa` | **(c)** `type:` → `unit:`, alone, with the blast-radius measurement |
| `46fd16065` | **(b) again** — the shape a live wire *actually* delivers, found by driving |
| `a34d215e2` | **(a) again** — the report was correct and **never reached the node #26 is about** |

🔴 **Three of this task's own claims were wrong.** Each is recorded below with the measurement that
replaced it, because each would have shipped a different (and in one case empty) fix.

## 1. The mechanism, confirmed — and the exit nobody had written down

The three-way result #26 reported is three separate code paths, and the task file had all three
right:

- `height` **inert**: a bare number over a wire merges into the port's current unit, which defaults
  to `%`, and `layout.ts` turns a percentage on the parent's **main axis** into `flexGrow`.
- `width` **works**: the same percentage on the **cross** axis stays a real CSS length.
- `paddingTop` **works**: it is an `inputCss` port, and *that* setter coerces a bare value into the
  default unit before the branch. This is the third mechanism, and it is why the same wire behaves
  differently on two ports of the same node.

✅ **The exit is real and is now in the message**: give the port a **px value in the property panel
first**, and the wire's bare number merges into `px` instead of `%`. Both halves of the fix print it.

## 2. What the corpus says, because the rule is calibrated and not argued

202 projects — both corpora plus `templates` and `project-examples`. **78,162 connections; 413 land
on a `width`/`height`; 108 of those are on the parent's main axis**, 55 cross-axis, 250 on a node
with no parent inside its own component (unknowable, skipped). The
`maxWidth`/`minWidth`/`maxHeight`/`minHeight` family — 183 more — is **not** in the population:
`layout.ts` converts neither.

Both reports fire only on a **CONNECTED** port. Every visual node's `width` and `height` default to
`100%`, and on the main axis that default *is* how a child fills its parent, so a rule keyed on the
conversion alone would fire on almost every node in every project.

## 3. 🔴 The three wrong claims

**(i) "Every dynamically registered units port has never had bare-number merging."** *(task §2.3)*
**There are no dynamically registered units ports.** `Node.prototype.registerInput` — the function
with the typo — is reached only by dynamic registration; a library node never goes through it
(`nodedefinition.ts` assigns `node._inputs = Object.create(inputs)` and seeds `_inputValues` via
`initializeDefaultValues`, which has always written `unit`). Probing `registerInput` and enumerating
every type shape it meets, across three populations:

| population | distinct dynamic registrations | units-typed |
|---|---|---|
| `noodl-runtime` suite | 75 | **0** |
| `noodl-viewer-react` suite | 26 | **0** |
| 20-project render corpus, real Chrome | 171 | **0** |

**272 distinct, zero units-typed** — and the probe named every shape it *did* meet (`NO-TYPE` 215,
`{name:'boolean',allowEditOnly:true}` 36, `number` 6, `boolean` 4, `color` 3, `string` 3, `*` 2,
`signal` 1), so this is an absence beside a known-firing signal. `Expression` registers its dynamic
inputs with **no type at all**; `Function` takes a type-NAME string from `parameters['intype-…']`,
never the object form that carries `units`. ⚠️ **So R4's release-note line is not owed** — "wires
that were ignored now take effect" describes nothing that exists.

**(ii) "A wire carrying a non-numeric value reaches this setter with no `.value`."** *(task §2.2)*
It does not. `Node.queueInputValue`'s first-update consolidation wraps an incoming non-object in
**the unit of the value it is overwriting**, with no numeric check — so a `String` node wired to
`height` arrives as `{value: "tall", unit: "px"}`, sails past `.value !== undefined`, and is emitted
as `props.height = "tallpx"`: invalid CSS, dropped silently, authored value gone. **The same
disappearance, one shape further out.** That is a **third** copy of the unit merge
(`setInputValue`'s `isNaN` guard, the `inputCss` coercion, and this one), and the guard is placed
where they converge.

**(iii) The report was correct and unreached.** `reportMainAxisGrow` was first wired beside the one
`Layout.size` call in `react-component-node`'s render. **There are twenty-two**, and a `Group` — the
node #26 is about — sizes itself in `Group.tsx`. Every spec arm passed because every arm called the
reporter. It now lives in `layout.ts` and is called from `size()` itself.

## 4. 🔴 The lesson, and it is the one to carry

**A spec that calls the function it is grading cannot tell you whether anything else does.** Ten
arms, six mutants, all green, against a report that never fired on the node in the issue. The two
instruments that caught it were the **drive** (`WarningsModel.instance` after opening a fixture in
the real editor) and the mutant the specs could not express until they went through the caller —
*unhook the one call*, which now reddens four arms. Same family as
[[a-substring-match-cannot-tell-called-from-mentioned]]: **grade the wiring, not the function.**

## 5. AC1, driven

`demo/fld-004-fixture` — two Groups in a column parent; A with `height` unauthored and wired from a
Number of 400, B with `height` authored `120px` and wired from a String. Opened in the real editor
(`LocalProjectsModel.openProjectFromFolder` + `route({to:'editor', project})`), read back from
`WarningsModel.instance`:

```
node/box-a  [dimensions/wired-dimension-becomes-grow]  "height" is wired … became flex-grow 400 —
            a ratio against the siblings that also grow, not a height.
node/box-b  [dimensions/not-a-dimension]               "Height" was sent {"value":"tall","unit":"px"} …
node/box-b  [dimensions/wired-dimension-becomes-grow]  … flex-grow 100 …
```

**Second sentence**: with the wires removed, Box B renders `height: 120px`, 120px tall — the
authored static value comes back — and Box A returns to the declared `100%`. No errors.

⚠️ **What (b) does NOT restore, and cannot**: Box B's authored `120px` does not survive *while the
wire is live*. The consolidation replaces the authored parameter with the wired value in the same
first update, so the setter never sees `120px` — which is correct, because a connection is meant to
override a parameter. What changed is that the port falls back to its **declared default** instead
of to nothing (NDA-016's shape): before, Box B had no `height` in its style at all.

## 6. AC6 — the corpus renders identically

20 corpus projects, each arm run **twice and controlled against itself first**, two viewer bundles
from the same pipeline. **20 of 20 identical on geometry**, measured against HEAD before any of this
work and re-measured after each commit. The only field that moves anywhere is which of six racing
`starter-imagery` 404s (register **P34**) lands in a truncated evidence sample; the error **counts**
are identical, so `dimensions/not-a-dimension` fires nowhere in the corpus.

## 7. Gates

`noodl-editor` `tests-unit` **430/430 suites, 7,152/7,152**; `noodl-viewer-react` **103/103,
1,381/1,381**; `noodl-runtime` **159/160 suites (1 skipped), 2,714 passed**; `noodl-mcp` **108/111
suites, 1,560/1,564** — the two documented pre-existing reds (`def018-def020-layout-drive`,
`sbr009ThemeEditorDrive`), **re-proved against this change** with the source swapped to
`git show HEAD:` and the viewer bundle rebuilt from it (identical **3 failed / 15 passed by name**),
plus one backend-provisioning test that **passes in isolation**. `tsc --noEmit` 0 in runtime, viewer
and editor.

Mutants run: **six** on the authoring rule, **five** on the runtime reporter (including *unhook the
call*), **three** on the abstain branch, **three** on the magnitude guard, **two** on the typo —
AC3's and AC4's required reverted arms among them, each reddening and each leaving the control arm
green.

## 8. What is still open

- **#27** — *"very probably this defect wearing a different hat"* (§5). Not re-measured. A component
  input named `height` wired to a Group root's `height` passes a **bare number** into a library
  units port, so it is the *unit* half and not the typo: component-instance ports register with **no
  type at all**. Re-measure against the reporter's project before anybody builds
  `input-shadows-root-port`.
- **Promotion.** Both new codes are warnings and neither is in `AUTHORED_BLOCKING_WARNINGS`, on this
  file's standing convention. The 108-firing calibration is here when somebody wants to argue it.
