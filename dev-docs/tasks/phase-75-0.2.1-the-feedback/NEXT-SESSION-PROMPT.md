# Next session — phase 75

_Written 2026-08-28 at the end of session 68. **Richard answered all nine open decisions.** This
session captured them and ran out of context before implementing any of them._

## 🟢 START HERE: [RICHARD-RULINGS-2026-08-28.md](RICHARD-RULINGS-2026-08-28.md)

**Nine decisions that had been open — several for ten sessions — are now answered.** Every one is
recorded there with its reasoning, its measured consequences, and the task it unblocks. **Read it
before anything else**; a lot of this phase was waiting on exactly these answers.

⚠️ **Nothing in it is built yet.** The rulings are captured; the work is queued.

## 🔴 I got something wrong, and the correction is the first thing to absorb

I told Richard the production API key had a **three-day deadline** and put it at the top of a
decisions page with a 🔥. He asked why, since he never set one. **He was right to.**

The real facts: Claude Sonnet 5 is on introductory pricing **through 2026-08-31** (verified against
Anthropic's current pricing this session), and the app's default model *is* Sonnet 5 — so the price
rise is real. **But it is not a deadline**: nothing breaks, and getting a key first changes nothing.
The one consequence is that our **cost reporting** goes stale on 1 September unless
`models.ts:227` is updated from `$2/$10` to `$3/$15`.

🔴 **Two unrelated notes got fused into one urgent item** — "we need a production key" (real, open,
no clock) and "intro pricing ends 31 Aug" (real, not an action). A footnote in an old costing note
became a banner three phases later because I relayed a **conclusion** instead of the
**measurement**. ✅ **Re-derive urgency at the point you assert it**, especially when the assertion
is going in front of Richard.

## ⬜ The queue, in the order I'd take it

| # | task | why first |
|---|---|---|
| 1 | **Moderator handle** — `richardosborne14` *or* `richard@digitalbricks.io` | Ten sessions blocked on it. ⚠️ **Read `isModerator` to see which of the two it compares against before writing the file** — the wrong one 404s identically to today |
| 2 | **`tsfixme` reorder** | One failing gate is hiding three others, two of which check colours and icons. Ruling §8 — the reorder is not a judgement call |
| 3 | **Delete button: dim red + a `danger` ring** | Ruling §3. Measured: 4.83/6.57 label, 4.52/4.38 boundary — both clear. Then the same pair across six more stylesheets |
| 4 | **`models.ts:227` price** | One line, on/after 31 Aug |
| 5 | **FIX-026 (a)** — restore a deleted lesson node | Ruling §5, about a day |
| 6 | **FIX-027 14/15/16** — unlock Backend Services from step conditions | Ruling §4 |
| 7 | **Admin-managed channels** | Ruling §2 — a scope change; needs designing before building. ⚠️ The retire path is the hard half |
| 8 | **Border sweep, 35 sites left** | Next family: the six Version control / GitHub sites, five of which are also hover-trap sites |

**Not in this queue and deliberately so:** FIX-027 item 22 (the intake recommender). Ruling §6 gives
a complete spec, but it needs every lesson tagged with a level and a function-style, and **those
tags are content** — so it follows [phase-79](../phase-79-the-syllabus/), it does not lead it.

## 🆕 Two new phases, created this session

- **[phase-78 — the templates](../phase-78-the-templates/)**. 🔴 Its first task is finding **"the
  list we made"**: it is **not in this repository** (searched P70/71/76/77, the P75 task files and
  the market research). The only set referenced is *"Richard's eight 0.2.1 templates"*, cited in
  P75 `TASKS.md` and **never enumerated**. **Ask him, or re-make it with him.**
- **[phase-79 — the syllabus](../phase-79-the-syllabus/)**. Its first task is reading the 15 lesson
  titles **off production** — they are not in this checkout.

**P77 continues unchanged** on the site-builder template; the *other* site-builder templates are
phase-78's T4 and must not start while P77 is live.

## ✅ What session 68 actually finished

**The property editor's Style section border sweep** — 6 declarations across 4 stylesheets, a
35-row spec, and after Richard lifted the freeze mid-session, **the whole owed queue was paid**:

| gate | result |
|---|---|
| `jest tests-unit/border-sweep/` | ✅ 8 suites / **271 passed** / exit 0 (271 − 236 = 35, exactly this session's rows) |
| **12 mutants + 2 controls** | ✅ **9 killed, 5 survived exactly as predicted** |
| editor `test:main` | 375 suites / 6253 passed / 1 failed — **the red was a peer's SBR-003**, fixed by them at 16:47 |
| `noodl-core-ui` | ✅ 28 suites / 527 passed |
| `tokens:css` | ✅ exit 0 |
| `typecheck:core-ui` | 🔴 44 errors, **all in `noodl-editor`, zero in core-ui** — pre-existing, unbuilt types, files last touched 08-06 |

Full write-up: [BORDER-CONTROL-SWEEP.md](BORDER-CONTROL-SWEEP.md). Sweep findings worth carrying:
a divider tone can hide inside a **`color-mix`** where the documented trap-grep cannot see it (and
`tokenOf`, used by all six earlier sweep specs, had the same hole); the **ground can be in another
package**; an **unplaced component has no ground**, so "it is not placed" became a row.

🔴 **`tsc -p packages/noodl-editor --noEmit` includes ZERO files under `tests-unit/`** — the previous
handover told the next session to run it first *to protect the spec*, and it cannot see the spec at
all. **The jest run is the typecheck.** A gate can be right about the risk and wrong about the
population.

## 🧭 Still Richard's

- **Production `ANTHROPIC_API_KEY`** — open, no deadline (above). Plus: are AI features on by
  default, or behind a setting?
- **Content** — the template list, the syllabus prose, the tutorial briefs. Phases 78 and 79 exist
  for the first two; [TUTORIAL-WORKSHOP.md](TUTORIAL-WORKSHOP.md) has a fill-in brief for the third.

## Standing facts

- ✅ **The CPU/testing freeze is over** (Richard, session 68). A peer confirmed teardown of their
  editor stack at the end of this session — **checkout free**.
- 🔴 **Docker is not running**; community suite runs against a scratch DB on local **5432**
  (`DATABASE_URL="postgres://richardosborne@localhost:5432/nodegx_c5_s59"`). Repo default is 55432.
- ⚠️ **Not mine, uncommitted, leave them**: the P77 SBR-002/003 work, the `nodegx-export` P18 work,
  the P70/P71 task files, the P72/P68 doc edits, and `AskAboutNodeDialog.module.scss`.
- ✅ Every file borrowed for a mutant was restored and **verified md5-exact**.
