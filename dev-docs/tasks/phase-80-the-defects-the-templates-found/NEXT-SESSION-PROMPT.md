# Phase 80 — next session

## State: DEF-001 and DEF-002 both closed. The next rank is DEF-003.

**s2 (2026-08-29)** finished DEF-002 — the blocker s1 identified, plus its three remaining rules.

| commit | what |
|---|---|
| `820fde86` | **AC6** — `validate_project` runs the precondition layer, calibrated over the corpus |
| `c8e0f262` | **1(b)/1(c)** — `CloudFunction2` `in-*`/`out-*` and `RouterNavigate` `pm-*` |
| `b91d696a` | **2** — a cloud function's `Failure` edge that reaches no response |
| `f984849f` | the deferred promotion's cost, re-measured after a peer's template fix |

Gates at close: `test:ci` **2889 specs, 4 failures, all `AIX-006 style vocabulary` by name** (the
floor) · `test:main` **6311/6311** · MCP **897/897** · `typecheck:editor` and `typecheck:mcp` clean.

---

## 🔴 The one thing left on DEF-002, and it is small and named

**`failure-reaches-nothing` is a rule but not yet a blocking one.** To promote it, add
`DiagnosticCode.FailureReachesNothing` to `AUTHORED_BLOCKING_WARNINGS` in `authoredCandidate.ts`.

What stops that today is **two deliberately-malformed test probes** —
`/#__cloud__/probe/RunTasksCrossRuntime` and `/#__cloud__/probe/RunTasksMissing` — which exist to
exercise a *different* check and fail this one on the way past (4 specs). **Wire their `failure`, or
exempt them, and the promotion is free.** The shipped templates are clean.

🔴 **This entry said something else earlier today and it was wrong.** It said the promotion was
blocked because the templates *"really do leave failure edges unanswered"*. They do not. It was
blocked by **two false positives in the rule**, found only because a peer pushed back with a
counter-measurement:

- `mail.failure` unwired, because **`mail.completed → res.send` already answers** — `completed`
  fires after every invocation *whatever the outcome*, so it answers the failure path.
- `compose.failure` unwired, because a **parallel branch still answers**, so a throw there costs the
  work, not the reply.

Both are now exits with arms and controls. Corpus **249 → 182 → 33** (`d3461020`).

⚠️ **And the peer's diagnosis was wrong too**, in the opposite direction: they proposed excluding
components with no `Response` node — which the rule has always done — and their metric counted only
failure wires that **exist**, so it could not see the two *unwired* ports doing the firing. **Two
real measurements, neither answering the question. Re-measure the thing itself.**

## Where to go next

**DEF-003** is the next rank (three authoring acts with no honest surface; P77 D8 = P76 F15, P77 D7,
P76 F16 — bites *every author*). DEF-010 C1 and DEF-004 are the other open work.

⚠️ **DEF-014 and DEF-015 were filed into this phase by a peer** during s2 and this session never
read them — check `TASKS.md` before ranking.

## 🔴 What this session paid for, that the next one should not re-buy

- **A relayed description of a mechanism decays, even inside the task file that owns it.** DEF-002
  §1(c) sourced the `pm-` ports from *"`PageInputs.pathParams` and the `{braces}` in `Page.urlPath`"*.
  The adapter reads `pathParams` **and `queryParams`**, and `urlPath` **not at all**. Building from
  that sentence would have been wrong **twice** — a false positive on every query-parameter wire and
  a false negative on brace names. **This is the second time in two sessions**, after D10's
  "runs once with false". **Read the caller.**
- 🔴 **A new checker's first number is about the checker.** `failure-reaches-nothing` fired **249**
  times on its first corpus run. 67 were `noodl.cloud.response` nodes — a response **is** the send,
  so requiring its own failure to reach a response is an infinite regress, and it was firing on
  **both arms of its own acceptance pair**. One principled exemption took it to 182 real ones.
  **Run a new rule over the corpus before believing any of its findings.**
- **A zero is only readable beside its arms.** 1(b)/1(c) find **nothing** across 94 projects. That
  is a clean corpus and not a dead check *because* the corpus holds 14 real prefixed wires it reads
  and accepts, and a sabotaged copy yields exactly 2. **Neither number alone says anything.**
- **The honest denominator for "what would switching this on cost" is what is not already
  reported.** `rules/parameterValue` has run `checkParameterValues` on that door since D13, so the
  naive precondition count double-counts. `npm run calibrate:preconditions -- <dir>` does the
  subtraction.

## Traps carried

- ⚠️ **`tpl001Template.test.ts` flaked once** — "13 file(s) differ" in a full-suite run, then passed
  twice alone and clean in the next full run. **A lone red is a flake until re-run.**
- ⚠️ **`tsc -p scripts/tsconfig.json` OOMs at HEAD**, with or without new files, and **there is no
  `typecheck:scripts` gate**. `scripts/*.ts` is typechecked only by `ts-node` when it runs.
- ⚠️ Peers committed into this checkout throughout (HEAD moved `820fde86` → `98bfdea0` under the
  gates). **Pathspec commits only, and `git add` untracked files or they are skipped silently.**
- ⚠️ A peer addressed this session as though it were another one ("AC1 is yours — take it", about
  SBR-015/P77). **It was not, and nothing was taken.** Cause, from the peer: they replied to a
  `ListAgents` **name** for a message that arrived on a **socket** — two identifier spaces.
  **Reply to the socket a message arrived on.**
- 🔴 **A peer's pushback was right that I was wrong, and wrong about why — and both halves mattered.**
  Their metric ("failure wires whose target is not a Response") could not see an **unwired** port,
  which is the case the rule is about. **When a counter-measurement disagrees, check what it is
  blind to before accepting *or* dismissing it.**
