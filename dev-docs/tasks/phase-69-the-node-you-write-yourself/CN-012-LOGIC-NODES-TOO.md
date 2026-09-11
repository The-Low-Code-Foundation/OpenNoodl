# CN-012 — Logic nodes too

| Field | Value |
|---|---|
| **Tier** | 4 |
| **Effort** | M |
| **Surface** | `runtime` / `catalog` / `editor` |
| **Rulings** | ✅ **D2** — the published types' logic half is no longer provisional |
| **Depends on** | CN-003 |
| **Status** | ✅ **MEASURED AND BUILT 2026-08-18 (s24).** AC1 ✅ · AC2 ✅ · AC3 ✅ |

> 🔴 **This spec was rewritten from measurement on 2026-08-18, as its own first section demanded.**
> The original is preserved at the bottom, unedited. Everything above it is what a kit actually did.

---

## What was measured, and with what

**The caller: `tally-kit`, a kit with `nodes` and no `reactNodes` at all** — no React, no DOM. Three
nodes covering three separate claims: hold state and emit a value *and* a signal; receive a signal
**from another kit node**; declare `runOnValueChange`. Driven through the real headless extractor,
real Chromium, the real `CloudRunner`, and the real editor.

Full readings, with the predictions written down first:
**[notes/cn-012-measurement.md](notes/cn-012-measurement.md)**.

### ✅ The logic half works, and it needed nothing built

| Claim | Result |
|---|---|
| Registers | ✅ `registerModule` loops `nodes` with no visual assumption; `viewer.jsx`'s `reactNodes` branch is guarded |
| Reaches the editor with its own category | ✅ `category: "Math"`, `color: "data"`, `module: "Tally Kit"` |
| Placeable like an `Expression` | ✅ type resolved on canvas, declared ports present; built-in `Counter` control identical |
| Signals in | ✅ a **built-in visual** node's `didMount` reached a kit logic node's signal input |
| Signals out, kit → kit | ✅ `sendSignalOnOutput` reached **another kit node's** input, which published in turn |
| Values | ✅ `flagOutputDirty` published through a live connection into a `Text` |
| `runOnValueChange` | ✅ the `runOnChange-<input>` checkbox is synthesised on a kit node with the runtime's own wording |
| The catalog overlay | ✅ `isVisual: false` and everything downstream of it correct; `collisions: []` |

🔴 **The one contrast with the visual half is worth carrying forward: a logic kit node gets NO
runtime base set.** CN-008 found the base set takes `demo.kit.Badge` from 12 in / 9 out down to the
8 and 1 its author declared. A logic node's ports are exactly what the author wrote, plus any
`runOnChange-` checkbox they asked for.

⚠️ **`runOnValueChange` declares the port and wires nothing** — and the first kit written for this
task got it wrong, which is the finding. The governed input's own `set` must ask
`this.shouldRunOnValueChange(name)`, exactly as every built-in in the class does. Omitting it is
silent and reads as a runtime bug: the output keeps the value `connectInput` pushed at boot, so a
consumer reads a confident `0` from a node that has never run. **The published types did not declare
`shouldRunOnValueChange` at all**, so an author following them could not discover it. Now declared,
with the two-line shape and the failure mode, and cross-linked from the field.

### 🔴 The cloud: the runtime is willing and there is no caller

Built the caller — `CloudRunner` + `request → <node> → response`, 1500 ms bound:

| Arm | Result |
|---|---|
| kit logic node, as shipped | ⏱ **`CloudFunctionTimeoutError` — never answers** |
| built-in `Counter`, same graph (control) | ✅ `200` |
| kit logic node, after `runtime.registerModule` by hand | ✅ `200` |

`CloudRunner`'s constructor calls `registerNodes` and nothing else, and `load(exportData,
projectSettings)` **has no parameter a module could arrive through**. The failure is CWF-018's
second confirmed instance: an unregistered type is logged and skipped, its connections dropped, and
the graph runs with the chain cut — a **hang**, not an error.

🔴 **And `runtimes: ["cloud"]` makes a kit run NOWHERE.** `buildInjectionTags` filters on
`runtimes.indexOf('browser') !== -1`, so declaring cloud **removes the kit from the browser** and
nothing loads it server-side. Measured: every kit node missing, `Can't find component model` in the
console, and the author told nothing. **The field's only positive value takes the kit out of the one
runtime that would have run it.**

⚠️ It was also silently mis-stated to the AI: the overlay copied the manifest verbatim, so an agent
was told `availableIn: ["cloud"]` — in the same field that states plain fact for a built-in.

📊 **Census, because the blast radius depends on who uses it:** of the 40 `manifest.json` files under
a `noodl_modules/` in this repo, **not one shipped module declares `runtimes` at all**, and the
scaffold writes none. The field is entirely aspirational, so settling its meaning breaks nothing.

---

## What was built

1. **`availableIn` states what runs.** `effectiveKitRuntimes` in `@nodegx/kit-catalog`: absent or
   containing `browser` → `['browser']`; anything else → `[]`. The manifest's claim is not lost — it
   moves to `declaredRuntimes`, present **only when the two differ**, so its presence always means
   "this kit asked for something it does not get".
2. **`kit-loads-nowhere`**, an `error` in `kitDiagnostics`, naming the kit, its declaration and the
   consequence. 🔴 **Keyed on the KIT, not on its nodes** — a kit no runtime loads registers nothing,
   so a node-keyed rule would be blind in exactly the case it exists for. An earlier cut fed the fact
   in as a synthetic node row and thereby disabled `kit-registered-nothing` for the same kit; there
   is a test for that pairing now.
3. **Both surfaces**, because a diagnostic the author never sees is not a fix. `validate:project`
   through the extractor (which now resolves the fact where `moduleRuntimes` and the kit list are
   both in hand), and the editor's Kits panel through `listNodeKits`, which now carries `runtimes`.
4. **CN-005's provisional marker lifted** from `NodeDefinitionOptions` / `LogicNodeDefinition` /
   `NodeKitModule.nodes`, with a `kit-logic` fixture that typechecks against the published types and
   two `never`-probes proving the green is real rather than a silent non-resolution.
5. **Found in passing — the harness's own bootstrap.** `render-from-disk.js` hand-writes a fourth
   copy of the `defineModule` shim and was the only one missing CN-003's `__noodl_module_name`
   adoption, so every kit node in the harness stamped `Unknown Module` while the right name sat one
   tag away. ✅ Control: identical on a **visual** kit, so never about logic nodes. Fixed and gated.

**Tests:** kit-catalog 55 → 63 · node-kit-types 71 → 76 · editor `test:main` **3664 / 240 suites** ·
noodl-mcp **633 / 53** · module-inject 21. `typecheck:editor` **0**, `typecheck:mcp` **0**.
**8 of 8 real mutations killed** on the new checks, plus the harness gate and the editor plumbing.
⚠️ One attempted mutation could not fail and the guard it targeted was **removed** rather than
re-tested — a `Map` already deduped by kit, so a `!has` check was a guard nothing could kill.

---

## Acceptance criteria — as met

1. ✅ **A logic-only kit node registers, appears under a sensible category, and computes.** Measured
   in the extractor, in Chromium and in the editor, with a built-in control beside it.
2. ✅ **Its cloud behaviour is established and documented.** It is **explicitly unsupported**, and the
   manifest field is now honest at every surface an author or an agent reads: the catalog states
   where the node runs rather than what the manifest wished, and a kit that runs nowhere is an error
   naming itself. "Untested" is gone.
3. ✅ **CN-005's logic types lose their provisional marker**, backed by a fixture rather than by a
   re-reading of the runtime.

## 🔴 What this task did NOT do, and who owns it

- **Making kits work in the cloud is a RULING, not a build.** The runtime already accepts them; a
  loader would mean running a kit's arbitrary JavaScript **inside the backend process**, and ✅ D6
  only ruled on locally-authored kits in the browser. Owed to Richard, and it gates **CN-013**.
- **The `partial` / half-registered case** is CN-015's, unchanged.
- **Closing `NodeDefinitionOptions`' index signature** (which would catch optional top-level typos on
  a logic node, as `ReactNodeDefinition` already does) was measured and works, but makes a **second**
  deliberate divergence and turns `drift.test.js`' "the one divergence" row red. **CN-005's call.**
- **The property panel's rendering** of a logic kit node's ports is recorded **unmeasured** — nothing
  was selected and this build exposes no `NodeGraphEditor` singleton.
- ⚠️ **`WarningsModel` read `0` beside a deliberately bogus node type on the same canvas** — third
  confirmation of the recorded trap. Whether the editor warns about anything here is **unmeasured,
  not silent**.
- ⚠️ `kitDiagnostics` output is printed outside `validate:project`'s summary, so an `ERROR` line
  appears above `0 error(s)`. Pre-existing CN-015 behaviour; noted, not changed here.
- **CN-007's docs page** does not yet carry a logic-node section. The material is the measurement
  note; the page is CN-007's surface.

---

# Original spec, preserved unedited

## 🔴 This is a measurement task first, a build task second

**Do not write the rest of this spec from the source.** Everything this phase proved on 2026-08-15
was about `reactNodes` — the visual half. The logic half (`module.nodes`, via `defineNode`) is
**inherited, plausible, and completely unexercised here.**

The repo's record on exactly this shape is bad enough to be a standing rule: **build the caller, 5
for 5.** Four of those five found a hole; one of them found a *feature* with no implementation
behind it that a live drive had already passed over. `0 of 29 shipped library modules have ever been
run`. A spec for CN-012 written from reading `noderegister.ts` would be the sixth entry on that
list.

## The measurement pass — do this, then rewrite the task

Build a kit registering a **logic** node — no React, no DOM — and establish:

1. **Does it register?** `viewer.jsx` concatenates `module.reactNodes` (compiled) onto
   `module.nodes` (passed through) before `registerModule`. So a module supplying only `nodes` should
   work. **Confirm it, don't infer it.**
2. **Does it reach the editor's node library** with a non-`Visual` category, and can it be placed on
   canvas like an `Expression`?
3. **Signals and values** — does a logic kit node send signals, receive them, and participate in
   `runOnChange` the way built-in logic nodes do?
4. 🔴 **Does it run in the cloud runtime?** `noodl-viewer-cloud` has **no `registerModule` call**
   in `src/` — grepped 2026-08-15. If that holds, a logic kit is **browser-only regardless of what
   the manifest's `runtimes` field says**, which would make the manifest field misleading rather than
   merely unimplemented. That is a finding worth having on its own, and it feeds CN-013.
5. **What the catalog overlay does with it** — CN-003 was designed against visual nodes; a logic node
   has no visual ports and different `availableIn` semantics.

## Then build

Whatever the measurement shows. Likely shape: make the logic path work end-to-end, document it in
CN-007, and promote CN-005's provisional logic types to guaranteed.

## Acceptance criteria (provisional — revise after measuring)

1. A logic-only kit node registers, appears in the picker under a sensible category, and computes.
2. Its behaviour under the cloud runtime is **established and documented** — working, or explicitly
   unsupported with the manifest field made honest. "Untested" is not an acceptable end state for a
   field that implies support.
3. CN-005's logic types lose their provisional marker, or the marker is made permanent with a reason.

## Traps

- 🔴 **A typeless node empties the graph** — wires-with-no-nodes means something threw. If a logic
  kit renders an empty canvas, look for the throw before doubting the registration.
- ⚠️ **`flagOutputDirty` on a signal never fires** — a recorded runtime trap directly in the path a
  logic node's outputs take.
- ⚠️ Do not let this task quietly become "visual nodes, again". The whole point is the half nobody has
  run.
