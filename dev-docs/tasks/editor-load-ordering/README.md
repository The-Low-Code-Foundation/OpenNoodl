# Editor load ordering (Track ELO)

**Created:** 2026-08-11, out of SIG-005's **R8** — a defect found while measuring the wire pulse,
filed rather than fixed, and explicitly *not* a phase-60 task.

The editor boots before it knows what a node is. `window.NodeLibraryData` is not on disk and not in
the bundle: the viewer delivers it over `ViewerConnection`, `NodeLibraryImporter` merges it, and only
then calls `NodeLibrary.instance.reload()`
([`NodeLibraryImporter.ts:315`](../../../packages/noodl-editor/src/editor/src/models/nodelibrary/NodeLibraryImporter.ts#L315)).
Everything the editor builds before that moment is built against a library that answers *nothing* —
`getNodeTypeWithName` returns undefined, `type` falls back to an `UnknownNodeType`, and an
`UnknownNodeType` declares no ports at all.

That window is short and it is invisible, and the editor is mostly correct across it because the node
library broadcasts `libraryUpdated` and several listeners re-derive. **This track is for the places
where something derived inside that window is kept afterwards.** They share a signature: correct on
the second look, wrong on the first, and self-healing the moment the user does anything — which is why
none of them have ever been reported.

| Task | One line | State |
|---|---|---|
| [ELO-001](ELO-001-A-PORT-LIST-CACHED-BEFORE-THE-LIBRARY.md) | a node's port list is memoised from a type the library could not answer for, so the first graph a project opens paints signal wires in the data colour | ✅ **closed 2026-08-11** |

## The rule this track exists to state

**A value derived while the node library was empty is a "don't know yet", not an answer, and must not
be memoised.** The `[]` that an `UnknownNodeType` yields is *truthy*, so every `if (!cache)` guard in
the editor is blind to the difference between "not computed" and "computed against nothing". Grep for
that shape before adding a cache keyed on `type`.

## What is *not* in scope

Making the library synchronous, or gating the editor's first paint on it. Both are much larger changes
to the boot path, and neither is needed: the broadcast already exists and the listeners already fire.
The bugs here are in what the listeners find when they run.
