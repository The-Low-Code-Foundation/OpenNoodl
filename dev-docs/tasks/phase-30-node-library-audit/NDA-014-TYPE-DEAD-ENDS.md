# NDA-014: `object`, `array` and `color` are dead ends in the type system

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-014 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 2 |
| **Priority** | 🟠 High — it makes the product punish authors for declaring the truth |
| **Difficulty** | 🟠 Medium — small change, wide blast radius, needs a compatibility story |
| **Estimated Time** | 1–2 weeks |
| **Prerequisites** | None |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** — this is a type-system decision, expensive to reverse |

## Objective

Make a port typed `object` connectable to something. Today it reaches four destinations in the entire
product, and declaring it makes a port *less* useful than leaving it untyped.

## The defect

This surfaced from Richard's "there were output types on Function and Script nodes that don't work,
like objects I think was one example". It is not a Function-node bug. It is the typecast table.

```
{ "from": "object", "to": [] }                          ← casts to nothing
{ "from": "color",  "to": [] }                          ← same
{ "from": "array",  "to": ["collection"] }              ← and back; nothing else
{ "from": "string", "to": [ …, "array", "object" ] }    ← but string casts INTO both
```

Counted across the library:

| | Count |
|---|---|
| Input ports | 1,750 |
| **Typed `object`** | **4** — `Global Store.initialState`, `Server-Sent Events.headers`, `State Snapshot.snapshotData`, `Send Email.variables` |
| Typed `*` (wildcard) | 12 |
| Output ports typed `object` | 13 |

So an `object` output can reach **four** destinations. And because the Function node defaults an
untyped output to `*` ([`simplejavascript.ts:442`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts#L442)):

```js
type: (node.parameters['outtype-' + p.label] as string) || '*'
```

**selecting the correct type makes the port strictly less connectable than leaving it alone.** The
enum offers `Object` as a choice and choosing it is always a mistake. That is the whole complaint.

The 13 `object` outputs include `HTTP Request.responseHeaders`, `Query Data.firstRecord` and **every
`error` output on the Cloud Data nodes** — so the error objects that defect class B is about are
themselves nearly unwireable. NDA-004 will hit this immediately.

`color` has the identical shape (confirmed while auditing the Variables category): a Color variable's
output reaches only `color` inputs.

## §1 — Decide the model (this is the whole task)

Three options, not mutually exclusive.

**A — Give `object` outbound casts.** At minimum `object → string` via JSON, which is what an author
reaching for a Text node wants. Possibly `object → array` for the values. Cheap, immediately useful,
and it does not change what connects to what *illegally* — it only adds legal connections.

**B — Make `*` the honest default and stop offering the choice.** If the accurate type is always worse,
the enum is a trap. Either the type should be advisory (used for hints and validation, not for gating
connections) or it should not be offered.

**C — Distinguish "declared type" from "connection compatibility".** The real problem is that one
field does two jobs: describing the value, and gating the wire. A port could declare `object` for
documentation, validation and the AI authoring loop, while connection compatibility falls back to
structural rules.

**Recommendation: A now, C as the direction.** A is a small table change that fixes the reported
symptom this week. C is the correct model and should be written down as the target even if it is not
built in this phase — because B, done alone, throws away exactly the type information NDA-005 and the
AI authoring loop need.

## §2 — Apply it

- Update the typecast table; regenerate the catalog and register.
- Re-check the 13 `object` outputs and 4 `object` inputs actually connect usefully now.
- Do the same for `color` — same shape, smaller blast radius, good place to prove the change.
- Check whether `setInputValue`'s existing `string → object`/`string → array` `eval` path
  ([`node.ts:308-339`](../../../packages/noodl-runtime/src/node.ts#L308-L339)) needs a mirror on the
  way out, and be careful: that path `eval`s author input and already has a warning channel.

⚠️ Adding casts changes which connections the editor *allows*. Existing projects cannot break (nothing
is being removed) but the connection UI, the semantic validator and the AI authoring loop all read
this table. Regenerate and re-run all three.

## Success criteria

1. An `object` output from a Function node can be wired to a Text node and shows something useful.
2. Every one of the 13 `object` outputs has at least one sensible destination.
3. The Function node's output type enum no longer contains a choice that is always wrong.
4. Semantic validator and catalog regenerated; no new validation errors on the QA fixture corpus.
5. The §1 decision — including the C direction, if adopted — is written into `dev-docs/reference/`
   alongside the other contracts.
