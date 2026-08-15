# CN-004 — Turn the checks back on

| Field | Value |
|---|---|
| **Tier** | 1 |
| **Effort** | M |
| **Surface** | `editor` (`validation/`), `mcp` |
| **Rulings** | ✅ **D4** — kit-declared ⇒ known and **fully checked**; only the truly unresolvable errors under `--strict` |
| **Depends on** | CN-003 (the overlay), CN-002 (the baseline it erases) |

## What changes

With the overlay in place, "unknown type" stops being one bucket and becomes two:

| Case | Today | After |
|---|---|---|
| Type resolved by a kit | warning; **all downstream checks skipped** | **known** — parameter values, port names, everything |
| Type unresolvable by anything | warning; checks skipped; error under `--strict` | unchanged |
| Type resolved by a kit, **named in a lesson condition** | 🔴 **hard error, bundle refused at install** | **known** — the condition verifies like any other |

Three defects close at once:

- **The silent hole.** `parameterValues.ts` stops skipping kit nodes, so a kit node with a wrong
  parameter is reported like any other node.
- **The greenfield contradiction.** `validate_component`'s `strict` flag currently promotes
  `unknown-node-type` to an error, so **a greenfield project using a kit cannot pass its own gate**.
  After this task, a type the overlay resolves is simply known, and `--strict` has nothing to
  complain about.
- 🔴 **The lesson that cannot teach your node** (added 2026-08-15 — README §4). This one is *not* a
  `--strict` opt-in and not a warning: `lessonverify.ts` errors on `unknown-node-type` unconditionally,
  that error is failure class **F1**, and `REQUIRED_CLASSES` demands F1 of every provenance. **A
  lesson naming a kit node is refused at install for every author, curated included** — and the
  message it prints tells them their own node type is not in the catalog. CN-003 routes the overlay
  in; this task must confirm the consequence, because the *severity difference* means CN-004's
  reasoning ("unknown was a warning, now it's known") does not describe this consumer.

## What to build

1. `parameterValues.ts` and the unknown-port check take kit-resolved types on the normal path. The
   existing skip stays **only** for genuinely unresolvable types.
2. `--strict` errors only on unresolvable types.
3. CN-002's `info` diagnostics are removed for the newly-checked cases — a check that now runs must
   not also announce that it was skipped.
4. Dynamic-port nodes keep their existing carve-out. `dynamicports` are real ports the catalog
   cannot enumerate statically, and that is CN-010's problem, not this one. ⚠️ A kit node with
   dynamic ports is therefore *partly* checked — its static ports are as static as anyone's, exactly
   as SUB-006 already reasoned for `PageInputs.pathParams`.

## 🔴 Expect this to go red, and do not soften it

**Turning on checks that have never run will find real bugs in existing kits.** That is the ruling
working, not failing. Likely first casualties:

- The **cashflow reference kit** — 60-odd ports written by hand against a type definition read from
  source, never once validated.
- Any of the **29 shipped library modules**, of which **0 have ever been run** (P65 / LBR-004) and
  **3 register zero nodes** (LBR-006).

⚠️ **The softer option — landing the new checks as warnings for one release — was offered at ruling
time and declined.** Do not quietly reintroduce it when the first run goes red. If the volume turns
out to be genuinely unmanageable, that is a reason to **re-open D4 in writing**, not to downgrade
the severity in a commit.

## Acceptance criteria

1. A kit node with a **deliberately wrong parameter** produces the same diagnostic a built-in node
   would for the same mistake. Build that fixture; do not rely on finding one in the wild.
2. A greenfield project using a kit **passes `--strict`**. This is the headline.
3. A project using a type no kit declares still warns, and still errors under `--strict`.
4. CN-002's `info` count for a kit project is zero.
4b. **A lesson bundle whose steps name a kit node installs**, and its steps tick when the learner
   places that node. 🔴 Verify the *consequence*: "the verifier no longer errors" is also true of an
   overlay that resolves the type and then matches nothing at runtime — which is failure class F1 by
   a different route, and the exact silent failure UNI-007's `unmatchable-node-path` was added to
   close. Drive the step to completion.
5. The `test:ci` and `test:main` floors are unchanged — 🔴 quote a **tree, not a commit**, and
   🔴 **re-read the floor before comparing; do not use the figure below from memory.** As of
   2026-08-16 (after CN-001 + CN-002) `test:main` is **205 suites / 3157 tests**; it was 203 / 3140
   before them. ⚠️ The often-quoted *203 / 3136* does **not** reproduce and never did — it is a
   4-test error that circulated for weeks. That is the reason this criterion names a date and a
   task, rather than a bare number a later reader would trust.

## Traps

- 🔴 **Verify the consequence, not the mechanism.** "Validation now knows the type" is true of a
  broken implementation that knows the type and still checks nothing. The consequence that
  discriminates is: **a wrong parameter on a kit node is reported.** Write that sentence down before
  running anything.
- ⚠️ **Two ways an instrument lies.** Run the new checks against a **known-good** kit (must stay
  silent) *and* a **known-broken** one (must report). Either alone proves nothing.
- ⚠️ A kit that shadows a built-in type name must not let the kit's port set silently replace the
  built-in's during checking. CN-003 makes that a diagnostic; this task must honour the precedence.
