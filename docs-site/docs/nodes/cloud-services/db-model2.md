---
title: "Record"
---
Record: binds to one cloud database record by id and exposes each of its properties as an output that follows the record.

DbModel2 (Record) points at a single record of a cloud database class and exposes one value output per property of that class (registered as `prop-<property>`), plus a `changed-<property>` signal per property. Setting `modelId` binds the node to the record in the app's local record store — properties already known locally (for example from a Query Records result) appear immediately, and `fetched` fires. Triggering `fetch` (Fetch, signal) loads the record fresh from the server by id; while `fetch` is connected, local change events no longer drive the outputs, so updates arrive only when you fetch. `changed` fires whenever the bound record changes from anywhere in the app (a Update Record elsewhere, a live query update). `fetched` and `changed` are value-level announcements and fire on binding as well as on a fetch; `done`/`failure`/`completed` are the outcome of a `fetch` invocation specifically, so wire those to sequence a chain and `fetched` to react to the data.

## When to use it

Use it to read one record's properties — a detail page, or the current item inside a repeater (set `idSource` to 'From repeater'). It does not write: pair it with SetDbModelProperties to save edits. For lists of records use DbCollection2 (Query Records); for records from a non-cloud (BYOB) backend use noodl.byob.QueryData, whose results are plain objects, not records.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `DbModel2` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `idSource` | Enum (`explicit`, `foreach`) | `explicit` | Whether the record is named by Id or taken from the repeater this node sits inside |
| `modelId` | String | — | Id of the record to read; ignored unless Id Source is Specify explicitly |
| `repeaterComponent` | Component | — | Which repeater to take the current item from when nesting makes the nearest one ambiguous; leave blank for the nearest, and ignored unless Id Source is From repeater |
| `runOnChange-modelId` | Boolean | `true` | Whether a new value on Id re-runs this node. On by default; untick to make this input passive so only the control signal runs it |
| `runOnChange-record` | Boolean | `true` | Whether a new value on Record properties re-runs this node. On by default; untick to make this input passive so only the control signal runs it |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `fetch` | Signal | — | Re-reads the record from the backend now, replacing the copy held in memory. This is additional to Id rebinding on change and to changes being announced; untick either under Run On Value Change to stop it |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `id` | String | — | Id of the record this node is bound to, whether or not it has been read yet |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires when a property of the bound record changes, including a change another node made |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when a Fetch finished and the property outputs are up to date |
| `fetched` | Signal | — | Fires once the record has been read and the property outputs are up to date |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last read failed; empty until one does |
| `failure` | Signal | — | Fires when the record could not be read, after the reason has been reported on the error channel |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups, runtime-discovered); the tables above may be incomplete for a given instance._

Property ports are created from the cloud database class schema selected via parameters (one port per class property).

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| idSource = explicit OR idSource NOT SET | `modelId` | — |
| idSource = foreach | `repeaterComponent` | — |

## Ports at runtime

Property ports are runtime-determined from the cloud database class selected via the `collectionName` parameter (itself a runtime-registered enum of the project's classes plus _User and _Role): each schema property becomes a value output `prop-<name>` (typed from the schema) and a signal output `changed-<name>`. Relation properties get no ports. An authoring tool should set `collectionName` in parameters and may reference `prop-<name>`/`changed-<name>` for properties it knows exist in the class schema.

## Patterns

- Component Inputs `<id>` → `modelId`, with `prop-<name>` outputs driving the page: the canonical detail-page shape where a list passes the record id to a detail component.
- `prop-<name>` → a Text Input's `startValue`, edited text → Update Record `prop-<name>`: prefill an edit form and save it back.

## Watch out for

- Connecting `fetch` just to 'refresh' — while `fetch` is connected the node stops following local record changes, so only do it when you explicitly want server-fetch-driven updates.

## Examples

**Load, edit and save a single record**

The record-detail flow: a Record node (DbModel2) binds to one database object by `modelId` and exposes its properties as schema-generated outputs. The edit field is initialised from the record, and Save (SetDbModelProperties) writes the changed property back on click, targeting the same id. `done` confirms the round trip, and `completed` fires after it whatever the outcome. Property ports on both nodes come from the database schema — they are runtime-determined, wired here exactly as the editor would write them.

## Related nodes

[Query Records](./db-collection2.md), [Update Record](../data/set-db-model-properties.md), [Delete Record](../data/delete-db-model-properties.md), [Create Record](../data/new-db-model-properties.md), [Repeater](../visual/for-each.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
