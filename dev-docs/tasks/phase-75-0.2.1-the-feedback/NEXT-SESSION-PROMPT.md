# Phase 75 — next session

**State as of 2026-08-26 (session 49).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue.

**Landed this session:** queue item 2 — **the binary template transport**, both halves.
`nodegx-community@2609137` and `OpenNoodl@44084419`. A template now carries its own font and its
own photograph. Full record in [FB-005-SCOPE.md](FB-005-SCOPE.md) §4f.

## 🔴 READ THIS FIRST: an undeployed platform now LOSES DATA rather than refusing it

`0023` and the routes that read it are **committed and not live**. Production is `27be4d1`, whose
`POST /templates/submissions` destructures the fields it knows and passes `files` alone.

⚠️ **So a new editor sharing a project with a font, against today's production, files a submission
with the binaries SILENTLY DROPPED.** No 400, no warning, a 201 and a template missing its assets.
🔴 **That is a worse failure than the one this task fixed** — the old behaviour refused loudly.

✅ **Nothing is broken today**, because neither half has shipped to anybody: 0.2.1 is unreleased and
the shelf holds zero rows. **The obligation is ordering, not urgency** — whichever of the two ships
first must not be the editor.

- **Deploy:** `ops/deploy.sh 49.12.102.195`, run from a **pristine `git clone`** rather than this
  working checkout. 🔴 That method is load-bearing, not ceremony: the script **rsyncs the working
  tree**, and the clean-tree refusal's first production catch was a peer's half-finished file. A
  clone satisfies the refusal honestly instead of silencing it with `--allow-dirty`.
- ⚠️ **`origin/main` is now THIRTEEN commits behind local `main`** on `nodegx-community`. Same shape
  as s48's finding: *a fact that lives in exactly one place.*

## The queue — cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **Deploy the platform half** | **S** | 🆕 **owed before the editor ships** — see above. Also carries FB-005's routes for anything else queued behind them |
| 2 | **Publish a curated batch** | **S–M** | 🧭 **needs Richard**: which templates, and the 3-of-8 category gap (`pixel-game`, `interactive-fiction`, `shared-canvas` are none of the six). This is what makes T3/T4/AC2 real for a user — the machinery is live and holds nothing |
| 3 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** ⚠️ Its corpus does not exist either — FB-014 measured the bench at **3 posts, 2 threads, 1,369 chars** |
| 4 | **FB-005 T6** — star ratings | **M** | 🔒 **still needs a ruling.** Precondition is closer — the queue is live — but nothing has been submitted |

~~**A binary-capable template transport**~~ ✅ **CLOSED s49.** The measurement it was scoped
against — *"5 of 25 real projects still cannot be shared"* — was re-run over the disk rather than
the recent-projects list and came out **11 of 77**, with the same character: the author's own
`fonts/*.ttf` and `assets/*.png`.

## ✅ What shipped, and the numbers that decided it

Measured over **77 real projects** (every manifest-bearing directory under `NodeGX test projects`
and `project-examples`), through the **real** `isNeverShared` rather than a restatement of it:

| | |
|---|---|
| refused by the text-only transport | **11 of 77** |
| blocking files | **19 `.ttf`**, **4 `.png`** |
| over the 8 MiB cap once base64'd | **0** |
| largest project, every binary encoded | **1,445,478 bytes** — 17% of the cap |

🔴 **`0020` warned that base64 costs +33% against the cap. It does, and it does not matter** — so
the cap is untouched. ⚠️ **The denominator is not s46's 25**; that corpus was the editor's
recent-projects list, which has since changed. The two tables are not comparable and the second is
not a correction of the first.

**Design:** two maps — `payload = { files, binaryFiles }` — rather than a `"base64:"` sentinel
inside a value. `files` holds a builder's **source code**, so a sentinel would let a text file
**forge** a binary. The key set is a discriminant no file's contents can influence. `0020`'s
`project_template_files_are_text` is untouched and still true, so a client that never learns about
the second map behaves exactly as before.

## 🔴 Three findings worth carrying out of s49

1. **`->` and `||` share a precedence class in postgres and associate LEFT.** Written without
   parentheses, the disjointness constraint parsed as `((payload -> 'files') || payload) ->
   'binaryFiles'`, evaluated to `{}` for every real payload, and **refused every insert** — 42
   specs red on rows with no binaries in them. ✅ **The negative control is what pins it**: a spec
   asserting only *"an overlapping payload is refused"* stays green while the rule refuses
   everything.
2. **A backtick in a SQL comment inside a JS template literal ends the string.** `0020`'s author
   left the warning in the file — *"it cost one syntax error to learn"* — and it cost a second one
   anyway. Reading a recorded trap after writing the code is not reading it.
3. ⚠️ **A rule's justification can change while the rule does not.** `RESTORED_ON_INSTALL` used to
   be the fix for a refusal; those fonts would now travel fine, and the reason to exclude them is
   that it is a third of a megabyte the installer already has. 🔴 **And a stray `.DS_Store`'s
   failure mode moved from *refuses the share* to *uploads to a public shelf*** — same rule, worse
   consequence, which is a reason to keep measuring rather than to relax.

## Carried forward, unchanged

- ⚠️ **AC5's last mile is still unverified and still deliberately so.** The share button was driven
  end to end in s46 and reached a 404; the routes answer 200 now, but **nothing has been POSTed
  through the live path**. Doing so files a real row on Richard's production queue with no withdraw
  route. 🔴 **The GET probe cannot stand in for it**: authorised and anonymous
  `GET /templates/submissions` both return `200 {"items":[]}` — the queue holds zero rows, so the
  empty set fits *"correctly scoped"* and *"wide open"* equally.
- The five defects the s46 drive found — the `Select`-in-a-`Modal` dismissal (**`BaseDialog`'s and
  still UNOWNED**), the document-global radio `name`, nested `.DS_Store`, the 44%-of-real-projects
  refusal, and the `absent` sentence that blamed an account for a deployment gap.
- The three `0021` findings, the licence-at-promotion defect, the contrast items
  (`--theme-color-border-default` at 1.07:1; FB-002's selected pill at 1.16:1), and the share
  dialog's **693 px of content in a 525 px viewport**, which puts the licence question below the
  fold.
- **`MEMORY.md` is over its 17,510-unit budget** and has been since before s48.

## Gates — session 49

| gate | result |
|---|---|
| `nodegx-community` full suite | ✅ **62 files, 1534 tests, exit 0** |
| `npm run test:main` | ✅ **346 suites, 5739 tests, exit 0** |
| `typecheck:editor`, `typecheck:editor-tests` | ✅ clean |
| `nodegx-community` `tsc --noEmit` | ✅ clean |
| `npm run test:ci` | ❌ **not run** — a peer session was building phase 76 on this checkout all
evening, and the recorded rule is that `test:ci` is only meaningful **run alone on the machine**.
Inherited unchanged from s47/s48 rather than paid here. |

⚠️ **One flake seen and confirmed as one**: `aib-009/turnDeadline` *"lets a slow turn run as long as
the stream is alive"* failed on the first `test:main` and passed on re-run and on the full second
pass. A timing test, unrelated to this change.
