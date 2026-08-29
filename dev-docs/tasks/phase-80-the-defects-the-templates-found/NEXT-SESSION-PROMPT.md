# Phase 80 — next session

## State: DEF-001, 002, 003, 004, 006, 016 closed. **DEF-006 is fully closed, (c) included.**

**s8 (2026-08-29)** took DEF-006 (c). If you are picking up DEF-006 for any reason, read its
**§7**, not §6.4 — §6.4 is the sourcing survey and **one of its judgements is superseded**, with a
banner saying so at its head.

| commit | what |
|---|---|
| `3a112837` | **DEF-006 (c)** — six compositions, the token the survey recommended that fails AA, and the gate that would have passed it |

Gates at close: `typecheck:editor`, `typecheck:editor-tests`, `catalog:check`,
`catalog:merge:check`, `catalog:groups:check`, `docs:nodes:check` **clean** ·
`styleVocabularyPorts` **13/13** · `design-token-contrast` **13/13** · `noodl-mcp` **956 passed**
· `catalog:examples` **60/62 — red, unchanged, still somebody's** · ✅ **`test:ci` 2889 specs,
4 failures, all four `AIX-006 style vocabulary` by name — the floor**, seed 74947.

---

## 🔴 The finding, in one paragraph

**The task's one judgement was a reading, driving it inverted the decision, and the gate that
exists to catch exactly that would have passed it.** §6.4 said to source the `fieldError`
composition from `--destructive` rather than the raw `--red-700`, since presets move the semantic
token and not the palette one — true — *"so the contrast floor survives the move"*. Measured as
14px text on the `--surface` a form card actually sits on, `--destructive` is **4.38:1 under
Playful and 4.49:1 under Soft**, both under AA's 4.50, where `--red-700` never drops below 6.03.
It is a **fill** colour, sized for white text on top of it. The survey had measured against
**white**, and against the **default palette only** — which its own next line explicitly warned
against. Worse: `design-token-contrast.test.ts` grades text with no declared background as sitting
on `--background`, where the proposed token clears in **all six** palettes — so the gate would have
reported nothing. It now grades both implicit grounds.

## What to do next

**DEF-017 C1**, or **DEF-007** — read its **§1.1**, which changes that task's premise and makes it
the owner of P77's D11.

Also open: **DEF-008**, **DEF-009**, **DEF-014**, **DEF-015**, and the four carried from phase 76
by reference (**DEF-010/011/012/013** — three say their fix needs a corpus sweep, and that sweep is
shared work to be done **once**). **DEF-005** is 🔒 on a Richard ruling.

🔴 **New and unowned, registered in `TASKS.md` under *Findings this phase raised that nobody owns*:
there is no semantic token for error TEXT.** `--destructive` is the only semantic red and it is a
fill. That is why `fieldError` ships a raw palette token to stay legible, and why a re-themed app
keeps a brick-red error line while everything else moves. Fixing it means a value in
`DefaultTokens.ts` **and all five presets**, each against the contrast floor — 🧭 **plausibly
Richard's**, on the same grounds his `--primary` ruling was.

🔴 **The standing instruction still pays — five sessions running.** *Find the claim in your task
that is a reading rather than a measurement, and drive that one first.* s4 deleted two of three
rows, s5 found a defect the file did not contain, s6 found the defect had been fixed the day
before, s7 found the rule was wrong about two of eleven cases, s8 found the recommended fix ships
an accessibility defect.

## 🔴 What this session paid for, that the next one should not re-buy

- 🔴 **A stale measurement does not announce itself by being wrong.** `ui-form-field`'s
  description said `--destructive` measures **3.60:1 and fails AA**. That was *exact* — for
  `#ef4444`, the value it held when the sentence was written on **2026-08-11**. DEF-001 moved
  `--destructive` to `#dc2626` at **09:39 that same morning**, making it 4.62:1 and passing. The
  sentence's **conclusion outlived its evidence**: still right, for a reason it no longer states.
  ✅ **When you cite a number about a token, `git log -S'<value>'` the token first** — ten seconds,
  and it is the difference between quoting a measurement and quoting a fossil.
- 🔴 **Two grounds, not one.** A colour with no declared background does not sit on one thing.
  `--background` is the top of a page; `--surface` is inside every card, panel and form — which is
  where form text lives. Grading only the lighter one is optimistic **exactly where a real app is
  darker**, and the gap (4.70 vs 4.38 under Playful) is the whole defect. ✅ Widened, **free**:
  55 → 86 pairs, nothing reddened. ⚠️ Still not every ground — `--surface-raised` and runtime fills
  are outside it, and the test says so.
- ✅ **A widened gate needs an arm that only the widening can pass.** Arm (e) plants a regression
  invisible on `--background`, and asserts it is caught **only** on `--surface` and **only** in
  `playful` and `soft`. 🔴 Narrowing `groundsOf` back reddens **arm (e) and nothing else** — the
  other twelve stay green, which is precisely the hole that existed. Without that arm the widening
  would have been silently revertible.
- ✅ **Sabotage told me the catalog agreed with the recipe's prose.** Reverting `textField` to the
  shipped `sizeMode: 'contentSize'` reddens the AC2 gate with the catalog's own condition —
  `width is off under "sizeMode = explicit OR sizeMode = contentHeight"`. The recipe's measured
  196px-at-every-viewport trap, confirmed **from the port declaration** rather than from the
  sentence describing it.

## Traps carried

- ✅ **`test:ci` ran after the peer announced teardown, and it is the floor**: 2889 specs, 4
  failures, all four `AIX-006 style vocabulary` **by name**, seed **74947**. `test-results.json`
  was deleted first and the readout is 19s old, so a stale file could not have passed as this run.
  ⚠️ **The runner printed `HEAD b25bc914` — a P18 peer's docs commit made 18 seconds earlier.**
  `gitHead` is the checkout at read time, never authorship; `3a112837` was verified an ancestor
  separately.
  🔴 **The peer offered their own floor reading (seed 07472) and it was not adopted.** Theirs was
  taken at 16:28, after this commit landed at 16:08, so it genuinely did compile this change — and
  it still is not evidence about it. A relayed measurement is about the run that produced it; the
  point of running it again was the **independent seed**, which is what separates a floor from a
  repeat. ✅ **When a peer hands you a green reading of your own work, run it yourself anyway** —
  it cost 90 seconds.
- ⚠️ **`typecheck:mcp` is red on ONE error, and it is a peer's**: `TOKEN_PRELUDE` in
  `packages/noodl-mcp/tests/tpl001Cloud.ts`, uncommitted, mtime mid-session, mid-refactor.
  `noodl-mcp`'s own suite also carries **2 failures in `tpl001Template.test.ts`** from that peer's
  uncommitted `templates/members-area.security.json`. **Neither is phase 80's.** Re-measure before
  attributing either to anything here.
- 🔴 **`catalog:examples` is still a PR gate (`pr.yml:210`) and still RED at HEAD**, 60/62,
  measured before and after this session: unchanged. `comp-repeater-set-item-object` and
  `fn-aggregate-stats-function`, owner **`NONE`**, ~20 minutes, both diagnostics carry their own
  `suggestion`. **It fails every PR until somebody takes it.**
- ✅ **The peer collision §6.4 warned about was real and was handled by talking.** The peer
  confirmed from `.logs/dev.log` that saving `StyleCompositions.ts` closed their open project
  mid-drive — *"[HMR] Cannot apply update... is not accepted"*. They asked for batched saves, not
  for me to stop. ✅ **Batching the remaining writes (including the `catalog:merge` regeneration of
  `node-catalog-enriched.json`) and sending one "done" message** cost nothing and bought them a
  stable window. ⚠️ Worth knowing: **`catalog:merge` writes into `packages/noodl-types/`, which is
  also HMR-live** — editing a recipe under `docs/` is not the docs-only change it looks like.
