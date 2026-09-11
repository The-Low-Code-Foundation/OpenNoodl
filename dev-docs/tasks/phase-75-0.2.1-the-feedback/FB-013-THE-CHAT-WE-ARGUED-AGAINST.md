# FB-013 — the chat we argued against

**Filed:** 2026-08-22, from Richard's item 13. **Status: 🟡 C1 + C2 + C3 BUILT AND SPECCED
(sessions 51–52) — R-chat ruled 2026-08-22: OVERRULED, build it.** Size: L.

📋 **The scoping doc the ruling asked for exists: [FB-013-SCOPE.md](FB-013-SCOPE.md) (2026-08-26).**
Read §1 before anything else — the risk UNI-011 predicted was measured this session and it went the
argument's way, which is what the design in §2 is built against.

✅ **C1 (schema + lib) and C2 (routes) are done, session 51.** `0024_fb013_chat.sql`, `src/lib/chat.ts`,
`src/lib/chat-http.ts`, and the five routes under `/api/v1/community/chat`. **22 specs, 6 mutants
all killed.** The three repo sweeps a new table and route owe are paid: Drizzle mirror,
`uni005` census with an **executed** probe, and `uni011` D15 verdict recipes for both routes.

✅ **C3 (the web tab) is done, session 52.** `/chat` and `/chat/[messageId]`, `chatRiver` in
`src/lib/lists.ts`, `src/components/Chat.tsx`, `src/components/ChatComposer.tsx`, a nav entry.
**22 specs, 12 mutants all killed.** 🔒 **Left: C4 (launcher tab), C5 (moderation verbs — needs
R-chat-mod).**

### 🔴 What C3 had to decide, and the one that is load-bearing

**A chat message is not a card, and it does not go through `ListView`.** `CardView` renders
`<h3>{title}</h3>` over an optional `body` that is a plain `string`; a chat message has no title
and its body is `Block[]`. Forcing one through the card archetype means inventing a headline and
flattening the body to a sentence — **and a river of headlines IS the forum**, which is the shape
SCOPE §3 spends its table refusing.

✅ **So what is shared is the ENGINE rather than the card.** `chatRiver` goes through `buildList`,
and the page renders the kit's `PageHead`, `FacetBar` and `EmptyState` — so a channel pill's
number is still what clicking it returns, the pill markup is still declared exactly once in
`Kit.tsx`, and `/chat` is in `FACETED_PAGES` in `uni023` beside the other six rather than
asserting the same promises a second time.

⚠️ **`chatRiver` calls `listRiver(sql)` with NO channel, and that one line is the design.** The
page never asks the database for one channel: it fetches the merged window and `buildList`
narrows it. A mutant that narrowed in the database too survived every assertion written before
it — see below.

### 🔴 The thread page's `<h1>` is DERIVED, and that is §3 seen from the other end

A permalink needs a heading; a forum gets one by asking the author to write it, and **that field
is what makes readers scan titles instead of reading messages**. `threadLabel` recomputes it from
the opening message — nothing is asked of the author, no column exists to drift, and it lives in
`lib/chat.ts` beside `CHANNEL_PURPOSE` because both clients need it and a label two surfaces
compute differently is a permalink whose title depends on where you followed it from. **This is
the same decision as "no `chat_threads` table", seen from the view layer.**

🔴 **R-chat, as ruled:** UNI-011's written argument (*"a forum flatters low volume; chat punishes
it"*) is **superseded by a decision, not answered by a counter-argument** — it stays quoted below
because the risk it names is still real, and the scoping doc has to say how the design survives it.
Richard chose the full build over the middle option (a no-answered-state `#lounge` bench category).
Two consequences the ruling inherits: **FB-014's search gains a second corpus**, and **D7 declined
report/flag on the same day** — chat is where that absence bites hardest, so the scoping doc must
raise the posture question rather than assume the bench's answer transfers.

> *"I think we need a chat tab. I know we said the bench is better, but when I think about
> sharing tutorials, maybe chatting about templates, collaboration, just talking and not
> committing to anything, a chat feed would be good… maybe a Slack clone with topics and
> threads? Very simple, not a forum level complexity, with good tagging, categories, searching
> for easy filtering."*

---

## The argument on file (UNI-011, ~280–290) — quoted so the ruling reverses it knowingly

> *"Discord is not quiet because it is Discord — it is quiet because a young community has low
> message volume, and chat renders low volume as an empty room every time anyone looks… A forum
> flatters low volume; chat punishes it. … The hangout is the weekly call, which Richard already
> runs. A `#lounge` category and the events strip carry the social half; a chat tab would just
> be a quieter Discord, and it is out of scope."*

Also relevant: D19's chosen-absence list (private messages — flagged as *"the one worth arguing
about"*), and D15/L5 posture (what an org-minor or refused viewer may see applies to chat too).

## What's changed since that argument (Richard's side, steelmanned)

- The community now has content types with no natural bench home: sharing a tutorial file
  (FB-012c), showing a template (FB-005), collaboration feelers, "just talking without
  committing to anything". The bench's whole design is *commitment* — a question with an
  answered-state. The argument said the weekly call + a `#lounge` category carry this; Richard
  is reporting they don't.

## R-chat — the actual decision

1. **Overrule, or partially?** A middle exists that the original argument allows: a **`#lounge`
   discussions category on the bench** (threads without answered-state — "just talking") costs
   almost nothing and tests the volume hypothesis before a chat build. If it fills, chat is
   justified by measurement; if it stays empty, chat would have punished us as predicted.
2. If full chat: channels (fixed vocabulary, not user-created — D19 excluded user tags) +
   threads + FTS search, reusing the bench's post/moderation/notification machinery
   (`notification_deliveries`, never the relay — D10). Slack-shape, forum-weight refused.
3. Moderation floor first: chat multiplies D7's surface (report/flag/delete-own per message).

## Proposed sequencing (if Richard rules "chat")

Scoping doc (S) → schema + routes behind the four platform gates → web tab → launcher tab
(inside FB-006's tab structure — do not ship chat before the restructure or it lands in the
one-big-list). Editor: door only, per FB-006/D6.

## Acceptance criteria (v1 sketch, post-ruling)

- AC1: post to a channel, reply in a thread, both surfaces agree (D15).
- AC2: search finds chat messages; facets by channel/tag via the existing facet machinery.
- AC3: report/flag/delete-own per D7's ruling; org-minor posture per D15.
- AC4: an empty channel says what it is for — the empty-room problem addressed in copy, since
  it was the whole counter-argument. 🔴 **Restated as STRUCTURAL by SCOPE §2 and graded that way
  in C3**: no screen in the feature has an accidentally-reachable empty state, falsifiable three
  independent ways — a per-channel ROUTE on disk, a default read that returns one channel, or a
  pill that links to a path instead of a query. The copy obligation survives on the
  *deliberately* filtered view and is asserted with a negative control beside it.

---

## 🔴 What C3's mutation grading found — two survivors, and both were real

Twelve mutants, ten killed on the first pass. **The two that survived were defects in the spec,
not in the code, and neither was visible from a green run.**

1. 🔴 **A row named *"finds a word that is only in a message body"* was searching for a word that
   lived in a REPLY.** So dropping the body from `searchable` — FB-024's exact defect, restaged —
   failed nothing. ✅ The fixture now carries **three rare words, one per place**: `marmalade` in a
   root and nowhere else, `periwinkle` in a reply and nowhere else, `chartreuse` written nowhere
   at all as the control that proves a hit is about the word.
2. 🔴 **Narrowing in the DATABASE as well as in `buildList` survived every assertion**, because
   all of them read the *unfiltered* river, where the two are indistinguishable. What it breaks
   is a reader standing in `#lounge`: the window would hold lounge rows only, so `#templates`
   would advertise `0`, clicking it would return nothing, and **the room would be back with a
   count that lies about why** — while the page looked completely normal. ✅ The new row asserts
   the number that GREW: `#templates` reads **3** from inside `#lounge`, because the dimension is
   multi-select and a pill's count is what clicking it RETURNS. ⚠️ Count-equals-rows still holds
   under the mutant, so that property could not have caught it.

⚠️ **Both are the same lesson in two costumes** — *a spec that passes is not a spec that grades
the thing in its name* — and in both cases the assertion that would have caught it needed a
number the wrong implementation cannot produce, not merely a number that fits.

---

## 🔴 What DRIVING the real pages found, after 22 green specs and 12 killed mutants

The specs render the composition; **`next build && next start` and a `curl` render the page.** Two
things came out of the gap, and only one of them was a defect.

### 1. 🔴 `/chat/not-a-uuid` answered **500** — and so do `/bench/[threadId]` and `/rfps/[id]`

A malformed id reaches postgres as `invalid input syntax for type uuid`, throws, and Next renders
the error page: **a server fault for a request that was simply wrong.**

⚠️ **`apishape.ts` records this exact defect being fixed across NINE ROUTES at once — and the
PAGES were not among the nine.** `/chat/[messageId]`'s own API route has carried `isId` since C2;
the page did not.

🔴 **No spec could have seen it, and the reason is worth keeping.** Every assertion renders the
composition over a thread that exists, so `threadById` is only ever reached with an id somebody
already holds. The defect lives in the page's *glue*, on the path an HTTP request takes. It took
an actual request with rubbish in the URL.

✅ **Fixed on `/chat/[messageId]`** — `if (!isId(messageId)) notFound()`, and specced with the
discriminating assertion rather than "it threw": **both arms throw**, because `notFound()` throws
too, so the row asserts the error is *not* a postgres cast failure and that a well-formed-but-absent
id produces the identical answer. Mutant (guard removed) **killed**.

| measured live, same minute | before | after |
|---|---|---|
| `/chat/not-a-uuid` | **500** | ✅ 404 |
| `/chat/<absent uuid>` | 404 | 404 |
| 🔴 `/bench/not-a-uuid` | **500** | **still 500 — NOT FIXED HERE** |
| 🔴 `/rfps/not-a-uuid` | **500** | **still 500 — NOT FIXED HERE** |
| `/u/not-a-real-handle` | 404 | 404 — a handle is text, so it never casts |

🔒 **The other two are left deliberately**, as one-line fixes in other tasks' files: the same
`isId` guard before the query. Recorded here rather than fixed silently or left unmentioned.

### 2. ⚠️ NOT a defect — and it re-confirms a trap already on file

`@ada-drive` appeared absent from the thread page. It is not: Next's SSR emits
`@<!-- -->ada-drive`, React's text-node separator, and the probe's tag-stripping turned the comment
into a space. A reader sees `@ada-drive`.

🔴 **But the spec's `toContain('@ada-builds')` passes on bytes the page does not ship**, because
`renderToStaticMarkup` inserts no separator and Next's SSR does. **This is FB-011's finding from
s18 arriving a second time** — *the drive found `renderToStaticMarkup` grading different bytes than
the page ships*. Harmless here; it will not be harmless the day an assertion depends on two
adjacent expressions being adjacent in the output.

### ✅ What the drive positively confirmed, live over HTTP

- `/chat` **200**, four channel pills, `1 conversation` for one seeded thread.
- `?q=second+level` — a word written **only in a reply** returns its **root**, and excludes the
  other thread. The `replySearchText` corpus works on the real page, not only in a spec.
- `?channel=collab` — the quiet channel renders **"Nothing in #collab yet. Looking for someone to
  build with, or offering to help on something."** AC4's copy obligation, on the deployed path.
- The thread page's `<h1>` is the derived label, and **no client island renders** for a signed-out
  reader — the read path is what it claims to be.

