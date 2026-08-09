# Phase 46 — Verification (Track V)

**Created:** 2026-08-06
**Status:** 📋 Specced, not started — **13 tasks**. Post-alpha. Tasks are **[TASKS.md](TASKS.md)**.
**Amended 2026-08-09:** Tier 1.5 added (VER-009…013, the component half). See below.
**Origin:** [NODEGX-VS-CODE-A-REAL-APP.md](../../reviews/NODEGX-VS-CODE-A-REAL-APP.md) §4.2, which
called this *"the one I would put first if I could only keep one"*.

> Richard, 2026-08-06: *"I'm not sure what kind of test harness you can have inside NodeGX, no idea
> how it would even work."*

That reaction is the right one and it is worth answering directly, because the answer is much less
exotic than "how do you test a graph" suggests.

## The unlock

**A cloud function is already a pure function.** Request in → graph → Response out. JSON to JSON.

That is precisely the shape a test asserts on. Nobody has to invent a semantics for "testing a node
graph" — you name an input and pin an output, which is what every test in every language has ever
done. The reference app's entire calculation core (3,915 LOC of French social charges, RGDU, TNS,
versement libératoire, pricing) is pure input→output, and it is the part of that product that most
needs pinning. A harness that covers only pure cloud functions would already have covered the thing
that mattered most.

## The second unlock, which is ours alone

**Determinism is a smaller problem here than in code, and that is a structural advantage.**

In Python, `datetime.now()` can be called from any line of any file, so pinning time needs
`freezegun` and a habit. In a NodeGX graph there are exactly **four** sources of nondeterminism and
the runtime owns all four:

| Source | Node | Test-mode seam |
|---|---|---|
| Wall clock | `net.noodl.Now`, `Date To String` | Freeze to a declared instant |
| Identity | `net.noodl.UUID`, `Unique Id` | Seeded sequence |
| Entropy | `net.noodl.RandomBytes` | Seeded PRNG |
| Network | `net.noodl.HTTP`, `REST2` | Record / replay cassettes |

Four injection points, enumerable from the catalog, closed by construction. The closed vocabulary —
usually discussed as a constraint — pays for itself here.

### ⚠️ …and phase 44 breaks this, which is a scheduling problem this phase owns

Added 2026-08-06 after an adversarial review
([counter-review §A.2](../../reviews/NODEGX-VS-CODE-THE-COUNTER-REVIEW.md)) caught it, correctly.

The claim above holds for a graph. It **stops holding the moment
[phase 44](../phase-44-compute-ceiling/README.md) ships `lib/`** — and the index schedules 44 first,
deliberately. `lib/` is arbitrary CommonJS: `Date.now()`, `Math.random()`, `crypto.randomUUID()`,
host-locale `Intl`, `process.env`. None are catalog nodes. None are enumerable. You are back to
Python's problem exactly, whose answer is `freezegun` plus a habit.

POST-ALPHA-INDEX names the 44/46 tension as *"a bigger foot-gun"* — a volume argument. That
understated it. **Phase 44 does not merely give phase 46 more work; it invalidates the design claim
this section makes**, and both comparison documents quote that claim as a differentiator.

**What this phase now owes, in VER-002:** a determinism contract for `lib/` — an injected clock,
`random` and `uuid` supplied to project modules rather than reached for globally, and a lint or
validator rule that fails a `lib/` file touching the globals directly. It is the same answer every
language reaches; the honest change is that we no longer get it for free.

## Why this outranks everything except cost

The comparison's Part II made the argument in the agent's terms and it is worth repeating as the
phase's reason for existing:

> Claude Code's most trustworthy mode is red→green. Without a test harness there is no green, so
> every claim of correctness is an assertion rather than a demonstration.

And the corroborating evidence is this repo's own history: catalog gates that read the working tree
and went green while `HEAD` advertised an unregistered node; a font check that passed twice while
the wrong font shipped. **If the platform's own gates can go green wrongly, an agent with no gates at
all should not be trusted about a tax calculation.**

This phase is also what makes [AAQ-007](../phase-40-ai-authoring-quality/AAQ-007-THE-AGENT-SEES-ITS-WORK.md)
worth having. An agent that can see its work but cannot prove it is still guessing with better
eyesight.

---

## Tier 1 — cases (the shippable core)

**A test is a file. The runner is headless. Neither needs the editor open.**

| ID | Title | Est. | Notes |
|---|---|---|---|
| **VER-001** | The case format and the headless runner | 1 wk | `tests/<function-path>/<case>.json` = `{ name, request, expect, only?, skip? }`, inside the v2 project so it diffs and merges like everything else. Runner boots the cloud runtime in-process — it already runs in-process in `nodegx-backend` — POSTs each case, deep-compares. `expect` supports exact, subset, and a small matcher vocabulary (`~number` with tolerance, `*` any, `!undefined`). **No assertion DSL beyond that**: a matcher language is a programming language one feature at a time. |
| **VER-002** | The determinism seams — four in the graph, plus `lib/` | **1.5 wks** | The table above. A case declares `{ now: "2026-01-01T00:00:00Z", seed: 42 }`; HTTP gets record-mode (writes a cassette next to the case) and replay-mode (default in CI; an unmatched request **fails** rather than reaching the network). **Plus the `lib/` contract** — see the warning above; this is the half that is not free. |
| **VER-003** | `nodegx test` | 3 d | CLI over a project directory. TAP + JSON reporters, non-zero exit on failure, `--filter`, `--update-cassettes`. This is the CI story, and it must not require Electron. |
| **VER-004** | The Tests panel | 1 wk | Green/red list grouped by function; a **Run** affordance on the function canvas itself; a failure opens the graph with the failing run's values on the wires — which is where this phase meets the trace substrate and stops being a text tool. |

**Tier 1 total: ~3 weeks.** Ships alone and is worth shipping alone.

## Tier 1.5 — components (added 2026-08-09)

**Origin:** Richard, 2026-08-09, on how AI-built projects accumulate a regression suite:

> *"When you build a new visual or logic component, part of the 'checklist' of that component is to
> design and run a test to make sure the component does what you intended it to do… Every time you
> make a new component, all the previous component tests run when you declare it done and it flags up
> which components are now not working the way you intended them to."*

Tier 1 covers cloud functions because a cloud function is already a pure function. **But most of a
NodeGX project is not a cloud function — it is components**, and Tier 3 below defers the component
half as Playwright-shaped and expensive.

That was the right call when it was written and it is no longer the situation, because
**[phase 56](../phase-56-component-bench/README.md) shipped 80% of this without calling it testing.**
The Component Bench mounts one component in a real runtime, feeds it declared inputs, and — BEN-003 —
**reads its outputs back rather than only its pixels**. BEN-005 persists a named set of inputs on the
component as a **scenario**, round-tripped through the project format.

> **A scenario is a test case missing exactly one field.** It has a name, inputs, a declared frame,
> and it diffs and merges with the component it belongs to. It has no `expect`.

BEN-005 §4 filed the gap itself — *"needs an assertion language this task does not have"* — and this
tier is that language plus the runner, the reporting and the agent surface around it.

**The authoring model is the differentiator, and it is only available to us.** The builder does not
write an expectation: they run the scenario, look at the outputs the bench already renders, and press
**Pin these as expected**. Nobody types a matcher. For an audience that will not write test files
under any circumstances, that is the only version of this that ever gets used — and it is possible
only because the platform owns both the runtime and the component's declared interface.

| ID | Title | Est. | Notes |
|---|---|---|---|
| **[VER-009](VER-009-A-SCENARIO-GROWS-AN-EXPECTATION.md)** | A scenario grows an expectation | 1 wk | `expect: { outputs, signals }` on BEN-005's scenario, using **VER-001's matchers, imported**. Pinned by looking, never typed. ⚠️ **Its §1 is the load-bearing finding**: the bench's output channel is `previewValue`, a **display dialect capped at 200 characters**, so it cannot carry an assertion — a fidelity read path is the first thing this task builds |
| **[VER-010](VER-010-THE-COMPONENT-RUNNER.md)** | The component runner: no editor, no display | 1 wk | Three of its four pieces already exist: `render-from-disk.js` mounts a component by name from node, `benchHarness()` is a pure JSON transform, `editor-deps.ts` proves the imports are Electron-free. ⚠️ **Hard-ordered behind VER-002** — a component calling `Now` is as nondeterministic as a function calling it |
| **[VER-011](VER-011-COVERAGE-IS-INFORMATION.md)** | Coverage is information; only failure is a warning | 3 d | The corrected version of *"an untested component gets an error badge"*. It would light up every component on day one and **teach people to ignore the warning colour** — which is already carrying real defects. Failing warns; untested informs; untestable is silent and out of the denominator |
| **[VER-012](VER-012-WHAT-DID-I-JUST-BREAK.md)** | What did I just break | 1 wk | Newly-failing vs still-failing, and the part a code suite cannot do: **the blast radius is computable**, because the instance graph is written down. *"You changed Card; 14 components embed it; 6 have scenarios; 2 now fail; 8 were not checked."* ⚠️ The last clause is mandatory |
| **[VER-013](VER-013-THE-AGENT-PROPOSES-THE-HUMAN-PINS.md)** | The agent proposes the states; the human pins the truth | 3 d | The agent enumerates states from the interface and the graph (`Empty`, `Loaded`, `Long name`, both sides of a condition). It **never** authors an `expect` — an AI that writes the component and the assertion has proved only that the graph does what the graph does. Extends VER-007's tools; adds none |

**Tier 1.5 total: ~3.5 weeks**, and the cheap slice is **VER-009 + VER-011 at ~1.5 weeks** — pinning
and verdicts in the bench, no CLI, no CI. That is enough to find out whether builders pin anything at
all, which is worth knowing before spending the other two.

## Tier 2 — traces (the differentiated part)

[OBS-001](../phase-36-runtime-observability/OBS-001-TRACE-SUBSTRATE.md) already replaced the
frame-flushed debug map with an **append-only, per-edge event log with ordering and causality
preserved**. That is a trace recorder that nobody has yet pointed at testing.

The payoff is a kind of test that code does not get cheaply: **a regression test that is recorded,
not written.** A user hits a bug; you capture the session; it becomes a permanent test. Nobody
authors a test file. For an audience that is not going to write test files under any circumstances,
this is the only testing story that will ever actually get used.

Note this is also the **same machinery [EXP-003](../phase-18-code-export-v2/EXP-003-AI-LOGIC-TRANSLATION.md)
already needs** — "run the interpreted and compiled versions side by side on recorded traces". One
substrate, two consumers, and the second one is already specced. That is the strongest possible
argument for building it.

| ID | Title | Est. | Notes |
|---|---|---|---|
| **VER-005** | A trace is an artifact | 1 wk | Record from a running app or a function run; store as a first-class project file with a stable format; redaction rules, because a trace of a real session contains real data. |
| **VER-006** | Replay and the mismatch policy | 1.5 wks | Replay inputs, compare the emitted event log. **The hard part is not replay, it is what counts as a mismatch** — wire order that is genuinely free vs. order that is load-bearing, timestamps, ids. Get this wrong and every trace test is flaky and the feature dies. Ship with a deliberately narrow definition (values on declared edges, order only where the graph makes it deterministic) and widen on evidence. |
| **VER-007** | Tests are visible to the agent | 3 d | MCP: `run_tests`, `get_test_failures`, `record_case`. This is the task that converts the AI story from assertion to proof, and it is three days on top of VER-003. |
| **VER-008** | Workflow run assertions | 4 d | A workflow's durable execution record is already the right artifact; assert on step outcomes, retries taken, and the path through the DAG. |

**Tier 2 total: ~4 weeks.**

## Tier 3 — explicitly not now

Driving the running **app** — navigating routes, filling forms across pages, asserting on the
assembled result. Playwright-shaped, expensive, and the value/cost is poor while the other tiers are
unbuilt. The platform already has CDP drivers for its own QA; app-level E2E for *users* can wait for
evidence that anyone wants it.

⚠️ **Amended 2026-08-09: Tier 1.5 is not this.** A benched component is a single component at a
declared width in a real runtime, driven by data rather than by clicks — no routing, no page
assembly, no user journey. It is closer to a unit test than to an E2E one, and phase 56 already
built the mount. The distinction matters because "assert on rendered output" was the phrase that put
the entire component half in the not-now bucket.

**Pixel diffing stays out**, and the reason is not cost. Screenshot comparison fails on font hinting,
antialiasing, a scrollbar and a different OS — so most of its failures are not defects, and a suite
whose failures are usually noise gets re-run until it goes green. That is worse than no suite,
because it launders untested code as verified. Tier 1.5 asserts *structurally* instead (something was
drawn, N rows, no overflow at the declared width, the bound text is in the DOM) — see VER-010 §5.

## Exit criteria

1. The reference app's social-charge calculation ships as a cloud function with cases pinning SMIC,
   2200 €, 2500 € and PASS against the published reference table — the exact tests
   `test_2_6_2_prestataire_charges.py` performs in Python today.
2. `nodegx test` runs in CI on a checkout, with no editor, no display, and no network.
3. A recorded session from a real bug replays as a failing test, and passes after the fix.
4. An agent, via MCP, makes a change, runs the tests, sees a failure, and fixes it **without a human
   in the loop** — the first time an agent has been able to prove anything about a NodeGX project.
5. *(Tier 1.5)* A builder pins expectations on a component by **looking at its outputs and pressing a
   button**, having written nothing. Weeks later a change to a shared component turns that scenario
   red, and the report names the component they changed, the consumer that broke, and **how much of
   the blast radius was never checked at all**.
