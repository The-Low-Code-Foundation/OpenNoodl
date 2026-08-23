# FB-003 — nobody can offer, and nobody can ask

**Filed:** 2026-08-22, from Richard's item 2. **Status: ✅ DONE — built, specced, and DRIVEN
over real HTTP, 2026-08-23 (session 15).** `nodegx-community` **`67df2b1`**. Size: M, delivered
M. No ruling was needed. ⚠️ **Not deployed** — nexus-1 is still at `0860426`.
See *"What session 15 found"* at the foot of this file.

> *"Right now in the community there's no way to add yourself as a coach or add an RFP, maybe
> that's coming in the remaining phase tasks?"*

The honest answer to his question: **partly, and the part he asked about is nobody's task.**
NAT-009/NAT-010 cover *reading and responding* to RFPs and coaching **from the editor**. Nothing
anywhere covers *offering* coaching or *posting* an RFP — and the web pages both surfaces point
at have no forms.

---

## What exists (swept 2026-08-22)

- `nodegx-community/src/lib/coaching.ts:66` `createOffer()` — the only writer of a coaching
  offer, **no caller in `src/`**: no page, no form, no `/api/v1` route. `/coaching` is read-only;
  the community coaching endpoint's own header says *"🔴 booking one is not here"*.
- `nodegx-community/src/lib/rfps.ts:68` `postRfp()` — **no caller either.** The whole site has
  two `<form>`s: the layout search and the device-approve form.
- **NAT-009 AC4 ruled posting stays on the web behind a labelled hand-off** — and the editor's
  `rfpboardview.ts:174` already says *"Posting a request for work opens the community in your
  browser."* **That hand-off is a promise to a page that cannot keep it.** This task makes the
  promise true.
- UNI-004 built the schema and its 18 tagged refusals (five plpgsql functions on the insert
  path); NAT-009's platform half built the editor-side read/respond client.

This is the 21st and 22nd instance of *build the caller*: heavily-specced lib functions whose
green suites could never see that no production code calls them.

## Scope

Two web composers, no editor half (NAT-009 AC4 already ruled the editor hands off):

1. **Post an RFP** — a form on `/rfps` for a signed-in account: title, body, budget band, the
   fields `postRfp` already takes. Nothing more than the lib function accepts.
2. **Offer coaching** — a form on `/coaching` ("Become a coach"): the fields `createOffer`
   takes, including rate band. ⚠️ NAT-008 found **4/4 rate-band keys guessed wrong** invisibly —
   derive the vocabulary from the schema, don't retype it.

## Acceptance criteria

- AC1: a signed-in account posts an RFP from `/rfps` and it appears in the board list and in the
  editor's NAT-009 client without either being redeployed.
- AC2: a signed-in account creates a coaching offer from `/coaching` and appears in the coaching
  list with their profile line.
- AC3: every one of the migration's refusal tags that can fire on these two inserts renders as
  its own sentence, not the generic "could not be reached" default — sweep the migration per
  function, state the bound in the spec (NAT-009's `nat009-board-refusals.test.ts` is the
  pattern).
- AC4: the editor's existing `POST_A_REQUEST_LINE` hand-off lands on the RFP composer (anchor or
  route), signed-out lands on sign-in with a return path.
- AC5: an `org_minor` account is refused per D15's posture (bare 404 shape where the ruling says
  the surface must not be described).

## Traps

- Writes go through the byte-capped write path; the four derived-from-disk gates and the
  envelope contract fire on any new route.
- `acceptConnection` (the relay's connect step) still has no caller — **out of scope here**;
  don't wire it in passing, it is D10-shaped.
- A coaching offer is user content with a rate — the data-inventory census will demand a
  classification for any new free-text column.


---

# What session 15 found

## ✅ Built: two POSTs on the routes that already served the GETs, one client island

`POST /api/v1/community/rfps` and `POST /api/v1/community/coaching` — added to the existing
route files rather than to new ones, so the board's read and its write live together.
`src/components/BoardComposer.tsx` holds both composers.

🔴 **A CLIENT ISLAND AND NOT A SERVER ACTION**, and `ApproveForm.tsx` had already argued it:
*"a server action would put the decision somewhere no other client can reach and nothing on
disk would sweep it."* AC1 is literally that a request posted from the form reaches **the
editor's NAT-009 client without either being redeployed** — a server action could not satisfy
that criterion at all. It renders `null` on the server, so `/rfps` and `/coaching` still take
no viewer and their markup is byte-for-byte what it was.

## 🔴 The drive found the thing the task file did not know, and it is the COMMON case

**`coaching_offers.account_id` references `profiles`, not `accounts`** (`0004…sql:255`, and the
comment there says why — it does D15 duty at the same time). So **an account with no profile
cannot create an offer at all**, and that is *every* account a real sign-up produces, because
`upsertProfile` has no caller in `src/` — which is FB-010, still open.

- ⚠️ **It rendered as `"that offer could not be created"`** — the generic default
  `board-http.ts` exists to prevent — on the single most likely path through the feature.
  Now `[offer-needs-profile]`, a **403 naming the precondition**, on `[rfp-not-listed]`'s
  precedent: a door that opens once you have done something must be described.
- 🔴 **THE SPEC FIXTURE HAD HIDDEN IT.** `makeUnlistedBuilder` creates an account **with** a
  profile and no evidence — the below-the-bar case. A real sign-up has no profile row at all,
  and that is a *different* refusal. Sixteen green specs and every arm walked past it.
  **The drive is the only thing that could have found this.**
- ✅ **The control that proves the two tables really differ**: the same profile-less account
  posts an RFP successfully (201), because `rfps.poster_account_id` references `accounts`.
  One account, two verbs, opposite answers — driven over HTTP as well as specced.

## ✅ Creating an offer and being ADVERTISED are two events, and the response says which

`listOffers` gates on a public profile meeting D8's bar; `createOffer` gates on neither,
deliberately — *"the bar is not a permission to sell; it is the condition for being
advertised."* So the route returns `listed`, read off the platform through `isOfferListed`,
which **shares its predicate with `listOffers`** (extracted to one fragment — a second copy
would agree the day it was written and drift the first time D8's bar moved). That is
`respondToRfp`'s `outcome` precedent, and NAT-008's lesson is why it is a field and not a guess.

**Three states, all three driven:** no profile → **403** with the precondition; below the bar →
**201 `listed:false`**, and not on the board; meets the bar → **201 `listed:true`**, on the
board and on the web page.

## 🔴 Three defects found in the refusal layer while satisfying AC3

1. **`boardRefusalResponse`'s default said `"that response could not be sent"`.** Correct for
   the one route that had it; a lie on these two — somebody refused while **posting a request**
   would be told their *response* failed, naming an act they never performed. Now a parameter,
   defaulted so the responses route's own noun is unchanged.
2. **`[rfp-response-cap]` names TWO different failures**: the trigger's *cap is spent*
   (`0004…sql:561`) and the constraint `rfp_response_cap_positive`'s *cap is not positive*.
   A poster whose cap was `0` would be told their request *"has taken all the responses it will
   take"* — about a request with none. ✅ **Unreachable today** because no route lets a poster
   name a cap; recorded at the entry rather than fixed, because nothing can exercise a fix.
3. **There is no rate band, and no budget vocabulary.** FB-003's scope asked for both. The
   schema has `price_cents`, `currency` and `duration_minutes`; `budget_band` is `text` with a
   1–60 length check and no enum. ✅ **Derived from the schema, not retyped from the task** —
   this task's own recorded trap, earned by NAT-008's *"4/4 rate-band keys guessed wrong,
   invisibly"*. A spec row asserts the budget sentence names no band.

## ✅ AC5 — D15, satisfied by construction rather than by a branch

Two new entries in `WRITE_CAPABILITIES` (`postRfp`, `offerCoaching`). That is what makes them
**governed**: `d15-visibility.test.ts` quantifies over the list and **grew four rows by itself**,
and `readOnlyCapabilities()` has no branch that grants a write, so there is no value of any
input that turns either on. `postRfp` is deliberately **not** `contactViaRfp` — responding
reaches one person through the relay; posting publishes on a board readable signed out, and
they differ on the only axis D15 cares about.

🔴 **`gateFor` copies `serveCommunityWrite`'s ORDER, and that is the subtlest thing here.**
Signed-out and D15-refused produce an **identical** capability reading — measured live:
signed-out is `surface=present, viewer=NO, postRfp=False`, org-minor is `surface=ABSENT` — and
they want **opposite** treatment. Check capability first and every signed-out reader silently
loses the way in; check `viewer` first and a pupil is offered a sign-in link to a surface D15
says must not be described.

⚠️ **One mutation survived, and it is an equivalent mutant.** Swapping the `surface` and
`viewer` checks leaves every row green, because `apiviewer.ts:97` maps no session to
`anonymous` and `communityVisibility` answers `present` for it — so **`viewer === null` implies
`surface === 'present'`**, and the combination that would tell them apart cannot occur. The
invariant is now asserted, so the day it breaks the ordering becomes load-bearing and somebody
is told. (A mutation breaking that invariant turns the row red — checked.)

## The drive (real HTTP, `next start` on 3200, own database)

- **AC1 — both clients, neither redeployed.** Posted from a signed-in account → **201**; the
  brief appears on the **web board** `/rfps` *and* in **`GET /api/v1/community/rfps`**, which is
  the endpoint NAT-009's editor client reads. Signed-out `/rfps` HTML carries **0** composer
  nodes, so the read path is untouched.
- **AC2 — all three coaching states**, above.
- **AC5 —** org-minor is **404 `not found`** on *both* verbs.
- **Signed out is 401** naming the verb (*"sign in to post a request for work"*).
- **A refusal is a sentence**: a 19-character brief → `400 "a brief is between 20 and 8000
  characters"`, not an outage.
- ✅ **The island really ships**: `/rfps` went from 269 B to 2.24 kB in the build output, and
  both composers' strings are in both page chunks.

## What is NOT done

- ⚠️ **AC4's editor half.** `POST_A_REQUEST_LINE` and `POST_A_REQUEST_LABEL` **have no UI
  consumer** — `rfpboardview.ts` is a view model nothing renders yet, and `openCommunity()`
  deliberately takes no path (its comment: *"a parameter kept for nobody is an invitation to
  add the next silent jump"*). So there is no click to redirect. The **web half is done and
  specced**: signed-out gets a sign-in link carrying `?next=/rfps`, which `safeReturnPath`
  already sanitises. 🔴 **A path constant with no caller would have been the 23rd "build the
  caller" committed on purpose**, so it was not added. Whoever builds NAT-009's board UI wants
  `/rfps`.
- ⚠️ **The form is not driven in a BROWSER.** Server HTML, the capability payload it branches
  on, `gateFor`'s every branch, and both routes over real HTTP are all driven; **hydration
  actually rendering the form is covered by spec and bundle presence, not by a click.**
- ⚠️ **Not deployed.** `67df2b1` is committed and unshipped; nexus-1 is at `0860426`.
- **Out of scope, untouched**: `acceptConnection` still has no caller (D10-shaped).

## Gates

- Community suite: **56 files / 1360 specs / 0 failures** (was 55/1321 at session 11).
  **+34** this file, **+1** `uni023`, **+4** generated by `describe.each(WRITE_CAPABILITIES)`.
  Reconciles exactly. `npm run typecheck` clean.
- **Twelve mutations, all red** — listed in the commit. ⚠️ `npm run lint` is `next lint`, which
  is deprecated and prompts interactively for configuration; it did not run and does not run
  for anyone.
- Databases left behind: `nodegx_community_fb003` (specs) and `nodegx_community_fb003drive`
  (the drive, seeded).
