# Next-session prompt — phase 57, after session 9

Paste everything below into a fresh session.

---

You are picking up **phase 57 (BLD — the Build panel as a conversation)** on `cline-dev` in
`/Users/richardosborne/vscode_projects/OpenNoodl`.

Read `dev-docs/tasks/phase-57-build-conversation/HANDOVER-SESSION-9.md` first, then `TASKS.md`.

## 🔴 Do these checks before anything else

1. **`git log` *and* `git status` — sessions 7, 8 and 9 all ran beside a sibling.** Two files under
   `packages/noodl-core-ui/src/components/code-editor/` have been modified and uncommitted for three
   consecutive sessions and **are not yours** — leave them. Three untracked `dev-docs/tasks/phase-59…61`
   directories are likewise not yours. **Pathspec-scope every commit; never `git add -A`; never
   `git stash`.** ⚠️ A clean `git status` can also mean *a sibling already committed your work* —
   check `git log` before concluding anything.
2. **`ps aux | grep "[e]lectron/dist"` before you launch or stop anything.** `npm run dev:stop` reaps
   by *checkout* and a sibling shares this one. If something is running that you did not start, **ask
   Richard before stopping it** — the editor is a queue, not a resource to seize.
3. ⚠️ **Never run `test:ci` with a dev stack up.** Commit `37fe2db5` proves it manufactures phantom
   failures: 11 failures with the stack live, **`Jasmine: 2582 specs, 6 failures`** on a clean re-run
   with no code change. Stop the stack, redirect to a file, `grep -E "^Jasmine:"` — never `tail` it,
   the `FAILED:` list prints *after* the verdict line.
4. **`ai-test` holds two things that look like litter and are not.** Its `project.json` carries a
   sibling's Slider/Expression graph; `docs/uk-vat.md` is BLD-007's acceptance fixture (currently
   `inject: always`). **Do not clean either.**

## Where the phase is

**8 of 16 built, 7 driven.** BLD-001 ✅, BLD-002 ✅, BLD-003 ✅, BLD-004 ✅, BLD-005 ✅, **BLD-007 ✅
(driven and closed session 9 — D9 closed)**, BLD-012 🟡.

**BLD-012 is the one to read carefully before touching.** Its image block *has* now reached a real
Anthropic endpoint on both `chat` and `chatStream` — that claim is closed. Two different gaps remain:
**the panel** (no UI produces an image message until BLD-011 ships the chip) and **OpenAI's leg**
(stub-only). Do not re-verify the Anthropic one; do not assume the other two are done.

## What to work on

Unless Richard says otherwise:

1. **BLD-006** — threads persist across accept, navigation and restart, plus the switcher.
   `BuildThread`'s `header` slot was deliberately left free for it (BLD-005 took a *separate*
   `runHeader` slot so the two would not fight over one node). ⚠️ It also owns **R6**: the user's
   request renders **twice** in the thread — a retired turn carrying only the request, plus the live
   one. Visible in every screenshot since session 8; it is a thread-composition question, not a
   regression.
2. **BLD-008** — ⚠️ `question` is **already** a kind on `AuthoringActivity`, with its treatment built
   and its collapse rule decided (a question can never be absorbed into a run). **Add the author, not
   a fifth opinion about how it should look.**
3. **BLD-010** owns three debts (one fewer than last session): BLD-003's docs route has **never been
   on screen**, and BLD-004's **R4** (Ollama open-weight leg, inferred not driven) and **R5**
   (OpenAI-compatible `reasoning_content`, deliberately unwired). ✅ **BLD-005's R5 is closed** —
   cost is now verified against a real provider and the arithmetic is exact.

## The three traps sessions 8 and 9 found, all one shape

> **A rule that was right about its old subject.**

Three for three this phase: a clock that outlived what it measured (BLD-004), a state class that
outlived its modifier (BLD-004), and an ellipsis that outlived the path it was written for
(BLD-007 **B8** — the panel stated the per-turn cost and truncated it to *"about 4…"*). When you
append to something, re-read the rules already governing it. **A correct decision plus a correct
decision is not a correct result.**

> **A spot-check at the default value proves nothing about the range.**

B8's *first* fix was perfect at the shipped 400px panel and hard-clipped the cost with no ellipsis at
every narrower width — strictly worse than the bug. Found by sweeping the panel's whole width range.
Same lesson as session 7's opacity table. **Sweep the parameter; it costs the same as one check and
answers a different question.**

> **A substring in a request is not evidence of a leak.**

Searching a captured request for removed docs returned two hits, both false: the harness's own text,
and a citation a human had typed inside a different doc. **Locate the offset and read around it.**

## Driving this panel

The recipe is in handovers 5–9. The four from session 9 that cost real time:

- **The doc tool lives on `AuthoringSession`, not the planning turn** — a doc drive must carry a run
  into a real build operation. The planning turn offers only `submit_plan`, which is a plain tool call
  with an `operations` array (no XML), so scripting it is two lines.
- ⚠️ **HMR applies SCSS to the Docs panel and misses its TSX**, and switching panels does not remount
  it. Only a full restart works, and `cdp reload` is still forbidden (it lands the `file://` page on
  `chrome-error://`). **Order your source edits to pay for one restart, not two.**
- ⚠️ **`textContent` sweeps across `*` match `<style>` elements** — a CSS module's own source comments
  contain the words you are searching for. Exclude `style`/`script`.
- **You may not need to reset a capture.** Record the current length and slice from it; it keeps the
  previous run's evidence instead of destroying it, and avoids the global assignment the tool-call
  classifier refuses.

## If a real provider is needed

The editor has **no AI provider configured**, deliberately — session 9 ran its endpoint check
*outside* the editor so no key reached `editorSettings`, the keychain or the repo. Richard supplied a
testing key on request and said he would cycle it. The harness is one ts-node script driving the real
`AnthropicProvider` with no injected client; the pattern is in HANDOVER-SESSION-9.md and it takes a
model id as an argument, so OpenAI's leg is a short job.

⚠️ **Make the test distinguish acceptance from comprehension.** A 1px PNG proves only that a request
shape was not rejected. Session 9 sent a solid blue square and asked what colour it was.
