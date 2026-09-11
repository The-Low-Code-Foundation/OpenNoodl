# LEG-007 — notes for the orchestrator

Branch `leg-007`, base `80868946`. One commit: `02acff1a`
(`test(editor): LEG-007 — the guard for a carry nobody had asserted`).

Files in the commit, and nothing else:

- `packages/noodl-editor/tests/nodegraph/paste-carries-labels-and-comments.spec.ts` (new)
- `packages/noodl-editor/tests/nodegraph/index.ts` (**one appended line at the end**, no reformat —
  read back after writing, it is the last line and the file ends with a single `\n`)

This NOTES file is deliberately **not committed**. Phase-50 docs were not touched.

---

## 1. The premise holds. Paste is not losing anything

Read in source at `80868946`, not inherited:

- `NodeGraphNodeSet.clone()` (`NodeGraphNodeSet.ts:30-33`) is `NodeGraphNode.fromJSON(node.toJSON())`.
- `toJSON` emits `label: this._label` (`NodeGraphNode.ts:1577`) and `metadata: this.metadata` (`:1590`).
- `fromJSON` restores `label` (`:165`) and `metadata` through `stripCodeHistoryMetadata` (`:180`).
- Reminting runs *after* the round trip and touches `node.id` plus the connection endpoint map only
  (`NodeGraphNodeSet.ts:36-56`).
- `strip()` deletes `dynamicports` and nothing else (`:81-89`).

So the spec is a regression guard, as LEG-007 says. **One adjacent defect found** — see §4.

## 2. What the spec asserts (11 `it`s, three describes)

`describe('clone() …')`

1. every label carried, nested two deep; the unlabelled node stays unlabelled;
2. every `metadata.comment` carried, nested two deep; the uncommented node gains none;
3. every id reminted, no collision with the source, source untouched, and the one connection —
   whose `fromId` is the **grandchild** — repointed at the clones. A parent-only fixture passes
   with the `forEach` recursion broken, which is why the endpoint is two levels down;
4. `metadata.merge.soureCodePorts` survives and `codeHistory_*` does not (the deliberate strip,
   pinned so that "restoring" it is red rather than twenty code blobs per node coming back);
5. `merge` is *derived* for a source-code port that had none recorded — exercises
   `isSourceCodePort` against the `image.css` port in `tests/nodegraph/nodelibrary.js`;
6. the metadata-aliasing characterisation (§4).

`describe('the OS clipboard …')` — replays `EditorClipboard` verbatim
(`clone()` → `strip()` → `JSON.stringify(toJSON())` → `JSON.parse` → `NodeGraphNodeSet.fromJSON` →
`clone()`), collapsing only the `clipboard.writeText`/`readText` pair into the string they hand each
other. Labels and comments across the boundary; ids reminted and the connection kept; `strip()`
drops `dynamicports` **and leaves label and comment standing**.

`describe('duplicate component')` — the real `ProjectModel.duplicateComponent`, asserting labels,
comments, fresh ids, an untouched original, and that the duplicate gets **its own** metadata objects
(the contrast case for §4). `ProjectModel.instance` is set for the call and restored in `afterEach`.

Fixture: `group > group > image`, labelled and commented at all three depths, plus an unlabelled
`image` carrying a `css` parameter, a pre-set `merge`, and a legacy `codeHistory_css` key.

## 3. The cross-component and cross-project answer — checked, and it is clean

Asked for whichever way it falls. It falls the good way:

- **Cross-component and cross-project paste are the same code path.** `copySelected` writes
  `JSON.stringify(nodeset.clone().toJSON())` to the electron clipboard (`EditorClipboard.ts:59-61`);
  `getNodeSetFromClipboard` does `JSON.parse` → `NodeGraphNodeSet.fromJSON` (`:149`);
  `insertNodeSet` clones once more (`:169`). The only channel is a JSON string, and a second editor
  window / a different project reads that same string. **No allowlist anywhere on that path** —
  `NodeGraphNodeSet.toJSON` forwards to `NodeGraphNode.toJSON`, which emits the whole node.
  Labels and comments cross. This is now covered by the clipboard describe.
- The one thing a cross-project paste *can* lose is a node whose **type** does not exist in the
  target project — `insertNodeSet`'s `checkCreateStatus` rejects the whole paste with a toast. That
  is a node-type question, not a label/comment question, and it is out of LEG-007's scope.
- **`ExtractToComponent.ts` does not serialise at all.** It `removeNodeSet`s the live nodes from the
  source graph and `insertNodeSet`s *the same objects* into the new component's graph
  (`ExtractToComponent.ts:61,75`; `NodeGraphModel.insertNodeSet` just re-parents, it does not clone).
  Labels and comments cannot be lost there by construction, so no spec is warranted — a test there
  would assert that object identity preserves a property.
- ⚠️ **Reading is of commit `80868946` only.** `EditorClipboard.ts` and `ExtractToComponent.ts` are
  both mid-edit and uncommitted in the primary checkout (live extract-to-component work). Anything
  in §3 about those two files may have moved underneath me; the line numbers are from the committed
  version this worktree holds. The spec itself depends on `NodeGraphNodeSet`/`NodeGraphNode`, which
  are **not** among the dirty files, so the *assertions* are not exposed to that — only my prose
  about the clipboard call sites is.

## 4. The one real defect found, recorded and NOT fixed

**`clone()` hands the copy the same `metadata` object as its source.** `toJSON` emits
`metadata: this.metadata` by reference, and `stripCodeHistoryMetadata` returns its argument
untouched when there is nothing to strip — so for any node with clean metadata,
`clone.metadata === source.metadata`. Every other field is deep-copied (`parameters`,
`stateParameters`, `ports`, … all go through `JSON.parse(JSON.stringify(...))`); `metadata` is the
exception.

Consequence: editing the copy's comment rewrites the original's, and vice versa. Reachable through
(a) `EditorClipboard.paste()`'s in-memory fallback, taken whenever the OS clipboard holds text that
is not a parseable node set — `this.clipboard` is a `clone()` of the **live** nodes, so the pasted
nodes share metadata objects with the graph they were copied from; and (b) any direct
`insertNodeSet` caller holding live nodes (AI assistant, node-set import).

Related, same root: `toJSON`'s source-code-port loop does `json.metadata.merge = …` on that shared
reference, so **serialising a node mutates the node's own metadata** (`NodeGraphNode.ts:1596-1602`).
Harmless today because the value it writes is the value it derives.

I did not fix it — LEG-007's remit is a regression spec, and the value carry it specs is not broken.
The fix is one line in `NodeGraphNodeSet.clone()`, matching what `duplicateComponent` already does:

```ts
clones.push(NodeGraphNode.fromJSON(JSON.parse(JSON.stringify(this.nodes[i].toJSON()))));
```

When that lands, the characterisation `it` in the spec
(`shares the metadata object with its source — a defect, recorded, not endorsed`) flips from
`toBe` to `not.toBe` plus an independence assertion; the duplicate-component describe already has
the independence assertion written, so copy it from there. **It is a green test over a defect** —
if that is not wanted, delete that one `it` and file the defect instead; everything else stands.

## 5. The exact red-proof edits (I could not run them — see §6)

Each is a single-line local edit; run the suite, read the `Jasmine:` line, revert.

| # | Edit | Expected red |
|---|---|---|
| A | `NodeGraphNode.ts:1577` — delete `label: this._label,` from `toJSON()` | the two label `it`s, the clipboard label `it`, the duplicate label `it`, and the remint `it` (it locates clones by label) |
| B | `codeHistoryMetadata.ts:33` — change the filter to `.filter((key) => key.startsWith(CODE_HISTORY_METADATA_PREFIX) \|\| key === 'comment')` | the three comment `it`s only. **This is the most faithful simulation of the regression the phase fears** — a second strip added beside the first, exactly what LEG-001 makes tempting |
| C | `NodeGraphNode.ts:1590` — delete `metadata: this.metadata` from the `toJSON()` literal | every comment `it`, the `merge` `it`, the derived-`merge` `it`, and the aliasing `it` — the blunt version of B |
| D | `NodeGraphNodeSet.ts:39-42` (the `clones[i].forEach` block) — replace `clones[i].forEach(function (node) { … })` with the same body applied to `clones[i]` alone (kill the recursion) | the remint `it` only, via the grandchild connection endpoint. Proves the nesting is doing work |

A is the one the acceptance names. B is the one worth keeping in the phase record.

## 6. Could not verify

- ⚠️ **The spec has never been executed.** The editor Jasmine suite cannot be run from this worktree
  (`lerna exec` resolves to the primary checkout's source, and `test:ci`/`dev:stop` sweep processes
  by checkout, which would reap two live sibling sessions). So: **assertions unproven green,
  and the red-proof edits in §5 unproven red.** Both are the orchestrator's one step.
- What *was* verified here: `npm run typecheck:editor-tests` equivalent —
  `tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit` — **clean**, with `--listFiles`
  confirming the new spec is in the program (it is a real gate: `tsconfig.json` excludes `tests/`,
  `tsconfig.tests.json` includes it). `prettier --check` clean on both files. The barrel export was
  read back after writing.
- ⚠️ When the suite is run: **only the `Jasmine:` summary line counts.** A process exit code lies
  here, and a backgrounded run's exit code lies twice. Do not run it with a dev stack live.
- **Order dependence to watch on one `it`.** `isSourceCodePort` memoises on
  `typename-parameterName` in a module-level `Map` that nothing clears between specs. No spec in the
  suite today resolves `image-css`, so the derived-`merge` `it` should be safe, but if that single
  `it` ever goes red on its own, that cache is the first place to look. It is noted in the spec too.
- **Fixture-library side effect.** The spec does the established
  `window.NodeLibraryData = require('./nodelibrary'); NodeLibrary.instance.loadLibrary()` in
  `beforeAll` (as `hierarchy.js`, `conflictwarnings.js` and five others do). If a spec that runs
  after mine assumes a different library and does not load its own, that is a pre-existing
  suite-wide hazard, not one this file introduces — but I could not run the suite to confirm nothing
  downstream depends on the library my `beforeAll` leaves installed.
- **`ProjectModel.instance` is set and restored** around the duplicate-component describe. The
  setter registers/unregisters the project as a `NodeLibrary` module and fires two
  `EventDispatcher` notifications; unverified that no other spec's listener reacts badly.

## 7. Deviations from the spec's letter

1. **Placed beside `extract-to-component.spec.ts` — which does not exist at `80868946`.** The spec
   names it as the neighbour; there is no such file in `tests/nodegraph/` on this commit, and
   `tests/components/index.ts` is dirty in the primary checkout, so it is almost certainly the
   sibling session's uncommitted work. I did not go looking and I deleted nothing on that inference.
   The new file went in `tests/nodegraph/` as instructed; if the sibling's spec lands there too,
   they are neighbours as intended.
2. **The barrel line is appended at the end, not in alphabetical order** (the rest of the file is
   alphabetical). Instructed, to keep the hand reconciliation with the sibling's edit to one line.
3. **Three assertions became eleven `it`s.** The spec's three are all present; the extras are the
   unlabelled/uncommented controls, the clipboard boundary, duplicate-component, the derived-`merge`
   case, and the aliasing characterisation.
4. **Copy→paste is specced at the serialisation boundary, not through `EditorClipboard`.** Driving
   `EditorClipboard` needs a live `NodeGraphEditor`, a selector, a comment layer and electron's
   clipboard; the spec would then be mostly harness. The helper replays the exact call sequence with
   its line numbers cited, and the only elided step is a string going into and out of the OS
   clipboard. Worth knowing: the `EditorClipboard` glue itself is therefore still unguarded — if
   someone re-orders those calls or drops the `strip()`, this file will not notice.
5. **No assertion on `NodeGraphNodeSet.comments`** (the canvas comment regions). They are a
   different feature from `metadata.comment` and out of the phase's scope; the file header says so
   to stop the next reader conflating them.

## 8. Register entry text — for the orchestrator to fold into the spec file

Replace the L22 row and add three:

| # | Finding | State |
|---|---|---|
| L22 | `EditorClipboard.ts` read at `80868946`: copy writes `JSON.stringify(toJSON())` to the OS clipboard and paste reads it back through `fromJSON`. **Cross-component and cross-project paste are the same path, and no allowlist exists on it** — both fields cross | ✅ checked, clean |
| L23 | `clone()` gives the copy the **same `metadata` object** as its source — `toJSON` emits it by reference and `stripCodeHistoryMetadata` passes a clean bag through untouched. Editing a pasted node's comment rewrites the original's, via the in-memory clipboard fallback and any direct `insertNodeSet` caller. Every other field is deep-copied. Recorded in the spec as a characterisation; the fix is one line in `clone()` | 📋 open, not fixed here |
| L24 | `ExtractToComponent` never serialises — it moves the live node objects between graphs. Labels and comments cannot be lost there, and a spec would be asserting that object identity preserves a property | ✅ checked, no work |
| L25 | The spec is committed and exported, but **has never been executed and has never been seen to go red**. §5 of the notes lists the four one-line edits and which `it`s each should turn | ⚠️ the acceptance gap |
