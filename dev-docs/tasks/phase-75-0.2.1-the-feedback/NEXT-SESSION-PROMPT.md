# Phase 75 — next session

**State as of 2026-08-26 (session 47).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue.

**Landed this session:** queue item 1 — **FB-005 T5's button.** *"Share as template…"* is on every
launcher project card's kebab, it opens a five-field dialog, and it was **driven end to end in the
running app**. ✅ That closes the "build the caller" half s45 deliberately left open.

🔴 **AND THE DRIVE FOUND FIVE DEFECTS THAT 226 GREEN SPECS COULD NOT SEE — plus the real blocker.**
All in §4e of [FB-005-SCOPE.md](FB-005-SCOPE.md). The blocker first, because it changes the queue:

## 🔴 READ THIS FIRST: the platform half of FB-005 is NOT DEPLOYED

The real send came back `absent`. Probed directly:

| `community.nodegx.io` | | |
|---|---|---|
| `/api/v1/community/threshold` | **200** | the control — the host is up, serving `/api/v1/community/*` |
| `/api/v1/community/templates` | **404** | T3's shelf, session 43 |
| `/api/v1/community/templates/submissions` | **404** | T5's queue, session 45 |

The editor's **authorised** request and an anonymous probe agree. **Production predates FB-005 T3
entirely.** T3, T4 and T5's platform halves are merged, specced, gated — and **not live**. So the
create wizard's community provider and the whole share path reach nothing today, and *"the curated
shelf is empty"* is not a content problem: **there is no shelf.**

⚠️ *Deployed is not committed*, in the direction that is easier to miss — everything green, nothing
live. 🔴 **Nothing in this repo's gates can see it.** Deploying `nodegx-community` is now the
highest-value item in FB-005 and it is **not an OpenNoodl change**.

## The queue — cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **Deploy `nodegx-community`** | **?** | 🔴 **Unblocks T2–T5 at once.** Not a code task — the code is written. Until it happens the share button, the community picker and the shelf are all correct and all reach a 404 |
| 2 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** ⚠️ Its corpus does not exist either — FB-014 measured the bench at **3 posts, 2 threads, 1,369 chars** |
| 3 | **A binary-capable template transport** | **M–L** | 🆕 **Now measured, not speculative: 5 of 25 real projects still cannot be shared**, and the residue is the author's own `fonts/*.ttf` and `assets/*.png`. See §4e |
| 4 | **FB-005 T6** — star ratings | **M** | 🔒 **still needs a ruling**, and its precondition moved further away: nothing can reach the queue until item 1 |

## The five defects the drive found — the reusable half

1. 🔴 **A `Select` inside a `Modal` CLOSES the `Modal`.** `Select` portals its options into
   `dialog-layer-portal-target`, **outside** the modal's subtree; `BaseDialog` dismisses when a
   gesture starts and ends outside `visibleDialogRef`. ⚠️ **This dialog was the first `Modal` in the
   editor to contain a `Select`** — swept, one hit. **The `BaseDialog` defect is UNOWNED and not
   fixed**: `isOutsideDialog` is every dialog's dismissal rule.
2. 🔴 **A radio `name` is DOCUMENT-GLOBAL, so `BaseDialog`'s double render put 12 radios in ONE
   group** — six ghosts, six real, each unchecking its twin. ⚠️ **The known form of this trap is
   about *querying* (filter out `MeasuringContainer`); this is about a browser-global namespace,
   where the ghost is a PARTICIPANT rather than an extra node to skip.** A `name` from a prop cannot
   fix it — both copies get the same props. `useId` can.
3. 🔴 **`.DS_Store` was withheld only at the project ROOT.** Finder writes one per directory; 25 real
   projects had **seven** nested ones. ⚠️ **The symptom was not a leak** — each is binary, so it
   landed in `binaries` and **refused the whole share**. All 20 existing specs were green through
   it, because every fixture put `.DS_Store` at the root.
4. 🔴 **11 of 25 real projects could not be shared at all** — measured over the corpus that exists,
   not fixtures. Not size: **42 of 46 blocking files were `.ttf`/`.woff2` under `noodl_modules/`.**
5. 🔴 **The `absent` sentence blamed the account for a deployment gap.** It said *"Sharing is not
   available on this account"*; the cause was a route that was never deployed. **`absent` has four
   causes and the client cannot tell them apart**, so it now names them as possibilities.
   ⚠️ **A sentence that asserts a cause the code cannot know is worse than one that does not.**

### ✅ Richard's ruling on defect 4, and why it did not need new machinery

**Richard, 08-26:** *"in theory exclude modules, but like node modules, there should be an easy way
to do an equivalent of npm install… Don't leave people with a half working template."*

🔴 **The restore already exists and already runs.** `createProjectFromTemplate` calls
`installStarterAssets` **after** `installTemplate`, and it never overwrites. `inter` and
`lucide-icons` are **bundled inside the editor**, so a template that omits them is given them back
byte-for-byte, no network, nothing to approve — they are NodeGX's files, not community content.

**`RESTORED_ON_INSTALL` is DERIVED from `STARTER_ASSETS`** so the two cannot drift, and the rule on
it is the whole justification: **a module may be excluded ONLY IF THE EDITOR CAN PUT IT BACK.**
Result: **13/25 → 19/25 shareable.**

🔴 **What is still owed of Richard's ask:** a restore for a **non-starter** module, and the approval
step for community ones. Nothing to restore from today — `kit-provenance.json` has **no
`builtin`/`starter` arm** and is not written for starter assets; `inter` is not a library entry at
all; `listNodeKits` filters on a manifest with a `main`, which neither starter module has, so **they
never appear in the Kits panel**; and **nothing in the product detects a missing module.**

## Gates — session 47

- `tests-unit/fb-005/share-template-form.test.ts` — **49 specs**, new. **6 mutants, 6 killed.**
- `tests-unit/fb-005/template-submission.test.ts` — **20 → 27**, the `.DS_Store` and
  `RESTORED_ON_INSTALL` guards. **2 mutants on the `.DS_Store` fix, both killed.**
- `tests-unit/uni-001/session-readers.test.ts` — **50 → 56.** 🔴 **See the trap below.**
- `npm run test:main` — **346 files / 5732 specs / 0 failures.** Reconciles exactly: s45's
  345/5670, +1 file/+49, +7, +6. ⚠️ **`bld-004/reasoningChannel` went red twice under load and green
  alone both times** — a 250 ms timing flake, not a regression.
- `typecheck:editor` **0**; `typecheck:editor-tests` **0**.
- ⚠️ **`typecheck:core-ui` is 44 and that is the DOCUMENTED BASELINE** — `pr.yml:65` says so in
  as many words. Mine added none; all 44 are `TS2307` alias resolution in files nobody touched.
- `npm run test:ci` — see the tail of this file; run alone, and read the **summary line**.

## 🔴 The trap worth carrying: a new session reader owes the UNI-001 sweep

`useShareTemplate.ts` calls `readCommunitySession`, and `session-readers.test.ts` went red on the
next full run. **Its rule says do NOT add the row to make it green — answer the question first.**

🔴 **And this is the FIRST ROW in that table whose answer to *"what does it WITHHOLD?"* is not
simply "nothing".** Every row above reads a token as a bearer header on something the platform
serves to strangers; this one reads it for a **write**, and the send button is off while signed out.
⚠️ **What makes that not principle 1's failure is that no capability MOVED behind the session** —
filing a submission did not exist for anybody before T5, and cannot exist without an account on the
platform side either (`submitTemplate` is a checked capability; `submitter_account_id` is
`not null`). The account is not buying back something an account-less editor lost; it is **who the
act is by**. Six structural specs assert the offer never disappears: the kebab entry is guarded on
the **handler**, the dialog opens signed out, and the decision layer is handed a **boolean**.

## Carried forward, unchanged

Everything in the s45 file that is not superseded above still holds — the three `0021` findings, the
licence-at-promotion defect, the three repo sweeps a new platform table owes, the category
vocabulary gap (`pixel-game`, `interactive-fiction`, `shared-canvas` have no honest category), and
the contrast items (`--theme-color-border-default` at 1.07:1; FB-002's selected pill at 1.16:1).

⚠️ **New, small, unowned:** the dialog's content is **693 px in a 525 px viewport** at 1368×781, so
the licence question — the most consequential field — is the one below the fold.
⚠️ **`.cache/cached-thumb.png` was checked and is NOT ours**; no editor code writes a project-level
`.cache`. Recorded because "looks like editor state" was the obvious wrong conclusion.

## Driving traps met this session

- 🔴 **`npm run cdp -- click` uses `document.querySelector`, which returns `BaseDialog`'s
  MeasuringContainer copy FIRST.** A click on anything inside a `Modal` lands on the ghost's
  coordinates **and still reports success**. ✅ Tag the non-measuring copy with a `data-drive`
  attribute and click that.
- 🔴 **`elementCentre` calls `scrollIntoView` and reads `getBoundingClientRect` in the SAME eval**,
  so the coordinates are the pre-scroll ones. ✅ **Click twice** — the second reads settled geometry.
- ⚠️ **A DOM read taken immediately after a click can predate React's re-render.** Two reads
  disagreed and the second was right; it cost a wrong hypothesis.
