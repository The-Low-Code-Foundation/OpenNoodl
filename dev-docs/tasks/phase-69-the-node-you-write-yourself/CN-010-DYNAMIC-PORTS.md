# CN-010 — Dynamic ports

| Field | Value |
|---|---|
| **Tier** | 4 |
| **Effort** | M |
| **Surface** | `runtime`, `docs`, `editor` (validation interaction) |
| **Rulings** | — |
| **Depends on** | CN-003, CN-004 (this task changes what "fully checked" means), CN-005 |

---

## ✅ Session 18 (2026-08-17) — AC2 and AC3 built. AC1 and AC4 open.

**23 tests, 15/15 real mutations killed. Gates: `noodl-mcp` jest 613 / 52 suites ·
editor jest 3,567 / 231 suites · resident surface 8,223 / 8,280 (unchanged) ·
`tsc --noEmit` 8, all pre-existing.**

### 🔴 The spec's premise for AC3 was false three times over

AC3 asks that `get_node_type` report the mechanism *"the way it does for `Function` and
`Object`"*. Measured against the real catalog before anything was written:

1. **There is no type called `Function` or `Object`.** They are `Javascript2` and `Model2`;
   `get_node_type('Function')` is a lookup miss. (The task's own trap section warns that
   Function's ports are `in-`/`out-` prefixed — the type *name* is the same class of error.)
2. **88 of 175 shipped types declare `dynamicPorts`**, 34 with `declaredPortGroups` — 165 groups,
   158 carrying a condition. **None of it reached an answer.**
3. 🔴 **The projection read `dp.note` — a field that exists on no node in the product.** The
   catalog's field is `description`, and it is *non-optional* on both `DynamicPortInfo` (shipped)
   and `OverlayDynamicPortInfo` (kits). So every dynamic type answered with a bare mechanism list:
   *this port list is incomplete*, with no statement of how. It typechecked, because the projection
   re-declared the shape it read.

⚠️ **The editor's `CatalogIndex.dynamicPortNote()` reads `description` and was right all along.**
One consumer of two had the name wrong — the same shape as CN-008's `docs` and CN-009's `summary`.
**Three fields in three consecutive tasks.** The common cause is not that kits were forgotten: it is
that a second consumer of a shared document **re-declares the shape it reads**, and nothing types
the seam.

### ✅ What AC3 landed (`packages/noodl-mcp/src/catalog.ts`)

- `description` reaches full detail — for all 88 shipped types **and** kits.
- `declaredPortGroups` reaches full detail, projected to `{condition, inputs, outputs}`; the
  exporter's internals (`name: "conditionalports/extended"`, `template`, `indexStep`) are dropped
  because they name a mechanism inside `nodelibraryexport.ts` and mean nothing to a caller.
- **Summary mode**: a kit's `hasDynamicPorts: true` now arrives with a sentence. It never could
  before — the sentence comes from `runtimeBehavior`, which is `enrichment`, which is generated at
  repo-build time and keyed by type name. **88 of 88 built-ins have one; 0 kits can, on any
  machine, ever.**

🔴 **The obvious control cannot fail, again.** *"No built-in shows the generic dynamic description"*
passes against a **completely unimplemented** fallback, because the `else` branch is unreachable for
all 88. The real control is a hand-built node shaped so the fallback *would* fire — with nothing for
it to fire with. Both are in `tests/cn010.test.ts`, labelled **guard** and **control** respectively.

### 💰 The budget ratchet was moved, with the arithmetic

`nodeDocBudget.test.ts`'s full-detail ceiling: **12,500 → 13,500**.

| | before | after |
|---|---|---|
| all 142 types, full detail | 283,483 | **294,894** (+4.0%) |
| worst single (`net.noodl.controls.textinput`) | 12,069 | **12,899** |
| `Group` | 11,242 | 12,282 |
| headroom | 431 | 601 |

⚠️ **The ceiling case is no longer `Group`**, and that comment had been stale for a while.
✅ The cheaper-*looking* alternative was measured and is **not** cheaper: moving the condition onto
each port as `activeWhen` costs **29,014** bytes against the group block's **22,911**, because
conditions are long and one group shares a condition across several ports. AC3's named shape won on
its own merits.
✅ **Resident surface unchanged at 8,223 / 8,280.** CN-009's finding holds: facts that travel in a
*response* cost nothing at the gate. **The 57 are still unspent and there is still no third
renegotiation.**

### ✅ What AC2 landed (`packages/noodl-editor/.../validation/parameterValues.ts`)

The runtime-dynamic carve-out was a bare `continue`. Measured across the 29 projects in
`NodeGX test projects`:

| | |
|---|---|
| set parameters, all projects | 15,794 |
| reaching the silent skip | **947 (6.0%)** |
| nodes carrying them | **321** |
| components with at least one | 127 of 344 |
| per component | median 0, p90 **2**, max **17** |

The last row is why it emits unconditionally. 🔴 **Gating it behind `emitDynamicPortInfo`, as the
connection-side sibling does, would have built a diagnostic no production caller can turn on**:
`checkParameterValues` has exactly one caller, `authoredPreconditionDiagnostics`, which passes
`{ component }`; the flag is read only by `scripts/validate-project.ts`, for the *other* pipeline.

✅ **Not a new diagnostic.** `DiagnosticCode.DynamicPortSkipped` already existed and `nonexistentPort`
already emitted it for *connection* endpoints — so a connection to a runtime-created port was
reported as skipped while a **parameter on the same port of the same node** was not. One of two
sibling call sites had the notice. ⚠️ **The wording could not be borrowed from the nearest
neighbour**: `unknownTypeSkip` says *"type X is not in the node catalog"*, which is false here — the
type resolves, and for a kit node it resolves **because CN-003 put it there**. Reusing that sentence
would tell a kit author their node is unrecognised at the one moment it is not.

### 🔴 Four silence baselines were replaced, not deleted

CN-002's rule (*"asserts the silence deliberately — replace it when the call is taken, do not delete
it"*) applied to four tests. Each now asserts the **guarantee** — *not accused* — rather than the
**shape** — *empty array*, which would re-hide exactly what this task surfaced.

🔴 **One of them is worth Richard's eye and is flagged in §6 below**: `stagingDiagnostics`' *"stays
silent on a clean candidate"*. `Page` is `runtime-discovered` and declares **neither `title` nor
`urlPath`** as a static port — they are registered per instance — so the two most commonly set
parameters on the most commonly written node in the product were checked by nothing and reported as
checked. **96 of the 947 skips are `Page`.** The notice is a true positive; the consequence is that
**"clean" is no longer "an empty diagnostics array" for any page**. `warnings` stays 0 and nothing
blocks.

### ⚠️ What is NOT done

- **AC1 — the property panel.** A kit node's `dynamicports` surviving `sendNodeLibrary` into the
  panel, and being connectable, is **unmeasured**; it needs a running editor. Also unmeasured:
  what the editor does when a kit's dynamic ports change while nodes using them exist on canvas.
- **AC4 — the CN-007 worked example.** Not started. ⚠️ The trap section's warning stands and now has
  a second instance: any doc must use **real** port names (`in-`/`out-` prefixes) *and* real type
  names (`Javascript2`, not `Function`).
- **`parameterEncoding` is still `{known: false}` on every overlay node**, which
  `@nodegx/kit-catalog`'s header names CN-010 as the owner of. Untouched — the key formulas are
  derived by *driving* the node, which is AC1's missing editor session.

---

## Why this is the flexibility task

A node with fixed ports is a widget. A node whose **ports come from its data** is a building block —
it is the difference between "a chip" and "a row that adapts to whatever record you feed it". The
built-in library leans on this heavily: `Function`'s `in-`/`out-` ports are mined from the script
text, `Object`/`Set Object Properties` build `prop-<name>` ports from a `properties` list, and
`For Each`'s template drives what an instance exposes.

`ReactNodeDefinition` already carries `dynamicports`, and `nodelibraryexport.ts` already knows both
forms — the editor-format entries (`ports`/`template`/`port`/`channelPort`) and the name-list form
(`inputs`/`outputs`) that `formatDynamicPorts` expands against the node's own port metadata. **None
of it is documented for a kit author**, and this phase's proof did not exercise it.

## Establish behaviour before specifying it

⚠️ **Build a kit that uses `dynamicports` before writing the rest of this spec.** The mechanism is
inherited and the repo's record on inherited-but-unexercised mechanisms is poor —
`0 of 29 shipped modules have ever been run`. Specifically unknown today:

- whether a kit's `dynamicports` survive `sendNodeLibrary` into the editor's property panel intact;
- whether the **conditional** forms (`condition`, `parentPort`) work from a module;
- what the editor does when a kit's dynamic ports change while nodes using them exist on canvas.

## The validation interaction, which is the real design work

CN-004 deliberately preserved the dynamic-port carve-out: a node with dynamic ports keeps its
unknown-parameter check skipped, because those ports are real and the catalog cannot see them
statically. SUB-006 already reasoned this through for `PageInputs.pathParams`, and the rule it
landed on is the one to honour:

> **A dynamic node's *static* ports are as static as anyone's.** Parameters naming a
> statically-declared port are still checked; only the dynamic surface is exempt.

So the question this task must answer is: **can the overlay resolve a kit's dynamic ports well
enough to check them, or do they stay exempt?** Both answers are acceptable; what is not acceptable
is leaving it implicit. If they stay exempt, CN-002's `info` diagnostic must say so for those ports
— the user should know which half of the node was verified.

## Acceptance criteria

1. A kit node declaring `dynamicports` shows the expected ports in the property panel and is
   connectable.
2. The static/dynamic split in validation is **explicit and documented**: static ports checked,
   dynamic ports either checked or reported as skipped, never silently ignored.
3. `get_node_type` reports the dynamic-port mechanism the way it does for `Function` and `Object`,
   so an agent knows the port list is not exhaustive. The catalog already has a `dynamicPorts`
   descriptor shape with `mechanisms` and `declaredPortGroups` — reuse it.
4. Documented in CN-007 with a worked example.

## Traps

- 🔴 **`hasType()` passing is not the match succeeding** — 103 recorded divergences.
- ⚠️ **Function-node ports are `in-`/`out-` prefixed and the catalog does not say so.** Any doc or
  scaffold this task produces must use the real port names, or it joins the list of docs whose
  examples lie.
