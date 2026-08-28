# Phase 79 — next session

**Written 2026-08-28, end of session 1.** Read [README](README.md) and
[RICHARD-RULINGS-2026-08-28.md](RICHARD-RULINGS-2026-08-28.md) first; this file is the working
state, not the phase.

---

## 1. Where this actually stands

**T0 is closed.** The phase opened believing the syllabus had to be scraped off production. It is a
checked-in file:

> `src/lib/curriculum.json` in **`~/vscode_projects/nodegx-community`** — a *separate checkout*.

🔴 **It is not fifteen tutorials.** A **12-lesson spine that builds one app (a virtual creature)**,
plus *Data & backends* (2) and *Custom nodes* (1). ~9¼ hours. Every spine lesson `needs` the one
before it and they **share one project**.

**Richard ruled all three open questions** (R1/R2/R3 in the rulings file). **SYL-001 slice A is
built, gated and committed.** **SYL-002 is written and deliberately blocked.**

## 2. 🔴 The one thing everything else waits on

**Richard's brief for lesson 1, `your-creature-on-screen`.** No amount of engineering substitutes
for it — the phase's own standing fact is that the prose is his. The form is in
[TUTORIAL-WORKSHOP.md](../phase-75-0.2.1-the-feedback/TUTORIAL-WORKSHOP.md):

```
WHO IT'S FOR:
WHAT THEY'LL HAVE BUILT BY THE END:
THE 3-6 THINGS THEY MUST UNDERSTAND:
WHERE YOU'VE SEEN PEOPLE GET STUCK:
ANYTHING IT SHOULD DELIBERATELY NOT COVER:
```

⚠️ **Do not start building lesson 1's app before this arrives.** R1 committed the series to the
creature, but not to any particular first screen.

## 3. What is ready and needs no more thought

### The `detail` field is live — author into it from lesson 1

`body` says what to do; `detail` says where the button is, as a disclosure open by default.
Documented in [LESSON-FORMAT.md §4a](../phase-17-noodl-learn/LESSON-FORMAT.md) and in `noodl-mcp`'s
authoring brief. 🔴 **This is why the field was built first**: lesson 1 is the most beginner-facing
lesson in the curriculum, and splitting one `body` later is a re-cut of Richard's words.

### The measurements — do not re-derive them

| gate | reading |
|---|---|
| `test:ci` | **2875 specs, 4 failures @ seed 22416, 71s** — all four **AIX-006 style vocabulary**, the recorded floor, **by name** |
| the 12 new specs | suite **2863 → 2875 = +12**. They ran. |
| `test:main` | 375 suites / 6254 tests / 0 failures, exit 0 |
| `typecheck:editor-tests`, `typecheck:mcp` | exit 0 |
| `lessons:check` | exit 0, `log-a-thing` clean |

⚠️ **`typecheck:editor` does NOT cover `packages/noodl-editor/tests/`.** `typecheck:editor-tests`
is the gate that grades a spec there, and `tests/` is the **Electron/jasmine** suite (`test:ci`) —
it does **not** use jest matchers. `toHaveLength` and `toContainEqual` do not exist there; use
`.length).toBe(n)`.

## 4. The order to take it

1. **Lesson 1**, when the brief lands. Build the app, draft steps into `body` + `detail`, hand the
   prose back to Richard.
2. **R2's curriculum edit** — the responsive lesson, `it-breaks-on-a-phone`, at spine position 2.
   ⬜ **Richard has not written its `description` yet**; a draft is in the rulings file. ⚠️ It is
   **two edits**: the new entry, and `poke-it`'s `needs` moving onto it. Spine 12 → 13.
3. **Lesson 2.**
4. **[SYL-002](SYL-002-THE-CHAIN-THAT-CANNOT-DRIFT.md)**, the moment two lessons exist — not
   before, and not after lesson 12.
5. **SYL-001 slice B** whenever convenient. Blocks nothing.

## 5. Traps carried out of this session

- 🔴 **A field is not shipped until something reads it.** This format contains a live example:
  `suggestedNodes` → `data-suggested-nodes` → `LessonModel.getCurrentSuggestedNodes`, **no callers**,
  and the MCP brief has to warn models off it. SYL-001 ships a native `<details>` for exactly this
  reason — no runner, no preference, works the day it lands.
- 🔴 **The verifier and the sink are a PAIR.** `safeLessonUrl` drops an unsafe scheme; the verifier
  *tells the author*. A field added to one half has half the protection, and the half that goes
  missing is the one nobody notices — a link that silently stopped working.
- 🔴 **`log-a-thing` does not fit the spine.** It is clean and shipped, but it is a log app teaching
  the Visual-Function/async rule; the spine's data lesson is a snack cupboard. It is a standalone
  **article**, not spine lesson 8. Do not retrofit it.
- ⚠️ **The Markdown link grammar truncates a URL at the first `)`.** `javascript:alert(1)` reads as
  `javascript:alert(1`. A scheme fixture with parens grades the link parser, not the refusal.
- ⚠️ **`experience` is answered on the platform, rendered by the editor, and nothing crosses that
  gap.** Do not close it by shipping the answer inside a bundle — D17 requires a lesson stay
  installable from a local directory with no origin.
- ⚠️ **`timeout` does not exist on macOS.** `timeout 900 npm run …` exits **127**, which reads
  exactly like a failing suite.
