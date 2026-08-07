# QA fixtures

Projects that exist to be *measured*, not to be read as examples. They live here
rather than in `project-examples/` because they are deliberately odd — one of
them contains a node type that does not exist — and nothing should offer them to
a user as a starting point.

## `nodegx-qa-fixture`

Built 2026-07-28. It replaces **`Shine Phase 2`**, phase 25's old reference
project, which pointed into a deleted temp scratchpad and no longer opens.

### Why it had to exist

Gate runs were coming back green *without proving anything*. `components-tree`
reported **11 SKIPs**, and the two best projects available could not do better:
`VerifyFix4` (2 components, depth 1) and `Agent Chat Example` (7 components,
depth 1). A skip is not a pass, and one of these produced something worse than a
skip — see *the meaningless green* below.

### What it carries, and which assertion each thing is for

| Feature | Where | Serves |
|---|---|---|
| Four-level nesting | `/Library/Widgets/Controls/…` | PNL-006 **assertion B** (indent guides), which wants 4 levels |
| An unresolved node type | `Markdown` in `/Content/Release Notes`, `/Content/Changelog` | PNL-006 **assertion D** — the warning dot's *rendered* behaviour |
| A 79-character leaf name | `/Library/Widgets/Controls/Secondary Action Button With A…` | PNL-006 **assertion C** (ellipsis at 240px) |
| 28 rows when expanded | 7 folders + 21 components | the tree must actually scroll |
| Five uncategorised components | `/Logic/*`, `/Content/*` | PNL-006 **assertion E** — see below |
| A Router with 3 pages | `App` | UIX-011 **row 7** (`File` / `FileFill`, filled = start page) |
| Four text styles, all referenced | `metadata.styles.text` | UIX-011 **row 8** (`Sliders`) |
| A variant + a visual state | `Card Surface` on `/Library/Widgets/Cards/Product Card` | UIX-011 **rows 3, 4, 5** (`Reset`, `CaretDownUp`) |
| A Query/Filter pair | `DbCollection2` + `FilterDBModels` in `/#__page__/Catalog` | UIX-011 **row 6** (`Trash`) — *see preconditions* |
| A **signal** connection | `Text.onClick` → `RouterNavigate.navigate` in `/#__page__/Home` | UIX-011 **row 9** (`Lightning` beside signal ports only) |
| A **data** connection | `DbCollection2.items` → `FilterDBModels.items` | UIX-011 **row 10** (`Pin`/`PinFill`) — the one to enable inspect on |
| Pages, groups and text | throughout | UIX-011 **rows 1, 2** (box-model tabs, reset dot) |

### ⚠️ The meaningless green this fixture exists to prevent

PNL-006's `GLYPH_CONTRAST_EXEMPT` branch only executes when a component's
category resolves to `default`. `Agent Chat Example` has only `visual` and `home`
glyphs, so a gate run against it reported the exemption path green **without ever
running it**.

A component is `default` when **no root node has `allowAsChild`** — that is
`ComponentModel.color`'s rule. The `/Logic/*` components are built from
`JavaScriptFunction` and `Expression` roots for exactly this reason. If you edit
them, keep every root non-visual, or the assertion silently stops being tested.

Always check the gate report's `measured` block to confirm the thing under test
was present.

### Preconditions this fixture does **not** remove

- **UIX-011 row 6 (query rule popup)** needs a backend with a class schema. The
  visual query editor builds its rules from `QueryRecordsAdapter` and the
  selected class — the node is here, the schema cannot be. Connect a backend, or
  the row stays unproven.
- **UIX-011 row 10 (inspect)** needs the preview running: inspect is a live
  debug-inspector interaction and is not persisted in `project.json`. The fixture
  supplies the data connection to enable it on.
- **UIX-011 row 11 (lesson checkmarks)** is **not covered.** It needs a lesson,
  and phase 17 (Learn) is deferred except LEARN-006 pilots. This remains the
  flagged highest-risk row and has still never been seen.

### Regenerating

`project.json` is generated, not hand-edited:

```sh
python3 dev-docs/qa-fixtures/generate.py     # rewrites nodegx-qa-fixture/project.json
python3 dev-docs/qa-fixtures/verify.py       # asserts every property above
```

Ids are `uuid5` of stable labels, so regeneration is byte-identical and a real
change shows up as a real diff. `verify.py` mirrors the editor's own derivations
(`addComponentToFolderStructure`, `componentKind.categoryFor`,
`ComponentModel.color`) — it caught a dangling `Button Label` text-style
reference on the first run.

Both are checked with the repo's semantic validator:

```sh
npm run validate:project -- dev-docs/qa-fixtures/nodegx-qa-fixture
# 0 error(s), 2 warning(s) — both warnings are the deliberate Markdown nodes
```

**The two warnings are the point.** If that count changes, something else broke.

### What it caught on its first real run (2026-07-28)

`components-tree` went from **11 SKIPs to 1**, and assertion D — the warning dot —
failed to be provable for a second reason once it finally had a project carrying a
warning: the dot was **broken**. The top bar counted the two `Markdown` nodes and
the tree rendered zero dots, because `warningCountFor` passed `excludeGlobal: true`
and every health warning sets `showGlobally`. Fixed as **F62**; see phase 25's
PROGRESS. This is the point of the fixture — the SKIPs had been hiding a feature
that never worked.

The surviving SKIP is now a *measurement*, not an unknown: at `--height 520` the
tree scrolls and reports p95 frame 17.5ms over 28 rows against a 16.7ms budget.

### ⚠️ The committed shape is not the shape the editor writes

`generate.py` emits `ports`, `visual` and `visualStateTransitions` on every
component, plus a top-level `rootComponent`. **`ProjectModel.toJSON()` writes none
of them** — it writes `rootNodeId`. So the first time the editor opens this
project it strips all four, and `project.json` gets one large one-time diff.

`verify.py` did not catch it because it mirrors the editor's *derivations*
(`addComponentToFolderStructure`, `componentKind.categoryFor`,
`ComponentModel.color`) and not its *serialisation*. Either regenerate to the
canonical shape or expect that first diff; do not read it as corruption.

### ⚠️ Opening it rewrites it

Opening any tracked project rewrites `project.json` on open *and* on shutdown.
That is now much less destructive than it was — `filesystem.writeJson` indents
its output as of 2026-07-28, so a save no longer collapses the file to one line —
but key order and derived fields still move. **Check `git status` before every
commit**, and `git checkout --` this file if a gate run dirtied it.

---

## `generate-erg004.py` — the ERG-004 change-detection project

Written 2026-08-02 for ERG-004's live QA (phase 35). Unlike `nodegx-qa-fixture`
this one is **not committed as a project directory** — the generator is the
artefact, and it writes to
`~/vscode_projects/NodeGX test projects/erg004-qa`, outside the repo. Run it, add
the directory to `~/Library/Application Support/NodeGX/recently_opened_project.json`
if it is not already there, and **restart the app** — the launcher reads that
file only at start.

### What it is for

Driving `Object Changed` and `Array Changed` in a real viewer with a real frame
clock, which `renderToStaticMarkup` cannot provide. It carries:

| Feature | Serves |
|---|---|
| A labelled readout row per value port (`OC key: …`) | Reading a value by DOM position produced one confident wrong conclusion. The label travels with the value |
| A `Counter` per signal port | The values tell you *what* a signal carried; only a count tells you **which** signal fired, and that a sort fires none |
| Both nodes wired **twice** — from live values and from `Id` strings | The by-id half is the measurement, and is deliberately mis-wired |
| A `Script` node publishing `Noodl.Object.get(id)` / `Noodl.Array.get(id)` | Today this is the **only** way to feed either node — see ERG-004-NOTES §7.4 |

Mutations are driven from outside over CDP against the same ids, so nothing
depends on clicking a button:

```bash
npm run cdp -- eval "Noodl.Object.get('qa-obj').set('name','alpha')" --target=viewer
```

### ⚠️ Two nodes in it are wrong on purpose

`OC by id` and `AC by id` raise `invalid-object` / `invalid-array`. **Delete them
before using this project to judge a clean-Problems-panel criterion** — with them
gone the panel is empty.

### ⚠️ A hand-authored `Script` node needs its `dynamicports` on disk

The runtime registers a Script node's outputs from `this.model.outputPorts` — what
the *exported graph* carries — not from the ports its own parser derives from the
code. With `"dynamicports": []` the node parses fine, runs `setup` fine, and
throws *"Node Javascript2 doesn't have a port named obj"* the moment `setup`
touches an output. The generator writes them; the editor writes them back on save.

### ⚠️ Regenerate before every run

The same "opening it rewrites it" hazard as above, and here it bites harder
because the project is hand-authored: after a live deletion test the autosaved
file had genuinely lost the deleted node, and the next run measured a dead half
of the graph that briefly read as a regression. Re-run the generator each time.

---

## `generate-erg005.py` — the ERG-005 §0 component-interface project

Written 2026-08-02 for ERG-005 §0 (phase 35). Like `generate-erg004.py` the
generator is the artefact; it writes to
`~/vscode_projects/NodeGX test projects/erg005-qa`, outside the repo.

### What it is for

Measuring how a `Component Input`'s / `Component Output`'s type is **derived**
from what it connects to inside the component. None of §0's five questions can
be answered by adding one connection — they need a *sequence* of edits with a
reading after each. So the project ships the nodes and the ports and
**deliberately no connections**; the measurement wires and unwires them live over
CDP and reads `ComponentModel.getPorts()` after every step.

| Feature | Serves |
|---|---|
| `/Probe` — a `Component Inputs` node with 6 ports, a `Component Outputs` node with 4, all type `*` | the state the Port Editor leaves a freshly-created port in |
| Typed sinks: `String`, `Number`, `Boolean`, plus a second `String` | "two connections of the same type" has to be distinguishable from "two of different types" |
| Typed sources: `String.savedValue`, `Number.savedValue` | the output side of the same rule |
| A `Text` node with a `font`-typed input | the only easy way to build a pair with **no** common typecast, which is what returns `*` |
| `/App`, visual, with an instance of `/Probe` | the *outer* contract, read from the instance — a different code path from the model call, and the one an author actually sees |

Results, and the four traps driving it cost, are in
`dev-docs/tasks/phase-35-authoring-ergonomics/ERG-005-COMPONENT-INTERFACE.md` §0.

### ⚠️ Regenerate before every run

Same hazard as `erg004-qa`, and worse here because the project is mutated live by
design: after a measurement the file on disk carries whatever the last wiring step
left behind. Re-run the generator each time.

### ⚠️ A hand-authored component port's `plug` is the direction *inside*

`Component Inputs` ports are `plug: 'output'` and `Component Outputs` ports are
`plug: 'input'` — the opposite of what they become on the instance. Copy the shape
`componentports.tsx:286-293` creates: `{name, plug, type: {name:'*'}, group, index}`.
