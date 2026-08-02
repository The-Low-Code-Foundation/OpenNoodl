# LIB-006 legacy-import fixtures

Two projects and their committed import reports. The reports are the acceptance
artifact for [LIB-006](../../tasks/phase-21-library-and-import/LIB-006-LEGACY-IMPORT-ASSIST.md);
`packages/noodl-editor/tests-unit/lib-006/fixture.test.ts` regenerates and diffs them.

```
UPDATE_LIB006_FIXTURES=1 npx jest tests-unit/lib-006/fixture   # regenerate
npx jest tests-unit/lib-006                                    # gate
```

The assessment runs against the **real** bundled node catalog, so a catalog
change that alters a classification fails the diff. That is intended: the report
is a claim about what NodeGX can convert, and it should not be able to change
quietly.

---

## `real-noodl-form/` — a genuine Noodl 2.x project

`library/prefabs/form/project/project.json`, snapshotted at `32e3a946`, before
phase 21's prefab overhaul touches it. 13 components, 82 nodes, authored in Noodl
2.x by the original library authors — not written for this test.

**It converts completely.** 82 of 82 constructs, verdict `proceed`, zero
placeholders, nothing for an assistant to do.

That is the acceptance evidence, and it is also the finding. PLAT-003 kept every
deprecated node registered rather than deleting it, and no legacy Noodl node type
was ever removed during the revival — so a Noodl 2.x graph resolves almost in
full. A test that "passes trivially" here is reporting a real property of the
product. If it ever starts failing, a node type was removed and
[the inventory table](../../tasks/phase-21-library-and-import/LIB-006-LEGACY-CONSTRUCT-INVENTORY.md)
needs a new row.

## `synthetic-unconvertible/` — written to exercise the placeholder path

**This one is synthetic and is labelled so deliberately.** LIB-006's risk table
says: *"If no genuinely old project can be found, say so plainly rather than
substituting a synthetic fixture and calling it verified."*

So, plainly: **no genuinely-old project in this repo exercises the placeholder
path**, for the reason above — the legacy node surface survives. The constructs
that do not convert are the five `noodl.byob.*` types, which are *pre-BCN-004
NodeGX* rather than Noodl, and which no checked-in project uses. Every complete
legacy project in the repo (60 of them) was surveyed; across 136 distinct type
strings, three fail to resolve and all three are module-provided.

This project therefore exists to run the code, not to prove a legacy project
behaves this way. It carries one of each:

| Construct | Expected outcome |
|---|---|
| `noodl.byob.QueryData`, `CreateRecord` | `placeholder`, with a known equivalent |
| `noodl.byob.SubscribeToChanges` | `placeholder`, rebuild — no node replaces it |
| `SomeModuleProvidedNode`, no module travelling | `placeholder` |
| `REST2` with no scripts | `converted-with-changes` → `net.noodl.HTTP` |
| `REST2` with a `requestScript` | `converted` — left alone, the code would be lost |
| `Label` | `converted`, deprecated note, aggregated per type |
| `findDOMNode` in a Function node | `converted`, flagged as a React 19 removal |
| `deviceSettings` | `dropped` |
| `thumbnailURI` | `dropped`, but `benign` — regenerated, so not an action item |
| `rootComponent`, `version: 1` | `converted-with-changes` |
| `metadata.cloudservices` | `converted`, unverifiable |

Verdict: `rebuild` — 10 nodes, 38% unconverted, which is exactly the case the
compatibility policy's worked example describes.

## What these fixtures do not prove

- **That the imported app runs.** Explicitly not promised, by the policy.
- **That the placeholder path behaves on a real old project.** Nothing available
  can show that; see above.
- **That an assistant repairs a construct end to end.** The hand-off is wired
  (`ContextBuilder.importReport()`, the MCP `get_import_report` tool) and unit
  tested, but a live agent run against a real provider was not performed —
  see `LIB-006-NOTES.md`.
