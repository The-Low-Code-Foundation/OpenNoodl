# CN-006 — the drive, session 11

**Written BEFORE the editor was launched, 2026-08-16.** The handover (§3) named three things built in
s9/s10 and never seen in a browser, and the standing obligation for this phase is to write down what
would be observably true of a *working* feature before driving it — so that a pass cannot be read
into a broken one.

Fixture: `cn006-drive`, a `cp -R` of `cn001-kit-drive`. Chosen because it is four components and it
already carries a **second, unrelated kit** (`cashflow-kit`) whose node is a built-in control for
observation 1.

---

## The observations, and what each one excludes

### O1 — AC1: the scaffolded node is in the picker and placeable

**Expected:** after scaffolding a kit named `drive-kit` and reloading the preview, the node picker
contains an entry whose type is `drive-kit.StatTile`, displayed as **Stat Tile**, and dropping it on
a canvas yields a node with the fifteen ports `EXAMPLE_PORTS` declares.

⚠️ *"The picker opens and has nodes in it"* would be true of a completely broken kit — the picker is
full of built-ins. The observation has to name **this type string**.

✅ **Control (built into the fixture):** `cashflow-kit`'s node must be in the same picker listing. If
neither is there, the picker readout is broken and says nothing about the scaffold; if cashflow's is
there and `drive-kit.StatTile` is not, the scaffold genuinely did not arrive.

### O2 — AC3: the *computed* style, not the parameter value

**Expected:** on a placed `Stat Tile` with **no parameters set**, in the running viewer:

- `getComputedStyle(el).paddingLeft` is a **resolved pixel length** — not `0px`, not the empty
  string, not the literal text `var(--space-4)`;
- and the string `)px` appears **nowhere** in the element's inline style or the document's CSS.

⚠️ `an-icon-host-that-sets-fill-sets-nothing` is the local precedent for a style that is set and does
nothing. s10 asserted the *style layer* (the instance carries `padding: 'var(--space-4)'`); only a
browser resolves it.

🔴 **Two different failures produce the same `0px`, and they have different fixes.** So read
`getComputedStyle(document.documentElement).getPropertyValue('--space-4')` in the same viewer as a
**discriminator**:

| `--space-4` on `:root` | `paddingLeft` | reading |
|---|---|---|
| resolves | resolved px | ✅ working |
| resolves | `0px` | the `)px` bug, or the port never reaching style |
| empty | `0px` | **token delivery**, nothing to do with CN-006 |

### O3 — the `ProjectModel.modules` staleness twin — a hypothesis, not a finding

`KitsSection` calls `readModules()` after a scaffold *because the MCP side had exactly this hole*.
Whether the editor's model was genuinely stale without it **has never been measured**, and s9's
warning applies: *the MCP side looked fine too.*

**The measurement** — scaffold a second kit by calling `createNodeKit()` directly over CDP, which
bypasses `KitsSection` and therefore bypasses `readModules()`:

1. read `ProjectModel.instance.modules` → baseline names;
2. `createNodeKit(dir, 'probe-kit')`, and confirm the files are **on disk**;
3. read `ProjectModel.instance.modules` again — **expected, if the hole is real: `probe-kit` absent**;
4. call `readModules()` and read a third time — **expected: `probe-kit` present**.

Step 3 absent + step 4 present ⇒ the call is load-bearing. Step 3 **present** ⇒ the model refreshes
by some other route and the `readModules()` call is belt-and-braces; that is a finding too, and the
honest one to report.

### O4 — `CodeFileDocument` has never been mounted

**Expected:** after the scaffold, a document tab is open, and the CodeMirror in it contains the
bytes of the generated `index.js` — check for a line only that file has, not merely "an editor is
visible".

---

# THE RESULTS — written after the drive, 2026-08-16

Editor launched (`dev:debug`), fixture opened and confirmed by `_retainedProjectDirectory` (not by
name — a `cp -R` copy is indistinguishable from its source in the launcher). **All four observations
were measured.** Two are met, one is met in half and fails the half nobody had checked, and one
converted a hypothesis into a finding.

| # | Observation | Verdict |
|---|---|---|
| **O1** | scaffolded node in the picker and placeable | ⚠️ **Half met — and the failing half is the half AC1 actually names** |
| **O2** | computed style resolves the tokens | ✅ **MET**, every port, with the discriminator run |
| **O3** | `ProjectModel.modules` staleness | 🔴 **The hole was REAL** — hypothesis is now a finding |
| **O4** | `CodeFileDocument` mounts with the file's bytes | ✅ **MET** — first mount in the product's life |

## O3 — the twin was real, and `readModules()` is load-bearing

Measured by calling `createNodeKit()` **directly over CDP**, which bypasses `KitsSection` and
therefore bypasses its `readModules()` call. Four readings, in one session, on one project:

| step | `ProjectModel.instance.modules` |
|---|---|
| baseline | `cashflow-kit, inter, lucide-icons` |
| after `createNodeKit(dir,'probe-kit')` resolved **and the files were on disk** | `cashflow-kit, inter, lucide-icons` — **`probe-kit` ABSENT** |
| after `readModules()` | `cashflow-kit, inter, lucide-icons, probe-kit` — **present** |

✅ **So s10's call is not belt-and-braces; without it the editor's model is silently stale**, exactly
as the MCP side was. The handover was right to refuse to assert this before measuring it, and it was
right in substance — but *"the MCP side looked fine too"* cuts both ways, and it is now measured
rather than reasoned.

## O2 — MET, and the discriminator says the pass is real

A `drive-kit.StatTile` placed with **no parameters set**, read in the running viewer:

```
inline: padding: var(--space-4); background-color: var(--surface-raised);
        border-width: var(--border-1); border-radius: var(--radius-md);
        border-color: var(--border); color: var(--foreground);
computed: paddingLeft 16px · paddingTop 16px · backgroundColor rgb(255,255,255)
          borderRadius 8px · borderWidth 1px · borderColor rgb(226,232,240)
          color rgb(15,23,42) · label fontSize 14px · value fontSize 24px
          gap → marginTop 4px
```

✅ **Every token resolves to a real computed value.** ✅ **`)px` occurs 0 times** in the viewer's
whole document and in 95,977 characters of CSS — and the sweep is not a dead instrument: the same
scan counted 8 live `var(--` occurrences in that CSS.

✅ **The discriminator from the pre-drive table was run and it discriminates.** `:root` carries
`--space-4: 16px`, `--surface-raised: #ffffff`, `--text-sm: 14px`, so the "token delivery" row is
excluded; and had the `)px` bug still been present the declaration would have been invalid and
`paddingLeft` would have read `0px`. It read `16px`. **s10's two guards in `react-component-node.ts`
hold in a real browser.**

## O4 — MET, and it renders properly

`CodeFileDocument` mounts: `Root`, `Topbar`, `Identity`, `Actions`, `Surface` and a live `cm-editor`.
Identity reads **`noodl_modules/drive-kit/index.js`**. The buffer carries the real bytes, checked on
lines only that file has — `@ts-check`, `Ports are the product`, `drive-kit.StatTile` — not merely
"an editor is visible". Syntax highlighting, `Format` / `Save` / `Close` all render.

## 🔴 O1 — the node is placeable; it is NOT "under its kit's name"

**What works.** After the viewer had the kit, the editor's node library went 180 → 182 types,
carrying `drive-kit.StatTile` (`displayName: 'Stat Tile'`, `category: 'Visual'`, `module:
'drive-kit'`, **28 ports**). Clicking its picker card placed it, and the graph then contained
`drive-kit.StatTile`. It rendered in the viewer as `Revenue / —`, its generated defaults. ✅ **So
"placeable" is met, and the fixture's `cashflow-kit` control was in the same listing throughout** —
the picker readout was never the thing that was broken.

🔴 **What fails is the clause AC1 is actually written in.** The picker files every kit node under a
single category **"External libraries"**, in a subcategory whose name is the empty string. With two
kits installed the picker showed:

```
2 results in 1 category
EXTERNAL LIBRARIES  2
   [S] Stat Tile        [S] Stat Tile
       External libraries   External libraries
```

Both cards display the same name, the same category, and the same `title="Stat Tile"` tooltip. **The
only thing that separates them anywhere in the DOM is a `data-test` attribute** —
`node-picker-card-drive-kit.StatTile` versus `node-picker-card-probe-kit.StatTile`. An author with
two kits cannot tell which node belongs to which kit, and the detail pane says *"No documentation
yet."*

✅ **Traced to one hard-coded line**, `packages/noodl-runtime/src/nodelibraryexport.ts:917-932`:

```ts
nodeTypes.forEach((type) => {
  const nodeMetadata = nodeRegister._constructors[type].metadata;
  if (nodeMetadata.module) { moduleNodes.push(type); }     // <- the kit name is RIGHT HERE
});
if (moduleNodes.length) {
  obj.nodeIndex.moduleNodes = [{ name: '', items: moduleNodes }];   // <- and it is discarded
}
```

The kit name is in hand in the loop and thrown away one line later; the editor's picker
(`utils/createnodeindex.ts:115-131`) then renders `subCategory.name` faithfully — as nothing. So this
is a **small fix in the runtime's exporter, not a picker rewrite**, and it is the same provenance
CN-006b needs. ⚠️ It is *not* in CN-006's code: the scaffold sets `module` correctly, which is why
`NodeLibrary`'s own type record knows the kit and the picker does not.

## 🔴 A second product finding: the file editor shows a Function-node hint

`CodeFileDocument` reuses `@noodl-core-ui`'s `JavaScriptEditor`, and inherits FUN-006's port bar. On
a kit's `index.js` — which is a **file**, not a node, and has no ports of any kind — it renders:

> This node has no ports yet. Type Inputs. — the name you use becomes an input port.

`JavaScriptEditor.tsx:316` computes it from `getCodeAuthoringContext().openNode`, ambient state that
has nothing to do with the open file. ⚠️ **It is not merely cosmetic: it instructs the author to use
a mechanism that does not exist in a kit file**, in the one surface this phase points a new kit
author at. The header also labels the file `SCRIPT`. Small, and it belongs to whoever finishes the
CodeFileDocument surface.

## ⚠️ One thing observed and deliberately NOT claimed

I never clicked "reload the preview", and the kit still reached the picker — which would make
`KitsSection`'s instruction unnecessary. **I am not reporting that**, because the mechanism is
unattributed and there is a live confound: peers were editing the tree throughout, and the log shows
`_src_frames_viewer-frame_index.*.hot-update.json` — **HMR was reloading the viewer frame for reasons
that had nothing to do with me.** A viewer reload I did not cause is indistinguishable here from a
product that reloads itself. On a quiet checkout the author may well still need to reload by hand.
**Wants a re-run on an undisturbed tree**; the cheap version is to scaffold, then poll the viewer's
`script[src]` list without touching anything.

## How the session ended

🔴 **A peer's edit to `esLintDiagnostics.ts` forced a full HMR reload** (*"[HMR] Cannot apply update.
Need to do a full reload!"*), which dropped the editor back to the Launcher and wiped every injected
CDP handle. All four observations were already measured; the auto-reload re-run was what it cost.
This is the shared-checkout hazard, and it is worth budgeting a re-measure for rather than assuming a
drive will hold for its whole length.

**Cleanup:** fixture `cn006-drive` deleted, both its entries filtered out of NodeGX's
`recently_opened_project.json` (2 → 0), source `cn001-kit-drive` verified untouched (still its
original three modules).
