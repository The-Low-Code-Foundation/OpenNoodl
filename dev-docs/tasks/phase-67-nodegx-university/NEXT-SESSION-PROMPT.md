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
| **Platform** | UNI-001 (AC3), 002, 003, 009 (content cut) | 🟢 **Spine + engine + profile.** `58d6787`, third commit, **pushed** |
| **Platform** | UNI-004, 005, 006, 008 | 📋 **Four tasks, not started** — UNI-004 is next and now has profiles to hang off |
| **Platform** | UNI-001 (the rest) | 🔴 **Blocked on Richard**: OAuth callback URLs need `community.nodegx.dev`, still unregistered |
| **Editor / MCP** | UNI-007, UNI-010, UNI-012 | UNI-007 slices 1–5 + tutor overlay; UNI-010 five slices, **KEEP**; UNI-012 scoped, not built |
| **Editor + bridge** | UNI-011 | ✅ **Fully unblocked to build AND to ship** — D15 and D16 are ruled |

**The sixteenth session built UNI-003 — the profile.** Seven of the phase's twelve tasks now have a
platform surface, and the community has a page you can point at a person.

## What UNI-003 added, and the one thing it found

**Gates:** `164 specs / 9 files` in `nodegx-community` (baseline **105 / 8**), `tsc --noEmit` clean,
`next build` succeeds. ⚠️ **`npm run lint` is STILL not a gate there** — no ESLint config, so the
script drops into an interactive setup prompt. It has never run in that repo.

**AC1's *"opting out returns 404, not a stub"* is a single `null`.** `publicProfile()` answers `null`
for a private profile, a hidden one and an account that never made one — the same value for all
three, so no route can render a *"this profile is hidden"* page and no stranger learns there was
something to look for. The criterion is met by there being nothing to render.

**Hiding is deliberately NOT `visibility = 'private'`.** If moderation reused the owner's own toggle,
the owner could not tell their own opt-out from someone else's decision about them — and AC4's *"the
owner sees why"* would have nowhere to live. `hidden_at` and `hidden_reason` are a **biconditional
CHECK**, so a reasonless hide is impossible to record rather than merely discouraged.

**D8's bar gates the LISTING, not the page and not the flags.** AC1 and AC3 are both literal about
the toggle and the two professional flags being unconditional, so the bar applies where D8's own words
put it — *"to list"*. And `profileBar()` returns its **components rather than a boolean**, which is
D16's *"a threshold nobody can see the approach to is a threshold that gets crossed by rounding"*
applied one task early. ⚠️ Its evidence half reads **D4's taxonomy, not a slug list**, or UNI-002's
AC4 breaks the day a second publishing challenge is added.

### 🔴 The finding: a badge that vouched for something the challenge did not mean

`project-first-built` — awarded on `project.first_saved`, for pressing save — carried **(building,
bronze)**, whose badge row reads, in D4's own words, **"Published — Published your first prefab."**

- On the profile it rendered as a claim about publishing the holder never made.
- 🔴 **And it silently cleared D8's evidence bar**, so anyone who had ever saved a project qualified
  for professional listing on the RFP board UNI-004 is about to build.

The defect was in UNI-002's **data**, and only a consumer of that data could see it. Fixed as data,
which is what AC4 was built for: the row keeps its 20 points and awards no badge, and a once-only
**`prefab-first-published`** awards the badge on `prefab.published`. ✅ **UNI-002's own *"every one of
D4's twelve badges is reachable"* spec is what made the fix safe** — a guard written one task earlier
caught the second half of a change made in the next. ⚠️ **Nothing mechanically checks that a
challenge's *meaning* matches its badge**; two specs pin these rows by hand.

### ✅ Thirteen control runs, and one of them is the useful kind

Every mechanism was disabled and watched to fail: the org-minor trigger (**2**), the URL scheme
allow-list (**6**), the display-name rules (**7**), the four small integrity rules (2/1/1/1),
`publicProfile`'s two clauses (4/3), D8's evidence half in both places (1/2), the catalogue defect put
back (**1**).

🔴 **The thirteenth is the one worth keeping**: `badgesFor` stopped excluding revoked awards and
**2 fail — mine and UNI-002's own**. That is what proves AC2's *"live, not copied"* spec has teeth on
a mechanism it does not own.

### ✅ Driven over HTTP, against consequences written before the drive

`/u/quiet-quentin` **404** with her bio string appearing **nowhere** in the body; `/u/nia-new` **200
while `/people` omits her and includes ada** — the D8 seam in one reading; hiding ada made
`/u/ada-builds` **404 on the very next request**; `/` and `/replays` still 200 after the shared layout
and CSS changed.

🔴 **A method note that nearly cost a false negative.** The contribution line was checked against a
second instrument — the page says **105 points · 2 of 12 badges** and `psql` says **105 points, 2
badges**. It took three attempts, because **React interleaves `<!-- -->` between text nodes**, so a
grep for `[0-9]* points` returns nothing — which reads exactly like a page rendering no number at all.
*A silent grep is not a measurement; it is an instrument that failed to reach the thing.*

---

# What to do next — pick a lane and say which

**LANE A — UNI-004, the RFP board and coaching offers. Recommended.** `TASKS.md` already rules the
order: *"UNI-004 rides once profiles exist"* — and they now do, with the two professional flags, the
directory, and `listDirectory({availableForWork})` already the query a client would use to find a
builder. D7 → **Paddle**, coaching only, and *build so payment can be absent* (the
booking-form-ends-in-an-email v0 stands). D8 → the **double-blind relay**, which is also the spam
shield, and 🔴 neither side sees an email address until both accept — not in a header, not in a
reply-to, not in a bounce.

**LANE B — make the login real.** Finish UNI-001: OAuth, sessions, the consent screen, the editor
half. 🔴 **Blocked on Richard, not on work** — callback URLs need `community.nodegx.dev` and the
domain **is not registered**. ⚠️ It is now blocking **three** things rather than one: the admin
routes UNI-002 and UNI-003 both deliberately did not build, and **UNI-003's owner-facing account
page** — `ownProfile()` is built and specced and returns the moderation reason, so AC4's owner half is
met **at the API and not yet at a URL**.

**LANE C — UNI-011, the editor mirror.** D15 and D16 are ruled, so it can be built *and* shipped.
🔴 The renderer is `nodeIntegration: true` **and so is the launcher** (same `BrowserWindow`): **no
post body may render as HTML in it.** ⚠️ **UNI-003 just made this concrete rather than theoretical** —
profile bios and links are stranger-authored content the mirror will render, which is why the scheme
allow-list is a database constraint on the platform side. Prove the boundary with a known-**BAD**
corpus, not a clean one. D15 says the visibility rule lives **behind the API** — do not reimplement it
in the editor client.

**LANE D — the editor remainder.** UNI-012 with a packaged build budgeted; TUTOR-BOUNDARY §5's six
adversarial attacks (needs a live provider, and §6's AIX-004 tuning is the same sitting); the D5
recents measurement, still spoiled.

**My recommendation: A.** UNI-004 is the last Tier-1 platform task, everything it needs now exists,
and it is the one that turns the community into something with a revenue rail attached.

## ⚠️ For Richard — the first is unchanged and still the only hard blocker

1. 🔴 **`community.nodegx.dev` is still not registered.** It blocks UNI-001's OAuth callback URLs.
   **This is the one thing a session cannot do for itself**, and it now holds up three built-but-
   unroutable things (see Lane B).
2. **The twelve badge artworks still need drawing.** D4 ruled ~12 flat SVGs in the editor's icon
   idiom. UNI-003 renders the **family mark and the tier colour** instead, so nothing is broken and
   nothing is blocked — but the profile is visibly waiting for them. ⚠️ It is deliberately *not* a
   placeholder graphic pretending to be a badge.
3. ⚠️ **GitHub Pages is still unattached** (`has_pages: false` as of 2026-08-16), so D17's v0 remains
   free to set up. It stops being free after the first deploy.
4. ⚠️ **The F4 packaged-install scope call** (UNI-012) is still yours and still open.
5. 🆕 **A judgement call you may want to take back:** UNI-003 changed UNI-002's challenge catalogue
   (the badge defect above). The fix is data, it is specced, and D4's taxonomy decided it — but
   *"saving your first project"* losing its badge is a product call as much as a correctness one. If
   you want first-save to carry a badge, it needs a family D4 does not currently give it.

## Gates (2026-08-16, sixteenth session)

- **`nodegx-community`: 164 specs / 9 files, all pass. `tsc --noEmit` clean. `next build` succeeds**
  (8 routes). Run with `npm run db:up && npm test` from the sibling checkout.
- **The four new routes were driven with `curl` against a seeded database**, not only specced — see
  the drive above. `npm run db:seed` now seeds four profiles chosen so every branch is reachable by
  looking: listed-and-available, listed-and-coaching, **public but below the bar**, and **private**.
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
- 🔴 **`MIGRATIONS` is asserted equal to the sorted contents of `src/db/sql/`** — three descriptions
  of one list, and the test is what keeps them agreeing.
- 🔴 **The drift spec checks tables and columns ONLY** — and says so, because an unstated limit reads
  as coverage. Its non-vacuity floor was raised 9 → 12 with UNI-003's tables.
- ⚠️ **An invisible-character class must be written as escapes.** UNI-003's display-name rule refuses
  bidi overrides and zero-width characters; written literally it would be a line no reviewer can read
  and no diff can show changing — unauditable by exactly the property that makes it necessary.
- 🔴 **`ports`, not `dynamicports`, is how a `Component Inputs` node declares its interface.**
- 🔴 **`forEachNode` STOPS on a truthy return.** Use a block body.
- 🔴 **`/usr/bin/grep -a`, always.** Plain `grep` here is ugrep and silently skips `.ts` as binary.
- 🔴 **The `lesson` MCP group is DEFERRED** — `find_tools({group:"lesson"})` first.
- `suggestedNodes` is still **dead** — no callers.
