# CWF-014 — The Request node believes anything

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) §6 row 14, approved 2026-08-05.
**Status:** open, unowned. **The one on this track that pays a design against three debts.**

## The mechanism, exactly

A cloud function declares its inputs as a comma-separated `params` string. The runtime splits it and
mints one `pm-<name>` output per entry, typed **`'*'`**
([request.ts:163-195](../../../packages/noodl-viewer-cloud/src/nodes/cloud/request.ts#L163-L195)),
each a getter straight onto the parsed request body.

That is the entire contract. There is no type, no required flag, no default, no shape. A function
expecting `{ total: number }` and given `{ total: "banana" }` runs happily and fails somewhere
downstream — or worse, doesn't fail, and writes `"banana"` into a record.

## Why this is one design against three debts

The same hole is filed three times over:

- **AIB-001** — nothing validates parameter *values* anywhere in the AI authoring path.
- **ERG-005** — component interface types exist in a table in the editor and never leave it, so
  nothing downstream can check them.
- **Here** — a function's public interface is a comma-separated list of names.

A cloud function is the case where it hurts most, because a function is an **HTTP endpoint**: its
caller is not the graph next door, it is a supplier's webhook, a mobile app, another team. An
endpoint with no request contract is not an API.

## Slices

### Slice 1 — the declaration

Replace / extend `params` with a proplist of rows: **name, type, required, default**. Types from the
port-type vocabulary already in the runtime (`string`, `number`, `boolean`, `object`, `array`,
`date`) — do not invent a parallel type language
([PORT-TYPE-CONTRACT](../../reference/PORT-TYPE-CONTRACT.md)).

⚠️ **Backward compatibility is not optional here** — every existing function and the shipped
templates use the string form. Accept both: a plain `params` string means "all `*`, all optional",
exactly as today. The migration is the author opting in per row.

⚠️ The dynamic-port rule on the editor side is `namedports/list` and it must agree port-for-port
with the runtime's split — WFA-009 records what happens when they disagree (empty entries dropped,
repeats collapsed, in *both* places). A typed row list needs the same agreement re-established, and
the same trap applies: **a port that appears in the editor and not in the export is worse than no
port**.

### Slice 2 — enforcement

- Missing required → **400** with a body naming the field. Not 500, not a graph error.
- Wrong type → 400, unless a lossless coercion applies (the runtime's typecast table already defines
  which — `string → number` is declared; reuse it rather than deciding again).
- Default applied when absent.
- ⚠️ The rejection must happen **before the graph runs**, in `sendRequest`, next to the existing
  `allowNoAuth` check ([request.ts:110-131](../../../packages/noodl-viewer-cloud/src/nodes/cloud/request.ts#L110-L131)).
  That check is the precedent: it throws before anything downstream sees the request.

### Slice 3 — the payoff nobody asked for

Once a function declares its inputs with types, three things become derivable rather than authored:

- **[CWF-001](CWF-001-CALL-FUNCTION-PARAMS.md)'s param mapping UI** knows what a step must supply.
- The **agent** authoring path gets a contract to check against (AIB-001's actual want).
- An OpenAPI description of the backend's functions becomes a generator, not a project.

Do not build those here. Do check the declaration shape against CWF-001's needs before fixing it —
one conversation now, or two incompatible shapes later.

## Done when

- A function with a typed, required parameter returns **400 with the field name** when it is absent,
  and the graph does not run.
- A `"42"` supplied to a `number` parameter arrives as `42` by the declared typecast, and `"banana"`
  is a 400.
- Every existing function with a plain `params` string behaves **exactly** as before — proven by the
  WFA-009 suite passing untouched.
- Editor ports and exported ports agree, driven on a real canvas.

## Traps

- ⚠️ **A saved project applies a parameter before the port exists** (the repo's recurring load-order
  trap; jest never reproduces it). Drive this from a saved, reopened project, not only from tests.
- ⚠️ The Response node has the same `params` shape. This task does **not** type it — but whatever
  shape is chosen here, the Response node will inherit it later. Design as though it will.
