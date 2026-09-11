# LGC-006 — eleven things we specced by hand that are already on npm

**Status:** 🔬 **verdict done 2026-08-12, adoption deferred** · **Track: adopt over build** · de-scopes two
tasks and **re-scopes LGC-007 upward**

## Why this is second in the order

Three tasks in this phase describe behaviour that Google already publishes as official plugins. Doing
this early **shrinks LGC-003 and LGC-004** rather than duplicating them, and one of them
(`disable-top-blocks`) turned out to deliver half of LGC-003 §2 for *less* than a config line — see
the row. It also **grows LGC-007**, which is the finding that mattered most.

We are on **`blockly: ^12.3.1`** ([`packages/noodl-editor/package.json:132`](../../../packages/noodl-editor/package.json)),
with `12.3.1` resolved on disk. Blockly's own `latest` is now **13.2.1**.

## What "verified" means in this file, said once

Every row below was checked in **three** places: the npm registry (versions, peer ranges, sizes, read
2026-08-12), the **plugin's own published source** (each blockly-12 tarball downloaded and read — not
the README), and **our source** (`BlocklyEditor/*`). Where the plugin's README and its source
disagreed, the source is what is written down, and three rows changed meaning as a result.

⚠️ **No plugin was installed and no plugin was run.** The acceptance criterion asks for *"one sentence
on what it actually did in our workspace"* and **this session cannot meet that bar** — the adoption
half is deferred for the reason in the last section. Rows are therefore marked **verified (static)**:
the claim about the plugin's code is sourced and precise, the claim about its *rendered* behaviour is
not made at all. Rows whose remaining risk is visual or interactional are marked
**needs-a-drive-to-decide** and say what the drive has to answer.

## 🔴 Three of the thirteen package names in the original table do not exist

`@blockly/cross-tab-copy-paste`, `@blockly/workspace-search` and `@blockly/strict-connection-checker`
all **404 on the registry**. The real names carry a `plugin-` prefix:

| written as | actually published as |
|---|---|
| `@blockly/cross-tab-copy-paste` | **`@blockly/plugin-cross-tab-copy-paste`** |
| `@blockly/workspace-search` | **`@blockly/plugin-workspace-search`** |
| `@blockly/strict-connection-checker` | **`@blockly/plugin-strict-connection-checker`** |

The other ten are correct as written. Anyone who had typed the table into `npm install` would have got
a 404 and had no way to tell it from a package that was never published.

## 🔴 Every plugin's `latest` has left Blockly 12 behind

The whole `@blockly/*` family re-based onto a **synchronised `13.x` version line** that peer-deps
`blockly: ^13.1.0` and then `^13.2.0`. There is no `@blockly/*` release newer than that which supports
Blockly 12. **Installing any of these by name today pulls a plugin that peer-deps a Blockly we do not
have.** Each row below therefore names the **last blockly-12 version**, and adoption pins it exactly.

This is a standing cost, not a one-off: the 12-compatible lines are frozen at their final patch and
will not get fixes. Upgrading to Blockly 13 is a separate decision with its own migration; **it is not
a prerequisite for any row here**, and it should not be smuggled in as one.

## The sweep

`gz` is the plugin's published `dist/*.js` gzipped at -9 — an **over**estimate of the marginal chunk
cost, because webpack minifies before compressing. For scale, Blockly core + blocks + the JS generator
is **218 KB gz** on the same measurement.

| Plugin | pin for Blockly 12 | gz | State | Verdict |
|---|---|---|---|---|
| `@blockly/block-shareable-procedures` | `6.0.12` | 6.8 K | ✅ verified (static) — **and it is not what LGC-007 thinks it is** | **adopt, for a different job** |
| `@blockly/workspace-backpack` | `7.0.11` | 6.4 K | ✅ verified (static) — it is a UI, not a store | **adopt, with `skipSerializerRegistration`** |
| `@blockly/plugin-cross-tab-copy-paste` | `8.0.8` | 2.0 K | ✅ verified (static); premise unchecked | **needs a drive** |
| `@blockly/disable-top-blocks` | `0.6.9` | 0.8 K | ✅ verified (static) — **the row's description was wrong** | **adopt — and take the free half first** |
| `@blockly/toolbox-search` | `3.1.9` | 1.7 K | ✅ verified (static); indexes our blocks correctly | **adopt** |
| `@blockly/continuous-toolbox` | `7.0.9` | 3.5 K | ✅ verified (static); replaces 5 registry entries | **needs a drive** |
| `@blockly/suggested-blocks` | `6.0.10` | 1.3 K | ✅ verified (static) | **reject** |
| `@blockly/block-plus-minus` | `9.0.10` | 4.1 K | ✅ verified (static) — **collides with shareable-procedures** | **adopt 3 of its 4 files** |
| `@blockly/workspace-minimap` | `0.3.9` | 2.9 K | ✅ verified (static) — **fails the theme flip as written** | **adopt via a subclass** |
| `@blockly/plugin-workspace-search` | `10.1.8` | 3.1 K | ✅ verified (static) — **two hardcoded-colour defects** | **adopt with a stylesheet override** |
| `@blockly/zoom-to-fit` | `7.0.9` | 1.9 K | ✅ verified (static) | **adopt** |
| `@blockly/theme-deuteranopia` · `-tritanopia` · `-highcontrast` | `7.0.4` | 1.0 K ea | ✅ verified (static) — **they will half-apply** | **blocked on our code, not theirs** |

**Total if everything recommended is taken: ~30 KB gz**, i.e. **~14 % on top of the 218 KB Blockly
chunk**. L17 said measure, do not assume. Measured: the weight is not the argument against any row
here. The arguments against rows here are behavioural, and they are below.

---

## The two flagships, in depth — this is LGC-007's first deliverable

### `@blockly/block-shareable-procedures` — real, useful, **and not the thing LGC-007 needs**

Pin **`6.0.12`** (`peerDependencies: { blockly: "^12.0.0" }`). 6.8 KB gz. Zero runtime dependencies.

**What it actually is.** The install is two calls (`src/index.ts`): `unregisterProcedureBlocks()`
deletes the four built-ins, then `registerProcedureSerializer()` swaps Blockly's procedure serializer
for one parameterised with the plugin's models. It then defines **exactly the same four block types
under the same names** — `procedures_defnoreturn`, `procedures_callnoreturn`, `procedures_defreturn`,
`procedures_callreturn` (`src/blocks.ts:23, 66, 90, 141`) — plus `procedures_mutatorcontainer` and
`procedures_mutatorarg`.

**Blockly 12: yes, cleanly.** It is built against core's own procedure API —
`workspace.getProcedureMap()`, `Blockly.procedures.IProcedureModel`,
`Blockly.serialization.procedures` — all of which are core Blockly 12 surface, present in our
installed 12.3.1.

**Does it work with blocks it did not define? No, and this is the decisive answer.** Every code path
is gated on `Blockly.procedures.isProcedureBlock(block)` (`src/update_procedures.ts`), i.e. blocks
implementing `IProcedureBlock`. Its unit of sharing is **a procedure: a name, typed parameters, and a
body authored inside a `procedures_defreturn` block**. It has no concept of "an arbitrary selection of
blocks". LGC-007 §1 asks for *select blocks → Save as a block* over a stack that might be
`noodl_set_output` + `math_arithmetic` + `controls_if`. **This plugin cannot represent that object.**

**Now the three claims in LGC-007, one at a time.**

- **"reference-by-id" — TRUE, and it is the part worth having.** `ObservableProcedureModel` carries a
  real uid (`src/observable_procedure_model.ts:42`) and caller blocks resolve their definition through
  the model rather than by name. Renames stop breaking callers. This is genuine.
- **"the definition store" — half true, and the half that exists is Blockly core's.** The store is
  `workspace.getProcedureMap()` — **per workspace**, created with it and disposed with it. The plugin
  contributes observable *models* that fire events; it contributes no store, no shelf, no file, no
  persistence beyond that one workspace's own serialised JSON.
- **"cross-workspace sharing" — NOT SHIPPED.** What "shareable" means, read in source, is that every
  model mutation fires a Blockly event that round-trips through `toJson`/`fromJson`
  (`ProcedureCreate`, `ProcedureRename`, `ProcedureParameterCreate`, …, each registered in
  `Blockly.registry`; see `src/events_procedure_create.ts:80`). **The plugin never connects two
  workspaces.** Sharing is *you* forwarding those events from workspace A into workspace B, and both
  must be **live at the same time**. Ours never are: `BlocklyWorkspace` injects one workspace on
  mount, disposes it on unmount (`BlocklyWorkspace.tsx:161-166`), and is keyed by node id. When the
  user opens the second Visual Function, the first no longer exists.

**And code generation, which nobody has asked yet.** The plugin ships **no generators at all**. It
works with `blockly/javascript` only because it reuses the built-in type names, so core's existing
`procedures_*` handlers still fire. That is also its ceiling: the generated body contains a real JS
function *definition* alongside its *calls*, in one workspace's output. A call block in workspace B
would emit a call to a function that is not defined in B. **That is precisely the failure LGC-007's
"two mechanisms" table exists to avoid, and this plugin does not solve it.**

**It also keeps the mutator.** `procedureDefMutator` and `procedures_mutatorcontainer`
(`src/blocks.ts:395, 530`) are the standard mutator-dialog UI. Adopting it does nothing for LGC-004
§4's novice cliff.

**Verdict: adopt — for local procedures inside one Visual Function, not for LGC-007.** Our toolbox
already has a `custom: 'PROCEDURE'` category (`BlocklyToolbox.ts:172`) populated by the *name-based*
built-ins. Swapping those for model-backed ones buys rename-safety and id-referenced calls for 6.8 KB
and two lines of setup. That is a good trade and it should be taken. It is a different feature from
"save a group of blocks and use it anywhere".

🔴 **Consequence for LGC-007: it is the largest job in the phase, not wiring.** L19 asserted the
opposite; it is now marked wrong. The definition store, the reference-by-id **for arbitrary block
groups**, the project/user shelves, the cycle guard and the regeneration sweep are all still ours to
build. What this sweep saves LGC-007 is the *pattern* — Blockly's `IProcedureModel` + fired-event
shape is a good model to copy — and the backpack as its retrieval UI. Nothing more.

### `@blockly/workspace-backpack` — the drawer, not the cupboard

Pin **`7.0.11`** (`peerDependencies: { blockly: "^12.0.0" }`). 6.4 KB gz. Zero runtime dependencies.

It is real, it is Scratch's backpack, and its API is generous enough to drive from our own code:
`addBlock`, `addBlocks`, `getContents`, `setContents`, `containsBlock`, `empty`, `open`/`close`, plus
a `Backpackable` interface for custom draggables.

🔴 **Its store is the workspace, not the user — and taken as documented it would write into the
project file.** At `init()` it registers a `BackpackSerializer` into the global
`Blockly.serialization.registry` under `'backpack'` (`src/backpack.ts:118`), whose `save()` returns
the backpack's contents (`src/backpack.ts:1031`). Our workspace persists
`Blockly.serialization.workspaces.save(workspace)` into the node's parameter on every settled edit
(`BlocklyWorkspace.tsx:63`). So the default install would:

1. **copy every backpacked stack into every Logic Builder node's project JSON**, on a 300 ms debounce;
2. give **each node its own separate backpack** — the exact opposite of §2's "My backpack — the
   builder's own shelf, across projects, on disk".

The remedy is known and small: pass `skipSerializerRegistration: true` and drive
`getContents()`/`setContents()` from our own store — `EditorSettings` for the user shelf, the project
file for the project shelf. **But that is us writing the store.** The plugin is the *retrieval UI*.

**Other integration facts, read in source:** it overrides `workspace.configureContextMenu` in `init()`
(its README documents the chaining requirement); we do not set that today, so nothing breaks now, but
anything later that does must chain. It supports **one backpack per workspace**. Its flyout reuses the
registered flyout class, so it inherits our `flyoutBackgroundColour`.

**Locale: it ships English, by design.** `src/msg.ts` assigns five strings — `COPY_TO_BACKPACK`,
`REMOVE_FROM_BACKPACK`, `EMPTY_BACKPACK`, `COPY_ALL_TO_BACKPACK`, `PASTE_ALL_FROM_BACKPACK` — into
`Blockly.Msg` **at module-evaluation time**, and the README says plainly *"We do not currently support
translating the text in this plugin."* Blockly's own bundles carry no such keys, so all 27 languages
in `SUPPORTED_LANGUAGES` would get English context menus. ✅ **The sequencing works in our favour:**
`Blockly.setLocale` **merges** key by key (`setLocale=function(a){Object.keys(a).forEach(b=>Msg[b]=a[b])}`,
read in `blockly_compressed.js`), and `applyLanguage()` runs after the static import, so adding these
five keys to a plugin-strings map inside `BlocklyLocale.ts` wins. That is five strings × the languages
we translate, and it is the correct place for them.

**Theme: partly follows, one asset does not.** The icon is a fixed base64 SVG and its only registered
CSS is opacity (`src/backpack.ts:1002`), so it does not re-colour on a flip. It is the same class of
asset as the trashcan and the zoom controls we already inject (`BlocklyWorkspace.tsx:82-88`), so it is
probably acceptable — **but whether it reads on `--theme-color-bg-0` is a screenshot's job and no
screenshot was taken.**

**Verdict: adopt, with `skipSerializerRegistration: true` and our own store behind it.**

---

## The rest, with the reason attached

### `@blockly/disable-top-blocks` — 🔴 the row was wrong, and the truth is better

Pin **`0.6.9`**. 0.8 KB gz. The published source is **74 lines** and it does **not grey anything out**.
All it does is rewrite the precondition of the `blockDisable` context-menu item so a user cannot
manually re-enable an orphan (`src/index.js`, `DisableTopBlocks.init`).

The greying is **`Blockly.Events.disableOrphans`** — **core Blockly**, confirmed present in our
installed 12.3.1 (`core/events/utils.d.ts:202`, re-exported at `core/events/events.d.ts:71`). So
**LGC-003 §2's static half costs one line and zero bytes**:
`workspace.addChangeListener(Blockly.Events.disableOrphans)`. The plugin is the 0.8 KB correction that
stops the user undoing it by hand.

⚠️ **One thing the drive must check:** `disableOrphans` fires block-change events, and our change
listener debounces a save-and-regenerate on anything that is not a UI event
(`BlocklyWorkspace.tsx:134-142`). Turning it on will produce extra save/generate cycles on load and
after every drag. That is a behavioural question, not a code-reading one.

**Verdict: adopt — but take the free core half first and measure the save churn.**

### `@blockly/toolbox-search` — adopt

Pin **`3.1.9`**. 1.7 KB gz. `BlockSearcher.indexBlocks` instantiates each toolbox block in a headless
workspace and indexes its type, every `field.getText()`, and every dropdown option
(`src/block_searcher.ts:29-60`). **Our blocks index correctly**: `📥 get input` matches "get" and
"input", and the `TYPE` dropdowns on `noodl_define_input`/`noodl_define_output`
(`NoodlBlocks.ts:45-52, 82-89`) contribute "string", "number", "boolean". Needs a `{kind: 'search'}`
entry added to `buildToolbox`.

⚠️ **Locale gap, sourced:** `toolbox_search.ts:56` sets `this.searchField.placeholder = 'Search'` as a
bare literal with no `Blockly.Msg` key. It is untranslatable without patching or reaching into the DOM
after injection. Indexing itself is locale-correct for us, because `applyLanguage()` resolves before
`Blockly.inject` (`BlocklyWorkspace.tsx:72-77`) — the standing sequence works.

### `@blockly/continuous-toolbox` — needs a drive to decide

Pin **`7.0.9`**. 3.5 KB gz. It replaces **five** registry entries — the toolbox, both flyout
orientations, the metrics manager and a flyout inflater (`src/index.ts:34-62`) — and must be handed to
`Blockly.inject` through `plugins:`. No hardcoded colours; it draws through the normal flyout, so our
`flyoutBackgroundColour` and `flyoutForegroundColour` apply.

**It is not rejected on cost, it is unresolved on evidence.** The row's justification is *"this is what
makes Scratch and MakeCode feel fluid"*, which is a preference claim, and this phase's own standing
constraint (README, the IwC finding) is that a stated preference is not evidence of performance. It
also replaces the entire toolbox interaction model, which is the largest behavioural change on this
list. **The drive has to answer: does an always-open flyout make our twelve-category toolbox better or
noisier, and does it survive our theme flip.**

### `@blockly/suggested-blocks` — 🔴 reject

Pin **`6.0.10`**. 1.3 KB gz. It registers a serializer at `priorities.BLOCKS - 10` and persists its
`recentlyUsedBlocks` list **into the workspace JSON** (`src/index.js:216, 224-246`).

Our workspaces are **one per Logic Builder node** and keyed by node id, injected on mount and disposed
on unmount. So its "most used" and "recently used" categories would be **per node**, resetting every
time the user opens a different Visual Function — and it would write a usage log into the user's
project file on every settled edit. The feature's whole premise is "it learns you"; the scope at which
it can actually learn here is one node, which is not a user.

**Rejected so nobody re-evaluates it:** it cannot deliver its own premise without us replacing its
store, and its premise is the weakest claim on this list — no task specced it, and no research in the
phase README supports it. If personalised block suggestions are ever wanted, the store is the work and
this plugin is not the part worth keeping.

### `@blockly/block-plus-minus` — adopt three of its four files

Pin **`9.0.10`**. 4.1 KB gz. Its README is explicit about scope: *"Currently this only affects the
built-in blocks that use mutators (controls_if, text_join, list_create_with, procedures_defnoreturn,
and procedures_defreturn)"* and *"the ability to easily add this to your own mutators may be added in
the future"*.

**Good news:** all three non-procedure blocks are in our toolbox (`BlocklyToolbox.ts:113, 143, 155`),
so the mutator-cliff win is real and it applies to blocks we actually ship.

**Correction to LGC-004 §4:** it does **not** apply to our custom blocks, and none of our fifteen
Noodl blocks has a mutator anyway. The "define inputs/outputs without a mutator dialog" UI is still
ours to build; what this plugin removes is the cliff on `if`, `join` and `create list`.

🔴 **Collision — the sharpest finding in the sweep.** `src/procedures.js:19-20` does
`delete Blockly.Blocks['procedures_defnoreturn']; delete Blockly.Blocks['procedures_defreturn'];` and
redefines both with `Blockly.defineBlocksWithJsonArray` using the **old name-based** procedure system
— grepping its whole `src/` for `getProcedureModel`, `doProcedureUpdate`, `getProcedureMap` and
`isProcedureBlock` returns **zero hits**. `block-shareable-procedures` defines the same two types,
model-backed. **Adopting both means whichever module is imported last silently wins, in either
direction, with no error and no warning.** Pick one owner for `procedures_def*` — or take this plugin
without its procedures half: its `src/index.js` is four bare imports, so importing `if.js`,
`list_create.js` and `text_join.js` directly is available and is the recommendation.

⚠️ **Locale:** `src/procedures.js:15` sets `Blockly.Msg['PROCEDURE_VARIABLE'] = 'variable:'` at import
and `:456` appends it with the source comment `// Untranslated!`. Moot if its procedures half is
excluded, which is the recommendation anyway.

### `@blockly/workspace-minimap` — 🔴 adopt only via a subclass; **it fails the theme flip as written**

Pin **`0.3.9`**. 2.9 KB gz. Real value against the scale problem, and a real instance of the defect the
spec warns about, caught statically before it shipped.

It **injects a second Blockly workspace** and takes `theme: this.primaryWorkspace.getTheme()` **once,
at construction** (`src/minimap.ts:71-88`). Our theme flip calls `workspace.setTheme(buildBlocklyTheme())`
on the **primary** workspace only (`BlocklyWorkspace.tsx:120-123`), and `minimapWorkspace` is
`protected` (`src/minimap.ts:33`) — our callback cannot reach it. **After a light/dark flip the
minimap keeps the old theme**: correct in one theme, wrong in the other. The fix is a subclass that
exposes the inner workspace and re-themes it alongside the primary.

Also `src/focus_region.ts:214` hardcodes `fill: #e6e6e6` for the viewport rectangle, which follows no
theme in either direction.

### `@blockly/plugin-workspace-search` — 🔴 adopt only with a stylesheet override written at the same time

Pin **`10.1.8`** (note the `plugin-` prefix — the name in the original table 404s). 3.1 KB gz. **Two
hardcoded-colour defects, both in `src/css.ts`:**

1. `.blockly-ws-search { background: #fff; border: solid lightgrey 0.5px; box-shadow: 0px 10px 20px grey; }`
   — a white panel with a grey drop shadow, in an editor whose workspace ground is `#0b0e12`
   (`BlocklyTheme.ts:25`).
2. `path.blocklyPath.blockly-ws-search-highlight { fill: #000; }` — **the match highlight paints the
   found block black.** On our dark workspace the thing the user searched for is the thing that
   disappears. This one is a defect in both themes and near-total on ours.

Its three toolbar icons are black-filled base64 SVGs and **cannot be recoloured by CSS** — they need
`filter: invert(1)` or replacement.

✅ **Mitigation exists and is cheap:** `injectSearchCss` inserts its `<style>` at
`document.head.firstChild` — lowest precedence — so our own stylesheet overrides every rule it sets.
Only the baked icon fills need the filter. **The override is part of adopting it, not a follow-up.**

⚠️ It defines **no `Blockly.Msg` keys at all**; every string is a literal. Check the placeholder and
the button titles before promising anything about translation.

### `@blockly/zoom-to-fit` — adopt

Pin **`7.0.9`**. 1.9 KB gz. The smallest of the three scale plugins. An image button whose only
registered CSS is opacity (`src/index.ts:258-268`) — the same asset class as the trashcan and zoom
controls we already inject, so it inherits whatever judgement those already passed.

### `@blockly/plugin-cross-tab-copy-paste` — needs a drive to decide

Pin **`8.0.8`** (note the `plugin-` prefix). 2.0 KB gz. It stashes the copy in `localStorage` under
`blocklyStash` (`src/index.ts:89, 209`) and registers context-menu items plus **overrides of the
Ctrl+C / Ctrl+X / Ctrl+V shortcuts** (`src/index.ts:281-495`).

⚠️ **Its stated value here needs checking before it is adopted.** The row claims "copy blocks between
two Visual Function nodes", but both tabs live in the **same renderer**, and Blockly's own clipboard is
module-global. What this plugin adds over the built-in is persistence across a renderer reload and
across separate Electron windows — which may be worth 2 KB and may be worth nothing.

⚠️ **It overrides the global copy/paste shortcuts**, and the editor has its own copy/paste on the node
canvas. That interaction is exactly what a drive is for.

✅ **Best-behaved plugin on the list for locale:** it honours `Blockly.Msg['CROSS_TAB_COPY']` /
`['CROSS_TAB_PASTE']` when set and otherwise composes its labels from `COPY_SHORTCUT` /
`PASTE_SHORTCUT` (`src/index.ts:262-295`), which Blockly's own bundles do translate.

### `theme-deuteranopia` · `theme-tritanopia` · `theme-highcontrast` — 🔴 blocked on **our** code, not theirs

Pin **`7.0.4`**. ~1.0 KB gz each. Blockly-12 clean. And **installing them today would half-apply, and
the reason is in our source, not the plugin's.**

Each theme supplies `blockStyles` (keyed `logic_blocks`, `math_blocks`, `loop_blocks`, …) and
`categoryStyles`, with `componentStyles: {}` (`theme-deuteranopia/src/index.ts:102-104`). **A block
only picks up a block style if it calls `setStyle()` or declares `style:`.**

- **All fifteen of our blocks call `setColour(<hue>)`** — `NoodlBlocks.ts:57, 68, 94, 110, 124, 138,
  150, 168, 183, 200, 215, 233, 249, 260, 273`.
- **Every toolbox category passes a raw hue string** — `HUE`, `BlocklyToolbox.ts:26-39`.

So an a11y theme would recolour the stock blocks and leave **all fifteen Noodl blocks and all twelve
category headers at their current hues**. A colourblind user would get a workspace that is half
corrected, which is arguably worse than one that is uniformly wrong, because the corrected half
implies the rest was checked.

✅ **Our chrome is safe either way.** `buildBlocklyTheme()` passes `componentStyles` explicitly
(`BlocklyTheme.ts:62-78`), so swapping `base:` from `Themes.Classic` to an a11y theme keeps the
workspace, toolbox, flyout, scrollbar and marker colours correct. It is the **blocks** that do not
follow, not the frame.

**Verdict: not a plugin decision.** LGC-005 §2's real cost is converting `NoodlBlocks.ts` and
`BlocklyToolbox.ts` from raw hues to registered block styles and category styles. After that the three
themes are ~3 KB and a picker. **Do not install them first and call §2 done.**

---

## 🔴 The defect the spec warns about is still in `package.json`

`"@blockly/theme-dark": "^8.0.3"` is declared at
[`packages/noodl-editor/package.json:116`](../../../packages/noodl-editor/package.json) and **nothing
in `src/` imports it**. The only trace left is the comment at `BlocklyTheme.ts:8` recording that it is
what *"made the block editor permanently dark"* — i.e. the very "correct in one theme, invisible in the
other" defect this task's §2 tells the reader we have shipped before. The evidence is still on the
dependency list.

(For the record, it does peer-dep `blockly: ^12.0.0`, so it is not a version problem — it is dead
weight with a bad history.) **Removing it belongs to the adoption half**, because it is a
`package.json` edit and this session may not make one.

## Two things to check before adopting anything — now checked, and what came back

1. **Theme compatibility.** [`BlocklyTheme.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyTheme.ts)
   builds our theme from `CanvasTheme` and re-colours on `nodegx:themechanged`. Three of the
   recommended plugins do not join that flip, and each fails differently:
   **`workspace-minimap`** copies the theme once at construction into a workspace we cannot reach;
   **`plugin-workspace-search`** hardcodes a white panel and a black match highlight;
   **`workspace-backpack`** and **`zoom-to-fit`** ship fixed-fill icons like the trashcan already does.
   Only the first two are actual defects; the icons are a judgement a screenshot settles.
2. **Locale.** [`BlocklyLocale.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyLocale.ts)
   delays injection until the language bundle resolves, and `BlocklyWorkspace.tsx:72-77` honours that.
   ✅ **The sequence is sound and plugins can join it**, because `Blockly.setLocale` **merges** rather
   than replaces, so plugin defaults set at import time can be overridden inside `applyLanguage()`.
   ⚠️ **Three plugins ship English strings that no Blockly bundle carries:** `workspace-backpack`
   (5 keys, listed in its README, translatable by us), `block-plus-minus`
   (`PROCEDURE_VARIABLE`, marked `// Untranslated!` in its own source), and **`toolbox-search`, which
   is the worst of the three** — its `'Search'` placeholder is a bare literal with no `Msg` key at all
   and cannot be translated without patching. `plugin-cross-tab-copy-paste` is the only one that does
   this properly.

## Acceptance

- ✅ Each row carries **verified (static)** with a sourced reason, or **needs a drive** naming what the
  drive must answer. Package names corrected; blockly-12 pins recorded.
- ✅ Every **rejected** plugin has its reason written down: `suggested-blocks` (store is the wrong
  scope), `block-plus-minus`'s procedures half (collides), the a11y themes (blocked on our hues).
- ✅ Weight measured from the registry rather than guessed: **~30 KB gz for everything recommended,
  against a 218 KB Blockly chunk.**
- ❌ **"One sentence on what it actually did in our workspace"** — **not met, and cannot be met by
  reading.** Every verdict here is a verdict from source. That is weaker than a verdict from running
  the plugin, and the rows above say where the difference bites.
- ❌ Chunk size before/after — not measured; no install.
- ❌ Both themes screenshotted — not done; no install.
- ❌ A non-English locale checked — not done; no install. The *gaps* are written down above, which is
  the half of that criterion reading can satisfy.

## Deferred: the adoption half

**No plugin was installed this session, and none was run.** The worktree's `node_modules` are symlinks
into the primary checkout, a concurrent session is working there and is holding `package-lock.json`
dirty, and `lerna exec` resolves to the primary checkout even from a worktree. Any `npm install` here
would have mutated another session's tree. The task was therefore scoped to the verdict on purpose,
and this section is the handover for whoever does the other half.

**Do it in the primary checkout, alone, with no other session running.**

1. **Install, pinned exactly** — every one of these must be pinned, because each package's `latest`
   peer-deps Blockly 13:

   ```
   npm i -w packages/noodl-editor \
     @blockly/block-shareable-procedures@6.0.12 \
     @blockly/workspace-backpack@7.0.11 \
     @blockly/disable-top-blocks@0.6.9 \
     @blockly/toolbox-search@3.1.9 \
     @blockly/block-plus-minus@9.0.10 \
     @blockly/workspace-minimap@0.3.9 \
     @blockly/plugin-workspace-search@10.1.8 \
     @blockly/zoom-to-fit@7.0.9
   ```

   and **remove `@blockly/theme-dark`** in the same commit — it is unused and it is the defect this
   task's §2 cites.

2. **Measure the chunk before and after.** Build once with none of them wired, record the byte size of
   the lazy Blockly chunk, then wire them and record it again. If the growth exceeds the ~30 KB gz
   predicted here, **the prediction was wrong and the rows that earned the difference get named** —
   that is L17's whole point. Do not substitute this file's numbers for the real measurement.

3. **Screenshot both themes with every plugin's UI visible**, and flip the theme *with the workspace
   open* rather than reloading into each one — the minimap defect above only appears on a live flip.
   ⚠️ Per the register, an occluded Electron renderer fires no `ResizeObserver` and clamps timers;
   take the screenshot to force a frame and do not trust a headless assertion about layout. Print the
   foreground and background hex with any contrast claim.

4. **Open the workspace in a non-English locale** — French is the safest, it has full
   `TOOLBOX_LABELS` coverage (`BlocklyLocale.ts:109`). Confirm the three known English leaks
   (backpack context menu, `toolbox-search` placeholder, `PROCEDURE_VARIABLE`) and either translate
   them in `BlocklyLocale.ts` or write the gap down against the row.

5. **Then, and only then**, replace each row's **verified (static)** with **verified**, and add the one
   sentence on what the plugin actually did in our workspace.

## Register

| # | Finding | State |
|---|---|---|
| L16 | Google publishes 39 official plugins. At least eleven cover behaviour this phase specced by hand, and two of them are LGC-007's hard part | ⚠️ **half wrong** — the coverage is real, the LGC-007 claim is not; see L26 |
| L17 | Blockly is lazy-loaded because it is ~1.1 MB. **Every adopted plugin is weight on a chunk the codebase already went out of its way to defer** | ✅ **measured 2026-08-12** — everything recommended is **~30 KB gz against 218 KB**. Weight is not the constraint; behaviour is |
| L18 | Colour-as-type is Blockly's native convention and a colourblindness hazard. The a11y themes are shipped; writing our own would repeat phase 41 | 🔴 **blocked on our code** — our blocks and categories use raw hues, not styles, so a shipped theme half-applies. See L29 |
| L26 | `block-shareable-procedures` shares **procedures**, not arbitrary block groups, between **live** workspaces, via events you forward yourself. It has no store and no persistence. **It is not LGC-007's hard half** | 🔴 **found 2026-08-12, read in source** |
| L27 | **Every `@blockly/*` plugin's `latest` now peer-deps `blockly: ^13`.** Each adoption must pin the last blockly-12 version, and those lines are frozen | 🔴 found 2026-08-12 |
| L28 | **Three package names in the original table do not exist** — `workspace-search`, `cross-tab-copy-paste` and `strict-connection-checker` are published under a `plugin-` prefix. A 404 is indistinguishable from "never published" | 🔴 found 2026-08-12 |
| L29 | Our fifteen custom blocks call `setColour(<hue>)` and our twelve toolbox categories pass raw hue strings. **No Blockly theme can recolour them.** LGC-005 §2's cost is converting ours to styles, not installing a theme | 🔴 found 2026-08-12 |
| L30 | `workspace-backpack` registers a **workspace serializer** by default, so the naive install writes every backpacked stack into every Logic Builder node's project JSON and gives each node its own backpack | 🔴 found 2026-08-12 — `skipSerializerRegistration: true` |
| L31 | `disable-top-blocks` **greys nothing out.** The greying is `Blockly.Events.disableOrphans` in core. **LGC-003 §2's static half is one line and zero bytes**; the plugin is only the context-menu correction | ✅ found 2026-08-12 — better than the row claimed |
| L32 | `block-plus-minus` and `block-shareable-procedures` **both redefine `procedures_defnoreturn`/`defreturn`**, one name-based and one model-backed. Import order silently decides, in either direction, with no error | 🔴 found 2026-08-12 |
| L33 | `plugin-workspace-search` paints its match highlight `fill: #000` and its panel `#fff`. **The thing the user searched for is the thing that disappears** on our dark workspace. Its CSS is injected at lowest precedence, so an override works | 🔴 found 2026-08-12 |
| L34 | `workspace-minimap` copies the theme **once at construction** into a `protected` second workspace our theme-flip callback cannot reach. Correct in one theme, stale in the other — the defect §2 warns about, caught before install | 🔴 found 2026-08-12 |
| L35 | `Blockly.setLocale` **merges** into `Blockly.Msg` rather than replacing it, so plugin defaults set at import time can be overridden inside `applyLanguage()`. The locale sequence is sound and plugins can join it | ✅ verified in `blockly_compressed.js` |
| L36 | **`@blockly/theme-dark` is still a declared dependency and nothing imports it** — the plugin that made the block editor permanently dark is still on the list | 🔴 found 2026-08-12 — remove with the adoption commit |
| L37 | **A verdict from reading is not a verdict from running.** Every row here is sourced from the plugin's published code; none was injected. The acceptance criterion asking what each plugin *did in our workspace* is deliberately left unmet | ⚠️ standing, until the adoption half runs |
