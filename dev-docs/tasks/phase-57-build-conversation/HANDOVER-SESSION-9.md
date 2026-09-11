# Phase 57 — handover after session 9 (2026-08-09)

**What ran:** **BLD-007 driven and closed** — all three of its open acceptance criteria are live
measurements now, and **D9 is closed**. **BLD-012's one untested claim was taken**: the image block
reached a real Anthropic endpoint. That single call also closed **BLD-005's R5** and produced the
first evidence of **BLD-004's heartbeat against a real provider**.

Phase 57 is **8 of 16 built, 7 driven** (BLD-001 ✅, BLD-002 ✅, BLD-003 ✅, BLD-004 ✅, BLD-005 ✅,
**BLD-007 ✅**, BLD-012 🟡). ⚠️ **BLD-012 is not closed** — see below for the two gaps that remain,
neither of which is the one its notes have carried since 08-08.

## 🟢 Concurrency — a sibling was live at the start and finished during it

- At session start: a `test:ci` was running (17:40), a dev stack was up (17:17), and two phase-58
  commits sat on top of session 8's work. **Richard confirmed the sibling was finishing.** It then
  landed `37fe2db5` — phase 57's own BLD-004 `test:ci` verdict — and exited.
- ⚠️ **Read `37fe2db5` before trusting any gate number.** It establishes the baseline this session
  inherited: **`Jasmine: 2582 specs, 6 failures`**, the inherited six by name. It also records the
  trap that shaped this session's ordering: **a `test:ci` run while a dev stack is live produces
  phantom failures** (5 extras, 3 of which vanished on a clean re-run with no code change).
- `packages/noodl-core-ui/src/components/code-editor/{JavaScriptEditor.tsx,codemirror-theme.ts}`
  are **still theirs, still uncommitted** — inherited for a third session, untouched again.
- `dev-docs/tasks/phase-59-logic-seam/`, `phase-60-values-and-signals/`,
  `phase-61-the-editor-teaches/` — untracked, not mine, **left alone**.
- Every commit pathspec-scoped. No `git add -A`, no stash.

## ⚠️ The finding worth more than the task

> **B8 — the panel stated the per-turn cost, and the ellipsis ate the number.**

BLD-007's whole point is that a user opting a doc into `inject: always` is agreeing to a real
per-turn cost, so the panel must *state* it. It did — and at the shipped 400px panel width the user
read:

> *"docs/uk-vat.md — sent with every build, about 4…"*

**378px of text in a 290px box**, `text-overflow: ellipsis`. The number the sentence exists to show
is the part that gets cut.

**The cause is the shape this phase keeps producing: a rule that outlived its subject.** F20 made
that toolbar label shrinkable *deliberately and correctly* — back then it **was** a doc path, and a
long one shoved the buttons past the panel's right edge at the 240px floor. BLD-007 then appended the
cost to the same label and left the rule alone. Both decisions were right about the label they were
looking at. That is BLD-004's two defects again (a clock that outlived what it measured; a state
class that outlived its modifier), and it is now three for three this phase.

Fixed by splitting the label — the path keeps the ellipsis, the cost gets its own element. F20's
property was **re-verified rather than assumed**: a long path (`docs/decisions/000-initial-scope.md`)
still ellipsizes and the buttons stay inside the toolbar at every width.

> ⚠️ **The first fix was wrong, and only a sweep found it.**

`flex: none; white-space: nowrap` stopped the cost shrinking — and at any width below the default it
simply *overflowed* a container the toolbar clips, giving a hard cut with **no ellipsis at all**.
Worse than the bug. It passes a spot-check at the default width perfectly.

| label width | 111 | 131 | 151 | 191 | 231 | 271 | 351 |
|---|---|---|---|---|---|---|---|
| **cost visible, fix v1** | ❌ −175px | ❌ −155 | ❌ −135 | ❌ −95 | ❌ −55 | ❌ −15 | ✅ |
| **cost visible, fix v2** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

v2 lets the cost *reflow* (2–4 lines, row 14→56px) instead of merely refusing to shrink. **Sweep the
parameter instead of picking one** — session 7's habit, earning its keep for the third time.

## ⚠️ A substring search over a request is not a leak test

Driving acceptance #3, I moved every user doc out of `docs/` and searched the captured request for
their content. Two hits came back and both were false alarms:

- **`UK VAT`** — my *own harness's* `submit_plan` intent, echoed back into the transcript.
- **`initial-scope`** — a `_Source: docs/decisions/000-initial-scope.md._` citation that the fixture
  author **typed by hand inside CONVENTIONS.md**, which is a seed always-doc still on disk.

Neither was staleness. Had I stopped at the substring count I would have filed "the docs snapshot is
stale" against code that is correct. **A string in a request proves a string is in the request; it
says nothing about where it came from.** Locate the offset and read around it before concluding.

## What the drive measured — BLD-007

| criterion | result |
|---|---|
| **#1** tool list + fetched on a real turn | enum `["ARCHITECTURE.md", "decisions/000-initial-scope.md", "uk-vat.md"]`; advertised as `uk-vat.md — UK VAT rules (relevant to: tax, VAT, pricing, invoices)`; returned **whole** — 1620 chars, last line present, **front matter stripped**; panel showed *"Read project doc uk-vat.md"* |
| **#2** `inject: always` → always-block, cost stated | left the pull enum, entered a `user` message on **every** request incl. the planning turn; cost sentence fixed (**B8**) |
| **#3** no user docs → byte-identical | reverted **exactly** to the pre-BLD-007 one-value form: `enum: ["ARCHITECTURE.md"]`, verbatim architecture-only description, no `extra` field |

⚠️ **An `always` doc lands inside the cached prefix.** On the authoring turn it sits at offset 13411
against a `cacheBoundary` of 15056 — so after the first turn it bills at *cache-read* rate, not full
input rate. The panel's "about N tokens per turn" is true in tokens and pessimistic in money. Nobody
asked for this measurement; it is worth knowing before anyone rewords that sentence.

## What the drive measured — BLD-012, against a real endpoint

Richard supplied a testing key (his words: *"I'll cycle it later"*).

> ⚠️ **The image was chosen so acceptance could not be mistaken for comprehension.** A 1px PNG proves
> only that the shape was not rejected. This sent a **solid blue 16×16 PNG** and asked *"What colour
> is this image?"*

| | |
|---|---|
| model id sent → served | `claude-haiku-4-5` → **`claude-haiku-4-5-20251001`** |
| answer | **"Blue"** · `stopReason: stop` |
| paths exercised | **both `chat` and `chatStream`** (the panel uses the latter) |
| usage | 22 in / 4 out |
| **cost** | **$0.000042** |
| `onActivity` calls | **6** |

Three things fell out beyond BLD-012:

- ✅ **BLD-005's R5 is closed.** Cost had never been checked against a real provider — every dollar
  figure so far was an artefact of a scripted hook returning fixed `usage`. $0.000042 is exactly
  22×$1/MTok + 4×$5/MTok, so the pricing arithmetic is right on real numbers.
- ✅ **BLD-004's heartbeat fired against a real provider** — 6 `onActivity` calls on a four-token
  answer. It had only ever been driven with a scripted hook.
- **The registry ships an id the endpoint accepts** — `claude-haiku-4-5` resolved server-side to a
  real dated model. Worth contrasting with register #5, where `openai-compatible` ids resolve to
  nothing.

⚠️ **Why BLD-012 is still not closed:** **the panel** (no UI produces an image message until BLD-011
ships the chip) and **OpenAI's leg** (stub-only — only Anthropic met a real endpoint).

🔐 **The key was never written to disk.** It was passed as an environment variable to one script and
nothing else. The editor still has **no AI provider configured** (`editorSettings.json` has no `ai*`
keys) — the endpoint check was deliberately run *outside* the editor so no key reached
`editorSettings`, the keychain, or the repo. Nothing needs cleaning up beyond Richard cycling it.

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **92 suites, 1268 tests**, zero failures — identical to session 8 |
| `test:ci` | see the closing commit; run with the dev stack **stopped**, per `37fe2db5` |

The change is CSS plus a render restructure with no new specs, so `test:main` was expected to be flat
and was. No spec pinned the cost sentence — the only grep hit was `tests/index.bundle.js`, a stale
committed build artefact, not a gate.

## Driving this panel — additions to the recipe

Sessions 5–8 hold. Six more:

- ⚠️ **The doc tool is on `AuthoringSession`, not the planning turn.** A drive that wants
  `get_project_doc` has to carry a run all the way into a build operation; the planning turn offers
  only `submit_plan`. Budget for that before writing the hook.
- **Scripting the planning turn is easy** — `submit_plan` is a *tool call* with an `operations`
  array, not an XML template. `{kind:'create', target:'Ui/X', intent:'…'}` is a whole valid plan.
- **`ProjectDocsModel` polls every 2s**, so an external front-matter edit is picked up live with no
  restart. Editing the file *is* a legitimate drive step.
- ⚠️ **HMR applies SCSS to the Docs panel and misses its TSX.** The stylesheet hot-swapped; the
  markup kept the old structure, and switching panels away and back did **not** remount it. A full
  `dev:stop` + `dev:debug` is the only fix — `cdp reload` still lands the `file://` page on
  `chrome-error://` and needs a restart anyway. **Order your source edits so you pay for one restart,
  not two.**
- ⚠️ **`[class*=Foo]` / textContent sweeps match `<style>` elements.** A `document.querySelectorAll('*')`
  filter on `textContent` returned the entire compiled stylesheet as a "hit" — the CSS module's own
  source comments contain the words you are searching for. Exclude `style`/`script`.
- **You may not need to reset a capture.** Assignments like `globalThis.__driveLog=[]` were refused by
  the tool-call classifier mid-drive. Recording the current length and slicing from it is cleaner
  anyway — it keeps the earlier run's evidence instead of destroying it.

## What to do next

1. **BLD-006** — persistence across a restart, plus the switcher. `BuildThread`'s `header` slot is
   still free for it. ⚠️ It also owns **R6**: the user's request renders **twice** in the thread
   (a retired turn carrying only the request, plus the live one) — visible in every screenshot
   again this session, provenance predates these changes.
2. **BLD-008** — ⚠️ `question` is **already** a kind on `AuthoringActivity` with its treatment built
   and its collapse rule decided. **Add the author, not a fifth opinion about how it should look.**
3. **BLD-010** now owns three debts, one fewer than at session 8: BLD-003's docs route has **never
   been on screen**; BLD-004's **R4** (the Ollama open-weight leg, still inferred — no local
   endpoint) and **R5** (OpenAI-compatible `reasoning_content`, deliberately unwired). **R5 of
   BLD-005 is closed** and can come off the list.
4. **BLD-012's two remaining gaps** — the chip (blocked on BLD-011) and OpenAI against a real
   endpoint. The second is now a ten-minute job if a key is available: the harness pattern is in this
   handover, and the same script takes a `model` argument.

## Fixture and cleanup

`ai-test` gained **`docs/uk-vat.md`** — it is the subject of BLD-007's acceptance criteria and is
**deliberately left in place**, currently declaring `inject: always` (flipped from `pull` mid-drive to
measure criterion #2). Its `project.json` still holds the sibling's Slider/Expression graph from
session 7 — **untouched, do not "clean" it**. Both user docs were moved out and **restored** for
criterion #3; `git status` in the fixture repo was checked afterwards and shows exactly what it showed
before, plus the new file.

The temporary `AiClient` drive seam is reverted (`grep __driveAiClient` returns 0) and the temporary
endpoint script is deleted. The dev stack is stopped. Screenshots and the `test:ci` log are in the
session scratchpad, not the repo. No worktree created.
