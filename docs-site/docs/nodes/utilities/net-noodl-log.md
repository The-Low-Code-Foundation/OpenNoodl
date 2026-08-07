---
title: "Log"
---
Writes a line to the log — the structured backend log inside a cloud function, the browser console in an app.

Log writes a message, at a level, when its Log signal fires. Where the line goes is chosen by the runtime, not by you: inside a cloud function it goes to the backend's structured log — one JSON line per event on stdout, carrying the run's request id and the id of this node — and a copy is recorded as a step in the run's execution record, so the History panel shows it beside the rest of the run. In a browser app the same node writes to the console at the matching level. Value passes straight through, so the node can sit inline on a wire without breaking the chain. The important difference from a Function node's console.log is redaction: in a cloud function every property of Data whose name says it holds a credential is replaced before the line is written, and the values of the backend's own stored secrets are scrubbed out of the message text as well — so wiring a Secret node's Value into a Log message writes [REDACTED], not the credential.

## When to use it

Tracing what a cloud function actually did with a real request, and leaving a breadcrumb for the next person who has to answer 'what happened at 3am'. Use the Data object for anything you might want to filter on later: the backend's log is JSON, so `jq 'select(.orderId==7)'` works on structured fields and does not work on a sentence.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `net.noodl.Log` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `data` | Object | — | An optional object written alongside the message as structured fields. In a cloud function every property whose NAME says it holds a credential is redacted on the way out |
| `level` | Enum (`debug`, `info`, `warn`, `error`) | `info` | How loud this line is. In a cloud function the backend drops anything below its configured level, so Debug lines cost nothing in production unless someone turns them on |
| `message` | String | — | The line to write. Free text, so keep credentials out of it by habit — the backend does scrub the values of its own stored secrets out of this before it is written, but that cannot cover a credential it never issued |
| `value` | * | — | Passed straight through to the Value output, so this node can sit inline on a wire |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `log` | Signal | — | Writes the line. Nothing is written until this fires |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `value` | * | — | Whatever arrived on the Value input, unchanged — this node never alters what passes through it |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation. This node has no other outcome — no Unchanged and no Failure — so it always fires together with Done, and wiring either one does the same thing. It is here on every action so that reaching for it is never a per-node decision |
| `done` | Signal | — | Fires once the line has been written |

## Patterns

- Splice it onto an existing wire: value in, value out, and the Log signal taken from whatever outcome you want to record. The graph behaves identically with the node removed.
- Log at `error` on a Failure branch, with the failing record's id in Data. That line carries the request id, so it lines up with the access log and the execution record.

## Watch out for

- A Log node inside a Run Tasks loop over thousands of items. That is thousands of stdout lines and thousands of execution-record steps; the backend caps the copies it records per run, but the volume is still yours to think about.
- Putting a credential in Message on purpose, on the assumption it will be scrubbed. The backend scrubs the values it issued; a token that arrived in a request body is not one of them.

## Related nodes

[Secret](../cloud/noodl-cloud-secret.md), [Request](../cloud/noodl-cloud-request.md), [On App Error](./on-app-error.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
