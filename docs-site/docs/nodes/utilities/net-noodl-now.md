---
title: "Now"
---
The current date and time, as a Date, a millisecond timestamp and an ISO string. Re-read on demand.

Now reads the wall clock when the node is created and again on every Read, and publishes the same instant in three shapes: a Date for the other date nodes, a millisecond timestamp for arithmetic and storage, and an ISO-8601 UTC string for a JSON body. The outputs hold the instant of the last Read — they are not a live clock, so a graph that wants a ticking value pairs this with a Timer. It reads Date.now(), which is the same clock in the browser, on the SSR server and in a cloud function.

## When to use it

Stamping when something happened, comparing a stored date against the present, or computing a deadline together with Date Add. In a cloud function it is the server's clock, which is the one you want for anything a client should not be able to lie about.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `net.noodl.Now` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `read` | Signal | — | Re-reads the clock. The outputs hold the instant of the last Read, not a live value |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `date` | Date | — | The instant of the last Read, for the other date nodes |
| `iso` | String | — | The same instant as an ISO-8601 string in UTC — the shape to put in a JSON body |
| `timestamp` | Number | — | The same instant as milliseconds since 1 January 1970 UTC |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation. This node has no other outcome — no Unchanged and no Failure — so it always fires together with Done, and wiring either one does the same thing. It is here on every action so that reaching for it is never a per-node decision |
| `done` | Signal | — | Fires once the outputs hold the freshly-read instant |

## Patterns

- Request receive → Now Read, then Date → Date Compare: 'is this due date in the past', answered on the server's clock.
- Now Date → Date Add (+30 days) → Date To String: a deadline, rendered.

## Watch out for

- Expecting the outputs to advance on their own. They hold the last Read; wire a Timer if you want them to tick.

## Related nodes

[Date Add](./net-noodl-date-add.md), [Date Compare](./net-noodl-date-compare.md), [Date To String](./date-to-string.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
