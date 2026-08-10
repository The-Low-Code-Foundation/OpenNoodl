# Phase 57 — handover after session 14 (2026-08-10)

**What ran:** **BLD-011 built and driven.** Track B has its frame: the composer is a context builder,
a turn carries references, and each remaining Track B task now adds a `kind` plus a resolver and
touches nothing else. Phase 57 is **12 of 17 built, 10 driven**.

The finding worth keeping is not the cache-safety work, which behaved exactly as designed. It is
that **two of the three defects the drive found broke nothing** — one of them rendered perfectly,
threw nothing, and passed typecheck, 103 jest suites and every contrast measurement, while making
the task's own primary control unusable.

## 🔴 Before you plan anything

> **The editor has a real, verified Anthropic provider. A drive costs Richard money.**

**This session billed `$0.029799`** for one call, and Richard approved one billed send in advance:

```
[ai] plan: anthropic/claude-sonnet-5 — 2 in (+0 cached, 9238 written) / 670 out, $0.029799
```

⚠️ **Ask before the next one, and scope it.** The request was deliberately phrased to fan out into a
**plan** rather than a component build, because the plan route stops at the proposal and waits — a
component route would have run a whole authoring session on top of the call that was authorised.

## ⚠️ The findings worth more than the task

### 1. A control that works and cannot be read

The picker's list opened **113.8px wide** — the width of the "Add context" button. `.List` is
`left: 0; right: 0`, which resolves against `.Picker`, and `.Picker` sat inside an `HStack` that
shrink-wraps to its child. So the one control whose entire job is *letting you find a component by
name* rendered `Library/Layout/Breadcrumbs` as `Library/L…`.

Nothing threw. Nothing looked broken in a screenshot of the closed composer. It passed
`typecheck:editor`, `typecheck:editor-tests`, 103 jest suites and every contrast ratio I had already
measured on it.

> **A green check cannot express "this is legible but useless."** The only thing that caught it was
> measuring the element's width and asking whether a real label fits.

This is the second time this phase a correct mechanism has been graded in the wrong state — BLD-004's
1.16:1 collision painted only in a frame nobody had screenshotted. The generalisation is the same
both times: **decide what state the defect would live in, then go and measure that state.**

### 2. The accent trap, third sighting, and the fix was to stop using the accent

The "Add context" button measured **4.33:1 in light** — `Ghost`'s accent label. That is not a new
number: it is C7's row from BLD-002, hardened by BLD-008's R12, now caught for a third time on a
third control.

**It was fixed by switching to `MutedOnLowBg` (6.66 dark / 6.54 light), not by a local override.**
Five call-site overrides of one token defect is five copies that can disagree, and R12's own note
says this needs a full-surface pass. The design-system row is deliberately still open.

⚠️ It was also the better control on the merits, which is the part worth carrying: attaching context
is *secondary* to Send, and an accent-bordered button beside the composer's CTA was competing with
the thing it supports. **The contrast failure was a symptom of an over-weighted control**, not just a
colour.

### 3. Aligning a container is not aligning its contents

The record row under a turn's request is `justify-content: flex-end` — but that positions the *row*,
which is a full-width flex item, so the chips inside packed left and sat under a right-aligned bubble
with their right edges **154px short of it**, reading as the agent's reply rather than as part of the
user's message. Fixed with `.Row.is-record`, and **the consequence measured rather than the
mechanism**: chip right-edges moved from 263 / 274 to 422 / 422.

### 4. ⚠️ The billed call proved transport, not comprehension

The attached `docs/CONVENTIONS.md` carried a deliberately unmissable naming rule ("every component
must be prefixed `Zeta`"), placed early so it would survive the 12k cap. The model never reached it:
asked for a footer, it correctly **reused** the project's existing `/Library/Layout/Footer` instead
of creating anything, so the rule had nothing to apply to.

Good behaviour from the model, and a wasted probe. **A comprehension test has to be answerable by the
route the request will actually take.** BLD-012 earned this lesson with a blue square; half of it was
relearned here at a cost of three cents.

What *is* established: the block went on the wire (`9238` written against a turn that carries ~5k
without it, `+0 cached`), and the assembly is pinned byte-exactly by spec.

## Rule 6, and why it is a spec rather than a drive

**This is the reason the task exists and the one claim a live drive is worse at proving.** If a
reference ever lands above `cacheBoundary`, every send carrying one silently re-bills the whole
AIX-007 prefix — and the only symptom is the invoice. Nothing on screen changes.

So `tests-unit/bld-011/cacheSafety.test.ts` asserts the **offset** as well as the bytes, on the
create turn and the update turn: a prefix that is the same length by luck is not the same prefix.
⚠️ **It was inverted before it was trusted** — moving the block into `referenceBlocks` turns it red
on the offset, not merely on content. R13 of BLD-008 is why that intervention is now routine.

## What was measured

| | result |
|---|---|
| references attached | **4, of 2 kinds** — see below |
| cap fired | `docs/CONVENTIONS.md` cut to **11,904 of 23,544**, stated in the chip and in the prompt |
| meter, 3 refs | `3 attachments · 15k characters` / `15k of it is pinned — sent again, uncached, on every later turn.` |
| unpinning the big doc | total held at **15k**, pinned fell to **2.9k** — two numbers that mean different things |
| removing a chip | row 3 → 2, pinned 2.9k → 2.6k |
| horizontal overflow, **248 → 607px** | **0** at every width — row, meter, chips outside the composer, and `document.body` |
| contrast, dark / light | label **6.66 / 6.54** · size **6.66 / 6.54** · "cut" **7.96 / 4.74** · meter **7.70 / 7.10** · toggle **6.66 / 6.54** |
| retention, on disk | `.nodegx/plan/session.json` = **1,458 bytes**, no `references` key, no `ATTACHED CONTEXT`, no document body |

## What was NOT driven — stated, not implied

- ⚠️ **Four references of _two_ kinds, not three.** There is nothing else to attach: the remaining
  `ReferenceKind` members belong to BLD-013/014/015/016. Inventing a kind to satisfy a count would be
  the fake pass this phase keeps paying for.
- ⚠️ **Staleness has never been on screen.** `isStale`, `staleAge`, the `[STALE — …]` prompt sentence
  and the chip's `is-stale` border are built and specced; nothing produces a `capture` until BLD-014.
  Same shape as BLD-008's R15.
- ⚠️ **The thread `.jsonl` was not driven.** A turn reaches the file only once the *next* request
  retires it, so driving it costs a second billed call to prove a file format. The round trip is
  pinned in `threadFile.test.ts` instead, and the negative half — that no bytes are persisted — was
  checked on disk.

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **103 suites, 1410 tests**, zero failures |
| `test:ci` | **`Jasmine: 2596 specs, 6 failures (failed). Randomized with seed 27603.`** — the documented baseline, all inherited |

✅ **The `test:ci` baseline is now confirmed at a third seed, and by name.** Sessions 12 and 13
measured 6 at seeds **39386** and **30232**; this run measured the same 6 at **27603**:

```
AI model registry treats openai-compatible as sharing the OpenAI catalogue
AI model registry has exactly one default per provider that owns models
AIX-006 style vocabulary a style suggestion never downgrades a valid authoring…
AIX-006 style vocabulary offers one advisory style pass on a valid-but-raw candidate…
AIX-006 style vocabulary AIB-009 F11: a provider that stalls during the style pass…
AIX-006 style vocabulary with guidance off, a raw candidate is accepted immediately…
```

The two real bugs behind them are unchanged: the registry expects `gpt-4o`/`gpt-4o-mini` where the
catalogue now has `gpt-4.1`, and AIX-006's style pass is not emitting `STYLE LINT`. **BEN-001 ×3 did
not appear at any of the three seeds.** ⚠️ **The dev stack was stopped before this ran** — a live one
makes `test:ci` invent failures.

✅ **And a correction to the recorded baseline.** Session 13's handover records `test:main` at **100
suites / 1383 tests**. Measured on this tree with the new specs held back it is **100 suites / 1386**,
so the +24 from `tests-unit/bld-011/` lands at 1410 exactly. The 1383 was stale; **1386 is the
number to diff against.**

## Concurrency

⚠️ The sibling session's last write was **22:26 on 2026-08-09**, ~11 hours before this session
started. `dev-docs/tasks/phase-17-noodl-learn/` and
`packages/noodl-core-ui/src/components/code-editor/{JavaScriptEditor.tsx, codemirror-theme.ts}`
are untouched and now inherited for an **eighth** session — leave them.

Every commit here was pathspec-scoped. No `git add -A`, no `git stash`.

⚠️ **There is a pre-existing stash on this branch** (`stash@{0}: WIP on cline-dev: ff74bcc9 …
phase-21`) that belongs to neither this session nor the sibling. It was not touched and is worth
someone identifying before it rots.

⚠️ **The QA fixture was modified and restored.** Two `docs/` files were created to drive the `doc`
resolver and removed afterwards, along with the `.nodegx/plan/session.json` the drive produced;
`project.json` was never touched (mtime unchanged, and the plan was never applied). **The fixture's
"no `docs/`" state is a property BLD-008's criterion 1 depends on** — to re-drive the doc kind,
recreate `docs/BRIEF.md` plus a `docs/CONVENTIONS.md` larger than 12,000 characters.

## What to do next

1. **BLD-013 / 014 / 015 / 016 are now cheap in the way the task promised.** Each adds a
   `ReferenceKind` member, a resolver in `authoring/referenceSources.ts`, and a glyph in
   `KIND_ICONS` — which is a `Record<ReferenceKind, …>`, so a kind added without one does not
   compile. **BLD-014 additionally closes R4** (staleness has never been on screen) and is the one
   the dependency map already prioritises.
2. **BLD-010's list is now seven**: BLD-004's R4 (Ollama) and R5 (`reasoning_content`); BLD-006's
   R12; BLD-017's F2 and F4; BLD-008's drafting turns + restart-resume; and **BLD-011's R9** — a
   comprehension probe that the request's actual route can answer.
3. **The design-system row is still four**, and R3 above is a third measurement of the same `Ghost`
   4.33. Three tasks have now worked around one token. It is worth fixing as one change.
4. **Four tasks remain unbuilt**: BLD-009, 013, 014, 015, 016 — and BLD-012 is still 🟡 on OpenAI's
   leg and the panel chip, which BLD-011's chip row does not close (that one is about a *message*
   carrying an image, not a composer carrying a reference).
