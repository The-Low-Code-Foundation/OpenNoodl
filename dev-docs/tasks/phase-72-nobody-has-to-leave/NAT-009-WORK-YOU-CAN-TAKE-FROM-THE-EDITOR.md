# NAT-009 — Work you can take from the editor

| Field | Value |
|---|---|
| **Tier** | 3 |
| **Effort** | M/L |
| **Surface** | `editor`, `core-ui`, `platform` |
| **Rulings** | ✅ D4 · ✅ **D5 settled 2026-08-20** — same session scope as the browser |
| **Depends on** | **NAT-005**, **NAT-006** |

## The job

`/rfps` and `/rfps/[id]` are the jobs board — the surface where somebody says *"I need this built"*
and somebody else says *"I can build it"*. It has no API and the editor has never heard of it.

This is the surface with the strongest argument for living in the editor, because the person
qualified to answer an RFP is, by definition, sitting in the tool at that moment.

## 🟡 Status — 2026-08-20 (session 11): the platform half is DONE, the editor's half is the client and every sentence

`6b2360b` (platform) · `638c82cc` (editor). **AC4 closes. AC1, AC2, AC3 and AC6 are built and
specced but nothing PLACES them yet** — there is no React view and no drive. AC5 is blocked and
its reason got sharper.

| AC | State | Where |
|---|---|---|
| 1 — browse the board, open a brief | 🟡 | `client.rfps()` / `client.rfp()` + `composeBoard`/`composeBrief`. **No view** |
| 2 — **respond from the editor** | 🟡 | 🔴 **The route did not exist and now does**: `POST /v1/community/rfps/{id}/responses`. `client.respond()` + `composeResponseBox`. **No view** |
| 3 — see your own responses and their state | 🟡 | `GET /v1/me/rfp-responses` + `responsesBy` + `composeMyResponses`. **No view.** 🔴 And the state cannot move — see below |
| 4 — posting an RFP is explicitly in or out of scope | ✅ | **OUT.** Read and respond ship; posting stays on the web behind a labelled hand-off — `POST_A_REQUEST_LINE` in `rfpboardview.ts`, D6's pattern |
| 5 — notifications send, not merely queue | 🔴 | **Blocked on NAT-014 AC2, and the reason is worse than "no drainer"** — see below |
| 6 — D15 and the four states | 🟡 | Both, and D15 is now enforced **twice** — see the capability finding. **No view** |

Gates on the committed trees: platform `tsc` clean and vitest **51 files / 1225 tests / 0
failures** · `typecheck:editor` and `typecheck:editor-tests` clean · `test:main` **290 suites /
4746 tests / 0 failures**. **92 new tests.**

🔴 **18 mutations run; 16 went red. The two that did not are the finding directly below** — and
they are the reason this section leads with it rather than with the route.

### 🔴 The capability model expressing D15 had never gated anything, and a read-only minor could write

`WRITE_CAPABILITIES` — `postThread`, `postReply`, `react`, `directMessage`, `contactViaRfp`,
`editProfile` — has existed since D15 was ruled. Measured this session: **every reference to it in
the whole repository is either a test asserting what `communityVisibility` returns, or `/v1/me`
publishing the list for a client to read.** No route had ever checked one. Twenty-first "build the
caller" in this phase, and the thing with no caller was the expression of a ruling.

🔴 **And it was not cosmetic.** `communityGate` refuses `surface: 'absent'`, which for an org-minor
means `access: 'off'` **only**. A **read-only** minor is `surface: 'present'` with every write
capability false — so the gate had nothing to say about them. Driving `serveCommunityWrite` with
one returned **201**. The board was still safe, because `board_actor_is_eligible` refuses them
under the insert; but that is a *board* guard, and a community write whose domain module has no
equivalent would have had nothing above it. `serveCommunityWrite` now takes the capability the
write needs.

⚠️ **Scoped deliberately, because the mistake in the other direction is one line away** and
`apiviewer.ts` has the standing note about it: D15 is *public speech by a minor readable by adults
we do not vet*. A pupil submitting the assignment their own teacher set them does not come through
this wrapper, and gating that on D15 would switch off UNI-006 for every org.

### 🔴 The route spec could not have found it — two guards, one observable

The route's own test says an org-minor posting a response gets a bare 404. **That assertion passes
with `communityGate` deleted**, measured by deleting it: the database refuses the same population
and the translator maps `[board-org-minor]` to the same bytes. The user-facing claim is true either
way, and *"the route applies D15"* is a claim about the route that the route's test cannot make.

✅ So `nat009-write-wrapper.test.ts` drives the wrapper with the domain removed — a `serve` that
always answers 201 — and every claim in it fails when the line it names is removed. **A reading
that FITS is not one that EXCLUDES**, and this is the fourth time that has bitten in this phase.

⚠️ **One claim in that file was WRONG and is now recorded as such.** It asserted the gate runs
before the 401 by handing the wrapper an expired token on a refused account, expecting the
stranger's 404. It gets *"sign in"* — a token that does not resolve produces no viewer, and an
anonymous viewer is `surface: 'present'`. **The gate/401 order is unobservable**: when a token
resolves the 401 cannot fire, and when it does not the gate cannot. What IS observable and does
bind is the **capability check's** position — it must come *after* the 401, or every signed-out
caller gets "not found" instead of the one sentence that would let them back in.

### 🔴 §6 specified one refusal. The migration raises eighteen.

*"Refused with `409` when the response cap is spent"* was the whole of the documented refusal
surface. `0004_uni004_rfps_and_coaching.sql` raises **eighteen** tags on the path an
`insert into rfp_responses` takes, across five plpgsql functions. A client mapping the documented
one renders the other seventeen as its default — and this client's default is *"the community
could not be reached"*. **A status the client never enumerated becomes an outage; a refusal the
route never enumerated becomes an indistinguishable 400.**

✅ `board-http.ts` maps them, and `nat009-board-refusals.test.ts` **reads the tag list off the
migration per function** so a tag added later has no verdict until somebody gives it one. It
reports its bound (the five functions on this path, named) and has a known-firing control, because
`boardRefusalResponse` has a catch-all default — a totality check over a function with a total
default passes with an **empty table**.

🔴 **Two of the mappings are arguments rather than lookups.** `[board-org-minor]` is a bare 404
carrying none of the database's sentence, which names D15 and D10 out loud. `[rfp-not-listed]` is a
403 that states all three things D8's bar wants. One door must not be described; the other is open
once you have done three things nobody told you about, and a table answering them the same way
would be wrong twice in opposite directions.

⚠️ And thirteen relay guards now answer **500**, not the 400 default. `bench-http.ts`'s reading —
*"an unmapped refusal is still a refusal the caller caused more often than not"* — is true of the
bench, which writes one table, and false here, which runs a five-table transaction through a
subsystem the caller never names. A 4xx tells somebody to fix a message that is already correct and
hides an outage from anything counting 5xx.

### 🔴 The double-blind relay's connect step is unreachable by any human

`acceptConnection` — the function that performs UNI-004 AC1's *"until"* — has **no caller anywhere
on the platform but its own suite**. No page, no route, no client. So `connectedAt` is null and both
accepts are false on **every response that will ever exist** until somebody builds it.

✅ The fields are on the wire because they are the truth about the row. 🔴 **What the client must
not do is draw them as a stage in a process**, and `myResponseMeta` therefore reports what happened
and offers no next step — a spec sweeps its output for *waiting*, *pending*, *accept* and *review*.
A progress bar that cannot fill is worse than no bar.

### 🔴 AC5 is blocked, and it is worse than "the queue has no drainer"

NAT-014 built the drainer. What it cannot fix is that the double-blind email's `Reply-To` is on
**`relay.nodegx.dev`, an unregistered domain with nothing receiving mail on it** — **D10**, open. So
a response is written, an email is composed correctly, and the address a poster would reply to does
not exist.

✅ **No sentence in `rfpboardview.ts` claims the poster was emailed**, and a spec sweeps every
drawable line for the claim. `RESPONSE_SENT_LINE` is *"Sent, and recorded against this request"* —
what this client can stand behind. ⚠️ `RELAY_NOTICE` is drawn **before** anybody writes, because it
is the one fact that changes what somebody writes, and because `[relay-address-leak]` is otherwise
a 400 out of nowhere for somebody being helpful.

### ⚠️ Three more, each short

- 🔴 **The four bench write routes take no rate-limit token at all** — `/v1/bench/threads`,
  `.../posts`, `.../accept`, `.../same-here` — while every `/v1/me` write takes `WRITE_LIMIT` and
  every read takes one through `serveCommunityRead`. **There is no middleware in this app.**
  `docs/API.md` §5 states the limit as a property of the API; it is a property of the routes that
  remembered. NAT-007's composer posts to two of them. **Not fixed — it is NAT-007's ground.**
- 🔴 **No JSON write on this platform had a byte cap.** §6 said *"a read cap is a `limit`; a write
  cap is bytes"* before any write existed, and UNI-015 shipped the bench's without one. 64 KiB now,
  in `apiwrite.ts`, measured in **bytes and not UTF-16 units** — a cap counted with `.length` is
  exceeded fourfold by emoji, and a spec proves it.
- 🔴 **`post()` had no 413 branch** — the third time this hole has been found in this client, after
  429 (UNI-006) and 409 (UNI-007), each by the caller that needed it rather than by an audit. The
  rule is stated in the file's own comment two branches down: *the mapping's completeness is a
  property of the ROUTES*. Nothing enforces it, which is why the count is three.

### ⚠️ Two instrument failures worth carrying

- 🔴 **`nat006-api-contract.test.ts` assumed every `/v1/community` route exports a `GET`.** The
  first write under the prefix made it report a fixture fault on three tests. ✅ The fix is not a
  skip list: the verbs are read off the file, and a new test proves that what is skipped is skipped
  **because it is a write** — it names the skipped route, asserts the count, and asserts it goes
  through `serveCommunityWrite`. A sweep that quietly passes over what it cannot call still reports
  a pass, and what it passed over is always the newest thing.
- ⚠️ **The double blind's direction was got wrong TWICE while writing its spec**, and each wrong
  reading produced a plausible green-looking assertion about the wrong field. `to_address` is the
  recipient's **real inbox** (a relay that masked the recipient could not deliver); `from_address`
  is a single generic address on the relay domain, **not** the sender's alias; `reply_to` is the
  recipient's **own** alias. And the smuggling vector is the **responder's own** address, not the
  poster's — the first draft smuggled the poster's in and watched it succeed.
- ⚠️ `expect(value, message)` is **vitest's** and this editor's runner is **jest**, where the second
  argument is a type error. Third time in this phase.

### What is left

1. 🔴 **A view, and the wiring.** `rfpboardview.ts` returns `CommunityRowProps`,
   `CommunitySectionState` and `CommunityReplyBox` — every type `CommunityDirectoryView` and
   `CommunityThreadView` already place. NAT-008's arc is the template: a core-ui view, a
   `useCommunityRfps` hook, the launcher tab and the rail panel.
2. 🔴 **Nothing has been driven.** The platform half is graded by route-handler calls, not over
   HTTP; ⚠️ `uni015-bench-http.test.ts`'s kind needs `.next`, and **a peer was running `next dev`
   in that checkout this session**, so a build would have stamped on it.
3. ⚠️ **AC5 stays open** and closes with NAT-014 AC2/AC4, not here.

---

## Acceptance criteria

1. Browse open RFPs in the editor — the list, and one opened to its full brief, with whatever
   budget/timeline/skills fields the web page renders.
2. **Respond from the editor.** This is the whole point and it is a write; 🔴 **D5 gates it.**
3. See your own responses and their state. An offer you cannot check on is an offer you send once.
4. Posting an RFP from the editor is **explicitly in or out of scope in this file** — it is the one
   verb here that a person is more likely to do from a desk than from a graph. Recommendation: read
   and respond ship; posting stays on the web behind a labelled hand-off (D6's pattern).
5. Notifications are honest end to end: if responding is supposed to email the poster, that mail is
   verified to **send**, not merely to queue. 🔴 **Today nothing sends at all** — `drainOutbox` has
   no production caller and the relay queue has no drainer. That is
   **[NAT-014](NAT-014-THE-QUEUE-THAT-NOTHING-EMPTIES.md)**, and this criterion **cannot be closed
   before it is**. A response that silently reaches nobody is worse than no board.
6. D15, and the standard four states.

## Traps

- 🔴 **The relay's `'relayed'` outcome.** UNI-004 built RFPs and coaching around a relay that mails
  the parties directly, and `notify()` returns `'relayed'` to mean "do not queue a second email
  about this". A new editor-side write path must pick its outcome deliberately or it either
  double-mails or silently mails nobody. Read UNI-004 before touching the notification path.
- 🔴 **Responding to an RFP may expose contact details between strangers.** Whatever the web does
  about revealing an email address, the editor must do the same thing — not a more convenient
  thing. This is the surface where "make it frictionless" and "do not leak a personal address" are
  in direct tension, and the web page already contains the decision.
- ⚠️ Money is mentioned on this board. Nothing in this task should imply the platform brokers,
  escrows or guarantees anything. Copy is a decision, not a detail.
- ⚠️ An RFP brief is long-form user content. It reaches the editor through the same
  `parsePostBody` → `Block[]` path as a post, or it does not reach the editor at all.
