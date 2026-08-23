# FB-010 — the profile nobody can create

**Filed:** 2026-08-22, from Richard's item 10. **Status: ✅ BUILT, SPECCED, DRIVEN — 2026-08-23
(session 16).** Size: M. 25th *build the caller*.

> *"When you click on your username at the top right, it comes up to
> community.nodegx.io/u/richardosborne14 and a 404 page. It would be nice to personalise your
> profile with an avatar (maybe some default ones to choose from if that exists as OSS), your
> bio, experience, badges etc."*

---

## What exists (swept 2026-08-22)

- **The page is built and the 404 is by design for a profile that doesn't exist** — UNI-003:
  `src/app/u/[handle]/page.tsx` calls `publicProfile()` and `notFound()` on null, deliberately
  indistinguishable across private/hidden/never-created (no enumeration leak). **Keep that.**
- **`upsertProfile` in `src/lib/profiles.ts` has no caller.** There is no `/settings`, no
  `/account` route at all (`src/app` holds auth, bench, coaching, orgs, people, replays, rfps,
  tutorials, u, university, unsubscribe). A signed-up account **cannot become public**, so every
  `/u/<handle>` 404s by construction — including the header's own link to your profile, which is
  the broken promise Richard clicked.
- **Badges are done**: UNI-013 slice 4 — twelve SVGs, CSS-mask painted, theme-correct. The coach
  queue lens already shows on public profiles (UNI-017).
- Recorded adjacent gap (`phase-72/TASKS.md:21`): *"this platform has no account page"* — the
  editor's 30-day grant can only be revoked from the editor. Same missing page.

## Scope

One `/settings` (or `/account`) page for a signed-in account:

1. **Profile**: create/edit — display name, bio, experience line, visibility (public/hidden).
   Saving calls `upsertProfile`; the header link stops 404ing the moment visibility is public.
2. **Avatar**: a fixed set of bundled defaults, OSS. Candidates: DiceBear (MIT, can pre-generate
   static SVGs — do NOT add it as a runtime dependency; this repo's production dependency list
   is five packages and that is a defended number) or hand-drawn marks in the badge style.
   **Pre-generated static assets in the repo, licence text alongside.** No uploads in v1 — an
   upload is a moderation surface (D7) and an object-store key; defaults are neither.
3. **Sessions**: list active grants (web + editor device-flow) with revoke — closes the
   editor-only-revocation gap NAT-007 documented.
4. Badges render on your own settings page as they do publicly — read-only, no new machinery.

## Acceptance criteria

- AC1: a signed-in account creates a profile, sets visibility public → `/u/<handle>` 200s and
  the header link works; setting hidden → 404 again, same shape as never-created.
- AC2: avatar chosen from defaults renders on `/u/<handle>`, `/people`, and bench author lines —
  wherever `PersonProfile` already draws the disc. ⚠️ The editor mirror fetches no remote
  images (NAT-008's decision): the mirror keeps its flat disc unless FB-007's display decision
  reverses that; don't reverse it here as a side effect.
- AC3: an editor grant revoked from the web stops working in the editor (driven), and
  `nat007-device-consent.test.tsx`'s assertion of the *absence* of web revocation is updated —
  that spec asserting an absence is the one this task makes false, on purpose.
- AC4: bio/experience are free-text columns → data-inventory census classification; the route
  gets a D15 verdict; envelope contract; byte-capped writes.

## Traps

- Do not weaken UNI-003's three-states-one-404 property while making the page reachable.
- The header's profile link should point at settings when no public profile exists, not at a
  404 — the 404 stays correct for *strangers*, not for yourself.


---

# What was built (session 16)

`nodegx-community`, migration **`0019_fb010_the_account_page.sql`**. A `/settings` page, one
write route, one sessions pair, and eight drawn avatars.

## The findings, in the order they mattered

- 🔴 **THE BUG WAS NOT THE 404. IT WAS THAT WE SENT YOU TO IT.** `publicProfile()` answering
  `null` is UNI-003 working exactly as designed — private, hidden and never-created are one
  answer so `/u/<handle>` cannot enumerate who holds an account. What was wrong is that
  `layout.tsx` linked every signed-in person to their own page while **no account could ever
  leave the never-created state**: `upsertProfile` had existed since UNI-003 behind a trigger
  and six CHECK constraints, and measured 2026-08-23 its only callers anywhere were test
  files. The header link now points at `/settings` until you have published a page. **The
  three-states-one-404 property is unchanged and a spec drives all four states to prove it.**

- 🔴 **AC3's SCOPE ASSUMED A DISTINCTION THE SCHEMA DID NOT HAVE.** *"List active grants (web
  + editor device-flow) with revoke"* — but `redeemDeviceAuthorization` mints an editor grant
  by calling `createSession(sql, accountId)`, **the same function with the same arguments the
  OAuth callback uses**. The rows were byte-identical in every column. A list built without
  `sessions.origin` could only have shown somebody N indistinguishable rows and asked which
  one was their laptop — and the one operation the list exists for is revoking a grant on a
  machine you no longer have. ⚠️ `default 'web'` is an honest-but-lossy backfill: some
  existing rows really are editor grants and will be labelled `web`, because **there is no
  field that could tell them apart retroactively**. That is the finding, not a shortcut.

- 🔴 **THE AVATAR IS A KEY, NOT A URL, AND THE OBVIOUS ALTERNATIVE IS AN OPEN REDIRECT.**
  `profile_avatar_url_scheme` is `^https://[^[:space:]]+$` — load-bearing, per `0003`'s own
  note about a `javascript:` URL reaching the editor's mirror. A bundled mark is
  `/avatars/<key>.svg`, which that regex refuses. Relaxing it to admit `^/` would also admit
  **`//evil.example/x`** — a protocol-relative URL every browser fetches off-site. So a new
  `avatar_key` column holds a key into a closed set that **cannot carry a scheme or a host**,
  the old constraint is untouched, and `avatars.ts` is the only place a path is ever built.

- 🔴 **A REFUSAL SENTENCE WAS WRITTEN FALSE AND THE MIGRATION CAUGHT IT.** `profiles.ts` maps
  `profile_avatar_url_scheme` **and** `profile_link_url_scheme` onto one `unsafe-url` tag, so
  one sentence has to be true of both — and **they disagree**: a link is `^https?://`, one
  scheme wider, because `0003` decided *"someone's own site may still be plain http."* The
  first draft said *"links must start with https://"*, which would have told somebody refused
  for a plain-http link to do what they had already done. A spec re-derives both regexes from
  the migration on every run.

- 🔴 **A MUTATION FOUND A HOLE SHAPED LIKE THE DEFECT — IN MY OWN SPEC.** The row asserting
  *"the fallback names THIS route's act"* called `profileRefusalResponse` directly with the
  right string, so it tested that the **function returns its argument** and said nothing about
  which argument the **route** passes. Changing the route's noun to FB-003's exact defect —
  *"that response could not be sent"*, told to somebody who saved a profile — left all 24 rows
  green. ✅ Now driven through the route: a **NUL byte** in a text field is refused by Postgres
  with a raw error carrying no `[tag]`, which is the only way to reach the fallback branch.

- 🔴 **THE REACHABILITY GATE CAUGHT `/settings` AND WAS RIGHT.** `uni019-home` reported it
  UNREACHABLE because `navHrefs` deliberately skips the header's template link — *"it exists
  only for a viewer who is already signed in, so it cannot be what makes a page reachable for
  the stranger the criterion is about."* Correct: an account page has nothing for somebody
  with no account. Registered in `NON_BROWSABLE` with a reason, **not** by widening `navHrefs`,
  which would have made `/u/[handle]` "reachable from the nav" too and retired a working rule.

- ✅ **`.avatar.sm` HAD NO SIZE RULE.** Only `.avatar.placeholder.sm` did — complete for as
  long as every small disc was a gradient initial, so the modifier and the placeholder were
  the same set. An `<img class="avatar sm">` matched only `.avatar` and would have drawn at
  the profile page's **88px inside a list row**. Same family as FB-019's units hole: a rule
  that was total until a new case existed.

- ✅ **SESSION MANAGEMENT IS DELIBERATELY *NOT* D15-GATED**, and a spec goes red if somebody
  "tidies" it into `serveCommunityWrite`. A read-only org-minor holds **no** write capability
  by construction, so gating the revoke would mean they could not sign a lost machine out.
  `/me/assignments` already records the general rule. **Driven**: a minor gets 404 on the
  profile route and **200 on their own sessions list**.

- ✅ **NAT-007's CONSENT COPY BECAME FALSE, ON PURPOSE, AND ITS CONTROL SAID SO IN ADVANCE.**
  The notice read *"sign out from the editor's launcher screen — that is the only place it
  can be ended"*, with a spec asserting no `/account|/settings|/sessions` route existed and a
  comment: *"the day somebody adds `/account` this fails, and the copy should change with it
  rather than quietly become out of date."* It failed. The copy now names both doors and the
  absence assertion is **inverted rather than deleted** — a removed absence assertion is
  indistinguishable from one never written.

- ⚠️ **A BACKTICK INSIDE A TAGGED TEMPLATE LITERAL TERMINATES IT** — an SQL comment written as
  ``-- the `case when` …`` inside a `` sql`…` `` block is a **syntax error**. It happened three
  times this session (`profiles.ts`, `coaching.ts` twice). Prose in SQL strings gets no backticks.

- ⚠️ **AC2 NAMED A SURFACE THAT HAS NO DISC.** *"…and bench author lines"* — the bench draws
  **no avatar anywhere** (measured: zero `kind: 'avatar'` and zero `avatar` classes under
  `src/app/bench/`). Its author line is text, `@handle · date`. AC2's own qualifier is
  *"wherever `PersonProfile` already draws the disc"*, so the four surfaces that do — the home
  page's featured person, `/people`, `/coaching` and `/u/<handle>` — all now route through one
  `personFigure` helper, and a census row fails if a fifth is added with its own inline
  figure. **Putting a disc on the bench is a design change, not this task**, and is left open.

## The drive (real HTTP, `localhost:3200`, its own database)

One account, `nia-drive`, created with **zero profile rows** — the state a real sign-up
produces, which is the fixture trap session 15 recorded.

| arm | before | after one POST |
|---|---|---|
| `GET /u/nia-drive` | **404** | **200**, name, experience line and `<img src="/avatars/harbour.svg">` |
| header link | `/settings` | `/u/nia-drive` |
| `POST /community/coaching` | **403** *"offering coaching needs a profile…"* | **201** `listed:false` |

- ✅ **FB-003's blocker lifted, end to end and over the wire.** The 403 session 15 predicted
  reproduces exactly, and the same account creates an offer after one save. `listed:false` is
  correct — D8's bar is a separate gate, which is FB-003's own three-state design.
- ✅ **Visibility both ways**: public → 200, private → **404 again**, header link follows. A
  visibility-only save left the name and avatar intact, proving the partial-update `case when`.
- ✅ **AC3 driven through the REAL device flow** — begin → approve → redeem. The list shows
  `editor` and `web`, and **`current` flips depending on which token asks**. The editor token
  worked (200 with a viewer), was revoked **from the web** (204), and then resolved to
  `viewer: null` while the web session survived. 🔴 `/api/v1/me` answers **200 with a null
  viewer** when signed out, so a status-only reading would have said *"still works"*.
- ✅ **D15 with a known-firing control**: a read-only minor → **404 `not found`**, **no profile
  row created**, no mention of D15/minor/school/org; the same request from an adult → 200.
- ✅ `/people` and `/coaching` draw the chosen avatar with the `card-person` layout modifier.
- ✅ `/settings` server-renders the saved values, 8 avatar options, exactly 2 checked radios
  (harbour + public); signed out it renders a sign-in prompt and **no form controls at all**.

## What is NOT done

- ⚠️ **The form is not driven in a BROWSER.** Server HTML, both routes over real HTTP, and the
  built client bundle (`/settings` 1.76 kB) are driven; **hydration actually handling a click
  is spec and bundle presence only** — same bound FB-003 recorded.
- ⚠️ **AC2's bench half** is deliberately not built (see above) — it needs a disc that does
  not exist, which is a design decision rather than a wiring one.
- ⚠️ **The API surface is unchanged.** `personProfile` in `apisurfaces.ts` does **not** carry
  `avatarKey` or `experience`, because AC2 says the editor mirror keeps its flat disc unless
  FB-007's display decision reverses that — *"don't reverse it here as a side effect."*
  Publishing a key the mirror could turn into an `<img src>` is how that reversal happens
  without anybody deciding it.
- ⚠️ **`sessions.origin` backfills every existing row to `web`**, including editor grants
  minted before this deploy. Nothing can tell them apart retroactively.
- ⚠️ **No avatar upload** — scope said defaults only in v1, and an upload is a moderation
  surface (D7) plus an object-store key.
- **Not deployed.** nexus-1 is still at `0860426`, now **three** commits behind.

## Gates

- Community suite: **57 files / 1384 specs / 0 failures** on the final run (session 15: 56/1360)
  — **+1 file / +24 specs, exactly this task's spec file**. Reconciles exactly: the census and
  recipe entries added to five other gates are DATA, not new rows. `npm run typecheck` clean. **Twelve mutations, all red** — including the one that found the vacuous fallback row.
- ⚠️ `npm run lint` still does not run for anyone (`next lint`, deprecated, prompts
  interactively). Not caused by this session.
- Databases left behind: `nodegx_community_fb010` (specs) and `nodegx_community_fb010drive`
  (the drive — migrated and driven, with `nia-drive` public + listed and `pupil-drive` a
  read-only minor). Rebuild rather than trusting them.

## 🔴 Six gates went red on the first full run, and one was a real defect

The FB-010 spec was green and twelve mutations were red **before** the full suite had ever been
run against these changes. That was not enough, and the gap is worth recording.

- 🔴 **A SHARED COLUMN LIST HAD THREE FROM CLAUSES AND ONLY ONE JOINED `profiles`.** Adding
  `p.avatar_key` to `OFFER_COLUMNS` gave `listOffers` its avatar — it takes its join from
  `OFFER_LISTABLE` — and broke `offersFor` and `getOffer`, which carry their own FROM clause:
  **`missing FROM-clause entry for table "p"`**. ✅ **My own spec could never have caught it**:
  it exercises `listOffers` and never calls the other two. `uni004-coaching` did.
  **A shared column list is only shared if every FROM clause under it has the same tables.**
- 🔴 **THE OTHER FIVE ARE CENSUS GATES, AND THEY ALL DID EXACTLY THEIR JOB** — every one is a
  list that must account for what is on disk, so a new file cannot be waved through by silence:
  `db-schema-drift` (the Drizzle schema must mirror the SQL — **two** tables), `uni011` (a D15
  verdict per route), `uni013-slice5` (a page is an archetype instance or a written reason),
  `uni019` (a reachability verdict per page), and `nat006` (the API mapper).
- 🔴 **AND ONE OF THEM FORCED A DECISION RATHER THAN A FIX.** `nat006`'s *"the mapper drops
  exactly what the page never printed"* is written as a **set difference** with the comment
  *"so a field added to either side has to be considered here"*. It went red the moment
  `DirectoryEntry` grew `avatarKey`, and the choice was publish it or record an exception.
  ✅ **Published** — an exception would have weakened a rule doing its job, and it is **not**
  NAT-008's reversal: that decision is about what the editor FETCHES AND DRAWS, and a short
  slug is strictly less than the real remote `avatarUrl` `personProfile` has published since
  UNI-003. The mirror still draws its flat disc; FB-007 owns that call.
- ⚠️ **Lesson: run the full suite before believing a green feature spec.** A feature spec grades
  the feature. Only the corpus grades what the feature did to everything else — which is this
  phase's *"run a checker over the artefacts that already exist"*, one layer up.
