# Next session — phase 75

_Written 2026-08-28 at the end of session 60. Session 59 handed over three blockers that are
Richard's and one item that was described as his and turned out not to be._

## What happened

**One commit on `cline-dev`**, **`nodegx-community` `main` pushed to `origin`**, and the
`--theme-color-border-default` item closed for T4's shelf — after finding the *fix* it was filed
with would have made things worse.

## Start here

⬜ **STILL THE ONE READY, UNFINISHED THING: deploy C5 and drive it.** Unchanged from s59 and still
blocked on one line. **`NODEGX_MODERATORS` is not in `~/nodegx-community-deploy.env`** — I checked
this session; the file's mtime is **08-26**, i.e. untouched since before C5 existed. Until Richard's
handle is in it, the hide route 404s for *everybody*, and **the verb has still never run outside a
spec.** It needs: his handle in that file, `ops/deploy.sh 49.12.102.195`, then the hide driven
against production.

🧭 **Richard's, and neither is code:**
- **Content for FB-005 / FB-009 / FB-012** — templates, syllabus lessons, the tutorial batch.
- 🔒 **Free tags are still unruled.** §8 asked it in the same breath as R-chat-mod and B did not
  answer it. v1 keeps the channel as the category by *default*, not by decision.

⬜ **The border sweep continues**: 60 known control sites, sized and listed in
[BORDER-CONTROL-SWEEP.md](BORDER-CONTROL-SWEEP.md). **Do not do it as one sweep** — see below.

## ✅ Closed: the shelf's control boundaries — and the framing was the finding

s59 listed `--theme-color-border-default` as *"selected, not started… it reaches every surface in
the editor, so it wants a session of its own."* **It did not want a session of its own, and the
reason it reaches every surface is the reason not to touch it.**

🔴 **`border-default` is a DIVIDER tone and is SUPPOSED to be invisible.** `colors.css` says so in
two separate blocks. NAT-003's note records the exact regression raising it would restage — *"it
stopped being a hair off `bg-3` (1.01) and became a visible line on it (1.34), **which is the
opposite of what it is for**."* And **VFN-002's c3 asserts `border-default` is invisible on bg-3**,
so the proposed fix would have gone red by construction.

✅ **The token for a control boundary already existed.** `--theme-color-border-control` (POL-016),
measured this session at **3.08–4.86:1 dark / 3.05–3.72:1 light** across bg-0/1/2/3. So the defect
was never 376 declarations; it is the subset that are **controls wearing a divider's token**.

**Fixed in `TemplateStep.module.scss`**: `.TemplateCard` (a `<button aria-pressed>`),
`.TemplateFilter-pill` (inactive state) and `.TemplateFilter-search` (an input). **Left alone**:
`.TemplateStep-notice` and `.TemplateCard-tag` — genuine dividers.

⚠️ **On this card the edge is load-bearing and that had to be measured, not assumed**: the fill step
is **1.156 dark / 1.085 light**, and the light figure is *under* NAT-001's own 1.09 perceptual bar.
A card elsewhere whose fill carries it may not need the same change — which is why the rest is not a
find-and-replace.

## 🔴 The findings worth more than the code

**1. A recommendation arrived carrying a real measurement and the wrong conclusion.** T4's
1.07/1.15 was correct and reproduced. What did not survive was *"changing the token touches every
surface, so it's a token decision"* — the breadth was the argument for the opposite. **Both prior
sessions relayed the conclusion; neither re-read `colors.css`, which answers it in a comment.**

**2. The spec had to refuse the over-fix as well as the under-fix, and that took its own mutant.**
Rows asserting "≥3:1" are all satisfied by sweeping *every* `border-default` in the file to
`border-control` — the exact over-correction this task exists to refuse. Two negative controls now
carry it: the shared token is still <1.2 on the panel, and the two non-controls still wear it.
**Three mutants, each killed by a named row**: revert the card (4 reds), raise the shared token
(1 red), sweep the tag too (2 reds).

**3. The spec reads the stylesheet, not the palette.** Asserting `border-control` clears 3:1 passes
on a build where `TemplateStep` never names it — that ratio is a property of the *token*, and the
claim is about the *card*. Each row resolves the selector's own border and background out of the
`.scss`, so a revert fails at a **number**.

**4. 🔴 The 60-site inventory reports its own bound and must be read as a floor.** The query needs
`cursor: pointer` in the block, so it **misses native `<input>`/`<select>`/`<button>`**. Proof:
`.TemplateFilter-search` is a control, it was part of this defect, and **the query did not find
it** — it was found by reading the file. Also ⚠️ **membership is a judgement**: `.Matrix`,
`.OpSummary`, `.TriggerInfoCopy` set a cursor but may be regions. The test is 1.4.11's — must a
reader *identify it as a component* — not "is it clickable".

**5. `origin/main` was 19 behind, not 18.** s59 measured 18 and the number moved because s59's own
C5 commit landed after the reading. **Pushed this session** — the ~16,121-line single-copy gap is
closed, verified by consequence (`origin/main` = `2bce720`, and `git branch -r --contains` names it,
rather than trusting the push's own output). ⚠️ The repo is **private** and the range was scanned
for env-shaped files and secret literals before pushing; both clean.

## Gates, as measured this session

- `tsc -p packages/noodl-editor --noEmit`: **exit 0**, written to a file (not piped — `PIPESTATUS`
  is bash and this is zsh; s59 got caught by the same thing).
- `fb-005` + `nat-001` + `vfn-002`: **10 suites / 524 / 0**. VFN-002's c3 negative control was the
  main risk and it is green.
- `noodl-core-ui`: **28 / 527 / 0**, unchanged from the recorded baseline.
- Editor `test:main`: **363 suites / 5944 passed** on tree `e250ee02`. ⚠️ One red,
  `bld-004/reasoningChannel.test.ts` — **a flake**: 8/8 on re-run, two timing rows (249ms, 67ms), a
  peer's `tsc` was competing for CPU, and the file is neither mine nor locally modified.
  ⚠️ **This change is +1 suite / +16 tests**; the rest of the movement from s59's `358 / 5907` is
  peer work on a different tree and I did **not** reconcile it. **Quote the tree.**
- `npm run tokens:css`: **exit 0**, 322 stylesheets.
- `test:ci` **not run by this lane** — the change is a `.module.scss` in the launcher wizard plus a
  `tests-unit` file; no Electron spec names either.

## Standing facts for this area

- 🔴 **`NODEGX_MODERATORS` is absent from `~/nodegx-community-deploy.env`** (mtime 08-26). C5 is
  deployed-but-inert until it is there.
- 🔴 **Docker is not running**, so `npm run db:up` fails. The community suite runs against a scratch
  DB on local **5432**: `DATABASE_URL="postgres://richardosborne@localhost:5432/nodegx_c5_s59"`.
  **`nodegx_c5_s59` still exists** and can be reused. The repo default is **55432** (Docker's).
- ⚠️ **P76 asks that the local backend "sb015 site backend" (port 8588) be left alone.** Not touched.
- ⚠️ **Not mine and still uncommitted, leave them**: `packages/nodegx-export/*` (P18),
  `tests/cloud/sb017-*`, `tests-unit/sb-017/`, `registeradapters.ts` (P76), and
  `AskAboutNodeDialog.module.scss`, uncommitted since **08-20** and belonging to nobody in this lane.
