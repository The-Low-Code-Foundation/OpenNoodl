---
title: "Create Record"
---
Create Record: inserts a record into a cloud database class from its property inputs when Do is triggered.

NewDbModelProperties (Create Record) creates one record in the cloud database class chosen with the `collectionName` (Class) parameter. Each property of the class becomes a value input; when the `store` (Do) signal is triggered, the current input values are sent to the server as a new record. On success the node binds to the new record, outputs its `id`, and fires `done` (Done) followed by `completed`; on failure it fires `failure` with a message on `error`, and `completed` after that too. Optionally, `sourceObjectId` seeds the new record with the data of an existing local object (explicit property inputs win), and Access Control Rules restrict who can read/write the record (defaulting to the creating user when a rule is left unconfigured).

## When to use it

The write half of every 'add item' flow — forms, quick-add buttons, duplicating a record via `sourceObjectId`. Live Query Records nodes pick the new record up automatically, so no manual re-fetch is needed. To modify an existing record use SetDbModelProperties instead; for a non-cloud (BYOB) backend use noodl.byob.CreateRecord.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `NewDbModelProperties` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `accessControl` | Proplist | — | Read and write rules stored on the record as it is written, each rule adding its own Target, Read and Write ports; backends that have no per-record access control ignore them |
| `sourceObjectId` | String | — | Id of an existing record whose properties seed the new one before the property inputs are applied over them; leave blank to start empty |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `store` | Signal | — | Creates a record in the chosen Class from the property inputs and sends it to the backend |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `id` | String | — | Id of the record this node last acted on, which on Create Record is the Id the backend assigned |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the backend has stored the new record and Id carries the Id it was given |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the most recent attempt failed, kept after a later attempt succeeds |
| `failure` | Signal | — | Fires when the backend refused the operation or the node had nothing valid to send, with the reason on Error |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Property input ports follow the selected cloud database class schema.

## Ports at runtime

Ports are runtime-determined: `collectionName` (Class) is registered as an edit-only enum of the project's classes plus _User/_Role, and each schema property of the chosen class becomes a value input `prop-<name>` typed from the schema. Each entry in the `accessControl` list additionally spawns `acl-<ruleId>-target` (user/everyone/role), then `acl-<ruleId>-userid` or `acl-<ruleId>-role`, plus `acl-<ruleId>-read` and `acl-<ruleId>-write` booleans. An authoring tool should set `collectionName` in parameters and drive `prop-<name>` inputs it knows from the class schema.

## Patterns

- Text Input `text` → `prop-<name>`, Button `onClick` → `store`: the minimal create form.
- `done` → a navigation or Event Sender, with `id` as payload: jump straight to the new record's detail page.

## Watch out for

- Re-fetching a Query Records node after `done` — live queries already receive the new record; only re-fetch when the query is not live.

## Examples

**Create a record with an uploaded file attachment**

The create-with-attachment flow: Open File Picker hands the picked browser file to Upload File, which stores it in cloud storage and outputs a `cloudFile`. Cloud File exposes that file's `url`, previewed in an Image (the cloudfile→image cast). When the upload succeeds, Create Record (NewDbModelProperties) writes a new 'Attachment' record whose properties — including the file — are set on the node's schema-generated inputs.

**Records on a REST backend: query, create, update, delete**

One Record family serves every backend. Query Records fetches on demand into `items` (re-trigger `storageFetch` to refresh — a query with realtime off does not re-query itself), Create/Update/Delete Record each act on a `store` signal and answer `done` (or `failure`) followed by `completed`, and Update and Delete take the record's `modelId`. After any write the query's `storageFetch` is re-triggered to refresh the list. No node here names a backend, so all five resolve the project's selected one; set the `Backend` input to point a single node somewhere else.

## Related nodes

[Update Record](./set-db-model-properties.md), [Delete Record](./delete-db-model-properties.md), [Record](../cloud-services/db-model2.md), [Query Records](../cloud-services/db-collection2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
