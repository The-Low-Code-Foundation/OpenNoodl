# AWP-001 — Derive `visualRoots`, so it cannot be omitted

**Status:** 📋 open · **Track: the writer** · out of **F43** · blocks nothing, but every hour it is
open is an hour an agent can author an invisible app

## The defect, verified by consequence

A component authored through MCP without `visual_roots` renders **nothing**, and every instrument
reports a pass.

**The mechanism, read in source:**

- `visual_roots` is `z.array(z.string()).optional()` on `stage_plan_operation`
  ([planTools.ts:674](../../../packages/noodl-mcp/src/tools/planTools.ts#L674)) and on
  `update_component`'s `set` ([author.ts:360](../../../packages/noodl-mcp/src/tools/author.ts#L360)),
  and an optional field on `create_component`
  ([author.ts:276](../../../packages/noodl-mcp/src/tools/author.ts#L276)). **The string
  `visual_roots` carries no `.describe()` on any of them, and appears in no tool description
  anywhere in the surface** — verified by grep.
- Both create paths funnel into one place:
  `assembleCreateFiles` writes `...(args.visualRoots?.length ? { visualRoots: args.visualRoots } : {})`
  ([author.ts:134](../../../packages/noodl-mcp/src/tools/author.ts#L134)). Absent in,
  absent out. `assembleSetFiles` does the same at
  [author.ts:156](../../../packages/noodl-mcp/src/tools/author.ts#L156).
- The runtime renders a component instance from `componentModel.roots`, and an empty list renders
  nothing: `if (this._internal.roots.length === 0)`
  ([componentinstance.ts:322](../../../packages/noodl-runtime/src/nodes/componentinstance.ts#L322)),
  populated from `componentData.roots` at
  [componentmodel.ts:494](../../../packages/noodl-runtime/src/models/componentmodel.ts#L494).
- The disk-render harness maps the field straight through:
  `roots: nodesFile.visualRoots || []`
  ([render-from-disk.js:174](../../../scripts/devtools/render-from-disk.js#L174)).

**⚠️ The editor cannot produce this file, and self-heals it on contact.** `visualRoots` is *derived*
there, not authored: `getVisualRootIds()` is `this.roots.filter((root) => root.type.allowAsChild).map((x) => x.id)`
([NodeGraphModel.ts:838](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphModel.ts#L838)),
called inside `toJSON()` at [:848](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphModel.ts#L848),
which `ComponentModel.toJSON()` invokes via `graph: this.graph.toJSON()`
([componentmodel.ts:363](../../../packages/noodl-editor/src/editor/src/models/componentmodel.ts#L363)).
And on the way in, `reconstructLegacyComponent` builds roots from `unflattenNodes(nodesFile.nodes)`
and treats `visualRoots` as *canvas state only*
([ProjectImporter.ts:192,212](../../../packages/noodl-editor/src/editor/src/io/ProjectImporter.ts#L192)).

So: **open an affected project in the editor and save it, and the defect disappears.** That is why
it has never been seen by a human, and why it can only be produced by an agent.

**Measured on the artefact** (DeepSeek V4 Pro's session-8 replay, on a copy so the run stayed
intact):

| probe | result |
|---|---|
| its page restored exactly as `apply_plan` staged it | blank — 0 texts, 0 images |
| `urlPath` flipped `"home"` → `""` | still blank (so not the route) |
| a plain `Text` added to the same page | **renders** (so not the page or the Router) |
| `visualRoots` derived for its 12 components, **nothing else changed** | **clean: 91 texts, 8 images, 0 broken, both viewports**; `validate:project` 0/0 on 108 nodes |

## The fix, in the phase's ordering: structure, not documentation

### §1 Derive it in the writer — one function, both doors

`assembleCreateFiles` and `assembleSetFiles` are the single choke point for `create_component`,
`update_component` and every staged plan operation (they are shared "so a staged plan create and a
direct create can never drift" — the file says so at
[author.ts:100](../../../packages/noodl-mcp/src/tools/author.ts#L100)). Put the derivation there and
all three doors are fixed at once.

**Derive exactly what the editor derives, and no more.** The editor's rule is `root.type.allowAsChild`
over the graph's top-level nodes. On the MCP side the equivalent is: nodes with no parent and not
claimed as anyone's child, whose type the catalog reports `isVisual === true`. Two details that are
not optional:

- **`Component Inputs` / `Component Outputs` must never be roots.** They are top-level and not
  visual; the catalog already answers this, but assert it — an interface node in `visualRoots` is a
  new way to break rendering.
- **An explicit `visual_roots` still wins.** Derivation is the default, not an override. A model that
  passes the field deliberately (all three session-6 models did) must get exactly what it asked for,
  including a deliberate subset of the visual roots.

**Do not derive for logic-only components.** A component with no visual node has no visual root, and
that is a legitimate, renderable-nowhere state — `visualRoots` should stay absent rather than become
`[]`. BEN-003 depends on that distinction being real.

### §2 Report it, so the model learns the model

The write response already reports `registeredPages`. Add `visualRoots` to what a successful
create/update reports back — **derived or explicit, and say which**. A model that sees
`"visualRoots": ["card"], "visualRootsDerived": true` in a result has been taught the concept at the
moment it matters, for about fifteen tokens, which is the documentation this field should have had.

### §3 Repair what is already on disk

Corpus measured 2026-08-08: **134 component `nodes.json` files hold nodes; 11 lack `visualRoots`
while holding visual nodes, and all 11 are in `phase55-s8-deepseek-v4-pro`.** So the repair is one
project today — but it is one project *because* the defect is three days old, not because it is rare.

Ship the derivation as a **read-time fallback as well as a write-time default**:

- `get_component` should report the derived roots when the file has none, so an agent inspecting a
  damaged project sees the truth.
- `render-from-disk` should derive when `visualRoots` is absent rather than rendering empty
  ([render-from-disk.js:174](../../../scripts/devtools/render-from-disk.js#L174)) — the harness
  should agree with `ProjectImporter`, which is the whole point of AWP-002.

⚠️ **Do not write a migration that rewrites every project on disk.** The read-time fallback plus
write-time derivation makes any project correct the next time it is touched, by either producer.
A sweeping rewrite of the corpus would also rewrite the session-8 artefacts, and those are evidence.

## Acceptance

- A `create_component` call with visual nodes and **no** `visual_roots` produces a file whose
  `visualRoots` names the visual top-level nodes, and the component renders.
- The same for `stage_plan_operation` → `apply_plan`, and for `update_component`'s `set`.
- An explicit `visual_roots` is preserved verbatim, including a deliberate subset.
- `Component Inputs`/`Component Outputs` never appear in a derived list.
- A logic-only component gets **no** `visualRoots` key, not an empty array.
- `get_component` and `render-from-disk` both derive when the field is absent.
- **The regression fixture is on disk and free:** `phase55-s8-deepseek-v4-pro` must render
  91 texts / 8 images without any hand-editing. Today it renders 0/0.
- Unit specs in `packages/noodl-mcp/tests`, and the fixture assertion wherever the render harness is
  exercised.

## Register

| # | Finding | State |
|---|---|---|
| A1 | `assembleCreateFiles`/`assembleSetFiles` are shared by all three write doors, so §1 is one change and not three. The comment at author.ts:100 says this was a deliberate anti-drift decision — it now pays for itself | 📋 to build on |
| A2 | The editor repairs the file on open+save, so **any project a human has touched will look fine** and the defect only survives in purely agent-authored projects. Do not conclude from "it works in the editor" that it is fixed | ⚠️ trap, recorded |
