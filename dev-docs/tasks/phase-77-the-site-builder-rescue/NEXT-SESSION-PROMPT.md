# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## s9 built and drove SBR-006. Two ACs pass, three are blocked — and none of the three by this task

`/Admin/Shell` and `/Admin/NewPageDialog` are new; `/Admin/PageRow`, `/Pages/Admin` and
`/Pages/ThemeEditor`'s root are rebuilt. Detail in SBR-006 §5. **AC1 ✅ and AC5 ✅** (the latter
with a control pair — same shell placed twice, the current-item colour and weight swap between
`/admin/pages` and `/admin/theme`, nothing poked). AC2 is half, AC3 and AC4 are not.

## 🔴 Three things s9 found that belong to other tasks

1. **`publishPage` and `duplicatePage` both time out at 30s with no response — and they
   disagree.** `claimSite` succeeds in **29 ms** on the same backend in the same session, so it is
   not the mechanism and not the wiring (the call arrived as
   `{"publish":true,"pageId":"0826ed8b…"}`). Duplicate **did its work** and stayed silent; publish
   **did nothing** and stayed silent. "Times out" is one symptom over at least two causes.
   **This has no task and no owner, and AC3 cannot pass until it does.** Evidence is in the
   backend's own `executions.sqlite` — that table is the fastest way to tell "never called" from
   "called and failed", and it is worth reaching for before any CDP forensics.

2. **SBR-008 now has its cleanest evidence.** The dialog changes where title and slug come from
   and does not change the outcome, because the drop is about `prop-*` being **wire-only**. One
   `Page` table, two rows, one written by each half:

   | row | written by | `title` | `slug` |
   |---|---|---|---|
   | `0826ed8b` | the dialog (browser `prop-*` wires) | `None` | `None` |
   | `0e65ab90` | `duplicatePage` (cloud) | `Copy of Untitled` | `page-copy-np3ui4` |

   The three `prop-*` set as **parameters** arrived on both. Same table, same columns.

3. **A refused query and an empty collection are the same screen.** On a cold load with no
   session the page list renders the shell, the heading and `New page` and *nothing else* — no
   rows, and no row-count sentence, because `count` runs on `pages.fetched` and a refused query
   never fires it. No "no pages yet", no "you are not signed in". Identical pixels, opposite
   fixes. Probably SBR-006's or SBR-010's; **Richard's call which.**

## 🔴 Owed, and small

**AC4's fix is authored and gated but NOT driven.** Clicking View site landed on
`location.pathname === "/%7Bslug%7D"` — the unsubstituted template. `goSite` now carries
`pm-slug: ''` (the empty slug IS the site root SBR-004 §11 drove). Verifying it needs a project
minted from the **regenerated** template: the running editor holds the project in memory, so
patching the drive project on disk never reached the viewer. ⚠️ That is a general trap for this
kind of quick fix — **an on-disk patch does not reach a running editor.**

**AC1 was driven with one page, not ≥2.** The second row arrived only as `duplicatePage`'s
untitled copy. Re-drive once SBR-008 lands and rows have titles to show.

⚠️ **`test:ci` still not run** — owed since s8. It drives Electron; run it alone.

## 🔴 The lesson from s9 most likely to repeat

**A checker's population is part of the checker.** `sb006PublicSite.test.ts` has caught growing
nodes since SBR-004 and was never wrong — it simply never walked the admin screens, which had
**eleven** growing nodes to the public site's two.

And then the new gate nearly shipped with the same shape of hole one level down: a walk that
stops at a component instance never reaches the bodies behind `Component Children`. It graded
**41 nodes instead of 61**, and the worst offender **vanished from the report** — which read as
an improvement. *The report got quieter, not louder.* The green arm now asserts node **names**,
because the count is exactly what the hole moved in the wrong direction.

Same family, third instance this phase: `sb005AdminPanel.test.ts` was authoring the admin set
into an **empty project** — a population the panel never ships into. The first component to refer
outward was refused and took all twenty of that file's other assertions down with it.

## Traps s9 paid for

- 🔴 **`NavigatiONShowPopup` contains the substring `onShowPopup`.** A repo-wide grep for the
  runtime field returned twelve confident false positives. Anchor with `[^A-Za-z]` and put a
  known-present control on the same command.
- 🔴 **A bare number in a dimension port is a PERCENTAGE.** `width: 240` meant `240%`. The door
  refuses it; the object form `{value:240, unit:'px'}` is the fix.
- 🔴 **`Text` declares no padding ports and no `borderRadius`** — margins only. A padded nav item
  needs a wrapping `Group`.
- ⚠️ **Two spellings, one popup mechanism**: Close Popup takes `result-<name>` **inputs**, Show
  Popup publishes `closeResult-<name>` **outputs**.
- ⚠️ **`npx vitest` pulls a different vitest from the npx cache.** The mcp package uses **jest**:
  `npm --prefix packages/noodl-mcp test -- <pattern>`.
- ⚠️ `${PIPESTATUS[0]}` is empty in zsh — redirect to a file and read `$?` instead.
- ⚠️ The editor preview is **988×313** until a device size is picked.
- ⚠️ The site-builder wizard path: New project → Start from a Template → name → Site Builder →
  Create. Then `SITE_SETUP_TOKEN` into the backend's `secrets.json` under `functions`, and
  `/admin/setup` with an email, a password and that token. **URL paths, not hash** — setting
  `location.hash` routes nothing.

## Standing context

- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
- 🔴 Never scope by time. Every task's ACs include a person sentence — verify as written, and if
  the platform cannot express what an AC asks for, **say so and record the gap** rather than
  quietly substituting.
- Drive artefacts: **`SBR-006 Admin Drive`** (claimed, backend `backend_mtdg3sdziq5nw`, token
  `drive-token-sbr006`) carries s9's graph *minus* the AC4 fix. `SBR-004 Mounted Drive` carries
  s8's.
- Shared checkout: **pathspec commits only**; announce editor launches **and** teardowns;
  `test:ci` alone, and never beside a live stack.
