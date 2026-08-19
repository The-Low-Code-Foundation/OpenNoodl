# Next session — phase 72

**Written 2026-08-19, fourth session.** **NAT-003 is fully done — all six ACs.** Tier 0 and Tier 1's
palette work are built, committed (`268fe34d`) and now measured against the electron suite.

## Read first, in this order

1. [TASKS.md](TASKS.md) §The order — **NAT-014 is the highest-value unstarted task** and has been
   for four handovers. NAT-004 and NAT-005 are the rest of Tier 1.
2. [NAT-003](NAT-003-LESS-DARK-ON-DARK.md) §"AC6 closed" — only if you are touching the palette.
   The live finding there is **unclosed by design** and described below.
3. [README §4](README.md) — five rulings still open (D5, D6, D7, D8, D10).

## ✅ The two things the last handover said were owed are done

- **CodeMirror was driven in both themes**, plus the launcher and a dialog in light. Both read.
- **`test:ci` was run, alone, seed 39393: `2849 specs, 10 failures` — exactly the floor, matched by
  name** (4× AIX-006, 2× AI model registry, 1× AIX-011, 3× SUB-011). ✅ **`CanvasThemeNodeSchemes`
  ran and passed** — the specific worry, since both sides of it were edited in one session.
## What happened this session

**NAT-003 is fully done — AC6 closed**, and the drive that closed it found two things.

`leg003-drive` ("Kiln & Co."), code popout on the `Date Picker` script node, both themes, plus the
launcher and a dialog in light. **CodeMirror reads in both themes**, and the syntax numbers are no
longer computed-only: editor ground `#2b3440` / `#f2f4f6`, gutter `#333e4d` / `#e5e9ed`, line
numbers 5.37 / 5.07, all matching the stylesheet exactly under `getComputedStyle`.

### 🔴 The finding worth carrying: the palette is graded on a ground CodeMirror only half paints

`PAIRS` grades every `--theme-color-syntax-*` token on **`bg-2`**. **The line the cursor is on is
not `bg-2`.** `.cm-activeLine` is painted with `--theme-color-bg-hover`, `highlightActiveLine()` is
registered, and **`bg-hover` is translucent** — so it composites over the ground rather than
replacing it: `#2b3440` → **`#404853`**, `#f2f4f6` → **`#e5e7ea`**.

| | graded on `bg-2` | on the active line |
|---|---|---|
| dark | 21/21 pass | **8 of 21 sub-AA** (`control` 3.31 … `angle` 4.45) |
| light | 21/21 pass | **10 of 21 sub-AA** (`meta`/`brace`/`number`/`type` 4.12 …) |

⚠️ **Pre-existing, and widened by NAT-003.** At `b668638e` it was **5/21 dark, 7/21 light**; after,
8 and 10. Both halves are true and reporting either alone would be false.

✅ **The gate was never alpha-blind — it just had no row.** `Pair` already carries `over`,
`ground()` composites through it, and it *throws* on a translucent background without one. My first
write-up said the opposite and it is corrected in the task file; the lesson is to check whether the
instrument already does the thing before proposing to build it.

**A ratchet is now in `palette-contrast.spec.ts`** pinning the counts at 8/10, with a control that
fails first if `bg-hover` ever stops being translucent (which would make every new row a silent
duplicate of the `bg-2` table). It is green, it may only go down, and **it would have caught
NAT-003's own widening.** 🔴 **It was verified RED**, not just green — tightening the ceilings to
7/9 turns both rows red and prints the offending tokens; the counts and membership agree with an
independent Python sweep over `colors.css`.

### 🔴 The dialog in light found a defect dating to the initial commit

`DeployPopup.tsx:18` set `backgroundColor: '#444444'` **inline**, since `b9c60b07` (2024-01-26). It
passed as correct in dark because it is near the old `bg-4`; **only light exposes it** — ~295px of
bare grey beside the single tab, with `color: #000` at 2.16:1 for anything landing on it.
✅ Fixed to `var(--theme-color-bg-4)`, **verified live over CDP before editing source**.

🔴 **It sat in the gap between two gates that each look complete**: `palette-copies.spec.ts` only
sees literals that *name* a token; UIX-002's mop-up is scoped to *stylesheets*. This is an inline
style object in a `.tsx`. That gap is the more useful half of the finding.

## Where to start

**NAT-014 is the highest-value unstarted task and has been for four handovers.** No dependencies,
blocks NAT-009/010/013, and it is still the only task whose defect is *currently telling users
something untrue* — no mail leaves the platform; `drainOutbox` has no production caller.

> 🔴 **Re-read `ops/` from disk before trusting NAT-014's trap section.** It says `ops/provision.sh`
> installs two timers and that AC1 should put the drain timer "beside the backup timer" there.
> **It is no longer there** — 67b moved the timers into `ops/install-backup.sh`
> (`nodegx-community-backup.timer`, `nodegx-community-restorecheck.timer`), and `ops/` is five
> scripts now. Its last trap ("backups live on the same box") **was fixed by 67b** (`d5f433e`,
> `4c9c07d`) — do not re-flag it. The task file is a hypothesis about a directory another phase
> edits, and it has decayed twice.

⚠️ Several NAT-014 ACs need Richard: a real send to a real MX, a registered relay domain with
SPF/DKIM/DMARC, and a claim made against the deployed box. **D10 is open.**

**If you are continuing the LOOK instead:** NAT-004 (light by default on the web — small,
independent) or NAT-005 (⚠️ *this is the vocabulary Tier 3 reuses; build it once here or four tasks
reinvent it*).

**If you want to close the active-line finding properly:** it is a decision, not a mechanical edit.
Either re-tune the sub-AA tokens against the second ground, or — probably better — **give the active
line its own token** instead of reusing the app-wide `bg-hover`, and pick an opacity the graded
palette survives. Then lower the ratchet's ceilings and the rows go green as a floor rather than a
cap.

## Loose ends

- ⚠️ **Eight phase-72 files remain modified and uncommitted** — NAT-006/007/009/010/011/012/013 and
  the README. They were in that state before this session and are not mine. Tracked, so a clean
  will not take them, but they are somebody's unlanded edits. I committed **only** my four files by
  explicit pathspec.
- ⚠️ **`AskAboutNodeDialog.module.scss` still carries the stale `bg-4: #2c3540` comment** (now
  `#3c4857`). Still another session's uncommitted work; still left alone for the same reason.
- ⚠️ **~99 files still paint words with a fill role** (NAT-002's remainder, 202 declarations, sub-AA
  in light). Unchanged. Wants its own task with a ratchet.
- ⚠️ **"Friendly and welcoming" is still Richard's call on a rendered screen.** The arithmetic is
  done; he has not seen the palette yet.
- `leg003-drive` was opened by the drive, so it carries the three files opening writes and every
  component is dirtied. It is a fixture outside the repo. The recents store was **not** written.

## Verification notes that earned their place

- 🔴 **An instrument pinned to line numbers reads a different file wrongly.** The first version of
  the active-line sweep hard-coded `colors.css`'s current block boundaries, then ran against older
  revisions where they differ — and reported a *dark* active line of `#eaecef` and "21/21 sub-AA".
  Confident nonsense that looked like a finding. ✅ Brace-match the blocks and **print an
  `[instrument]` line** so a mis-parse is visible rather than inferred.
- 🔴 **A screenshot misled in both directions in one session.** It showed a real dark band in the
  deploy dialog (true, and a two-year-old defect) *and* appeared to show the property panel's
  dropdowns keeping light backgrounds in dark mode (false — a sweep for luminance > 0.6 returned
  **zero**; what read as a light field was the colour swatch beside it).
- ✅ **Prove a colour fix over CDP before editing source.** Not just tidiness here: editing
  `noodl-editor`/`noodl-core-ui` source while the dev stack is up wedges `webpack-dev-middleware`
  permanently, and only a relaunch clears it.
- ✅ **`test-results.json` was 18 hours stale when this session started.** Deleted before the run,
  per the standing rule; reading it would have shown a pass predating the entire palette.
