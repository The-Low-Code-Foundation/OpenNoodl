# AIX-004 — Explain Mode: As-Built Notes

_Executor: Opus 4.8. Committed to `cline-dev`._

## 1. Shape of the thing

Four layers, each testable without the one above it:

```
graph.ts        live ComponentModel ─┐
                serialised project ──┴─→ ExplainGraph   (plain data, read-only)
assemble.ts     ExplainGraph + request ─→ ExplainContext (bounded, counted)
render.ts       ExplainContext        ─→ the text the model reads
prompts.ts      + system prompt, scope framing, brevity control
ExplainSession  → AiClient.chatStream, conversation, follow-ups
ExplainPanel    → sidebar UI, streaming, citations → canvas
```

The seam that matters is `ExplainGraph`. Because both the editor models and a serialised
`project.json` adapt into it, **every context spec runs over the real project corpus**
(`tests/testfs/`) with no editor, no canvas and no network — the same corpus SUB-006's
false-positive suite uses. Context assembly is the part of this feature where correctness
is checkable, and this is what made it checkable.

## 2. Why assembly, not prompting, got the effort

The spec said the quality lever is context. Two things follow from taking that seriously:

**Only referenced ports are documented.** A `Group` node carries ~80 ports. Including the
catalog entry for every port of every node type would spend the whole budget on ports
nobody connected. Assembly collects the port names actually referenced — by a connection
or by an authored parameter — and documents only those. On the corpus's `Collection2`
that is 2 ports instead of 20.

**Defaults are excluded, authored values are not.** `graph.ts` reads `node.parameters`
directly rather than through `NodeGraphNode.getParameter`, which falls back to the port
default. A default tells the model nothing the catalog has not already said; an authored
value is the entire difference between "a Condition node evaluates a condition" and "this
Condition only passes the signal when the toggle is true".

**Long values are truncated, never dropped.** A `JavaScriptFunction`'s `functionScript` is
the most informative thing in its node and also the longest. Truncation with an explicit
marker keeps the first 400 characters, which is usually the part that says what it does.

## 3. Roles are how "what feeds this" survives serialisation

Every node in context carries a role: `selected`, `container` (parent/child in the visual
hierarchy), `upstream`, `downstream`, `peer`. The role is fixed by the **first** hop that
reached the node, so a node found two hops upstream stays `upstream` even though the walk
continued in both directions from there. Without that, a depth-2 walk labels half the
graph as both.

Roles also drive the budget: when the node cap bites, `peer` goes first and `selected`
never goes at all. A truncated explanation is acceptable; one that dropped the node the
user asked about is not.

Scope changes the defaults rather than the algorithm — `node` gets depth 2 and 12
parameters each, `component` gets depth 0, every node, and 6 parameters each. Explaining
one node wants depth; explaining a page wants breadth at shallower detail.

## 4. Citations, and the one thing this feature has that code explanation does not

The model is required to cite nodes as `[Display Name](noodl-node:ID)`. That is an
ordinary markdown link with a custom scheme, which means:

- Remarkable renders it as an `<a href="noodl-node:…">` **without stripping the scheme**
  (verified — an unknown protocol survives its link normaliser).
- One delegated listener on the container handles every citation, including ones that
  appear mid-stream. No custom markdown renderer, no re-parse per delta.
- Hover → `HighlightManager` on the `selection` channel; click → `switchToComponent` with
  a `{ id }` node stand-in, the same call the Problems panel makes.

**Unresolved citations are degraded to plain text before render.** A model that invents an
id would otherwise produce a link that goes nowhere, which reads as an editor bug rather
than a model mistake. Stripping happens once, on completion, not per delta — doing it per
delta makes a citation flicker between link and text as its id streams in character by
character.

## 5. Read-only is structural, and there is a spec that says so

The panel states "asking never changes your project", so that had to be true by
construction rather than by intention. A session holds an `ExplainGraph` — plain objects
produced by the adapters — never a `ProjectModel`, `ComponentModel` or `NodeGraphNode`.
There is no reference through which a write could happen even by accident.

Two specs enforce it: one walks the whole assembled context asserting every reachable
object is a plain object or array (a model class would bring `set`/`notifyListeners` with
it), and one pins the session's public method list, so adding a write path fails the
suite.

## 6. Findings

1. **The enriched catalog had no editor-side loader.** SUB-005's semantics were reachable
   only from `packages/noodl-mcp`, which esbuild-bundles editor sources — a dependency
   that runs mcp → editor and cannot be reversed. Added
   `validation/enrichedCatalog.ts`, lazily loaded so nothing pays the ~1.45 MB until a
   feature asks. `noodl-mcp/src/catalog.ts` still has its own copy of the same idea; see
   §7.
2. **`Markdown` in `noodl-core-ui` renders with `html: true`.** Correct for authored copy,
   wrong for anything a model wrote — it would execute markup straight from the model into
   the editor's renderer process. `ExplanationView` renders its own Remarkable instance
   with `html: false`. The shared component's other callers were left alone, but this is
   worth knowing before the next feature renders model output with it.
3. **A component has no port declaration of its own.** Its interface is whatever its
   `Component Inputs` / `Component Outputs` (and `PageInputs`) nodes expose. Both adapters
   derive it the same way rather than going through `ComponentModel.getPorts()`, which
   derives *types* from connections and inverts `plug` in a way that is correct for its own
   caller and confusing everywhere else.
4. **`node.label` is not "the label the user typed".** The getter falls back to
   `type.labelForNode(node)`, so an unlabelled node reports a type-derived string.
   Assembly drops a label that equals the node type's display name — otherwise every node
   in context carries its own type name twice.
5. **`useEventListener.ts` still logs a module-load banner** —
   `🔥🔥🔥 useEventListener.ts MODULE LOADED WITH DEBUG LOGS - Version 2.0 🔥🔥🔥` at
   module scope. Same class of leftover as the 16 emoji `console.log`s PLAT-003 slice 2
   removed from the runtime. Not touched here (it is not this task's file), but it fires
   on every editor boot.

## 7. Open items

- **No live provider run.** Every spec is offline. The register, the citation rate and the
  actual usefulness of an explanation cannot be judged without running it against a real
  model — that is steps 6 and 7 of the spec (register tuning with two reader types, and
  the accuracy pass over a corpus), and both need a human with keys. This is the same gap
  AIX-001 recorded, and it is now the gap for two tasks.
- **Beginner comprehension check not run** (success criterion: a non-Noodl reader
  describes a page's behaviour from the explanation alone). Needs a reader.
- **`noodl-mcp/src/catalog.ts` and `validation/enrichedCatalog.ts` both load the enriched
  catalog.** The projections differ (mcp returns tool payloads, this returns context
  records) so it is not pure duplication, but the loader half is. The right fix is for the
  editor to own the loader and mcp to import it through `editor-deps`, which is how mcp
  already gets `CatalogIndex`.
- **The editor now bundles both catalogs** — `node-catalog.json` (validator, ~1.02 MB) and
  `node-catalog-enriched.json` (this, ~1.45 MB). The enriched file is a superset, and
  `noodl-mcp` already runs `CatalogIndex` over it for validation on the grounds that "the
  validator and the documentation tools can never disagree about a type". Pointing
  `validation/catalog.ts` at the enriched file would save ~1 MB and remove the second
  copy; it was left alone here because it changes a completed task's (SUB-006's) input,
  and that deserves its own change with its own corpus run rather than riding along.
- **Explanations cannot cross a component boundary.** Selecting a component instance
  explains the instance and its wiring, not what the instance does inside. That is the
  bound that keeps context small, but "what does this sub-component actually do" is an
  obvious next question — a bounded one-level descent into a cited component is the
  natural follow-on, and AIX-003 will want it too.

## 8. Verification

- `npm run typecheck:editor` — clean.
- `npm run test:ci` — **1107 specs, 0 failures** (1060 before; +47 AIX-004 specs).
- `npx eslint` clean on every new file.
- `node scripts/tsfixme-ratchet.js` — this task adds **zero** new `TSFixme`/`any`/ignores.
  (The tree also carries PLAT-003 slice 7's in-flight `std-library/data/` conversion,
  which is +4 `any`; not absorbed here, and the baseline was deliberately not moved.)
- Live editor pass: see §9.

## 9. Live editor pass

See the CHANGELOG in the task doc.
