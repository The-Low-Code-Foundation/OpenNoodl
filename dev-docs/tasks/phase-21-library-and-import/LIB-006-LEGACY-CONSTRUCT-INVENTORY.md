# LIB-006 — Legacy construct inventory

**Status:** committed as the scope boundary for LIB-006, per the task's step 1 and its risk table.
**Derived:** 2026-08-02, from the node catalog, the runtime's deprecation flags, git history, and a
survey of every complete legacy project checked into this repo.

> **This table is the scope boundary, not a wish list.** Adding a construct to the "convert it"
> column needs a reason that is not "it would import better" — that is the reflex
> [`COMPATIBILITY-POLICY.md`](../../reference/COMPATIBILITY-POLICY.md) removes. Anything not listed
> here is out of scope by default, and the honest answer for it is a report entry.

---

## 1. The outcome taxonomy

Four outcomes. They are defined by a **test**, not by a feeling, so that two converters classify the
same construct identically.

| Outcome | Definition | The test | Report entry |
|---|---|---|---|
| **`converted`** | Carried into the target unchanged. | The construct's type name resolves in the target after the import (node catalog, or a module imported alongside), **and** no parameter, port name, or wiring was rewritten. | Counted only |
| **`converted-with-changes`** | Carried across, but rewritten. Behaviour may differ. | The construct exists in the target under a **different type name**, or with **renamed/dropped parameters or ports**. | Always, naming exactly what changed |
| **`placeholder`** | Could not be converted. Left in the project **exactly as authored** — original type name, original parameters, original wiring — and marked so the editor and SUB-006 show it as an error. It does not run. | The construct's type name resolves **nowhere** after the import completes. | Always, with the catalog's nearest equivalents |
| **`dropped`** | Deliberately not carried into the target at all. | Nothing corresponding exists in the target project. | Always, saying what was lost |

**Tie-break rule.** Evaluate in the order above and take the **first** outcome the construct
qualifies for. A node whose type resolves is `converted` even if the importer considered rewriting
it; a node that was rewritten is `converted-with-changes` even if the rewrite was lossless as far as
we know. This ordering is what makes the classification reproducible.

**`dropped` is tightly rationed.** It is permitted only for constructs that have *no* representation
in a NodeGX project (§3 lists the two). Everything else that cannot convert is a `placeholder`,
because a placeholder is repairable and a drop is not.

---

## 2. Node types

### 2.1 The headline finding: the legacy node surface almost entirely survives

This is the finding that should shape the rest of LIB-006, and it contradicts the premise the task
was written on.

- The node catalog carries **153 node types**. **30** are flagged `isDeprecated`.
- Those 30 deprecated types are **still registered in the runtime** — hidden from the picker, not
  deleted. `packages/noodl-viewer-react/src/nodes-deprecated/` (24) plus 6 registered in place.
  This is PLAT-003's shipped compromise, which `COMPATIBILITY-POLICY.md` reopened but which no task
  has yet acted on.
- Git history over `packages/noodl-viewer-react/src/nodes/**` and `packages/noodl-runtime/src/**`
  shows **no legacy Noodl node type was ever deleted** during the revival. Every `--diff-filter=D`
  hit is a PLAT-003 `.js` → `.ts` rename of the same node.
- The only node types genuinely removed are the **BYOB family** (5 types, commits `8eed8141` and
  `9d050626`) — and those never existed in Noodl 2.x. They are a *NodeGX-era* legacy, not a Noodl
  one.

**Therefore: a legacy Noodl project's node graph imports as `converted` almost in full.** The
unconvertible surface is not node types. It is modules, backend configuration, and user JavaScript
(§3). LIB-006's placeholder machinery is still required — but it will fire rarely on a Noodl 2.x
project and often on a *pre-BCN-004 NodeGX* project, which is the opposite of what the spec assumed.

**Corpus evidence.** Every complete legacy project checked into this repo (60 of them: 33 prefabs +
25 modules in `library/**`, plus `project-examples/agent-chat` and `dev-docs/qa-fixtures/`) uses
**136 distinct type strings**. Of those, exactly **3** do not resolve in the catalog — `Avatar`,
`Markdown`, `module.inlineHtml` — and all three are **module-provided** (§3.1). Zero of the 30
deprecated types appear anywhere in the corpus.

### 2.2 Deprecated-but-present → `converted`

All 30 import unchanged and keep working. The report **notes** them (with the replacement, so an
assistant can offer to modernise) but does not rewrite them: rewriting a working node is a
behaviour change the user did not ask for, and the ordering rule in §1 puts `converted` first.

The replacement column is **not authored here** — it is read from
`packages/noodl-types/src/node-catalog-enriched.json` → `enrichment.relatedNodes`, which already
carries it. LIB-006 consumes that field; it does not maintain a second copy.

| Legacy type | Display | Category | NodeGX replacement (`enrichment.relatedNodes`) |
|---|---|---|---|
| `Animation` | Animation | Animation | `States`, `net.noodl.animatetovalue`, `Color Blend` |
| `Transition` | Transition | Animation | `net.noodl.animatetovalue`, `States` |
| `Cloud Function` | Cloud Function | Cloud Services | — (none) |
| `DbCollection` | Query Collection | Cloud Services | `DbCollection2`, `FilterDBModels`, `DbModel2` |
| `DbModel` | Model | Cloud Services | `DbModel2`, `NewDbModelProperties`, `SetDbModelProperties`, `DeleteDbModelProperties` |
| `net.noodl.user.RequestPasswordReset` | Request Password Reset | Cloud Services | — (none) |
| `net.noodl.user.ResetPassword` | Reset Password | Cloud Services | — (none) |
| `net.noodl.user.SendEmailVerification` | Send Email Verification | Cloud Services | — (none) |
| `net.noodl.user.VerifyEmail` | Verify Email | Cloud Services | — (none) |
| `Component State` | Component Object | Component Utilities | `net.noodl.ComponentObject`, `net.noodl.SetComponentObjectProperties` |
| `Parent Component State` | Parent Component Object | Component Utilities | `net.noodl.ParentComponentObject`, `net.noodl.SetParentComponentObjectProperties` |
| `Collection` | Array | Data | `Collection2`, `CollectionInsert`, `CollectionRemove`, `CollectionClear`, `CollectionNew` |
| `Model` | Object | Data | `Model2`, `NewModel`, `SetModelProperties` |
| `REST2` | REST | Data | `net.noodl.HTTP`, `JavaScriptFunction`, `CloudFunction2` |
| `Variable` | Variable | Data | — (none) |
| `Number Blend` | Number Blend | Interpolation | `Number Remapper`, `net.noodl.animatetovalue`, `Color Blend` |
| `Script Downloader` | Script Downloader | Javascript | `JavaScriptFunction`, `Javascript2` |
| `Signal To Index` | Signal To Index | Logic | `States`, `Switch` |
| `Gyroscope` | Device Orientation | Sensors | `JavaScriptFunction` |
| `Globals` | Globals | Utilities | `Variable2`, `Set Variable`, `Model2` |
| `String Selector` | Index To String | Utilities | — (none) |
| `Button` | Button | Visual | `net.noodl.controls.button` |
| `Checkbox` | Checkbox | Visual | `net.noodl.controls.checkbox` |
| `Field Set` | Field Set | Visual | `Group`, `Form` |
| `Form` | Form | Visual | `Group`, `net.noodl.controls.textinput`, `net.noodl.controls.button` |
| `Label` | Label | Visual | `Text` |
| `Options` | Options | Visual | `net.noodl.controls.options` |
| `Radio Button` | Radio Button | Visual | `net.noodl.controls.radiobutton` |
| `Range` | Range | Visual | `net.noodl.controls.range` |
| `Text Input` | Text Input | Visual | `net.noodl.controls.textinput` |

### 2.3 Removed node types → `placeholder`

The only node types that resolve nowhere. All five are pre-BCN-004 NodeGX, not Noodl 2.x.

| Removed type | Was | Removed in | Nearest NodeGX equivalent | Outcome |
|---|---|---|---|---|
| `noodl.byob.CreateRecord` | Create Record | `8eed8141` | `NewDbModelProperties` (Create Record) | `placeholder` |
| `noodl.byob.UpdateRecord` | Update Record | `8eed8141` | `SetDbModelProperties` (Update Record) | `placeholder` |
| `noodl.byob.DeleteRecord` | Delete Record | `8eed8141` | `DeleteDbModelProperties` (Delete Record) | `placeholder` |
| `noodl.byob.QueryData` | Query Data | `8eed8141` | `DbCollection2` (Query Records) | `placeholder` |
| `noodl.byob.SubscribeToChanges` | Subscribe To Changes | `9d050626` | `RealtimeSubscription` (no node; see BCN-008) | `placeholder` |

These are **not** auto-converted. The replacements have different port names (`8eed8141` records
`records`→`items`, `fetch`→`storageFetch`, `create`/`update`/`delete`→`store`,
`success`→`created`/`stored`/`deleted`), so a rewrite would silently re-point wires onto ports that
mean something different. The report names the replacement and the port deltas; the repair is the
assistant's, through AIX-002's diff review, where a human sees it.

### 2.4 The one mechanical conversion worth taking → `converted-with-changes`

`REST2` → `net.noodl.HTTP`, **conditionally**. NDA-011 assessed this and stopped precisely here:
`restnode.ts:91–97` says HTTP Request covers everything REST does *declaratively*, but REST's two
`new Function` scripts (`requestScript`, `responseScript`) have no equivalent, "and the conversion
path belongs to LIB-006."

So the conversion is gated on the scripts being absent or empty:

| Condition | Outcome | Why |
|---|---|---|
| `requestScript` and `responseScript` both absent/blank | `converted-with-changes` → `net.noodl.HTTP` | The declarative subset is a true subset; `resource`→`url`, `fetch`→`fetch`, `success`→`success`, `failure`→`failure`, `cancel`→`cancel`, `canceled`→`canceled` |
| Either script is non-empty | `converted` (left as `REST2`) | `REST2` still runs. Rewriting would drop executable user code — the one thing the policy's non-negotiable #1 forbids. Report entry recommends the manual path (`net.noodl.HTTP` + `JavaScriptFunction`). |

`method` has no HTTP Request input and is not carried; the report says so. `dynamicPorts` on `REST2`
are `runtime-discovered` from the scripts, so the gated form has none by construction.

**This is the only node-type rewrite LIB-006 takes.** Every other deprecated→replacement pair in
§2.2 is a *recommendation* in the report, not a rewrite, because the source node still works and the
target ports differ.

---

## 3. Non-node constructs

This is where the real unconvertible surface is.

### 3.1 Module-provided node types → depends on the module

A `noodl_modules/<name>/` directory ships arbitrary JavaScript that registers node types at load
time. Nothing static can enumerate them: `manifest.json` declares `name`, `type`, and asset lists,
**not** the node types the module registers.

| Case | Outcome | Rule |
|---|---|---|
| Type unresolved, **and** the source's modules are being imported alongside | `converted` | The module will register the type at load. Assuming otherwise would mark every working module prefab as broken — 47 `Avatar` instances in this repo's own corpus. |
| Type unresolved, **and** no module is coming with it | `placeholder` | Nothing will ever provide the type. |

The report states the assumption explicitly in the first case, because it *is* an assumption: a
module can fail to load, or can register different types than it used to. This is the honest form —
not a silent pass, and not a false alarm.

### 3.2 Backend / cloud services

| Construct | Outcome | Notes |
|---|---|---|
| `metadata.cloudservices` (`endpoint`, `appId`, `instanceId`, `type`) | `converted` | Still read. `BackendServices/activeBackend.ts` resolves it as a selectable backend; WF-007 moved the *UI* to the Backend Services panel but kept the field as the endpoint's configuration. |
| `metadata.dbCollections` (cached Parse schema) | `converted` | Still read by `utils/schemahandler.ts` and `AiAssistant/DatabaseSchemaExtractor.ts`. |
| A **live Parse server** behind that endpoint | out of scope | LIB-006 converts files. Whether the endpoint answers is not an import outcome. The report notes that the project points at an external backend it cannot verify. |

### 3.3 Project-level fields

| Field | Outcome | Evidence |
|---|---|---|
| `rootComponent` (component *name*) | `converted-with-changes` → `rootNodeId` | Already handled: `projectmodel.ts:207–213`. `toJSON` emits only `rootNodeId`, so the field name changes on the round trip. |
| `version` (`0`–`3`) | `converted-with-changes` → `4` | `ProjectModel.Upgraders` chain, `projectmodel.ts:238–245`. Already handled. |
| `runtimeVersion` absent | `converted` | Deliberately **not** defaulted on load (`projectmodel.ts:158–161`) so a legacy project is not corrupted; the runtime scanner detects it. |
| `settings`, `metadata.styles`, `variants`, `lesson` | `converted` | Round-tripped by `toJSON`. |
| **`deviceSettings`** | **`dropped`** | `projectmodel.ts:155` and `:1356` — both the read and the write are commented out. A project carrying it loses it on the first save, **today, silently**. LIB-006 makes it a report entry; it does not restore it. |
| **`thumbnailURI`** | **`dropped`** | `projectmodel.ts:151` and `:1350`, same shape. Regenerated by the launcher, so the loss is benign — but it is still a loss and still gets an entry. |

These two are the entire `dropped` column. Both are pre-existing silent drops that this inventory
found by reading `toJSON`; making them visible is exactly what the task is for.

### 3.4 User JavaScript

Code inside `JavaScriptFunction`, `Javascript2`, `Expression`, `CSS Definition`, and a module's
`index.js` is not analysable against the catalog. LIB-006 does not attempt to.

| Construct | Outcome | Notes |
|---|---|---|
| Function/Script node bodies | `converted` | Carried verbatim. |
| …containing a React 18→19 removal | `converted`, **flagged** | `models/migration/ProjectScanner.ts` `LEGACY_PATTERNS` already detects these 9 patterns (`findDOMNode`, string refs, `ReactDOM.render`, legacy context, `createFactory`, …). LIB-006 **consumes** that scanner; it does not restate the patterns. |
| …calling a removed runtime API | `converted`, unflagged | Out of scope. Detecting arbitrary API use in user code is a static-analysis project, not an import feature. The report says plainly that user code was not analysed beyond the React delta. |

---

## 4. What is deliberately not on this list

Recorded so the next agent does not re-litigate it:

- **Auto-modernising the 30 deprecated nodes.** They work. Rewriting them is a behaviour change
  nobody asked for, and the ports differ in most pairs. The report recommends; the assistant, with a
  human at the diff, rewrites.
- **A runtime placeholder node type.** See LIB-006-NOTES.md §"Deviations" — the placeholder is the
  *unresolved node itself*, marked. Adding a node type would destroy the original type name, break
  the module case in §3.1, and add a new runtime node type that phase 21's README excludes.
- **Static analysis of user JavaScript** beyond the React 18→19 delta that already exists.
- **Verifying a legacy project's external backend.**
- **The v1→v2 file-layout migration.** SUB-003 owns it; LIB-006 consumes it via `projectFromDirectory`.
- **Restoring `deviceSettings`.** It is reported as lost, not resurrected. Nothing reads it.

---

## 5. How this table was derived

Reproducible, so it can be re-derived when the catalog changes:

| Claim | Source |
|---|---|
| 153 types, 30 deprecated | `packages/noodl-types/src/node-catalog.json` → `nodes[].isDeprecated` |
| Replacement mapping | `packages/noodl-types/src/node-catalog-enriched.json` → `nodes[].enrichment.relatedNodes` |
| Deprecated registrations | `packages/noodl-viewer-react/src/nodes-deprecated/` (24) + 6 in place; flag path `nodedefinition.ts:274` → `nodelibraryexport.ts:394` |
| No legacy type deleted | `git log --diff-filter=D --name-only -- 'packages/noodl-viewer-react/src/nodes/**' 'packages/noodl-runtime/src/nodes/**'` — every hit is a `.js`→`.ts` rename |
| BYOB removals | commits `8eed8141`, `9d050626` |
| REST2 conversion gate | `packages/noodl-runtime/src/nodes/std-library/data/restnode.ts:88–98` |
| Corpus type census | 60 `project.json` files under `library/`, `project-examples/`, `dev-docs/qa-fixtures/` |
| Project-field drops | `packages/noodl-editor/src/editor/src/models/projectmodel.ts` — `toJSON()` at `:1344` vs the constructor at `:148` |
