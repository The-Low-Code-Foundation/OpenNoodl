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

## 🔴 The one decision this session deferred, with its price already paid

**`failure-reaches-nothing` is a rule but not yet a blocking one.** It reports on both doors today.
Promoting it into `AUTHORED_BLOCKING_WARNINGS` fails **8 specs across 3 suites**, and **every one is
a shipped template being regenerated through the door** — `publishPage`, `duplicatePage` and
`submitContactForm` really do leave failure edges unanswered, which is the defect P77 D1 reported.

- It was **10** before `98bfdea0` (TPL-001 Track A) cleared two. **The remaining blocker is the
  site-builder templates**, so this belongs to whoever next repairs `sb005Components.ts` and its
  siblings — not to a validation session.
- ⚠️ **Do not promote it to close a checkbox.** A door that rejects graphs the product itself ships
  is a door that gets switched off. The cost is recorded in `authoredCandidate.ts` beside the set,
  so it cannot be lost; re-run the three template suites with the code added to the set to get
  today's number.

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
  SBR-015/P77). **It was not, and nothing was taken.** Confirm ownership before acting on a handoff.
