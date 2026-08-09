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
| BLD-001 ⭐ | [BLD-001-ONE-THREAD.md](BLD-001-ONE-THREAD.md) | one thread, one composer; scope inferred, not chosen | D1 |
| BLD-002 | [BLD-002-MESSAGE-HIERARCHY.md](BLD-002-MESSAGE-HIERARCHY.md) | five message kinds, five treatments; collapsed activity runs | D4 |
| BLD-003 ⭐ | [BLD-003-DECISIONS-ON-THE-CARD.md](BLD-003-DECISIONS-ON-THE-CARD.md) | actions attach to their subject; one owner; Discard, not red Reject | D2 D3 D8ᵃ |
| BLD-004 | [BLD-004-THINKING-AND-HEARTBEAT.md](BLD-004-THINKING-AND-HEARTBEAT.md) | surface `onActivity`; add a reasoning channel the XML parser cannot see | D6 D7 |
| BLD-005 ⭐ | [BLD-005-LEGIBLE-LONG-RUN.md](BLD-005-LEGIBLE-LONG-RUN.md) | pin the run header out of the scroll area; plan-as-map; honest estimate | corr. 2 |
| BLD-006 | [BLD-006-THREADS-PERSIST.md](BLD-006-THREADS-PERSIST.md) | threads survive accept, navigation and restart; a switcher | D5 |
| BLD-007 ✅ | [BLD-007-DOCS-ARE-OPEN.md](BLD-007-DOCS-ARE-OPEN.md) | front-matter `inject`; the one-value enum becomes a discovered list | D9 |
| BLD-008 ⭐ | [BLD-008-DOCS-INTERVIEW.md](BLD-008-DOCS-INTERVIEW.md) | the agent asks before it drafts; TODO count stops being a feature | D8 |
| BLD-009 | [BLD-009-EXPANDED-MODE.md](BLD-009-EXPANDED-MODE.md) | the same thread as a document, two-pane with the live preview | D10 |
| BLD-010 | [BLD-010-ACCEPTANCE-PASS.md](BLD-010-ACCEPTANCE-PASS.md) | drive every state live, both widths, both themes, and measure | — |

ᵃ BLD-003 closes the *duplicate-bar* half of D8 (the Docs panel hand-off); BLD-008 closes the rest.

✅ = built **and merged to `cline-dev`** (BLD-007 and BLD-012, merged 2026-08-09). Neither has been
driven in a real editor; both carry an open live-QA criterion in their own file.

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
3. **BLD-005 + BLD-004** — the long-run legibility pair. BLD-005 is small (a sticky header and an
   estimate); BLD-004 is the one that makes it feel alive.
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
