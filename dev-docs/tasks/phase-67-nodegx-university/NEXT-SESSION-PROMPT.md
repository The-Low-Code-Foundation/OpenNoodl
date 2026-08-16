# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` — ⚠️ **the queue is EMPTY; D15/D16/D17 were ruled
2026-08-16** and the note at the end of D17 explains what to re-check if a *parent* ruling is ever
amended. Then §"WHERE THE PHASE ACTUALLY IS" below, then `TASKS.md`'s table, then your task file.
`PRIOR-ART-RECONCILIATION.md` if you have not read it before.

🔴 **Two repos now.** Editor work is this checkout. Platform work is
`/Users/richardosborne/vscode_projects/nodegx-community` — a **sibling directory, never nested** —
pushing to `The-Low-Code-Foundation/nodegx-community`. None of this checkout's gates, peers or traps
apply there.

---

# WHERE THE PHASE ACTUALLY IS — measured 2026-08-16, not remembered

| Track | Tasks | State |
|---|---|---|
| **Platform** | UNI-001 (AC3), 002, 003, 004, **005**, 009 (content cut) | 🟢 **FIVE BUILT.** `f56a70b`, fifth commit, **pushed** |
| **Platform** | UNI-006, UNI-008 | 📋 **Two tasks, not started** — **UNI-006 (assign/grade/review) is next on the platform track and is now unblocked by name**: it consumes UNI-005's roster |
| **Platform** | UNI-001 (the rest) | 🔴 **Blocked on Richard**: OAuth callback URLs need `community.nodegx.dev`, still unregistered |
| **Editor / MCP** | UNI-007, UNI-010, UNI-012 | UNI-007 slices 1–5 + tutor overlay; UNI-010 five slices, **KEEP**; UNI-012 scoped, not built |
| **Editor + bridge** | UNI-011 | ✅ **Fully unblocked to build AND to ship** — D15 and D16 are ruled |

**The eighteenth session built UNI-005 — the org workspace.** Nine of the phase's twelve tasks now
have a platform surface, and the roster phase 68 and UNI-006 both consume exists.

## What UNI-005 added, and the shape of it

**Gates:** `363 specs / 16 files` in `nodegx-community` (baseline **245 / 12**), `tsc --noEmit`
clean, `next build` **14 routes** (was 11). ⚠️ **`npm run lint` is STILL not a gate there** — no
ESLint config, so the script drops into an interactive setup prompt. It has never run.

**AC5 was already met before the session started**, and checking rather than writing is the point:
LEARN-005's D10 amendment was written **2026-08-14** by the first session. Two handovers could
easily have carried it as owed. Its condition 2 — *"the handle → pupil-name mapping stays with the
org"* — is now a trigger rather than a sentence.

**🔴 THE FINDING: `orgsFor` took an account id and no viewer**, with a comment reading *"its own
membership, so no viewer argument is needed"* — true of every call site that existed and **false as
a property**. An org admin legitimately holds a member's account id (it is on the roster they may
see), so the function was one call from telling them **which other organisations that member
belongs to**. This is the sixth instance in the phase of *build the caller and it shows you what the
thing does not do* — and the first where **the caller was a test being designed**, not a feature.

**AC3 is a sentinel sweep, not a list of negative assertions.** *"An admin cannot read a member's
non-org data through **any** org endpoint"* is a claim about a surface, so the suite seeds one
member with a distinct SENTINEL in nine places, calls **every function both org modules export**
with the admin as viewer and the member as subject, and asserts nothing comes back. The call list is
derived from the modules' own exports and **fails on an export it has no recipe for**. 🔴 Two
known-firing controls sit in the same file, because a sweep over endpoints that all returned `null`
would pass identically.

**AC4 is a census rather than a document.** All **73** free-text columns in the live schema carry a
classification; an unclassified column fails by name, a classification naming a dead column fails
too, and nine probes execute the refusals the classifications claim. ⚠️ **The suite also states
where the claim stops** — six columns are `adult-authored` and nothing can police what a teacher
types into an org name or a report reason. The claim is that no *pupil-facing path* deposits child
PII and no field is *for* it; a census implying more would be worse than none.

### 🔴 Three controls worth carrying past this task

**One found a module's own header to be true of one reader and false of the other.**
`src/lib/shelf.ts` claimed *"every reader is defined in terms of `shelf_item_visible_to`"*.
`shelfItem` was; `orgShelf` filtered `hidden_at` inline and agreed **by coincidence**. Making the
function always-true failed **five** specs instead of nine and nothing looked wrong.

**And the fix was unmeasurable until a spec was split.** With the listing routed through the
function, the obvious control still failed **1** spec either way — because the one spec touching
hidden-ness asserted *both* readers at once and failed for `shelfItem`'s reason regardless.
🔴 **A spec that fails for either of two reasons cannot be a control for one of them.** Split in
two, the arms separate: **as shipped 2 fail, with the inline copy restored 1** — the duplicate
survives its own rule being deleted.

**The control harness patches literally and prints what it patched.** UNI-004's control that
measured nothing used `perl -0pi` with a replacement containing `$$`, which perl expands to the
**process id**. This one does a split/join in Node and prints the patched region before running, so
a control that failed to apply cannot read as a result.

### ✅ Driven over HTTP, against consequences written before the drive

Thirty written first, **30/30 passed**: a signed-in non-member **404s** at the org page and at a
shelf item's **direct URL**; an ordinary member sees the roster and **not** the settings; the wrong
org slug with the right item id renders for a member and 404s for a non-member; COL-004's *"1 person
has this open"* renders; `/orgs` signed out is a **contact-us sentence, not a signup form**.

🔴 **The absence assertion carries its own known-firing signal.** *"No email address anywhere on the
school's page"* is worthless alone, so the record also shows the teacher's **handle** on that page,
her display name and address **absent**, and the same grep finding that address when present.

🔴 **And the thing that made any of it drivable:** UNI-005 is the phase's first task with **no
public half** — an org is member-only by definition. So `src/lib/viewer.ts` reads a session cookie
against UNI-001's real `sessions` table, and `db:seed` mints four dev sessions. **Nothing else mints
one.** Without it every route would have exactly one reachable branch, the 404, and *a drive over a
surface that 404s for everybody passes identically when the surface is broken.*

---

# What to do next — pick a lane and say which

**LANE A — UNI-006, assign / grade / review. Recommended.** It is the platform task with nothing in
front of it now that the roster exists, and D6 is explicit: **roles, assignment and grading read the
roster and must never branch on `source`** — that is the one binding UNI-005 could not discharge for
it, because nothing was assigning yet. ⚠️ **It also inherits UNI-005's sharpest open question:** an
org-minor account currently cannot publish to the shelf (a free-text payload is where a name
arrives), and *a submission is where pupil work is meant to go instead* — one reader rather than an
organisation. UNI-006 has to answer that, and it is a **product** call as much as a schema one.
D13 also names this task's state machine as the one phase 68 reuses with a human grader, so build it
so a coach can replace the runner.

**LANE B — make the login real.** Finish UNI-001: OAuth, sessions, the consent screen, the editor
half. 🔴 **Blocked on Richard, not on work** — callback URLs need `community.nodegx.dev` and the
domain **is not registered**. ⚠️ It now blocks **five** things: the admin routes UNI-002, 003 and 004
deliberately did not build, UNI-003's owner-facing account page, and **every write path in UNI-005**
— inviting, publishing, syncing and hiding are all specced and reachable only from a test.
🆕 **Half of it is now cheaper than it was:** `src/lib/viewer.ts` is a working session reader against
the real table. What is missing is the **issuer**.

**LANE C — UNI-011, the editor mirror.** D15 and D16 are ruled, so it can be built *and* shipped.
🔴 The renderer is `nodeIntegration: true` **and so is the launcher** (same `BrowserWindow`): **no
post body may render as HTML in it.** ⚠️ The stranger-authored corpus has widened again — UNI-005
adds shelf item titles, summaries and **payloads** to UNI-004's RFP text and UNI-003's bios. Prove
the boundary with a known-**BAD** corpus, not a clean one. D15 says the visibility rule lives
**behind the API** — do not reimplement it in the editor client.

**LANE D — the editor remainder.** UNI-012 with a packaged build budgeted; TUTOR-BOUNDARY §5's six
adversarial attacks (needs a live provider, and §6's AIX-004 tuning is the same sitting); the D5
recents measurement, still spoiled.

**My recommendation: A.** UNI-006 is the last thing between this phase and phase 68, and it is the
only remaining platform task that does not need the domain.

## ⚠️ For Richard — the first is unchanged and now blocks five things

1. 🔴 **`community.nodegx.dev` is still not registered.** It blocks UNI-001's OAuth callback URLs.
   **This is the one thing a session cannot do for itself.** Five built-but-unroutable things now
   sit behind it (see Lane B), including two marketplaces nobody can post to and an org workspace
   nobody can be invited to.
2. 🔴 **A Paddle account (D7) is still the thing standing between coaching and revenue.**
   `recordPayment` still has no caller. ⚠️ Not urgent in the way item 1 is — a booking that ends in
   an email is the ruled v0 — but it is the next commercial step.
3. **The twelve badge artworks still need drawing.** D4 ruled ~12 flat SVGs in the editor's icon
   idiom. Nothing is broken; the profile renders the family mark and tier colour instead.
4. ⚠️ **GitHub Pages is still unattached** (`has_pages: false` as of 2026-08-16), so D17's v0 remains
   free to set up. It stops being free after the first deploy.
5. ⚠️ **The F4 packaged-install scope call** (UNI-012) is still yours and still open.
6. 🆕 **Two judgement calls in UNI-005, both one line, both reversible:**
   - **An org-minor account reads the org shelf and does not publish to it.** `payload` and
     `summary` are free text, and no mechanism short of refusing the write keeps a name out of a
     free-text field — which is the conclusion UNI-003 already reached about a profile bio. The cost
     is real: **a school shelf pupils cannot publish to is a teacher's shelf.** UNI-006's assignment
     submission is the surface that can answer this differently, and it is next.
   - **An org-minor account belongs to exactly one org and can never be an org admin.** Derived
     from LEARN-005's condition 2 rather than ruled.
7. ⚠️ **Carried and still open:** UNI-004's *"responding to an RFP requires clearing D8's bar"*, and
   UNI-003's change to UNI-002's catalogue (*"saving your first project"* keeps its points and awards
   no badge — if you want first-save to carry a badge it needs a family D4 does not give it).

## Gates (2026-08-16, eighteenth session)

- **`nodegx-community`: 363 specs / 16 files, all pass. `tsc --noEmit` clean. `next build` succeeds**
  (14 routes). Run with `npm run db:up && npm test` from the sibling checkout.
- **The three new routes were driven with `curl` against a seeded database.** `npm run db:seed` now
  also seeds two orgs (a company on the GitHub rail, a school with a minted pseudonymous seat and
  D15's switch on), three shelf items, a live COL-004 claim, and **four dev session tokens it prints
  at the end** — the drive personas.
- **This checkout: nothing touched but `dev-docs/`.** No editor gate was run and none was needed —
  ⚠️ so do **not** quote a `test:ci` or `test:main` figure from this handover. There isn't one.
  ⚠️ A peer (s38/P66) reported `test:ci` **2843 / 6 @ seed 39393** on **their** tree during the
  fifteenth session. Relayed, not measured here — re-measure before quoting it as a floor.

## Standing constraints

- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call.
  ✅ **`git commit <pathspecs>`, never stage.** ⚠️ Untracked files are the one case needing
  `git add` — put add and commit in **one chain** with the message **already in a file**.
- 🔴 **`cd` does not persist between tool calls here, and a `cd` inside one does not leak out.** Put
  the `cd` in the same command as the run.
- 🔴 **Port 55432 for the platform's Postgres, never 5432** — this machine already runs one on 5432,
  and both `db:seed` and the test suite **drop and rebuild `public`**.
- 🔴 **This checkout is SHARED.** Peer messages are for **blocking or hazardous** things only.
  Findings go in the task file.

## Things the next person will otherwise re-derive

- 🔴 **Never generate DDL from `src/db/schema.ts`.** It is a query mirror; the rulings live in
  `src/db/sql/`. It cannot express CHECK constraints, triggers, or the string type postgres.js
  actually returns for a `bigserial`.
- 🔴 **The drift spec checks tables and columns ONLY — including NOT enum names.** Its non-vacuity
  floor is now **27**.
- 🔴 **`MIGRATIONS` is asserted equal to the sorted contents of `src/db/sql/`** — three descriptions
  of one list, and the test is what keeps them agreeing.
- 🆕 🔴 **A backtick inside a SQL comment nested in a tagged template literal opens a new template.**
  Cost twenty minutes and produced a `Transform failed` that names the SQL, not the backtick. Long
  notes go **above** the query, never inside it.
- 🔴 **postgres.js has no nested `begin`** — which is why `relayMessage` / `relayMessageIn` are two
  functions rather than one clever one.
- 🔴 **`gen_random_bytes` needs pgcrypto; `gen_random_uuid` does not.** Invite and session tokens are
  `randomUUID()` in Node, hashed with `node:crypto` — no extension, so it works on a database
  somebody else provisioned.
- ⚠️ **An invisible-character class must be written as escapes** (UNI-003's display-name rule).
- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.**
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.
- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
- 🔴 **The `lesson` MCP group is DEFERRED** — `find_tools({group:"lesson"})` first.
- `suggestedNodes` is still **dead** — no callers.
