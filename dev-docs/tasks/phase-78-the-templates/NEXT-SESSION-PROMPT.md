# Phase 78 — next session

## Where it stands

**Track B is closed.** Its last item — the sample content — is **dropped on the merits**, by
Richard's ruling, and what came out of costing it shipped instead: a moderator can now take an
announcement or a meeting back down. Track A, B1, B2 and B4 landed in s8–s10; **B3 is unblocked**
(below).

| | before s11 | after |
|---|---|---|
| ways to remove an announcement or a meeting from inside the app | **0** | **2 pages, confirmed** |
| second `myStanding` calls added to pay for the moderator gate | — | **0** — the band publishes it |
| `tpl001Template` | 55/55 | **64/64** (9 new, 5 sabotages) |
| the three tpl001 drives (real backend, real browser) | 71/71 | **75/75** (a new §9) |
| D1 — *"the door checks none of this"* | 🔴 open, high | ✅ **closed, all three classes** |

✅ `typecheck:mcp` clean · **noodl-mcp 947/947, 69 suites** · generation reproducible (**63 + 6**).
⚠️ `test:ci` **not run** — no editor source touched, deliberately: Track C is phase 80's lane and
that isolation is what has kept this phase collision-free all week.

✅ **Both reds the last prompt warned about are gone** — the peers' `site-builder` page count and
`renderReportModule` AWP-003 both pass at HEAD. Nothing in `noodl-mcp` is red.

## 🔴 Read this first: B3 is unblocked, and a register row was stale for four hours

- **B3 (layout variety) is unblocked.** P80 landed **C1** (`2c6a8876`): two new compositions
  grounded in `ui-data-table` — **`ruled`** (a row separated by a hairline, **no fill at all**,
  which is what B3 wants) and **`raised`** (`--surface-raised` with a `--border` hairline).
  ⚠️ Their file's doctrine **forbids inventing parameters** — every value is copied from a shipped,
  gated recipe, so "add a composition" there is a *sourcing* task, not a design one.
  ⚠️ `raised` only reads as raised on a `var(--surface)` ground; on the page background it is
  invisible. [D26](DEFECTS-THE-TEMPLATES-FOUND.md) is closed.
- 🔴 **[D1](DEFECTS-THE-TEMPLATES-FOUND.md) was fixed by Richard at 09:49 and this register said
  🔴 open until 13:00**, when a sabotage aimed at something else hit the refusal. **Nothing
  re-measures a row when somebody else fixes the thing it is about.** Before routing around any
  🔴 row in that file, re-run its sabotage — the statuses are *as recorded*, by this file's own
  house rule.

## Then, in order

1. ⬜ **B3 — layout variety**, now that `ruled` exists. The four repeater lists are the obvious
   readers: ten `card` rows read as ten objects where `ruled` would read as one list with
   divisions. ⚠️ Regenerating carries product-side composition changes into the artefact, so run
   the byte-identity gate **after** any P80 landing, not before.
2. ⬜ **T5 / publishing.** AC1 is ungradeable until it is on the shelf, and **Richard drives it
   first**. Everything else in TPL-001 is measured.
3. ⬜ **[D29](DEFECTS-THE-TEMPLATES-FOUND.md), when you are next running the drive anyway.** s11
   built **half** of it: `Members/Chrome` now publishes `isModerator`, and the two detail pages
   consume it. What is left is the *other* five pages dropping their own `Members/Standing` for the
   band's answer — which touches every wire AC2/AC3/AC4 rest on, so it belongs beside a drive.

## 🔴 Traps this session paid for

- 🔴 **`outerHTML` is honest about a RECORD and lies about a CONTROL.** A deployed page carries the
  **entire project graph** in `window.projectData` inside a `<script>`, so every static button
  label and notice sits in every visitor's document — a stranger's included. Three drive specs
  asserted a control's absence off `html` and all three failed; each would have read as a leak.
  ✅ `html` for a record, `inDocument` (the `<button>` elements) for a control, `text`
  (`body.innerText`) for a sentence. s8 learned half of this on one spec.
- 🔴 **A census moving by the wrong AMOUNT is the finding.** Adding two notices to each of two pages
  moved §2's notice census by **+2, not +4** — because the `confirm` held a sentence *and* two
  buttons, so it wore a notice's styling while escaping the census on a technicality. Chasing
  two-vs-four found it. ✅ **Re-pin a census only after you can say why it moved by exactly that
  much.**
- 🔴 **State a finding at the width you measured, not one notch broader.** A node-type census said
  "no delete anywhere in this template", which is **false** — `decideMembership` has one. The true
  claim is narrower and is the one that matters: none in the **browser** half. A finding stated too
  broadly is disproved by the first person who greps, and the real gap goes with it.
- 🔴 **A sabotage harness that swallows the generator's output turns a failed regeneration into a
  fake pass.** One sabotage ran with `npm run template:members >/dev/null`; the door **refused**,
  the previous artefact stayed on disk, and the reds that appeared were the *previous* sabotage's.
  ✅ Read the generator's exit and output, or the specs are grading a stale artefact.
- ⚠️ **Never `git checkout --` to undo a sabotage here** — uncommitted source goes with it.
  `cp` the files to the scratchpad first and `cp` them back; verify with `md5 -q`.
- ⚠️ **s10's work was never committed** and was found unstaged at the start of this session (16
  files). Commit at the end of a session, by pathspec, and `grep '^??'` for untracked.
- ⚠️ The drive prints the whole viewer bundle on failure — **190KB**, which buries jest's own
  summary. Redirect to a file and grep `Tests:` / `> NNN |`.

## Richard's rulings, still standing

- **Seeding, 2026-08-29: close the delete gap, seed nothing.** Examples a moderator cannot remove
  are worse than an empty noticeboard. AC6's designed empty state is the first impression.
- **Scope: A + B + all of C, with C done by phase 80** — not by this phase, because phase 78's
  isolation from editor source is what has kept it from colliding.
- **Appearance is an acceptance criterion, graded BEFORE the behaviour work, by looking at it.**
  ✅ Honoured: the removal and its confirm were rendered and read at 1280 and 390 as a signed-in
  moderator against a real backend.
- **Templates exist to surface product defects** — findings go in the register **as work with an
  owner**, never as notes.
- **Privacy**: `requestAccess` keeps the non-answer. **Publishing**: not yet. He drives it first.
