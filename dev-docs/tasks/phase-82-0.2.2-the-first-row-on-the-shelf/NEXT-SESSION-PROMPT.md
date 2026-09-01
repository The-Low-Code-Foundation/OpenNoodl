# Phase 82 — next session

_Opened 2026-08-31 (s1). Last updated **2026-09-01, session 14**. Row 6 has **no building left on
it**: every one of the thirteen pages has been photographed and graded at **all four widths**, both
of s13's queued questions are answered and built, and s14 found that the one apparent defect left in
the pictures belonged to the **test harness**, not the product. What remains is **Richard's own
look**. The decisions are
[`RICHARD-RULINGS-2026-09-01.md`](RICHARD-RULINGS-2026-09-01.md) — **§I is new, read it** — and the
change list is [`REL-002c-WHAT-I-WOULD-CHANGE.md`](REL-002c-WHAT-I-WOULD-CHANGE.md)._

## 🔴 Read this first: this is the only board you open

Richard, 2026-08-31: *"can we work through the next session prompt in phase 82, rather than me
ending up driving unnecessary tasks in other phases by accident — just so we focus on the tasks we
need to launch, over several sessions all in phase 82."*

**So: every launch session opens THIS file, takes the next unstruck row from the run sheet below,
and finishes inside phase 82.** The verdict scale and close protocol are restated in
[`TASKS.md`](TASKS.md) — you do not need to open phase 81.

🔴 **If a row is not on this board, it does not gate 0.2.2.** Anything else you find is a **register
row with an owner**, not this session's job — see
[`../../guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md).

## The bar for row 6, unchanged since s11

Richard, 2026-09-01: *"I want all pages looking as good as the homepage."* Grade each page **beside
`/` at the same width** and answer in writing: *would a stranger think these two pages came from the
same designer?* That is harder to fudge than a three-word verdict.

⚠️ **The chrome exemption still holds and is not a loophole.** These are mostly app-chrome pages;
*"as good as the homepage"* means **shows the same amount of decision**, not *looks like a landing
page*. A directory that is beautifully dense and clearly ruled is as good as the homepage. A
directory with no header row is not.

## ✅ SESSION 13 — the run was taken, and it changed the row twice

**Full write-up: [`TASKS.md`](TASKS.md) §"what session 13 did".** Gates: `template:members` **exit 0
and idempotent** (30 components, 94 files, same 110 door diagnostics); `tpl001Template.test.ts`
**72/72**; full `noodl-mcp` **85/85 suites, 1117/1117**; `tpl001-members-drive` + `empty-states` +
`refused-query` **3/3 suites, 79/79**; `vib001-members.look.ts` **exit 0 ×3**, 60 shots each.

### What the twelve unseen pictures showed

| page | before | after |
|---|---|---|
| `/meetings/{id}` | **the weakest page in the gate** — when and where as two unlabelled grey lines | `12 January 2099 · The hall`, one composed line, as `MeetingRow` already ruled |
| `/announcements/{id}` | body across the full §C 1200 — ~210 characters a line at 1900 | date + body in a `PROSE` 640 measure, as one record |
| `/post` | 🔴 **three left edges** — band 64, heading 304, footer 64 | one left edge; forms capped at 720 |
| `/account` | same three left edges | same fix |

🔴 **The `/meetings/{id}` defect is the one to learn from: it was a DECISION THAT HAD ALREADY BEEN
MADE.** `MeetingRow` carries the ruling in writing — *"one meta line, not two"* — and the detail page
was the exact shape that ruling was written against. **A member who pressed `Details` got a LESS
composed version of what they had just read.** Nothing had ever rendered that page, so the row and
the page it opens had never been seen together.

### The two rulings Richard gave (now `RICHARD-RULINGS-2026-09-01.md` §I)

1. **`/unsubscribe` vs D39 — *"D39 stands, accept the slack."*** 🔴 **The ~290px/~470px of space on
   that page is a RECORDED CONSEQUENCE, not open work.** It has been rediscovered and re-argued four
   times. Do not fix it, do not re-derive it.
2. **`/post` + `/account` — *"head on 1200, form panels capped at 720."*** Built as
   `AT_FORM_MEASURE`. ⚠️ **This does NOT reopen §C's departure on the four DOOR pages** —
   `/sign-in`, `/join`, `/setup`, `/unsubscribe` keep `FORM_GROUND` at 720 centred.

### Item 5's header row — **decided NO**, from the render

`/directory` at 1900 reads `Ada Newcomer` · `ada@example.invalid` · `Member · since 1 September
2026`. **A header would restate three things the data already says**, and below 700px the `Columns`
folds to `smallLayout: '1'` with no runtime rule that can hide it. The original symptom — ~250px
between a name and its email — **was fixed by s10**. Priced, not skipped.

## ✅ SESSION 14 — the phone column is read, and one "defect" turned out to be the harness

**Full write-up: [`TASKS.md`](TASKS.md) §"what session 14 did".**

1. ✅ **All fifteen phone renders opened** — 15 covers the 13 pages, since `/` and `/members` are
   photographed in both states. 🟢 **Nothing is broken at 390.** The three caps this row added are
   correct no-ops below their breakpoints; `/directory` folds to one column and **s8's
   `ada@example.invali / d` break is gone**.
2. ✅ **`/join` graded at all four widths — and its finding was a NON-finding.** Its footer sits on
   1200 while its hero and form sit on 720, but `/sign-in` does the same, so it is consistent across
   the four door pages and is the shape Richard already ruled acceptable. **Priced. Do not
   rediscover it.**
3. 🔴 **`/requests` was showing the applicant's name twice — and it was the SEED, not the product.**
   The harness was posting `message: `${name} would like to join.``, inventing the applicant's
   reason out of their name. `JOINERS` now carries real reasons. **The page a moderator sees was
   never wrong; the photograph was.**
4. ✅ **Re-render control: 32 of 36 text dumps byte-identical** to s13's, the 4 that differ being
   exactly the `/requests` ones. The harness is deterministic and s13's pictures were honest.

## 🔴 What is LEFT on row 6: only Richard's look

**There is no building left on this row that a session can identify.** Both remaining questions from
s13 are answered, the phone column is read, and every page has been graded at every width.

Per §A2a **Richard personally rules six**: `/` in **both** states, `/setup`, `/join`, `/members`,
`/directory`. The Judge grades the rest, and **no page is SHITTY**, so nothing escalates.

🔴 **A session's WORTHY is provisional until he has seen it** (close protocol #5), and **PASSABLE
never closes.** The reading to hand him:

- **Provisionally WORTHY:** the twelve pages other than `/unsubscribe`.
- **PASSABLE, and ruled to ship that way:** `/unsubscribe` — its ~290px/~470px of space is a
  **recorded consequence** of D39, re-argued four times now. **Do not fix it, do not re-derive it.**

**Row 6 closes when he looks. Ask when that is booked** — and note row 7 waits on the same answer.

## The run sheet

Take the topmost row that is not ✅.

| # | row | why here | needs |
|---|---|---|---|
| ~~1–5~~ | ~~REL-007/006, REL-005, REL-003, REL-002a, REL-002b~~ | ✅ **CLOSED s1–s5** | — |
| **6** | **REL-002c — every page as good as the homepage** | s14 read the phone column, graded `/join`, and fixed the seed that was faking a `/requests` defect | 🟡 **RICHARD'S LOOK — nothing else. A session cannot close this row** |
| 7 | **REL-001** publish + drive the install | shelf's first row; also closes P75's FB-005 | ⏸️ **HOLD** — see below |
| 8 | **REL-004** cut, tag and publish `v0.2.2` | last | 🟡 **AC1 done s11** (`5c805978`). 🔴 Blocked: `cline-dev` unpushed |

### ⏸️ Why row 7 still waits

Row 7 publishes `templates/members-area` to the shelf, and **row 6 has changed that artefact three
times today**. ✅ **Re-publishing is supported and safe** — `publish-project-template.ts` re-run
against an existing row leaves visibility where it was — so this is genuinely Richard's call, and
the recommendation is unchanged: **fix first, publish once.** Ask when his look is booked, not now.

## 🔴 Hazards that bit this row before, carried forward

1. 🔴🔴 **EVERY `Group` WITHOUT A `sizeMode` IS `flex-grow: 100`.** `addDimensions` defaults
   `sizeMode` to `explicit` and `height` to `100%`, and
   [`layout.ts:98`](../../../packages/noodl-viewer-react/src/layout.ts#L98) turns a percentage height
   inside a **column** parent into `flexGrow`. ⚠️ **s13 relied on the other half of this and checked
   it**: `AT_FORM_MEASURE` sets a `width` and no `sizeMode`, which is safe *only* because
   `PAGE_GROUND` is `contentHeight` and has no slack to share out. ✅ **Pin anything that must stay
   content-height before giving an ancestor a floor.**
2. 🔴 **A FIX'S STATED MECHANISM CAN PAINT NOTHING.** Item 4's `minHeight: 100vh` on `PAGE_GROUND`
   would have changed no pixel — that Group carries **no `backgroundColor`**. ✅ **Check the artefact
   for the property the fix needs.**
3. 🔴 **FOUR TIMES IN THIS ROW, A LAYOUT COMPLAINT HAD A CONTENT ANSWER** — and 🔴 **s13 is the
   counter-example that stops this becoming a reflex.** The remaining space on `/unsubscribe`,
   `/announcements/{id}` and `/meetings/{id}` has **no** content answer: a short record is short, and
   every candidate is new product surface on a page whose data model holds nothing more. ✅ Ask what
   is missing before what is mis-sized — **and accept "nothing" as an answer.**
4. 🔴 **A DECISION RECORDED IN A COMMENT IS STILL A CLAIM — this landed for the THIRD time in this
   row, and s13's instance is the sharpest.** `Members/Chrome` said *"they are now the same 1200"*;
   it was true of six of the eight signed-in pages and **nobody had rendered the other two**. ✅
   **Re-derive a recorded decision against the picture before inheriting it.**
5. ⚠️ **DELETING A CONTROL DELETES MORE THAN THE CONTROL.** ✅ **Grep for the id after removing a
   node.** ⚠️ **And check for an id COLLISION before adding one**: s13's first draft named a new
   `Group` `record` on both detail pages, where `record` was already the `DbModel2` every connection
   fires from.
6. 🔴 **A DELETED AFFORDANCE REDDENS THE SPEC THAT USES IT AS A CONTROL — RE-POINT IT, DON'T DROP
   IT.** `tpl001-members-drive` §5 AC4 uses the moderator's offered buttons as the **positive
   control** for two negative arms.
7. ⚠️ **A GATE CAN BE A HARD COUNT IN SEVERAL PLACES, AND THE ARGUMENT ABOVE IT IS THE PART THAT
   MATTERS.** s13 moved `tpl001Template.test.ts` §6 from `1` to `3` and **rewrote the paragraph**:
   it had read *"today exactly one page stacks two sections"*, which the change made false. A silent
   increment would have hidden the finding.
8. 🔴 **NEVER OPEN `templates/members-area` IN THE EDITOR.** `readBundleDirectory` has **no skip
   list of any kind** — opening writes `.mcp.json` (with absolute paths from this machine),
   `CLAUDE.md` and a `.gitignore` block, and **all three would ship**. ✅ Work through
   `npm run template:members`.
9. 🔴 **GATE ON AN EXIT FILE YOU WRITE YOURSELF.** ⚠️ **`timeout` does not exist on this Mac** —
   `command not found` piped into `echo "EXIT=$?"` reads as **`EXIT=0`**.
10. ⚠️ **A SEED CAN MAKE A FIX UNPHOTOGRAPHABLE.** Every `ANNOUNCEMENTS` body in
    `vib001-members.look.ts` is one short sentence, so **no render this harness can take will show a
    paragraph wrapping** — the `PROSE` 640 cap is asserted from `nodes.json`, not from a picture.
    Say which of the two you have when you claim a measure is right.

11. 🔴 **AND A SEED CAN MANUFACTURE A DEFECT THAT IS NOT THERE — the inverse of 10, found in s14.**
    `/requests` showed the applicant's name as the heading and again as their own words, at all four
    widths, because the harness posted `message: `${name} would like to join.``. **The product was
    correct; the photograph was not.** ✅ **Read the seed beside the picture before filing what the
    picture shows** — this row was one session away from Richard filing a defect against a page that
    does not have one.
12. 🔴 **THE LIVING ARM'S `artefactMd5` IS NOT A CONTENT FINGERPRINT, AND THIS BOARD SAYS IT IS.**
    `bindProjectToBackend` writes an **OS-assigned ephemeral port** into the copied project file
    before `judge()` hashes it, so **the living md5 changes every run even when nothing changed** —
    s14 moved it `ed8a32db → e6bea8be` while editing only a test file. **The door arm is sound**
    (`f969ad96…` equals the template on disk, which is the pin to cite). ⚠️ **s13's citation of a
    living-md5 progression as evidence of its edits is void** — the edits were real, the hash was
    never the evidence. Registered in [`TASKS.md`](TASKS.md) §4; owner REL-002c.

## Row 8 — done and blocked parts

✅ **AC1 met s11 (`5c805978`):** `packages/noodl-editor/package.json` reads `0.2.2`, gated on
`npm run ci:build:editor` **exit 0**. Two findings are in
[the runbook §2](../release-0.2.2/PUBLISH-0.2.2.md): the nine `library/prefabs/*/library.json` files
that also read `0.2.0` and must **not** move, and why the `package-lock.json` copy is **not** a gate.

🔴 **Still blocked on Richard:** `cline-dev` is a long way ahead of `origin/cline-dev` (**580
unpushed at the start of s13, and peers committed twice during it**), `origin/cline-dev` is at
2026-08-21, CI has run on none of it. **Derive the count again at cut time.** ✅ **Tag at `5c805978`
or later** — anything earlier carries `0.2.0` in `artifactName`.

## Working rules for this tree

🔴 **The tree carries a large amount of other work in flight, and peers are committing.** The
`headSha` recorded in s13's last two render manifests **differ from each other** — two peer commits
landed during a single 14-minute run. ✅ **Commit by pathspec, never `git add`** — except untracked
paths, which a pathspec commit **skips silently** (`git status --porcelain | grep '^??'`, and check
whether a `??` is a **directory**).

🔴 **`scripts/devtools/render-from-disk.js` is UNCOMMITTED and LOAD-BEARING.** Its working-tree diff
(`md5=1557f527…`, mtime 09-01 11:38) makes the harness serve **the product's own host stylesheet**
instead of a bare reset — which is what makes every `unreachable=0px` a statement about the product
rather than about the instrument. **If it is reverted, every fold reading since 09-01 is void.**

⚠️ **And it is not a peer's.** Its own docstring says **REL-002a** — this phase's row 4. s11 and s12
both recorded the whole 11:35–11:50 mtime cluster as *"another session's in-flight work"*, and at
least this one file is **ours**. ✅ **Read that cluster before the cut rather than inheriting the
label** — *"a peer's"* is a relayed conclusion nobody has re-derived.
