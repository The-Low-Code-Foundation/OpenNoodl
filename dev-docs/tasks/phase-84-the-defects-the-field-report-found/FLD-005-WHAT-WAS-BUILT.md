# FLD-005 — what was built

🟢 **BUILT 2026-09-11 (session 15), 5 of 5 ACs, [#35](https://github.com/The-Low-Code-Foundation/NodeGX/issues/35)
replied and CLOSED.** Two commits: `fed588edf` (the diagnostic, the drive, the corpus calibration)
and `3ab87897e` (the thirteen recipes, the vocabulary gate, the budget reading).

---

## 1. 🔴 Four of the task's own claims were wrong, and the title is one of them

Read this before trusting anything else in the task file. Every one of the four would have shipped
a different, worse fix.

| # | the claim | what the measurement says |
|---|---|---|
| **(i)** | *"a column of Groups **multiplies out**"* — the title, and the issue's | It **shares**. `layout.ts` sets `flex-shrink: 1` on the **same branch** that sets `flex-grow`, so siblings split the parent instead of overflowing it. The page never gets taller. |
| **(ii)** | *"whether five siblings multiply or share depends on … **`bodyScroll`**"* (§2) | It does not. Every arm was rendered in **both** scroll states and the two readings are **byte-identical**. The discriminator is whether an ancestor holds a **definite** height. |
| **(iii)** | *"**nine** recipes set `width` and never `sizeMode`"* (§2, §3) | **Thirteen.** `emptyState`, `heroGround`, `glassPanel` and `featureItem` are in the population and the task file names none of them. |
| **(iv)** | *"a recipe edit is a data edit that **reaches every project** using that recipe"* (§5) | It reaches **none**. `STYLE_COMPOSITIONS` has exactly one caller — `StyleVocabulary.ts`, building the `get_style_vocabulary` response. No apply path, no generated artefact, no template built from it. |

**(iv) is the one that changes an acceptance criterion.** AC4 asks to re-render the template corpus
and assert no page height moves except where the recipes were wrong. **That control cannot be run
on the recipes**, because no rendered page can move: every project on disk carries its own parameter
bag and nothing re-reads the composition. What *does* reach the corpus is the **diagnostic**, so
AC4's presence control was run against that instead — §5 below. The reach was established by
enumeration, not by argument.

---

## 2. AC1 — the before, and the number we could not reproduce

`packages/noodl-mcp/tests/fld005ColumnMultipliesOut.test.ts`, real Chrome at 1280×900, six arms,
each rendered in **both** `bodyScroll` states. 10 arms green.

**The issue's own smallest graph does not reproduce.** A column `Group` holding five row `Group`s,
no `sizeMode` anywhere:

| arm | rows | page height |
|---|---|---|
| `/d` — the reporter's graph, verbatim | **18, 18, 18, 18, 18** | 900 (the viewport) |
| `/c` — the control, `contentHeight` on all six | 18, 18, 18, 18, 18 | 900 |

The two arms are **identical**. But the mechanism is exactly as reported — every un-`sizeMode`d
Group carries, in its inline style:

```
height: 100%; flex-grow: 100; flex-shrink: 1;
```

🔴 **The third declaration is the whole correction.** `flex-shrink: 1` is set by the same branch of
`layout.ts` that sets `flex-grow`, so the children share rather than overflow — and with no definite
height anywhere in the chain there is no free space to share at all, so every row lands at its
content height and nothing goes wrong.

**What does go wrong**, arm `/e` — the same five rows carrying one, two, three, four and five lines,
under a parent with a definite height:

| parent | the five rows |
|---|---|
| 800px, `sizeMode: 'explicit'` | **160, 160, 160, 160, 160** |

One line and five lines, the same number, and none of them the content's height.

**And the consequence**, arm `/h` — the same five as `card` (which ships `clip: true`) in a 300px
parent: 60px each, and the ten-line card's **last six lines start below its bottom edge**. Not
scrolled, not overflowed — gone, with zero validation errors. That is the sentence the diagnostic is
written against, because a page four times too tall is something you see and six missing lines is
not.

**Arm `/g` is register V17**, re-driven: an un-`sizeMode`d `shell` inside `imageGround`'s 520px band
renders **520px** — the whole band — with the headline's top equal to the band's top. The control,
with the `contentHeight` the recipe now ships: shell **18px**, headline at the bottom, which is what
`justifyContent: 'flex-end'` was asking for all along.

---

## 3. AC2 — the thirteen recipes, and the gate that stops the fourteenth

All thirteen now carry `sizeMode: 'contentHeight'`: `band`, `bandSurface`, `shell`, `sectionHead`,
`card`, `raised`, `ruled`, `cardBody`, `emptyState`, `statTile`, `heroGround`, `glassPanel`,
`featureItem`.

`styleVocabularyPorts.test.ts` asserts every composition setting a `width` also sets a `sizeMode`
**the port actually defines**, with a denominator arm beside it (≥13 width-setters) so the gate
cannot pass by measuring nothing. **Deliberately no exemption list**: a composition that wants to
fill its parent says `explicit`, which is what `imageGround` and `cardImage` already do — they pass
by setting the port, not by being excused from the rule. Armed: removing `card`'s line reddens both
the gate and its denominator.

`imageGround`'s comment said *"the default `shell` above carries no `sizeMode`"*, which the fix made
false. Corrected in place with arm `/g`'s re-measurement beside it, rather than deleted.

**The wire budget, measured before and after** (V24's lesson — a change to `STYLE_COMPOSITIONS` is a
change to an MCP response billed on every turn, in a package its author may never run):

| | prompt | full |
|---|---|---|
| before | 4,032 | 13,869 |
| after | **4,110** | **13,989** |
| ceiling | 4,400 | 14,400 |

**No ceiling raise.** The reading is now printed on every run rather than only asserted, because the
trend is the part that spec's own comment says to watch.

---

## 4. AC3 — `column-children-split-a-fixed-height`

A **warning**, reported **once from the parent**, because the definite height is the parent's fact
and the repair is a decision about the column. Not in `AUTHORED_BLOCKING_WARNINGS` on first ship,
per this file's standing convention, and a spec arm pins the non-membership so a later edit cannot
promote it silently.

**The firing condition is not the one the task specified**, and the difference is the whole rule:

- the task says *"a Group in a column parent, with siblings, with no `sizeMode` and no `height`"* —
  that population is **4,792 column Groups** in the corpus, and in almost all of them **nothing is
  wrong**, measured;
- the rule requires the **parent's height to be definite** (a `sizeMode` that assigns `height`, plus
  a non-percentage `height`). That is the only circumstance in which `flexGrow` has free space to
  distribute, which is the only circumstance in which the defect exists.

🔴 **It also takes only the port's own `100%`.** An authored `40%` is a proportion somebody chose;
that author asked for a share and got a slightly different one, which is
`wired-dimension-becomes-grow`'s family of sentence. Counting it would make this rule's own message
— *"sized by the default 100%"* — **false about the node it names**, which is the one thing a
diagnostic may never be. Found from disk: `Erleah-2`'s login form is an 86vh column holding a `Logo`
at `40%` beside a sibling at the default. Firings went **22 → 21** when that landed.

Twelve unit arms in `layoutInertCombination.test.ts`, each reddening one sabotage: drop the definite
-height guard, drop the `>= 2` floor, accept a px height as growing, drop `resolveAgainstDefaults`
(the defect is made **entirely of defaults**, so the authored bag alone sees nothing), fire per child
instead of per parent, promote the code.

### 🔴 And FLD-004's lesson, applied

> *A spec that calls the function it is grading cannot tell you whether anything else does.*

All twelve unit arms call `checkLayoutInertCombination` directly. Two more arms in the drive go
through **`validate_component`** — the door an agent actually meets — so the mutant *"unhook the
call"* is expressible:

```
defectDoor:  ["column-children-split-a-fixed-height@box", "page-cannot-scroll@pg-4", "unlabelled-node@erow0", …]
controlDoor: ["page-cannot-scroll@pg-2", "unlabelled-node@row0-2", …]
```

The control produces six other diagnostics, so the absence is read beside a known-firing signal.

⚠️ **The first run of those arms reported the rule unwired, and it was the instrument.** The argument
is `path:`, not `component:`; the refused call returned `isError: true` with an empty `diagnostics`,
which reads downstream **exactly like a rule that never fires**. The arm now asserts `isError` first.

---

## 5. AC4 — the presence control, redirected onto the thing that has a corpus

The recipes cannot move a rendered page (§1(iv)). The diagnostic can, so
`npm run calibrate:layout` grew FLD-005's counts and denominators and was run over
**203 projects, 0 unreadable** (`Noodl projects`, `NodeGX test projects`, `templates`,
`project-examples`):

| | denominators | firings |
|---|---|---|
| **FLD-005** | 10,061 column Groups · 4,792 with 2+ children · **472 with a fixed (non-%) height** | **21 in 7 projects** |

The definite-height condition is what separates 21 from 4,792 — a **218×** cut, and it is the reason
this ships as a report an author can act on rather than as noise.

**Sampled from disk, and true.** `Puppy test 3 :: /Pages/Admin :: Page Root` — an **agent-authored**
page root at `height: 100vh`, `flexDirection: column`, three children, none of them sized. The
header row, the puppy list card and its sibling each get a third of the viewport, whether the list
holds two puppies or twenty. That project was authored through the very door this rule now guards.

D28 (15 firings) and D32 (33) are unchanged by this work, which is the neighbouring control.

---

## 6. AC5 — the register rows, closed where they live

Phase 81 `README.md`: **V1** and **V17** both marked ✅ closed, each carrying the measurement that
closed it and, for V1, the correction to its own sentence (it does not eat the viewport; it
overwrites the content). VIB-005's scope row now records that FLD-005 took two of its six rows and
that **V2, V14, V21 and V38 remain**. Phase 81's `NEXT-SESSION-PROMPT.md` §"three things not to
re-litigate" updated to match, and VIB-005's board row reads *"startable now, **smaller**"*.

⚠️ VIB-005 has **no task file** — it was never written — so AC5's *"VIB-005's own file records which
of its six rows this task took"* is recorded in phase 81's register and handoff instead, which is
where a VIB-005 session will actually look.

✅ **And V2 got sharper rather than smaller.** V2 is *"`clip: true` amputates silently"*, and it had
no rendered instance behind it. Arm `/h` is one: six of ten lines, gone, through exactly that
`clip`.

---

## 7. Gates

| gate | reading | exit |
|---|---|---|
| `noodl-mcp` `fld005ColumnMultipliesOut` | 10 arms, both scroll states, door wired | **0** |
| `noodl-editor` `layoutInertCombination` | 49 tests (12 new) | **0** |
| `noodl-editor` `styleVocabularyPorts` | 15 tests (2 new) | **0** |
| `noodl-mcp` `styleTools` | 14 tests, budget 4,110 / 13,989 | **0** |
| `tsc --noEmit -p packages/noodl-editor` | — | **0** |
| `tsc --noEmit` (noodl-mcp) | — | **0** |
| `npm run calibrate:layout` | 203 projects, 0 unreadable | **0** |
| mutant: drop `card`'s `sizeMode` | reddens the gate **and** its denominator | — |

⚠️ **A peer session held this checkout throughout** (phase 85 CMP-009, `noodl-mcp/src/catalog.ts`
and `src/tools/responses.ts`, uncommitted). Both commits used explicit pathspecs and the peer's four
files were verified untouched after each. **Never `git add -A` here.** For the same reason
`test:packages` was **not** run as a whole — it would grade the peer's in-flight code.
