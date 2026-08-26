# FB-013 — the chat we argued against

**Filed:** 2026-08-22, from Richard's item 13. **Status: 🟡 C1 + C2 BUILT AND SPECCED (session 51)
— R-chat ruled 2026-08-22: OVERRULED, build it.** Size: L.

📋 **The scoping doc the ruling asked for exists: [FB-013-SCOPE.md](FB-013-SCOPE.md) (2026-08-26).**
Read §1 before anything else — the risk UNI-011 predicted was measured this session and it went the
argument's way, which is what the design in §2 is built against.

✅ **C1 (schema + lib) and C2 (routes) are done, session 51.** `0024_fb013_chat.sql`, `src/lib/chat.ts`,
`src/lib/chat-http.ts`, and the five routes under `/api/v1/community/chat`. **22 specs, 6 mutants
all killed.** The three repo sweeps a new table and route owe are paid: Drizzle mirror,
`uni005` census with an **executed** probe, and `uni011` D15 verdict recipes for both routes.
🔒 **Left: C3 (web tab), C4 (launcher tab), C5 (moderation verbs — needs R-chat-mod).**

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
  it was the whole counter-argument.
