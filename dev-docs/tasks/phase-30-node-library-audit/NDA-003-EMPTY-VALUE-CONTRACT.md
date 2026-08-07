# NDA-003: The Empty-Value Contract

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-003 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 1 |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟠 Medium — four small edits, one large decision |
| **Estimated Time** | 4–7 days |
| **Prerequisites** | NDA-001 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** for §1, then 🟢 **Sonnet 5** for §2 |

## Objective

Decide what `null` and `undefined` mean in a Noodl graph, write it down, and make the four layers
that currently disagree obey it.

## The reported symptom

> "if the value flowing into the object or variable was not null, and then it becomes null, that
> doesn't register as a change and the not null value is stuck until another not null value comes
> along."

The audit found no single guard responsible. `Model.set` handles `null` correctly
([`model.ts:314-339`](../../../packages/noodl-runtime/src/model.ts#L314-L339)) — a unit test there
would pass and prove nothing. The failure is distributed:

| Layer | Guard | Effect on a `null`/empty write |
|---|---|---|
| [`node.ts:426`](../../../packages/noodl-runtime/src/node.ts#L426) | `if (outputValue !== undefined)` | at connect time, an undefined upstream value never seeds the input |
| [`modelcrudbase.ts:308`](../../../packages/noodl-runtime/src/nodes/std-library/data/modelcrudbase.ts#L308) | `if (value !== undefined)` | Set Object Properties skips the key instead of clearing it |
| [`collectionnode2.ts:112`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/collectionnode2.ts#L112) | `if (value === undefined) return;` | the Array node ignores the write |
| [`string.ts:24`](../../../packages/noodl-runtime/src/nodes/std-library/variables/string.ts#L24) | `String(value)` | stores the literal text `"null"` |
| [`number.ts:17`](../../../packages/noodl-runtime/src/nodes/std-library/variables/number.ts#L17) | `Number(value)` | `null` → `0`; `undefined` → `NaN` |
| [`httpnode.ts:353,369,407,444,453,462`](../../../packages/noodl-runtime/src/nodes/std-library/data/httpnode.ts#L353) | six variants of `!== undefined && !== null` | inconsistent within one file |

Each of these is individually defensible. Together they mean an author cannot predict whether
clearing a value clears anything.

## §1 — The contract (decide this first)

Proposed, for review:

> **`undefined` means "no opinion" — leave the target as it is.**
> **`null` means "clear this" — an explicit value that propagates, notifies, and is stored.**

Corollaries that follow, and that the current code violates:

1. A port receiving `null` **must** propagate it. Guards written as `!== undefined` are correct;
   guards written as `!value`, `== null` or truthiness checks are bugs.
2. A type cast must map `null` to that type's empty value, **not** to a stringified or coerced one.
   `String(null)` → `"null"` is the clearest violation in the library.
3. `null` must remain distinguishable from a legitimate `0`, `''` or `false` at the port level, even
   where the *stored* value is the type's empty value.

Corollary 3 is the expensive one and needs Richard's call. `Number(null) === 0` today; if a Number
variable must distinguish "cleared" from "zero", the Number node needs a nullable representation,
which changes what downstream `Condition` and `Expression` nodes see. **Recommendation:** allow
`null` as a stored value for all four Variable types and let the empty value be `null` rather than
`0`/`''` — with a per-node `Treat empty as` input for authors who want the old coercion. That keeps
existing graphs working while making the semantics available.

## §2 — Make the layers obey it

Mechanical once §1 is settled:

| Site | Change |
|---|---|
| `string.ts:24` | `cast: v => v == null ? '' : String(v)` — and decide per §1 corollary 3 whether the *stored* value is `''` or `null` |
| `number.ts:17` | same shape; never store `NaN` (it breaks the `!==` change check in `variablebase.ts:98` permanently) |
| `boolean.ts` (runtime), `color.ts` (viewer — `noodl-viewer-react/src/nodes/std-library/variables/`) | audit for the same pattern |
| `modelcrudbase.ts:308` | keep the `undefined` skip; verify `null` reaches `model.set` and clears |
| `collectionnode2.ts:112` | keep the `undefined` early return; add a `null` path that clears the collection |
| `node.ts:426` | keep — `undefined` at connect time genuinely means "nothing to seed" |
| `httpnode.ts` ×6 | normalise to one helper so the file stops disagreeing with itself |

⚠️ `NaN !== NaN`, so once a Number variable stores `NaN` the `changed` guard at
[`variablebase.ts:98`](../../../packages/noodl-runtime/src/nodes/std-library/variables/variablebase.ts#L98)
reports a change on **every subsequent set**, forever. That is a live bug independent of the contract
and should be fixed even if §1 stalls.

## §3 — Document it on the ports

Once the semantics exist, they have to be findable. The `description` field on every affected port
should state the empty behaviour. This overlaps NDA-005 (2,508 undocumented ports) — do the affected
ports here, and let NDA-005 take the rest.

## Success criteria

1. Corpus rows E1–E8 green, with E8 (the non-null → null → non-null round trip, through a graph)
   as the acceptance test.
2. The contract is written into `dev-docs/reference/` alongside NDA-002's.
3. No existing QA-fixture graph changes behaviour except where the corpus says it should.
4. Live-verified in the editor, not only under jest.

## Risks

- **§1 corollary 3 is a semantics change to the most-used nodes in the library.** If Richard wants
  the smaller change, do §2 and skip nullable Numbers — E1/E2 alone fix the visible garbage, and E3
  can stay as "`null` → `0`, documented".
- Existing graphs may rely on `String(null) === "null"` rendering something rather than nothing.
  Unlikely to be deliberate, but the screenshot corpus will show it.
