---
title: "Unique Id"
---
Provides a random 10-character alphanumeric id, with a signal to generate a fresh one on demand.

Unique Id holds a randomly generated id string — 10 characters of A–Z, a–z, 0–9, the same generator the runtime uses for model ids — on its `guid` (Id) string value output. One id is generated when the node initializes, so `guid` is usable immediately; triggering the `new` (New) signal input replaces it with a fresh id and pushes the change downstream. The ids are random, not sequential, and are not standard UUIDs.

## When to use it

Use it when client-side logic needs a throwaway identifier: keying a locally created list item, tagging a request or draft before it is persisted. Cloud records get real ids from the database on creation — do not use this to fabricate record ids.

## At a glance

| | |
|---|---|
| Category | String Manipulation |
| Type name | `Unique Id` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `new` | Signal | — | Generates a fresh id, replacing the one on Id |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `guid` | String | — | A short random id — 10 characters, from Math.random(). Good for keying a list. For a record id, an idempotency key or anything that must be unguessable, use the UUID node instead |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation. This node has no other outcome — no Unchanged and no Failure — so it always fires together with Done, and wiring either one does the same thing. It is here on every action so that reaching for it is never a per-node decision |
| `done` | Signal | — | Fires once a new id is available on Id |

## Patterns

- The signal that creates a local item also triggers `new`, and `guid` is stored with the item: every item gets its own key.

## Examples

**Debounced autosave with timestamped status**

The debounce idiom: every keystroke fires Value Changed, whose signal restarts a 1.5-second Timer — the save only runs when the user pauses. The save Function stamps the moment; Date To String formats it, Unique Id issues a save id shortened by Substring, and String Format assembles the status line. Signals sequence the flow; values shape the display.

## Related nodes

[Substring](./substring.md), [String Format](./string-format.md), [Function](../custom-code/java-script-function.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
