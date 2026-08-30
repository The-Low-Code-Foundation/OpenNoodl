# Phase 80 — next session

## State: DEF-001–004, 006, 008, 010, 011, 014–017, **021, 023** closed. DEF-007 🟡 (§3.2). DEF-009 🟡 (AC4). DEF-012 🟡 (§2 finding only). **Open: DEF-018, 019, 020, 022, 024, 025, 026.**

**s16 (2026-08-30)** closed the two worst of the phase-78 carry, both reproduced at HEAD before
building:

- **DEF-021 (`4adab228`)** — `Send Email` stamps each queued outcome token with the `To` it was
  minted under. Stamps agree → today's batch verbatim (one send, fields read after inputs
  settle — 🔴 the stamp must never become the address a single-address batch uses, because a
  pulse can arrive before its `To` in the same pass; that has its own arm and mutant). Stamps
  disagree → a fan-out: one send per consecutive run of the minted address, each run settled by
  its own call. 3 mutants, each killed by exactly its arm. erg-001 §4's constant-To pin
  untouched.
- **DEF-023 (`acd053e0`)** — 🔴 **the standing instruction paid a 13th time, new direction
  again: the recorded MECHANISM was the wrong runtime's.** D35 cited `_componentScopes` and
  reused instance ids; the cloud runtime never reaches that code — `noodl-js-api.js` overrode
  the scope to ONE module-level object (wider than the row: shared across functions, CONCURRENT
  requests, and even two runners in one process — the third spec arm caught the previous
  test's flag leaking in). Fix: WeakMap keyed on the component-owner INSTANCE. Same-instance
  scripts still share (TPL-002's plan/pump contract, the arm that kills the fresh-bag mutant);
  entries die with the request's graph — the leak half is held by construction, stated
  honestly, not by a spec.

## What to do next

- **Open carry rows, ranked by who they bite:** **DEF-026** (a cloud call to an unreachable
  backend reports nothing — *undiagnosed*: the drive established THAT `failure` never fires,
  not where the refusal is lost; start at `cloudfunction2.ts:182`'s error callback and find
  what a connection refusal actually does), **DEF-025** (checkbox label not a click target —
  ⚠️ defaulting `useLabel` on changes every existing project's rendering, so the door-
  diagnostic half may be the honest first move; the default flip smells like a Richard
  ruling), **DEF-022** (no way to learn the app's own origin — narrow fix is an output port
  on the Request node, which already holds the headers and throws them away;
  `request.ts:257`), **DEF-020/DEF-018** (the layout pair — both door-warning shaped, read
  them against each other before building either), **DEF-024** (Condition only turns gates
  ON — closest to a design ruling, do it last or take it to Richard).
- **DEF-012 §2 leftover** — the honest candidate is a door-side precondition (DEF-002 family)
  on cloud-function queries with connected filter params and run-on-change boxes on. SB-011 §5.
- **DEF-007 §3.2** — still sequenced behind phase 77's active file.
- **DEF-005, DEF-013** — 🔒 Richard rulings. Re-drive SB-012 §1 at HEAD before spending
  DEF-013's. **DEF-009 AC4** — 🧭 Richard (rateLimit default).

## Traps carried

- 🔴 **The peer's mid-flight edits are still uncommitted** — `site-builder.content.json`
  (+861 lines), `site-builder.security.json`, `noodl-mcp/tests/sb004Components.ts`, `sb005*`,
  `sb007Template.test.ts`, `nodegx-backend/tests/sb016/sb017`, `noodl-editor/tests/cloud/
  def015-cloud-component-roles.test.ts` + `sb017-deploy-connection-parity.test.ts` (those two
  are NEW since s15's list — the peer is still moving). The 15 nodegx-backend reds and 7
  test:ci reds from s15 belong to that template work. `git log -5 -- <path>` before touching
  any shared file.
- ⚠️ **TPL-002's `plan` script comment is now STALE** — it asserts "`Component` is not
  per-request" as current fact; DEF-023 fixed that. The write-whole discipline it prescribes
  stays harmless. Regenerating members-area just for the comment was not done (byte-gate churn
  beside the peer's mcp test edits); it lapses at the next regeneration. Noted in the D35
  section and TASKS.md s16.
- ⚠️ **dist staleness now also covers DEF-021/023**: noodl-mcp/dist (unchanged note) and any
  built nodegx-backend `dist/cli.js` predating s16 still carry the shared Component bag and
  the coalescing Send Email. Owner: whoever cuts the next 0.2.1 build.
- ⚠️ **MEMORY.md remains ~5K over budget** (unchanged from s15; lines only their owners can
  judge).

## Gates (s16, all fresh, HEAD `acd053e0`)

noodl-viewer-cloud **204/204** (194 + 7 DEF-021 + 3 DEF-023), `tsc -p noodl-viewer-cloud`
clean · nodegx-backend consumer suites over viewer-cloud/src (tpl002-notifications,
cwf-016-idempotency) **45/45** · tpl002 serial pump green pre- and post-fix (one address per
pass — never enters the fan-out branch). **`test:ci` NOT owed and not run** — no editor or
noodl-runtime source moved; the floor stands at s15's 2905/11 (4 AIX-006 BY NAME + 7
peer-template). Six mutants across the two tasks (3 + 2 run, + DEF-023's pre-fix red standing
as the shared-bag mutant), each killed by exactly its arm.
