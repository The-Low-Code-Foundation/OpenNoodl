# Phase 67b — next session

**Written 2026-08-19 (session 43), replacing session 42's.** Platform repo:
`~/vscode_projects/nodegx-community`. Task ledger:
`dev-docs/tasks/phase-67b-the-community-remainder/README.md` — the phase has **no per-task
files**; its work items are the `UNI-0xx` files in `phase-67-nodegx-university/`.

⚠️ **Check for a live peer yourself — that is a per-session fact, not this file's to assert.**
At 23:0x there were three OpenNoodl sessions: one on **phase 73 TUT-001** (BackendServicesPanel,
driving an editor) and one on **phase 72 NAT-007** (the thread view — five untracked files under
`noodl-core-ui/src/components/community/` and `editor/src/hooks/useCommunityThread.ts`). Neither
had committed. **Session 43 touched no OpenNoodl source at all** — only the two docs commits below.

---

## 1. ✅ UNI-007 AC1 IS MET. THE INTAKE, THE PATH, AND A CACHE THAT CAN PROVE ITSELF

`nodegx-community@ce3b4ea`, `OpenNoodl@0ee76722`. This was session 42's named next job and it is
done. Full write-up is in the **AC1 block at the top of
[UNI-007](../phase-67-nodegx-university/UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md)**.

| | |
|---|---|
| The intake | 3 closed-answer questions, `learner_intakes` (0016) — retaking replaces |
| Tier-0 branching | `src/lib/pathing.ts` — visual-logic learner never meets the function-node lesson; `data` / `custom-nodes` tracks join when asked for |
| Tier-1 projection | `src/lib/projection/projector.ts` + `concept_projections` (0016) |
| The real projector | `src/lib/projection/anthropic.ts` — **Sonnet**, per UNI-007's own scope line |
| Routes | `GET/POST /v1/me/intake`, `GET /v1/me/path`, `POST /v1/me/path/project` — `docs/API.md` **§5c** |
| Gates | **29** new specs; whole platform suite **48 files / 1164 tests / 0 failures** |

### 🔴 Three things to read before touching any of it

1. **The cache guarantee is the primary key, and the ORDER of two lines is the feature.** The
   `(account_id, concept)` row is **claimed before the model is called**. Swap those and
   "exactly one call ever" silently becomes sequential-only: two concurrent requests both find
   no row, both call, the second overwrites the first with an equally plausible answer, nothing
   errors and the bill doubles. **Measured, not argued**: with the defect reintroduced the
   eight-concurrent-request spec went red and **the sequential one still passed**.
2. **A failed projection is NEVER retried, deliberately.** Deleting the row on failure restores
   "one call per request, forever" against a provider that is down. If a later session wants
   retryable failures, the spec line `records a failure and does not retry it` is where that
   argument has to be won.
3. **An unconfigured projector must not claim the row.** Availability is checked *before* the
   claim, so a deployment with no `ANTHROPIC_API_KEY` does not poison every pair it is asked
   for. There is a spec for exactly that repair path.

### ⚠️ The repo gained its first new runtime dependency: `@anthropic-ai/sdk`

Deliberate, and argued in `projection/anthropic.ts`'s header. `mail/brevo.ts` avoids a dependency
because it posts one fixed body to one URL forever; a model API is a moving surface with versioned
per-model parameter rules, and hand-rolling it fails silently-wrong for the model it names.

## 1b. 🔴 A NEIGHBOURING TASK'S GATE FOUND A DESIGN ERROR IN THIS ONE

The first `pathFor` hardcoded three lesson slugs. **UNI-022 AC4's sweep — *no `.ts` under `src/`
may name a lesson* — failed it.** That was not a naming quibble: hardcoded slugs meant **branching
a learner past a lesson was a code change**, which is the same defect as adding a lesson being one.

Fixed by moving the rules into `curriculum.json` — `requires` / `includedBecause` /
`omittedBecause` on a lesson or a whole path, and `final` on the spine. `pathFor` now names no
lesson at all. ✅ **Putting a new lesson behind an intake answer is an edit to that file.**

⚠️ **The generalisation worth carrying: a gate written for a neighbouring task is a gate on YOUR
work too, and it is the one most likely to see what you cannot.** Two other derived-from-disk
sweeps also fired and both were right — UNI-011 wanted a D15 verdict per route, UNI-005 wanted
every new free-text column classified with an executed probe.

## 1c. §11's WALL IS UNCHANGED, AND AC1 DID NOT MOVE IT

**All fifteen lessons in `curriculum.json` are still `state: 'in-writing'`**, so every path AC1
produces is a path to nothing installable. That is deliberate and *visible* rather than worked
around: `ready`/`total` and a `truth` sentence are computed per path from each lesson's own
standing, and a spec asserts the curriculum really is all-in-writing so the sentence cannot rot.

🔴 **Curriculum hosting is UNI-007 §11's, open since 2026-07-25, and it is still the real blocker
on "a stranger learns NodeGX from the platform."** Two problems, not one: a hosting route, and
**fifteen lessons nobody has written**. The second is much the larger and is not an agent's call
to scope alone. ✅ `org_shelf` still works end to end — a school's own lesson travels as the shelf
item's payload — so the school case is unaffected.

## 2. D10 is now structural in two places, and both are worth not undoing

- **Off for org-minor accounts**, decided by reading the account's **own kind** from the database
  rather than trusting a caller's argument, and decided **before** the row is claimed. Paired with
  a known-firing control (an individual account through identical code *does* call), because zero
  calls reads the same whether the gate refused or the projector was never wired up.
- **Pathing metadata only, never pupil content.** The projector is handed two finished strings and
  never sees the learner, the account, or the intake object. The answer set is **closed — there is
  no free-text intake question** — and `learner_intakes_answers_are_tokens` (0016) enforces
  token-shaped values *in the schema*. 🔴 **That constraint exists because "the route validates
  it" is the sentence that stops being true the day somebody adds a second writer.** Adding a
  free-text intake question re-opens D10; do not, without a ruling.

## 3. Gate readings — 2026-08-19, session 43

| Gate | Reading |
|---|---|
| `nodegx-community` `npx tsc --noEmit` | ✅ **0 errors**, measured without a pipe |
| `nodegx-community` `npm test` | ✅ **48 files / 1164 tests / 0 failures** — after `npm run build`, so the real-HTTP file actually ran |
| `npm run lint` (platform) | 🔴 **STILL NOT A GATE** — no eslint configured |
| `OpenNoodl` `test:main` | ⚠️ **NOT MINE TO REPORT.** A peer measured 1 failure at ~23:00 (`uni-001/session-readers` — an unlisted reader from *their* NAT-007 neighbour's untracked `useCommunityThread.ts`), against 0 at 22:47. **Session 43 changed no OpenNoodl source**, so this is not from this work. Re-measure yourself. |
| `OpenNoodl` `test:ci` | ⚠️ Not run by me. A peer reported it at floor (2849 specs / 10 failures @ seed 39393, same 10 by name) at ~22:5x. Not my measurement — re-measure before quoting. |

✅ **Isolated database `nodegx_community_s43`** on the 55432 container; it still exists.
`DATABASE_URL='postgres://nodegx:nodegx@localhost:55432/nodegx_community_s43'`.
⚠️ `nodegx_community_s42` also still exists — tidy up when nobody needs it.

## 4. What to do next

### An agent alone — nothing needs Richard

1. **UNI-008** (L+, carries a standing legal and ops burden — **read D9 before starting**).
2. **UNI-010's remainder**; **UNI-012** (needs a **packaged build** to verify anything).
3. **Wiring AC1 into the editor.** The platform end is complete and has no caller in the editor —
   the same shape UNI-006 was in before session 42 built its bridge, and the same lesson applies:
   *building the caller is what finds what a shipped thing does not do.* The three routes are in
   `docs/API.md` §5c. ⚠️ This overlaps phase 72's editor surface — **check for a live peer first.**
4. ⚠️ **A deploy, whenever one is wanted** — see below. AC1's routes are inert on the live site
   until then, exactly as UNI-006's bridge and E7 are.

### 🔴 The deploy warning is UNCHANGED and still applies

nexus-1 is at **`0cbd716`**. Everything since — NAT-014's mail drain, E7, NAT-006's read API,
UNI-006's bridge and now UNI-007's AC1 — is undeployed. **The next deploy installs phase 72's mail
timer, and the first drain will refuse because the outbox backlog is older than
`MAIL_DRAIN_MAX_AGE_DAYS` (7). That refusal is the guard working — do not route around it.**
Releasing weeks-old mail is Richard's decision. ✅ **Deploy from a pristine clone of a named
commit**: `git clone` to `/tmp`, `git checkout main` (the **branch**, not the bare sha, or the
stamp records `branch: HEAD`), run `ops/deploy.sh` there.

⚠️ **A deploy now also needs `ANTHROPIC_API_KEY` in the environment**, or tier-1 projection
answers `unavailable` on every request. That is the honest degraded state and not an error — the
tier-0 path is a complete path — but it is a config step somebody has to *choose* not to take.

### ⚠️ One open ruling this session touched rather than settled

UNI-007's two writes take **the same session scope as the browser** — a *default*, not a ruling,
exactly as UNI-006's three do. Phase 72's **D5** (*what authorises a write from the editor?*) is
open. If D5 rules for a narrower post-only scope, the list to re-scope is now **five routes, not
three**, and they are named together in `docs/API.md` §5b/§5c so nobody has to go looking.

### Not this phase's

Gap A (the mail drainer) is **P72 NAT-014**, built and committed, **not deployed**. UNI-018 is
**NAT-015**; UNI-011's rail icon is **NAT-012 AC7**. Settled 2026-08-19, do not re-litigate.
