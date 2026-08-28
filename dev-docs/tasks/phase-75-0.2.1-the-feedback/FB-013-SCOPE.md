# FB-013 — the scoping doc the ruling asked for

**Written:** 2026-08-26 (session 51). ✅ **C1 and C2 are BUILT against it** (`nodegx-community` `c5be57b`) — 23 specs, 7 mutants all killed, full suite 63/1564/0. **Task:** [FB-013](FB-013-THE-CHAT-WE-ARGUED-AGAINST.md).
**Ruling in force:** R-chat, 2026-08-22 — *UNI-011 is **OVERRULED**; build the full chat, not the
middle option.*

R-chat did not merely say "build it". It attached three obligations to the build, and this
document exists to discharge them:

> *"it stays quoted below because the risk it names is still real, and the scoping doc has to say
> how the design survives it"* · *"FB-014's search gains a second corpus"* · *"the scoping doc must
> raise the posture question rather than assume the bench's answer transfers"*

§2 is the first, §7 the second, §8 the third.

---

## 1. 🔴 The measurement first, because it decides the design and it went the argument's way

UNI-011's counter-argument was a **prediction**: *"a young community has low message volume, and
chat renders low volume as an empty room every time anyone looks."* When it was written, that was
arguable. It is no longer a prediction — the number exists, and it was taken **directly from
production this session**, not relayed:

```
GET https://community.nodegx.io/api/v1/community/threads
GET https://community.nodegx.io/api/v1/community/home
```

| the live community | value |
|---|---|
| bench threads, all time | **2** |
| distinct authors across them | **1** (`richardosborne14` — both are ours) |
| replies | **1**, on one of the two |
| titles | **identical** on both (*"Help with a Text node"*) — they are test posts |
| D16 threshold: threads | **2 / 30** |
| D16 threshold: consecutive weeks with a call | **0 / 3** |
| D16 threshold: median first reply | **undefined**, `n = 0`, `unreplied: 2` |

🔴 **The platform's own gate says the community has not started.** D16 exists precisely to hold
surfaces back until it has, and every one of its three components is unmet — the *weeks-with-a-call*
one at zero, which is the component UNI-011 named as the thing actually carrying the social half.

⚠️ **This is stated, not argued.** Richard has the standing and the market contact to overrule a
prediction, and he did; a measurement arriving afterwards does not reopen a decision that was his
to take. What it does do is **fix what this design has to survive**, and R-chat asked for exactly
that. The rest of this document is written against the number above rather than against a
hypothetical busy server.

## 2. ✅ How the design survives it — one structural move, not a slogan

The empty-room failure is **not** caused by low volume. It is caused by an interface that makes a
reader *walk into a named room and find nothing in it*. Volume is the input; the room is the
mechanism. So the design removes the room, and keeps the channel.

🔴 **The default view is ONE MERGED RIVER across every channel. A channel is a FILTER, not a door.**

- Opening chat shows **all messages, newest first, across all channels**, each row carrying its
  channel as a pill. At two messages a week this reads as a slow feed — honest, and the same shape
  every other list on this platform already has.
- Narrowing to `#templates` is a **facet click**, and it is `buildList` / `facets.ts` doing it —
  UNI-023's facet bar, the same machinery the bench, the shelf and the people directory use. A
  facet that would show zero rows renders **with its count `0`**, which the facet bar already does
  everywhere, so a quiet channel is a `0` beside a pill rather than a room you fell into.
- 🔴 **There is therefore no screen in this feature whose empty state is reachable by accident.**
  You cannot look at an empty room, because there is no room to look at. That is the whole answer
  to UNI-011, and it is structural rather than a matter of copy.

Three supporting refusals, each of which exists because it is what makes quiet feel dead:

1. **No presence.** No online list, no green dots, no "last seen". A room with two names in it
   advertises its own emptiness; a feed with two messages does not.
2. **No typing indicators**, for the same reason and at no cost, since v1 is not realtime anyway
   (§6).
3. **No unread badge that counts to zero.** A *"new since you last looked"* divider is fine — a
   badge that is absent 6 days in 7 is a weekly reminder that nothing happened.

✅ **And the copy obligation (AC4) still stands on top of the structural one.** A `#templates` facet
at `0` says what the channel is for, because a reader who filters *deliberately* has earned an
explanation rather than a blank.

## 3. What chat is here — the shape, decided

Richard's words: *"maybe a Slack clone with topics and threads? Very simple, not a forum level
complexity, with good tagging, categories, searching for easy filtering."*

| Slack has | v1 | why |
|---|---|---|
| channels | ✅ **fixed vocabulary, 4** | D19 excluded user-created categories; `bench_section` is the precedent, an enum not a table |
| threads on a message | ✅ **exactly one level deep** | this is the "topics and threads" ask, and one level is what keeps it out of forum weight |
| edit / delete own | ✅ delete-own; edit-own 🔒 | §8 — D7 gave a bench answer that does not transfer |
| search | ✅ FTS + facets | §7 |
| DMs | ❌ | D19's chosen-absence list; *"the one worth arguing about"*, and not argued here |
| presence / typing / reactions | ❌ | §2 |
| realtime push | ❌ v1 | §6 |
| user-created tags | 🔒 | §8 — Richard asked for "good tagging", D19 excluded it. A collision, not an oversight |

### The channel vocabulary, and the one collision to avoid

The bench already owns `help`, `showcase`, `meetups`. 🔴 **A chat `#showcase` beside a bench
`showcase` section is two places for one thing, and the reader has to guess which** — the exact
failure `0008`'s header calls *"a second vocabulary growing beside the first"*. So the channels are
chosen to be the things Richard named that the **bench has no home for**:

```
create type chat_channel as enum ('lounge', 'templates', 'tutorials', 'collab');
```

- `lounge` — *"just talking and not committing to anything"*, verbatim from the report.
- `templates` — *"chatting about templates"* (FB-005 now has a shelf for them and nowhere to talk).
- `tutorials` — *"sharing tutorials"* (FB-012c).
- `collab` — *"collaboration feelers"*.

Every one of the four is a content type FB-013 §"What's changed" already names as having **no
natural bench home**, and none of the four overlaps a bench section. Adding a fifth is a migration,
deliberately.

## 4. What it reuses — and reuse is the point rather than the economy

Following `0008`'s header exactly, because that file is the precedent and it wrote the rule down:

1. **`board_actor_is_eligible()` (0004)** — the author gate, as a `before insert` trigger, one
   `perform`. D15's org-minor refusal and D8's ban are **not restated**. An org-minor who cannot
   post an RFP cannot post in chat, by the same code.
2. **`content_reports` (0004)** — one new `report_subject_kind` (`chat_message`), never a
   `chat_reports` table. ⚠️ The *table* gains the subject; whether any **verb** is exposed to a
   reader is §8's ruling. Building the subject is not the same as shipping the button, and the
   distinction matters because D7 declined the button on the bench.
3. **`notifications` + `notification_deliveries` (0007)** — one new `notification_kind`,
   `chat_thread_reply`: somebody replied in a thread you started. 🔴 **Never the relay** (D10) —
   the relay is a two-party masked-address channel for RFPs and bookings, and it is the wrong
   mechanism twice over.
4. **`points_ledger` (0002)** — 🔴 **deliberately NOT reused.** Awarding contribution points for
   chatter is how a quiet room becomes a farmed one, and it is the one reuse in this list that
   would make the feature worse. Recorded as a decision (§9) so a later session does not read the
   omission as an oversight.

⚠️ **The enum rebuild idiom is mandatory, not stylistic.** `0008` measured it on PostgreSQL 16.14:
`alter type … add value 'x'` followed by a CHECK naming `'x'` **in the same transaction** is refused
with *"unsafe use of new value"*, and `applySchema` runs each migration as one implicit transaction.
So `report_subject_kind`, `notification_kind` and `notification_subject_kind` are **rebuilt with all
their values**, exactly as `0008` rebuilt them.

## 5. The schema — `0024_fb013_chat.sql`

Next free number is **0024** (`0023_fb005_binary_template_files.sql` is the last one on disk).

```
create type chat_channel as enum ('lounge', 'templates', 'tutorials', 'collab');

create table chat_messages (
  id      uuid primary key default gen_random_uuid(),
  seq     bigserial not null unique,        -- 🔴 the ordering key; created_at is NOT one
  channel chat_channel not null,

  -- null = a root message. Non-null = a reply in that root's thread.
  parent_message_id uuid references chat_messages (id) on delete cascade,

  author_account_id uuid not null references accounts (id) on delete cascade,
  body              text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  hidden_at     timestamptz,
  hidden_by     uuid references accounts (id) on delete set null,
  hidden_reason text,

  constraint chat_message_body_shape check (length(btrim(body)) between 1 and 8000),
  constraint chat_message_hidden_has_reason check (
    (hidden_at is null) = (hidden_reason is null)
  ),
  constraint chat_message_not_own_parent check (parent_message_id is distinct from id)
);
```

Three points where this differs from the bench, each for a reason:

- 🔴 **There is no `chat_threads` table, and that is the design.** The bench has one because a
  thread there carries a *title* and an *accepted answer* — state that belongs to nothing else. A
  Slack thread carries neither; it is *"the messages whose parent is this one"*. A table holding
  only an id would be a join with no column in it.
- 🔴 **One level, enforced in the database.** A trigger refuses a parent that itself has a parent:

  ```
  if new.parent_message_id is not null and
     (select parent_message_id from chat_messages where id = new.parent_message_id) is not null
  then raise exception '[chat-reply-depth] a reply cannot be replied to';
  ```

  Without it "not forum level complexity" is a sentence in a doc rather than a property of the
  data, and the first client that posts a reply-to-a-reply makes the renderer's job unbounded.
- 🔴 **A reply inherits its root's channel, and the trigger enforces equality rather than the
  writer supplying it.** A reply in a different channel from its root is a message that appears in
  two filters and belongs to neither — and §2 made the channel a *filter*, so this is the one
  invariant the whole default view rests on.

Plus, exactly as the bench has it:

```
alter table chat_messages add column body_tsv tsvector
  generated always as (to_tsvector('english', body)) stored;
create index chat_messages_search_idx  on chat_messages using gin (body_tsv);
create index chat_messages_channel_idx on chat_messages (channel, seq desc)
  where parent_message_id is null;
create index chat_messages_thread_idx  on chat_messages (parent_message_id, seq)
  where parent_message_id is not null;
```

Generated rather than trigger-maintained, for `0008`'s stated reason: a body and its index cannot
disagree.

## 6. Routes, and what v1 does not do

Under `/api/v1/community/chat`, complying with `apishape.ts`'s envelope — 🔴 **it must, because
`nat006-api-contract.test.ts` holds the list of documented exceptions and the three grandfathered
mirror routes are the whole of it.** Anything new under `/v1/community` complies.

| route | verb | notes |
|---|---|---|
| `/v1/community/chat` | GET | the river: root messages across channels, `?channel=`, `?q=`, paged |
| `/v1/community/chat` | POST | post a root message |
| `/v1/community/chat/[messageId]` | GET | one root + its replies |
| `/v1/community/chat/[messageId]` | POST | reply in that thread |
| `/v1/community/chat/[messageId]` | DELETE | delete-own — 🔒 §8 |

Reads go through `communityGate` / `apiviewer` as every other community read does; writes through
`apiwrite`'s checked-capability wrapper, so the D15 verdict is produced by the same code that
produces it for RFPs.

⚠️ **No realtime in v1, and it is a refusal rather than a deferral.** SSE would be the one piece of
machinery in this feature built *for* a volume the platform does not have, and §1 says what that
volume is. The web tab polls on focus; the launcher tab already polls. When §1's table moves, SSE
is an additive change behind the same routes.

## 7. FB-014's second corpus — what actually has to change

R-chat's second inherited consequence. Concretely:

- **`chat_messages.body_tsv`** is the second FTS corpus, alongside `bench_posts.body_tsv`.
- 🔴 **FB-024's finding transfers whole and must not be re-learned.** The bench's reader-facing box
  does **not** go through `searchThreads`/`websearch_to_tsquery` — it goes `benchList` → `buildList`
  → `select()` in `facets.ts`, a **JavaScript substring over rows in memory**. A chat list built on
  `buildList` inherits `termsOf`'s ORed-words behaviour **and the stopword handling**, both of which
  FB-024 fixed. ✅ That is the right inheritance and costs nothing.
- 🔴 **And it inherits FB-024's other finding too: `searchable` must name a TEXT field.** The bench
  was the only one of six lists whose `searchable` named none, so a word in a question body found
  nothing. `chat_messages` has exactly one text column and a list that omits it would reproduce the
  identical defect on a corpus built after the lesson. **`searchable` returns the body.**
- ⚠️ **Cross-corpus search — one box over bench *and* chat — is NOT in v1** and is named here so
  the omission is legible. It is a genuinely different feature (ranking across two row shapes) and
  R-chat did not ask for it.

## 8. ✅ The posture question R-chat required be raised — **R-chat-mod, RULED B on 2026-08-28**

✅ **RICHARD RULED B (2026-08-28, session 59): A + hide-by-moderator, no reader-facing report.**
That is the recommendation this section made, taken unchanged. **C5 is unblocked**, and so is the
launcher's chat composer, which was behind it only because posting is what creates the messages a
posture is about. What B commits to, restated so C5 can be graded against it:

1. **Delete-own, always** — and `delete-unanswered` is *not* inherited, because its condition has
   no referent in chat (see the argument below). A message's author may remove it, full stop.
2. **Hide-by-moderator exists as a route.** The columns are already in §5's table; B is the
   decision that something may reach them.
3. **No reader-facing report.** ⚠️ This is the half that is easy to drift back into: `content_reports`
   already carries a `chat_message` subject (§4.2, and `0024` shipped it), so the *storage* for C
   is live on production as of this session. **C is a route away, and v1 must not add that route.**
   A reader who wants something taken down tells Richard out of band; that is the accepted cost.

🔒 **STILL UNRULED in this section: free tags.** The question below was asked in the same breath
and was **not** answered by the B ruling. v1 continues to treat the channel as the category and
adds no tag table — which is the reversible default, but it is a default and not a decision.

---

_The argument that produced the recommendation, kept because C5 is graded against its reasons:_

**What D7 ruled, 2026-08-22, on the bench and only on the bench:** edit-own, delete-**unanswered**,
**no report/flag, no hide**.

🔴 **Two of those four do not transfer, and one cannot.**

1. **`delete-unanswered` has no referent in chat.** "Unanswered" is a property of a question with an
   accepted-answer state. A chat message has none — that is the *point* of chat per Richard's
   report (*"not committing to anything"*). So the condition on D7's delete verb evaluates to
   nothing here and a rule has to be chosen, not inherited.
2. 🔴 **"No report/flag" is a much larger bet in chat than on the bench, and R-chat says so.** On
   the bench a bad post sits under a title, in a thread, on a page a reader chose to open. In a
   merged river (§2) it sits at the top of the **default view of the whole feature**. The absence
   D7 accepted is not the same absence here.
3. **Hide-by-moderator** — the columns exist in §5's table either way; `upholdReport`'s machinery
   is already generic. The question is whether any route exposes it.

**The options, cheapest first:**

| | posture | cost | what it accepts |
|---|---|---|---|
| **A** | inherit D7 literally: delete-own always, no report, no hide | ~0 | a bad message is removable only by its author or by SQL |
| **B** | **A + hide-by-moderator** (route exists, no reader-facing report) | S | Richard can take something down; nobody can tell him it is there except out of band |
| **C** | B + a reader-facing report, reusing `content_reports` | S–M | reverses D7's "no report/flag" for one surface |

🧭 **Recommendation: B.** It is the smallest posture that leaves the platform able to *act*, it
reverses nothing D7 decided (D7 declined the reader's **button**, not the operator's ability), and
the `content_reports` subject added in §4.2 means C is a route away rather than a migration away.

🔒 **Also needing a ruling in the same breath — free tags.** Richard asked for *"good tagging"*;
D19 excluded user-created tags. v1 as scoped treats the **channel as the category** and adds no tag
table. If "tagging" meant something more, it is a decision, and it is cheap to add later and
expensive to remove.

## 9. Decisions taken inside this doc, each reversible and each stated

1. **Merged river as the default view; channel as a facet, not a door** (§2). The load-bearing one.
2. **Four channels, chosen for non-overlap with `bench_section`** (§3).
3. **No `chat_threads` table; parenthood is a nullable self-FK** (§5).
4. **One reply level, enforced by trigger** (§5).
5. **A reply inherits its root's channel, enforced by trigger** (§5).
6. **No points for chat messages** (§4.4) — an omission on purpose.
7. **No presence, no typing, no reactions, no realtime in v1** (§2, §6).
8. **No cross-corpus search** (§7).
9. **`searchable` returns the body** (§7) — FB-024's defect, not reproduced.

## 10. The slice

Ordered so the early steps are shippable and independent of R-chat-mod.

| # | slice | size | depends on |
|---|---|---|---|
| **C1** | `0024` + `src/lib/chat.ts` + the Drizzle mirror + the three sweeps (§11) | **M** | ✅ **DONE s51** |
| **C2** | the five routes, envelope-compliant, D15 verdicts | **M** | ✅ **DONE s51** |
| **C3** | the web tab: river + facet bar + thread view + composer | **M** | ✅ **DONE s52** |
| **C4** | the launcher tab, inside FB-006's structure (**done 2026-08-22**, so not a blocker) | **S–M** | 🟡 **READ HALF BUILT s57** — see §10a |
| **C5** | moderation verbs | **S** | 🔒 R-chat-mod |

⚠️ **C4's precondition is already met.** FB-013's sequencing note says *"do not ship chat before the
restructure or it lands in the one-big-list"* — the restructure is FB-006, and TASKS.md records the
launcher half **done 2026-08-22**. The warning is discharged; noted because a future reader will hit
that sentence and stop.

**Editor: a door only**, per FB-006/D6 — unchanged, and not in this slice.

### 10a. 🟡 What C4 built (session 57), and the one thing it deliberately did not

✅ **The read surface, end to end**: `CommunityApiClient.chat()` / `.chatThread()`, a composer
(`models/community/chatview.ts`), the river component and thread pane
(`noodl-core-ui/components/community/CommunityChatView.tsx`), a hook (`useCommunityChat`), and the
tab wired through `ProjectsPage` into FB-006's strip.

🔴 **The tab is SECOND in the strip, after Bench, because the web's nav puts Chat there — and the
copy of that nav pinned in `communityTabs.ts` had gone stale.** That header records the web as a
different repository whose order *"cannot be derived from disk … it is a copy, and a copy drifts"*,
with the mitigation being a quoted block that a reader checks. It drifted within four days: C3
added `/chat` on 08-26 and the quote still described 08-22. **Re-reading it is what caught it**,
which is the mitigation working rather than failing — the block is now re-quoted and dated.

🔴 **The river is fetched with NO channel, always, and that is `facets.ts`' rule rather than an
optimisation.** The client accepts a `channel` parameter (the route offers one) and the hook never
sends it: narrowing happens in memory so a pill's count and a pill's rows come from **one pass over
one list**. The channel facet *is* the design here, so two producers of that number would be the
feature failing rather than a cosmetic drift. A spec asserts the identity by *selecting each pill*
and comparing, rather than re-deriving the count a second way — a re-derivation would agree with an
implementation that made the same mistake twice.

🔴 **`chatThreadLabel` is a cross-repository copy that MUST keep agreeing.** The platform's
`threadLabel` is a permalink's `<h1>`, and its own comment says a label two surfaces compute
differently is one address whose title depends on which client you followed it from. It is mirrored
line for line, with **one documented difference**: the editor's `unsupported` block kind — its
marker for a block *it* cannot draw — contributes no text, so a body of only those is honestly
nameless rather than named after a marker. That kind cannot appear on the wire, so the platform's
function has no case for it.

⚠️ **A message row is not `CommunityRow`, and the whole row is not the click target.** The first is
C3's finding transferred (a chat message has no title, and a river of derived headlines is the
forum). The second is new here and structural: a body may contain links, which
`CommunityPostBody` draws as real anchors, so a `<button>` around them would nest interactive
elements. The way into a thread is a control in the row's foot — and it is **absent inside the
thread pane**, because there it would point at the page it is already on.

🔒 **DEFERRED, and this is the honest half of C4: there is no composer.** You can read the river,
filter it, and open a thread; you cannot post or reply from the launcher. Two reasons, and the
second is the real one:

1. Scope: adding both writes turns an S–M slice into an L one.
2. 🔴 **Posting is where R-chat-mod actually bites.** C5 is listed as blocked on that ruling, but a
   *composer* is what creates the messages a moderation posture is about — shipping "anyone can
   post from the editor" before deciding whether anybody can take a message down is the ordering
   the ruling exists to prevent. **So the composer belongs with C5, not before it.**

⚠️ **And the platform half is not deployed.** `/api/v1/community/chat` answers **404** on
production while `/api/v1/community/threads` answers **200** and an invented path answers 404 —
so the tab is correct and has nothing to talk to until `nodegx-community` ships. It was therefore
driven against a **local** platform (see the task file), not production.

## 11. 🔴 The sweeps this owes — and it is **FOUR**, not the three FB-005 recorded

`fb005-template-submissions.test.ts` was **35/35 green while three repo-wide sweeps were red**. That
finding is the reason this section exists — and building against it turned up a **fourth**, which
FB-005's table does not name because T5 added no dynamic route.

| sweep | what it demands | state |
|---|---|---|
| `db-schema-drift` | the table declared in the **Drizzle mirror** (`src/db/schema.ts`) | ✅ paid |
| `uni005-data-inventory` | every free-text column **classified** — and a `minor-refused` row needs an **executed probe**, not a classification | ✅ paid |
| `uni011-mirror-api` | a **D15 verdict recipe** for every route on disk | ✅ paid |
| 🆕 **`nat006-api-contract`** | a **seeded row behind every DYNAMIC read endpoint** | ✅ paid |

🔴 **The fourth is the one that found itself, and it found itself the right way round.** It went red
with three failures reading:

> *"`/api/v1/community/chat/[messageId]` is dynamic and this file has no seeded id for it — a
> made-up id 404s, which would let a broken endpoint pass every assertion below"*

⚠️ **That is a sweep refusing to run rather than passing vacuously**, which is the difference between
this and the shape FB-005 paid for. A sweep that quietly skipped the route it could not call would
have been green, and the routes it skipped would have been exactly the new ones. ✅ **Write the
next one this way**: when a sweep cannot exercise something, the honest failure is *"I could not
measure this"*, never silence.

✅ **And the seed carries a REPLY as well as a root, deliberately.** Two of the three failing
assertions sweep whole response bodies; a thread with no replies would hand them an empty array, so
the nested shape — the only place in this API where a mapper runs over a second level — would be
swept without ever being looked at.

🔴 **`chat_messages.body` is a `minor-refused` row and the probe must be executed, not asserted.**
Here the gate is a **trigger** (`board_actor_is_eligible`, §4.1) rather than code, which makes it
*easier* than FB-005's — that one was the only probe in the file whose mechanism was code — but the
probe is owed all the same.

✅ **Run the whole suite, not the file you wrote.** A green new spec beside three red sweeps is the
exact shape of work that looks finished.

### 🔴 C3 owed TWO MORE, and neither is in the table above — because a PAGE is not a route

⚠️ **The four sweeps §11 names are what a new TABLE and a new API ROUTE owe. C3 added neither** —
no migration, no column, no endpoint — so all four were untouched, and a session reading only this
section would have concluded it owed nothing. It owed two, both found by running the whole suite:

| sweep | what it demands of a PAGE | how it went |
|---|---|---|
| `uni019-home` AC3 | every page on disk is **reachable by clicking**, or is in `NON_BROWSABLE` with a reason | ✅ passed first time — the nav entry and `chatRiver`'s `href` were enough |
| `uni023-facet-bar` AC5 | the `'use client'` files in `src/` are an **exact list**, each with a written reason | 🔴 **went red** — `ChatComposer.tsx` had to argue for itself |
| `uni013-slice5` §1 | every page is an **archetype instance or a recorded exception** | 🔴 **went red on both new pages** |

🔴 **`linksInPage` reads a page's source and the exported bodies of the `lib/` functions it
imports — it does NOT read components.** So the river's link to a thread had to be built in
`lib/lists.ts`; an href invented inside `Chat.tsx` would have left `/chat/[messageId]` reported
UNREACHABLE, correctly, because nothing the sweep can see would have linked to it. ✅ **That is
why a page's composition belongs in `lib/` and its markup in a component, and it is a
correctness constraint rather than a convention.**

## 12. Traps carried in — read before writing C1

- 🔴 **A CHECK constraint passes on NULL** (TUT-004). Relevant to every `is null` pairing in §5.
- 🔴 **`is distinct from` rather than `<>`** in any trigger comparing against a nullable `new`
  column — `0008`'s accept guard documents why: `<>` yields null, a plain `if` treats it as false,
  and the guard passes by accident on exactly the row it stopped checking. §5's depth trigger and
  its own-parent constraint both sit on that edge.
- 🔴 **`drizzle()` mutates the client you hand it** (FB-023) — `createDb()` takes no client. Any
  new reader uses it.
- 🔴 **pg `->` and `||` are ONE precedence class, left-associative** (P75) — parenthesise.
- ⚠️ **This repo sets no `strict`**, so a boolean discriminant does not narrow a union. Any new
  outcome type uses a **string** discriminant.
- 🔴 **A spec that passes is not a spec that grades the thing in its name** (FB-005 T4, twice this
  phase). Mutate the mechanism the spec's name claims.

## 13. Acceptance criteria — FB-013's v1 sketch, firmed up

- **AC1** — post to a channel, reply in a thread; both surfaces agree (D15). *(C2–C4)*
- **AC2** — search finds chat messages; channel facets via the existing facet machinery, and the
  `searchable` field names the **body** (§7). *(C1–C3)*
- **AC3** — org-minor posture per D15, enforced by `board_actor_is_eligible` and proved by an
  **executed** probe (§11); moderation verbs per **R-chat-mod**. *(C1, C5)*
- **AC4** — 🔴 **restated as structural, not editorial.** The original read *"an empty channel says
  what it is for"*. §2 goes further: **no screen in the feature has an accidentally-reachable empty
  state**, because the default view is the merged river and a channel is a facet. The copy
  obligation survives on the *deliberately* filtered view. A spec asserts the default view is never
  a per-channel one.
- **AC5** *(new)* — the envelope contract + the three sweeps of §11 pass; new columns classified in
  the census with an executed probe.
