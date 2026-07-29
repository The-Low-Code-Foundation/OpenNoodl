# NDA-001 corpus — the viewer half

Rows R8, R9, E7, F2 and F3 live here because the nodes they name do: `States`,
`Collection2` (the Array node), `Show Popup` and `Columns` are all viewer nodes.

The other half is in `packages/noodl-runtime/test/corpus/`, and so is everything shared: the
graph harness, the `test.failing` declaration, the row-by-row status table, the mapping from
corpus rows to the later tasks that turn them green, and the recorded limitations.

**Read that one:** [`../../../noodl-runtime/test/corpus/README.md`](../../../noodl-runtime/test/corpus/README.md)
