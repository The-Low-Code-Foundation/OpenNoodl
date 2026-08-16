# CN-004 — Turn the checks back on

> ## ✅ CLOSED 2026-08-16 — and it was not the task it was written as
>
> 🔴 **Items 1–3 were already done when this session started.** Every skip site
> gates on `catalog.hasType()`, and CN-003's overlay makes that true for a kit
> type — so `checkParameterValues`, the unknown-port checks and `--strict` all
> took kit nodes on the normal path the moment the overlay landed. **Nothing had
> ever asserted it.** Measured before anything was changed: a kit node with
> `progress: 'lots'` already produced `invalid-parameter-value` / error, the same
> code, severity and message a built-in draws for the same mistake, and a correct
> kit node was already silent.
>
> ⚠️ The task's own trap is why that is worth stating rather than quietly
> shipping. Three things were true before this session and are *also* true of an
> implementation that resolves the type and checks nothing: the info count goes
> to zero, `unknown-node-type` stops warning, and "validation knows the type".
> None of them discriminates. The consequence that does — **a wrong parameter on
> a kit node is reported** — was written down before anything ran and is now
> asserted, with its built-in control beside it, in every case.
>
> ### 🔴 What *was* broken: item 4, in both directions
>
> The dynamic-port carve-out was not kept, and no fixture could see it — the demo
> kit and the cashflow kit declare no `dynamicports` at all, so the mapping ran on
> the empty case for a task and a half. `toDynamicPorts` labelled **every** entry
> `declared-port-groups` and passed the raw exported entries through:
>
> | | before | after |
> |---|---|---|
> | a kit node with a `channelPort` (ports minted at runtime) | `unknown-parameter` **warning on a correct kit** — guaranteed, since the exporter keeps a channel port out of the static list | silent |
> | a kit node's conditional group, parameter set while switched off | **nothing** — the condition lived under `ports`, where `conditionForInput` does not look | `inactive-conditional-parameter`, as a built-in draws |
>
> The two vocabularies simply differ: `formatDynamicPorts` emits
> `{ name, condition, ports: [portObject] }`, the catalog stores
> `{ condition, inputs: [name] }`. One is a false accusation, one a silent miss;
> a fix for whichever was noticed first would have left the other. Both are
> mutation-proven — reverting `toDynamicPorts` kills 8 mapping tests and both
> consequence tests, and leaves the 12 parity tests correctly green.
>
> ### What landed
>
> - `@nodegx/kit-catalog` — `toDynamicPorts` classifies per entry and unions the
>   mechanisms; `toDeclaredPortGroup` translates to the shape consumers read.
> - `tests/fixtures/kit-dynports` — a **real** kit declaring both shapes, run by
>   the real extractor. `dynports-kit-nodelibrary.json` is its recorded payload.
> - 45 tests: `nodegx-kit-catalog/tests/dynamicPorts.test.js` (mapping, against
>   the recording), `noodl-editor/tests-unit/cn-004/` (parity + AC 4b's drive),
>   `noodl-mcp/tests/cn004.test.ts` (end to end through the real callers).
>
> ### 🔴 Two findings that outlive this task
>
> 1. **`@noodl/mcp`'s provisioning suites are intermittently red under machine
>    load, and were before this task.** Interleaved A/B runs: **2 of 6** failing
>    without CN-004's suite, 4 of 6 with. A 49th suite touching *no package code*
>    — 1.5s of arithmetic — reproduces it. ⚠️ A sequential "clean before, red
>    after" comparison on a shared machine measures the machine; that single
>    sample briefly convinced me this task had caused it. **Wants a task number.**
> 2. **The packaged `dist/noodl-mcp.cjs` still carries the old mapping.** The fix
>    reaches registered MCP servers only after a rebuild.

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
