# Next session — phase 75

_Written 2026-08-28 at the end of session 64. One more family of the border sweep closed. The two
blockers are Richard's and are now unchanged for a **sixth** session._

## What happened

**One commit on `cline-dev`** (`eba7c1e1`) — the launcher's Projects view, in `noodl-core-ui`. Four
controls fixed, 38 rows, **eleven mutants**. The most useful thing the session produced is not the
fix: it is that **the sweep's hover-trap list is built by a query that cannot see the trap this
family had**, and the mutant battery is the only reason anyone knows.

## 🔴 Start here — and this is a question for Richard, not a task for a session

⬜ **Deploy C5 and drive it. Unchanged since session 59 — this is the SIXTH session to open on it.**
`NODEGX_MODERATORS` is **still absent** from `~/nodegx-community-deploy.env`; re-checked this
session, **mtime still 08-26**, i.e. untouched since before C5 existed. Until Richard's handle is in
that file the hide route 404s for *everybody*, and **the verb has still never run outside a spec.**

⚠️ **Six sessions have each restated a one-line blocker that no amount of agent work can clear.
Stop re-reporting it and ask him.** It needs: his handle in the file, `ops/deploy.sh
49.12.102.195`, then the hide driven against production.

🧭 **Also Richard's, also not code:**
- **Content for FB-005 / FB-009 / FB-012** — templates, syllabus lessons, the tutorial batch.
- 🔒 **Free tags are still unruled.** §8 asked it alongside R-chat-mod and B did not answer it.

## ⬜ The ready work: the sweep continues — 40 listed sites left

In [BORDER-CONTROL-SWEEP.md](BORDER-CONTROL-SWEEP.md). 🔴 **Read s64's findings before picking one
up — two of them change what you check.**

**Suggested next: `LauncherButton .is-secondary`.** Found while reading, not swept, and it is the
strongest single target left: **one file, and it is the launcher's SHARED button**, so the defect
appears on every launcher surface at once. `bg-2` fill with `border-color: border-strong` =
**1.74 / 1.53**. ⚠️ It is in **no count in the sweep doc** — invisible on both of the inventory's
axes at once (a modifier class *and* the wrong token). Its hover fills `bg-2 → bg-3`, **down** the
ramp, so run the direction check before picking a tone. `ShareTemplateModal` (`.Preamble`,
`.Result`, `.ChoiceItem`, all `border-strong`) is the natural follow-on.

## 🔴 The finding worth more than the fix: a hover trap no grep can find

`.FolderPickerItem:hover` **declares no border at all.** It moves the *fill* down the ramp
(`bg-3 → bg-4`), and POL-016 scopes `border-control` to bg-1/2/3 — it is **2.64 dark / 2.77 light**
there. So the resting fix is **inherited onto a step where it fails 1.4.11**, and only under the
pointer.

🔴 **Sessions 61–63 all found hovers that NAME a divider tone, and the doc's "20 stylesheets" trap
list was built by searching hover rules for `border-color`. That list could never have contained
this site.** The trap list has the same shape of hole as the inventory itself.
✅ **The check that works is measuring every state that changes the border *or the fill*.**

## 🔴 Three more that change how you work the next family

**1. `own()` is load-bearing, and it is now proved rather than warned about.** Replacing it with
`return body` makes this spec **pass 38/38 with the `.Card` revert applied** — session 63's defect,
reproduced exactly in the very next nested family. **Copy `code-editor-control-borders.test.ts`.
Not the bench or picker files.** This is no longer advice.

**2. Pin the ground BY NAME — a number cannot catch a ground misread.** `.ContentArea` paints
`bg-0` and nests a scrollbar rule painting `bg-1`. When both faults coincide (a broken `own()` *and*
the nested rule using the other spelling), **the ground row reddens six times and every contrast row
stays green** — `border-control` clears 3:1 on `bg-1` just as on `bg-0`. 🔴 **When the wrong answer
also passes, the only check that works is naming the right one.** Grounds in this sweep increasingly
live in a *different stylesheet* from the control, so do this in every future slice.

**3. The up/down rule has a fourth case: the fill does not move.** `.Card:hover` lifts with a
transform only. Deleting its `border-color` was **measured and passes** — and was still rejected,
because the rule lists `border-color` in its own `transition` (deletion animates nothing) and the
sibling `.TemplateCard:hover` already uses `primary`. **Consistency and purpose decided it, not the
number.**

⚠️ **And a sixth proof the inventory is a floor**: `.Search` was a real defect and is not on the
list. Fourth slice running, always the same blind spot — **a text field sets no `cursor: pointer`.**

## Gates, as measured this session

- Editor `test:main`: **369 suites / 6125 passed / 0**.
  ⚠️ **The FIRST run read 368 / 6119 and did not reconcile.** The cause was a peer writing
  `tests-unit/sbr-001/` **during the run** (mtime 12:20) — the count was a snapshot of a
  half-written directory. Re-run reconciles exactly: s63's 366 / 6072, **+1 suite / +38 tests mine**,
  +2 suites / +15 tests the peer's. 🔴 **A suite count that misses by one is worth one re-run
  before it is worth a theory.**
- `noodl-core-ui` suite: **28 suites / 527 passed / 0** — reconciles exactly with s63.
- `tsc -p packages/noodl-editor --noEmit`: **exit 0**, 0 lines, written to a file not piped.
- `npm run tokens:css`: **exit 0**, 322 stylesheets.
- Eleven mutants. Nine killed by a named row; the two `own()` mutants are the interesting ones —
  one kills **nothing** (that is the finding) and one kills **only** the ground-pin rows.
  Failure **text** was read for both state-row kills, not just counts.
- `test:ci` **not run and not owed** — three `.module.scss` files plus a `tests-unit` spec.
  **Checked by content**: no Electron spec *source* names this family; the only other hit is
  `tests/index.bundle.js`, a build artefact.
- ⚠️ A peer was actively editing P77 SBR-001 source throughout. Committed with **explicit
  pathspecs**; their six modified and two untracked paths verified still uncommitted afterwards.

## Standing facts for this area

- 🔴 **`NODEGX_MODERATORS` absent from `~/nodegx-community-deploy.env`** (mtime 08-26). C5 is
  deployed-but-inert until it is there.
- 🔴 **Docker is not running**, so `npm run db:up` fails. The community suite runs against a scratch
  DB on local **5432**: `DATABASE_URL="postgres://richardosborne@localhost:5432/nodegx_c5_s59"`.
  Repo default is **55432** (Docker's).
- ⚠️ **P76 asks that the local backend "sb015 site backend" (port 8588) be left alone.** Not touched.
- ⚠️ **Not mine and still uncommitted, leave them**: the **P77 SBR-001 work** (`templatebackend.ts`,
  `tests-unit/sbr-001/`, `TemplateStep.tsx`, `useProjectTemplates.ts`, `EmbeddedTemplateProvider.ts`,
  `ProjectsPage.tsx`, `template.ts`) — **actively moving, a peer was editing it this session**; the
  P70/P71 task files; the P72 and P68 doc edits; and `AskAboutNodeDialog.module.scss`, uncommitted
  since **08-20** and belonging to nobody here.
