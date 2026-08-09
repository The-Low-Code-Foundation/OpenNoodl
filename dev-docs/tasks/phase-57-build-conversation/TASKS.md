# Phase 57 — the tasks (BLD: the Build conversation)

**Created:** 2026-08-08, out of [README.md](README.md) and the approved mockup
([artifact](https://claude.ai/code/artifact/a37f0d32-b7f8-4104-97fd-2ee46a188c9f)).

**The bar, restated as an exit test:** one continuous session builds across four components, attaches
a mock, mentions a component and a doc, asks the agent to look at the rendered result, accepts, writes
project docs by answering questions rather than correcting guesses, adds a doc of its own invention
that the next build actually uses — and **the thread never resets and no control appears twice**.
Then quit, reopen, and the thread is still there. Full criteria in the README.

**Sixteen tasks is a large phase. It cuts cleanly at the track line:** Track A alone fixes every
defect D1–D10 and is a complete, coherent release. Track B is what makes it the builder Richard
described, and every one of its tasks needs BLD-001 to exist first.

**Two corrections that must survive into every task** (both measured, both in the README):
contrast is **not** the legibility problem — type scale is; and the project run is **not** a black
box — its header is inside the scroll area.

---

## Track A — the conversation

| Task | File | One line | Closes |
|---|---|---|---|
| BLD-001 ⭐ ✅ | [BLD-001-ONE-THREAD.md](BLD-001-ONE-THREAD.md) | one thread, one composer; scope inferred, not chosen | **D1 ✅** |
| BLD-002 ✅ | [BLD-002-MESSAGE-HIERARCHY.md](BLD-002-MESSAGE-HIERARCHY.md) | five message kinds, five treatments; collapsed activity runs | **D4 ✅** |
| BLD-003 ⭐ ✅ | [BLD-003-DECISIONS-ON-THE-CARD.md](BLD-003-DECISIONS-ON-THE-CARD.md) | actions attach to their subject; one owner; Discard, not red Reject | **D2 ✅ D3 ✅** D8ᵃ |
| BLD-004 ✅ | [BLD-004-THINKING-AND-HEARTBEAT.md](BLD-004-THINKING-AND-HEARTBEAT.md) | surface `onActivity`; add a reasoning channel the XML parser cannot see | **D6 ✅ D7 ✅** C8 ✅ R2 ✅ |
| BLD-005 ⭐ ✅ | [BLD-005-LEGIBLE-LONG-RUN.md](BLD-005-LEGIBLE-LONG-RUN.md) | pin the run header out of the scroll area; plan-as-map; honest estimate | **corr. 2 ✅** |
| BLD-006 | [BLD-006-THREADS-PERSIST.md](BLD-006-THREADS-PERSIST.md) | threads survive accept, navigation and restart; a switcher | D5 |
| BLD-007 ⭐ ✅ | [BLD-007-DOCS-ARE-OPEN.md](BLD-007-DOCS-ARE-OPEN.md) | front-matter `inject`; the one-value enum becomes a discovered list | **D9 ✅** |
| BLD-008 ⭐ | [BLD-008-DOCS-INTERVIEW.md](BLD-008-DOCS-INTERVIEW.md) | the agent asks before it drafts; TODO count stops being a feature | D8 |
| BLD-009 | [BLD-009-EXPANDED-MODE.md](BLD-009-EXPANDED-MODE.md) | the same thread as a document, two-pane with the live preview | D10 |
| BLD-010 | [BLD-010-ACCEPTANCE-PASS.md](BLD-010-ACCEPTANCE-PASS.md) | drive every state live, both widths, both themes, and measure | — |

ᵃ BLD-003 closes the *duplicate-bar* half of D8 (the Docs panel hand-off); BLD-008 closes the rest.

✅ = built **and on `cline-dev`** (BLD-007 and BLD-012 merged 2026-08-09; **BLD-001 built, driven and
closed 2026-08-09** — `a93720b3`, `02c3072c`, `458e189f`).

**Session 9 (2026-08-09) — BLD-007 driven and closed; BLD-012's live claim taken.** **8 of 16 built,
7 driven.** BLD-007's three open acceptance criteria are all live measurements now, and the drive
found **B8** (the panel stated the per-turn cost and the ellipsis ate the number). BLD-012's image
block **reached a real Anthropic endpoint** on both `chat` and `chatStream` — the model was shown a
blue square and said "Blue", so acceptance is distinguished from comprehension. That one call also
closed **BLD-005's R5** (cost against a real provider: $0.000042, arithmetic exact) and showed
**BLD-004's `onActivity` firing against a real provider** for the first time. ⚠️ BLD-012 is *not*
closed: no UI produces an image message until BLD-011, and OpenAI's leg is still stub-only.

**BLD-001 is driven and closed** (2026-08-09). The first drive closed B1, confirmed six claims and
found two defects, neither reachable offline; both are now fixed and re-driven:

- ✅ **B9 — the thread reset on every successful send.** `history` accumulated on the declined and
  failed paths but not the success one. Fixed by `retireLive` (`458e189f`) and re-driven from an
  empty thread: three sends, three provider calls, **three turns, in order**. **D1 is closed.**
- ✅ **B10 — a retired turn kept the Accept card.** Found while fixing B9, not by driving it: the
  outcome *kind* plus a session-wide `canDecide` is not turn-specific, so a second staged build put
  a second Accept on the historical turn. `renderOutcome` now matches the live id.
- ✅ **B8 — the composer answered no key at all**; the refactor dropped the old `onEnter`. Fixed and
  driven.

⚠️ **The reusable lesson from the fix:** the id prefix *is* the liveness. `liveTurns(sources,
idPrefix?)` is one derivation read twice — with no prefix for the live turns, with `history-N` for
retired ones — and because the live ids are exactly what `renderOutcome` matches, a retired turn
**cannot** mount a live control. Anything else keying off a turn's identity must use the same
convention. And retiring is a **pair**: freeze the record, then release what produced it; doing only
the first half is worse than doing neither.

**BLD-003 is driven and closed** (2026-08-09, `49d06961` + `eb23291c`). **B5's measurement is
answered:** where there were 2 Accept and 2 Review changes, with the two copies disagreeing on
wording, there is now **exactly one of each**, moving between surfaces as the document opens and
closes — counted from the DOM in all three states.

⚠️ **The defect table listed two surfaces; there are three.** `ChangeReviewDocument` is reached from
the card's own *"Review changes"* button and a document sits **beside** the sidebar, not over it, so
the ownership rule had to cover it or this task's own control would have opened the duplicate it
exists to remove. The rule takes *every document that shows the candidate*, not a preview flag.

⚠️ **The one half of BLD-003 that has never been on screen is the docs route** — each draft's
Accept / Review changes / Discard. It is built and gated; it is not driven. **BLD-010 owns it.**

**BLD-002 is driven and closed** (2026-08-09). **D4 is closed.** Measured before and after, in both
themes, on the surfaces the thread actually paints:

- **The premise is confirmed on screen.** `is-type-secondary` and `is-type-default` measured the
  *identical ratio* in both themes (7.70 dark, 7.10 light), so the ~40 call sites alternating between
  them expressed no hierarchy at all. Every row was `12px / normal / 400`. And **no text role failed
  AA before the change** — README correction 1 is now empirical, not just arithmetic.
- Four sizes and explicit leading where there was one size and inherited leading; the user's message
  is now the highest-contrast element in its turn (13.03 / 14.20 against 7.70 / 7.10).
- Twelve tool activities collapse to one line and expand to twelve. **Driven.**

⚠️ **The rule that specs alone could not have protected: a *failed* submission never collapses.**
Driven with a real rejection through the real gate. A run that had swallowed it would look completely
normal on screen — the cure for noise must not also be a cure for signal.

✅ **C5 is fixed, and BLD-003's stated mechanism was half wrong** — which is why it said to
re-measure. The cause is not a stray stretch: **`Stack` sets `height: 100%` on every `HStack` that
does not declare one** ([Stack.tsx:38](../../../packages/noodl-core-ui/src/components/layout/Stack/Stack.tsx#L38)),
and the header is a *block* container, so the row resolved 100% against the whole header rather than
its own line. That is also why the "60px" did not close: the overflow **equals** the offset, always,
because the row becomes as tall as the header while starting below whatever is above it. Confirmed by
intervention before fixing.

⚠️ **Two findings filed rather than fixed, both design-system scope:** the `height: 100%` above is a
trap at **every** `HStack` in a block parent (C6), and `PrimaryButtonVariant.Ghost`'s label measures
**4.33:1 in light mode**, below AA, on every `bg-1` surface in the editor (C7). Neither is this
panel's to change; both need a full-surface pass.

**BLD-004 is driven and closed** (2026-08-09). **D6, D7, C8 and BLD-005's R2 are closed.** The
heartbeat, the reasoning channel, the collapsed run's duration, and the run map's motion.

⚠️ **The task's own premise was wrong about the mechanism, and one field was the whole of it.**
`display: 'omitted'` was never protecting the XML-parsed text — thinking has never been in a `text`
block on any setting — it made the thinking blocks arrive **empty**. The reasoning channel would
have shipped inert, and every spec above it would have passed. See the task doc's header.

⚠️ **Two defects came out of the drive that nothing else could have caught**, and both are the same
shape as the defect the task exists to remove:

- **A clock outlived what it measured.** The reasoning strip ran while `streaming` was set, and a
  hung turn stays `streaming` until the deadline — a one-second think showed **"Thinking… 3m 2s"**.
- **A state class collided with an animated modifier**, painting `primary` behind the sentence at
  **1.16:1**. ⚠️ Found by *measuring composited pixels*: every screenshot was taken in `waiting`,
  where the collision does not paint, so it was absent from every frame captured and present the
  whole time.

⚠️ **BLD-012's golden request spec caught the `display` change** — a spec BLD-004 never touched. A
golden that pins the *whole* request rather than the fields one task cared about is what made a
deliberate byte-change visible instead of silent.

⚠️ **BLD-007 and BLD-012 still have not been driven**, and BLD-012's is the one with a bill attached
to getting it wrong — its image block has never reached a real endpoint.

**The frame is up, so Track A is unblocked.** Everything below renders inside `BuildThread`
(`views/panels/AiAuthoringPanel/thread/`) over the pure turn model
(`models/AiAssistant/thread/`) — read both before starting any of them; between them they are ~600
lines and they are the vocabulary the rest of the track speaks.

## Track B — what the agent can see

| Task | File | One line | Rests on |
|---|---|---|---|
| BLD-011 ⭐ | [BLD-011-TURN-CARRIES-REFERENCES.md](BLD-011-TURN-CARRIES-REFERENCES.md) | the composer becomes a context builder; one `Reference` model | new |
| BLD-012 ⭐ ✅ | [BLD-012-MULTIMODAL-MESSAGES.md](BLD-012-MULTIMODAL-MESSAGES.md) | `AiMessage.content` widens to blocks; declared degradation | adapters exist |
| BLD-013 | [BLD-013-ATTACHMENTS.md](BLD-013-ATTACHMENTS.md) | drop/paste/pick markdown, text, images; PDF behind a decision | one new dep |
| BLD-014 ⭐ | [BLD-014-LOOK-AT-IT.md](BLD-014-LOOK-AT-IT.md) | two capture paths: the live webview, and CDP for any viewport or URL | harness built |
| BLD-015 | [BLD-015-WEB-SEARCH.md](BLD-015-WEB-SEARCH.md) | one editor-side backend; citations carry source and read-time | nothing |
| BLD-016 | [BLD-016-MENTIONS.md](BLD-016-MENTIONS.md) | `@` over components, docs, pages, collections, attachments | CM6 precedent |

---

## Dependency map

```
  BLD-001  one thread ──┬── BLD-002  hierarchy ── BLD-004  thinking ─┐
  (the frame)           │                                            ├─ BLD-005  long run
                        ├── BLD-003  decisions ──────────────────────┤
                        ├── BLD-006  persistence                     ├─ BLD-009  expanded
                        └── BLD-011  references ─┬─ BLD-012  blocks ─┤
                                                 │      └─ BLD-013  attachments
  BLD-007  docs open ──── BLD-008  interview     │      └─ BLD-014  look at it
        └──────────────────── BLD-016  mentions ─┘         (also needs F22)
                                                 └─ BLD-015  search

  BLD-010  acceptance pass ── everything
```

**The two real serialisation points:**

- **BLD-001 before everything.** It is the frame; every other task renders inside it. Starting
  BLD-002 or BLD-011 first means building against a component that is about to be deleted.
- **BLD-012 before 013 and 014.** Both carry images. Attempting either first produces a resolver with
  nowhere to put its output.

**BLD-007 is independent** and can be picked up in parallel by a second session — it touches
`ProjectDocs/` and `projectDocsTool.ts`, which no Track A task goes near. ⚠️ If two sessions run,
re-read [`no-concurrent-session-on-opennoodl`] discipline: pathspec-scope every commit, never
`git add -A`.

## Suggested order

1. **BLD-001** — nothing else is safe to start.
2. **BLD-003 + BLD-002** — together they are most of what Richard actually complained about, and they
   are visible immediately.
3. ~~**BLD-005** + **BLD-004** — the long-run legibility pair. **Both closed.**~~ BLD-005 was built
   *before* BLD-004 rather than after: only step 4's motion needed the heartbeat, and motion is the
   one thing there that must not be faked. BLD-004 then closed C8 and R2 along with its own D6/D7.
4. **BLD-006** — cheap, and it is the difference between a tool and a form.
5. **BLD-007 → BLD-008** — the docs pair. 007 is mechanical, 008 is the interesting one.
6. **BLD-011 → BLD-012 → BLD-014** — the context spine. 014 is the payoff and should be prioritised
   over 013/015/016 because it closes doctrine §11 inside the editor for the first time.
7. **BLD-013, BLD-015, BLD-016** — in whatever order the open decisions (Q4, Q5) resolve.
8. **BLD-009**, then **BLD-010**.

## Working habits carried in

- **Write the check before the fix** (phase 39). Several tasks here are "the mechanism exists and
  nothing surfaces it" — BLD-004 especially. The check proves the *surfacing*, not the mechanism.
- **Verify the consequence, not just the mechanism.** A right mechanism is not a right prediction;
  run it both ways and diff. BLD-004's heartbeat and BLD-005's estimate are both easy to build
  correctly and still have lie on screen.
- **Anything filed-not-fixed gets a row** in that task's register, with its blocker named — the
  LAS-005/F22 precedent is exactly why BLD-014 is scopeable at all.
- **A green check proves nothing about a panel.** Every visual claim gets driven live (BLD-010), and
  the editor is a **queue** — if another session is using it, wait and poll.
- ⚠️ **The editor holds the project in memory.** An MCP write never reaches the running preview, and
  restarting to pick it up can overwrite your work.
