# The Empty-Value Contract

**Status:** Normative. Decided 2026-07-29 (phase 30, NDA-003 §1); nullable-variables decision
confirmed by Richard.
**Applies to:** every port, cast, and stateful value in the runtime and viewer.
**Enforced by:** the NDA-001 behaviour corpus (rows E1–E8). E8 — a value going
non-null → null → non-null through a graph, with two changes observed downstream — is the
acceptance test for the whole contract.

## The rule

> **`undefined` means "no opinion" — leave the target as it is.**
> **`null` means "clear this" — an explicit value that propagates, notifies, and is stored.**

They are different words on purpose. Conflating them is the defect class: before this contract,
whether "clearing a value" did anything depended on which of four layers the write happened to pass
through (`node.ts:426`, `modelcrudbase.ts:308`, `collectionnode2.ts:112`, the Variable casts).

## Corollaries

### 1. `null` propagates

A port receiving `null` treats it as a real value: it is stored, it is forwarded, and it fires
`change` if the previous value differed (per the Reactivity Contract).

- Guards written as `!== undefined` are **correct** — they implement "undefined abstains".
- Guards written as `!value`, `value == null`, or truthiness checks are **bugs** — they swallow an
  explicit clear (and usually `0`, `''` and `false` with it).
- A file must not disagree with itself. `httpnode.ts` carrying six variants of the guard is the
  cautionary example; use one shared helper per package where the pattern repeats.

### 2. Casts map `null` to the type's empty value — never coerce it

`String(null)` → `"null"` and `Number(undefined)` → `NaN` are the two canonical violations. A cast
is written as:

```ts
cast: (v) => (v == null ? EMPTY : Cast(v));   // `v == null` catches null AND undefined — the one
                                              // place loose equality is the right tool
```

`NaN` is banned as a stored value outright: `NaN !== NaN` breaks the reactivity guard permanently
(every subsequent set reports "changed"). This holds even where the rest of the contract is not yet
implemented.

### 3. Variables are nullable (decided)

All four Variable types (String, Number, Boolean, Color) can **store `null`**, and `null` — not
`0`/`''`/`false` — is the empty value. "Cleared" is distinguishable from "zero" at the port level.

Back-compat: each Variable node gains a **`Treat empty as`** input (enum; default `null`, options
per type: `0`, `''`, `false`, …) restoring the old coercion for authors and existing graphs that
want it. Downstream nodes (`Condition`, `Expression`) see whatever the setting produces, so a graph
that relied on `Number(null) === 0` opts back in with one input.

The String variable's `length` output (and any similar derived getter) must handle a `null` store
without throwing — audit derived outputs when landing this (found during the NDA-012 Variables
audit).

### 4. `undefined` abstains everywhere, including at connect time

`node.ts:426` skipping the initial seed when the upstream output is `undefined` is correct: an
upstream that has produced no value yet has no opinion. Likewise Set Object Properties skipping
`undefined` keys (`modelcrudbase.ts:308`) and the Array node ignoring an `undefined` write
(`collectionnode2.ts:112`) are correct *for `undefined`* — their defect was only that `null` fell
into the same hole.

## What each layer does with each value

| Layer sees | `undefined` | `null` |
|---|---|---|
| Port input | ignore (keep current value) | store, propagate, notify |
| Cast | not reached (abstained earlier) — if reached, abstain | type's empty value; stored value stays `null` unless `Treat empty as` says otherwise |
| Model / Object property | skip key | write `null` to the key (clears), notify |
| Collection write | ignore | clear the collection, notify |
| HTTP / query param | omit the parameter | omit or send JSON `null` — pick per API semantics and **document it on the port** |

## Documentation duty

Every port whose behaviour on empty differs from the table above must say so in its `description`.
The description is read by the property panel, the semantic validator, and the AI authoring loop —
an undocumented deviation is invisible to all three.

## Conformance

| Corpus row | Behaviour pinned |
|---|---|
| E1/E2 | String variable: `null` clears (no `"null"` text); `undefined` leaves it unchanged |
| E3/E4 | Number variable: `null` distinguishable from `0`; `NaN` never stored |
| E5/E6 | Set Object Properties: `null` clears the key; `undefined` skips it |
| E7 | Array node ignores `undefined` |
| E8 | non-null → null → non-null through a graph: two changes observed downstream |
