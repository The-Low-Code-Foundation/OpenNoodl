# Phase 75 — 0.2.1: The Feedback

**Filed:** 2026-08-22, the day after 0.2.0 went live (published 2026-08-21 20:08Z, tag at
`ffc08ae0`). Richard used the shipped product and filed **thirteen items** about the community —
the web platform (`~/vscode_projects/nodegx-community`, live at community.nodegx.io), its mirror
in the launcher/editor, and the learning surfaces. This phase is the 0.2.1 container: the
thirteen items as tasks (`FB-001`…`FB-014`), plus the open remainder rolled forward from
phase 74 and the adjacent open NAT/TUT work that 0.2.1 depends on.

**Before filing any of these as new, the whole corpus was swept (2026-08-22).** The headline:
most of the thirteen are not missing features — they are **built machinery with no caller**, the
exact finding phase 66 made about 0.1.7 (*"most of it was not missing features but built
machinery the user could not reach"*). `createOffer`, `postRfp`, `upsertProfile` and the capture
uploader are all written, tested, and callable by nobody. Four items are gated on rulings that
were already open (D6, D7, D8, D10 in `phase-72-nobody-has-to-leave/README.md`), and three ask to
revise a **met acceptance criterion** — those task files name the AC or ruling they revise, so the
change doesn't read as a regression later.

---

## The thirteen items, mapped

| # | Richard's item | Task | What already exists |
|---|---|---|---|
| 1a | can't edit/delete my own bench question | **FB-001** | Nothing. No PATCH/DELETE under `src/app/api/v1/bench/**`; edit history is a D19 chosen absence; **delete-own is open ruling D7** |
| 1b | answered questions still clutter the list | **FB-002** | UNI-023 built the answered/unanswered facet on the web (`src/lib/lists.ts:729`) — the **default** view is unfiltered; the editor mirror has no facets at all |
| 2 | no way to become a coach or post an RFP | **FB-003** | `createOffer()` and `postRfp()` **have no caller anywhere** — no form, no route. NAT-009 ruled "posting stays on the web" and pointed at a page with no form. Sharpest gap of the thirteen |
| 3 | "Your path" dominates the Learning tab | **FB-004** | The placement **is UNI-007 AC1 as built** ("above the installed-lessons grid"). Third report of this class (FIX-024, FIX-025 §2/§3). Path-vs-University reconciliation belongs to NAT-011 (open) |
| 4 | uploadable templates, ratings, categories, search | **FB-005** | 🟡 **T1–T4 done (s40/s42/s43/s44).** ~~no template picker exists in the product at all~~ — **there is one now**: a fourth wizard mode, a `community://` provider, `templateRegistry.list()`'s first caller, and a picker you can narrow by category and by a typed sentence (`10/10` ORed vs `5/10` ANDed). ⚠️ **The shelf is empty and the platform is undeployed**, so the curated half has a mechanism and no content — **T4's recall figure therefore grades the matcher, not the shelf**. 🔴 **Three of the eight 0.2.1 templates have no honest category** in the ruled vocabulary. T5 (submissions), T6 (ratings, 🔒 needs a ruling) remain. ECO-002 stays gated; UNI-005's shelf stays org-scoped |
| 5 | launcher community tab is one big list | **FB-006** | ✅ **DONE 2026-08-22** — the web's tabs (Bench · Tutorials · Replays · People), driven both themes. NAT-005's page revised, its vocabulary reused |
| 6 | screen captures invisible / "image not yet hosted" | **FB-007** | Platform half (E7) fully built — objectstore, grant, routes, `Attachment.tsx`. **The editor never uploads**: capture is written to disk (`nodesharecontext.ts`) because "there is nowhere to upload to" — no longer true |
| 7 | is the community tab in the *editor* even worth it? | **FB-006** | D6 answered it: editor = door only. ⚠️ The narrowing itself is **NAT-012**, still open |
| 8 | community link in the editor's ?-menu | **FB-008** | `HelpCenter.tsx` has Docs/YouTube/**Discord**/bug links, no community entry — and Discord is the thing being retired |
| 9 | university lessons aren't clickable | **FB-009** | Deliberate (D17: the syllabus page carries no install link) — but the real walls are **nothing serves a curriculum index** and **all 15 lessons are `in-writing`** (Richard's prose) |
| 10 | `/u/richardosborne14` 404s; avatars/bio/badges | **FB-010** | The page, `publicProfile()`, and 12 badges are built. **`upsertProfile` has no caller** — no settings/account page exists, so every profile 404s by construction |
| 11 | the node mockup under a bench post is redundant | **FB-011** | Known finding, NAT-007 s8: **a node question's ports render twice on both clients** — left deliberately as one composer/renderer decision. This is that decision arriving |
| 12 | new default tutorials + commit pipeline + sharing | **FB-012** | Pipeline ✅ just built (`npm run lessons:check` + CI job, `2ba69638`). TUT-004 is 7/8 (needs the drive). Content is the wall; user-authored sharing has no coverage |
| 13 | chat tab | **FB-013** | **Explicitly refused with a written argument** (UNI-011: "a forum flatters low volume; chat punishes it"). Reopening is a ruling, not a task — the argument is in the file for Richard to overrule |
| 13b | pgvector semantic search (bench + chat) | **FB-014** | Zero hits for pgvector/embeddings in either repo. Search today is Postgres FTS + client-side filtering |

## The second batch — the test-user session (filed 2026-08-22, later the same day)

Richard watched a test user go through 0.2.0 and filed six more. Same sweep, same pattern —
one was specified once and deferred with no tracking task, one is a rollout that stalled three
phases ago, and one turned out to contain **two real silent-failure bugs**:

| # | Test-user item | Task | What already exists |
|---|---|---|---|
| 1 | Image source/source-set confusing; picker is an unexplained empty box | **FB-015** | No coverage. The empty box is `ImageType.ts:36` returning early into a `ContentPicker` with **no empty state**; there is **no assets convention and no import UI anywhere** — files must be hand-placed on disk |
| 2.1 | CSS-basics/responsiveness tutorial for everyone | **FB-012** (added to the batch) | None of the 15 curriculum lessons covers layout/CSS — new scope, needs a curriculum entry |
| 2.2 | Devtools-style box-model overlay in design mode | **FB-016** | Design mode + hover inspection exist (DES-001 — which has **no task file**, only commit `40e6252c`); the highlight is a bare 2px outline. The panel's `MarginPaddingInput` already draws the devtools boxes — reuse its language |
| 2.3 | Basics-first property panel, "Advanced CSS" collapsed | **FB-017** | STYLE-004 specced it and **explicitly deferred the restructure with no tracking task** (`phase-9/PROGRESS.md:35`); the panel's collapse mechanism is **dead code** (`groupExpansions` never written, `isExpanded` hardcoded true) |
| 3 | Which value wins — connection vs typed parameter | **FB-018** | The BindingChip exists but reaches only 5 row types; `Dimension` (the port he hit) gets a 1px outline and stays editable; `IconType` shows nothing. The precedence rule ("connection wins, eventually") is documented **nowhere** |
| 4 | Ports that look like numbers but take JSON | **FB-019** | Confirmed, and worse: bare number → Width either inherits a stale unit (**300 becomes 300%**) or **silently deletes the prop**; padding coerces but Width doesn't; string → icon renders an empty span. FIX-025 §12's warning table covers two pairs and its header says the rest was deliberately not built |

---

## The third batch — Jordan's session-2 report + the checkbox (filed 2026-08-22)

Richard's checkbox report plus the useful remainder of Jordan's hour-long think-aloud session.
Triage verdict per item — which are real, which are misreadings — is recorded here because
Jordan flagged that distinction as the open question:

| Report item | Verdict | Task |
|---|---|---|
| Checkbox not checkable (Richard + Jordan §7) | **Real bug.** The component *should* toggle locally on click; total no-reaction means the click dies upstream — prime suspect: design-mode inspector listeners (`preventDefault` at document capture) active during preview. Plus a latent desync found reading the code: the click path never writes `props.checked` back | **FB-020** |
| §2.1 sizeMode silently gates Width/Height | **Real, confirmed** (`dynamicports`). Fix = gated ports render disabled with their reason, same principle as refused connections | **FB-021** |
| §2.3 parameter-vs-wire precedence invisible · §3 "externally-driven indicator" regression | **Real** — the exact confusion FB-018 already covers; the regression claim gets checked against git history rather than assumed either way | FB-018 (extended) |
| §4 panel: no collapse, scroll resets, no search, width jitters | **Real, all four** — per-node view state | FB-017 (extended: AC6/AC7) |
| §5 numeric value scrubbing | **Real absence**, second independent request | **FB-022** |
| §6 transform-origin crosshair | ✅ **Done 2026-08-25 (session 28).** The arms, ring and label draw at the resolved origin while either origin field holds focus; the editor relays that focus because it is the one fact the viewer cannot see. Driven on three origin values and on a rotated element, where the naive reading is wrong by 42px | FB-016 (scope 4) — **done** |
| §7 corner radius "rendered as box outline" | ✅ **Settled 2026-08-25 — a misreading, and the overlay is fixed.** The element rounds; the outline was the rectangle. The highlight now follows the radius, and only where the corner really is round: an arm with `overflow: visible` and a child over the corner stays square, because there the corner genuinely is. Five arms measured in the running app, R1 ≠ R2 | FB-016 (scope 5) — **done** |
| §7 Enable Icon's module-authoring copy | **Real** (copy bug) | FB-019 (scope 4) |
| §7 assets folder undiscoverable | **Real** — already filed from Richard's batch; Jordan independently confirms | FB-015 |
| §7 text style has no stylesheet reference | **Real but already known** — the style-tokens work (FIX-015) that did not ship; not re-filed | — |
| §7 lesson state doesn't accumulate | **Unclear** — may critique lesson *content* (the curriculum literally has "poke-it"/"it-forgets-you"); bar added to the tutorial batch; clarify with Richard | FB-012 (note) |
| §2.2 "margin and position manipulate the same number" | **Garbled but witnessed** — investigation item; candidate mechanism is `{value, unit}` object aliasing through the merge path, which would be a third real bug in FB-019's territory | FB-019 (scope 5) |
| §8 the framing (Paradox of the Active User: make coupling perceptible in context) | **Adopted as the phase's design principle** for FB-016/017/018/021 — it is the same principle the refused-connections work already shipped | — |

## Rolled in from phase 74 (still open, unchanged — work lives in their own files)

- **FIX-025 §5/§7/§12** — built, never driven (needs the editor; a peer has held it three sessions).
- **FIX-026** (`phase-74-0.2.0-bug-fixes/FIX-026-PUT-IT-BACK.md`) — blocked on **Richard's option
  (a)/(b) decision**; there is no pristine copy to restore from.
- **FIX-027** — 6 of 9 open: **14/15/16** (Backend Services while `isLesson` — Richard's call,
  three options in the file), **17** (trigger on step *transition*), **19/20**, **22** (product
  decision), and bug 18's other half: **`state-on-a-page` ships from nowhere** — the bundle exists
  in neither checkout and must find a home before it can be fixed.
- **`tsfixme`** — the last red ratchet, a decision not a cleanup (+110 of +162 are test files;
  32 shipped-source markers sit in one un-retypeable `.d.ts` — see
  `a-mirror-file-cannot-be-retyped`).
- **Prod has no `ANTHROPIC_API_KEY`** — "Explain this for me" answers `unavailable`; ~$0.03 for
  all 11 path explanations, ~$30/1,000 learners. ⚠️ Sonnet intro pricing ends **2026-08-31**.

## Adjacent open work this phase leans on (stays in its own phase)

- **NAT-009** — platform + client done; **no view, nothing driven**. FB-003 builds the web
  composers it deliberately left out.
- **NAT-010** (coaching from the editor), **NAT-011** (University beside your project — FB-004
  adds a reconciliation AC), **NAT-012** (blocked on D6 — FB-006 supplies the ruling input),
  **NAT-004** (light by default on the web), **NAT-014** AC2/4/7 (Richard: MX, relay domain, box).
- **TUT-004** — 7/8, needs the drive; FB-012(c) builds on its seam.

---

## The rulings queue (nothing below it starts until its ruling lands)

| Ruling | Blocks | State |
|---|---|---|
| **D6** — one navigation model; what lives in launcher vs editor | FB-006, NAT-012, (FB-008's placement) | ✅ **SETTLED 2026-08-22: launcher home in web-mirroring tabs, editor door only.** Narrows D21 — see phase-72 README §4 |
| **D7** — report / flag / delete-own | FB-001; moderation posture for FB-005/FB-013 | ✅ **SETTLED 2026-08-22: edit-own + delete-unanswered. No report/flag, no hide.** ⚠️ leaves FB-005/FB-013 without a posture — see below |
| **D8** — offline caching posture | NAT-013 | Open |
| **D10** — the relay domain | NAT-009/010 AC5, NAT-014 AC4 | Open; relay.nodegx.dev unregistered |
| **R-templates** — does template sharing open to everyone now? | FB-005 | ✅ **SETTLED 2026-08-22: CURATED FIRST.** Richard publishes; a share button files a submission, it does not publish. G3 stays shut; same posture as tutorial curation |
| **R-chat** — overrule UNI-011's no-chat argument? | FB-013, FB-014's second corpus | ✅ **SETTLED 2026-08-22: OVERRULED — build chat.** 🔴 UNI-011's written argument is now superseded, not forgotten; FB-014's corpus grows and D7's posture gap becomes load-bearing |
| **FIX-026 (a)/(b)**, **FIX-027 14/15/16 + 22**, **tsfixme baseline**, **prod API key**, **15 lessons' prose** | carried | All Richard's, all already written up |

### What the 2026-08-22 rulings changed

Four landed in one sitting. Two unblock work as filed; two **create** work that was not in the
phase when it was scoped:

- 🔴 **R-chat was overruled — chat ships.** UNI-011's argument against it (*"a forum flatters low
  volume; chat punishes it"*) is superseded by a decision, not by a counter-argument, so it stays
  quotable and the risk it named is still real. Consequences the ruling inherits: FB-014's search
  now has a **second corpus**, and chat is the surface where D7's declined moderation verbs
  (report/flag) bite hardest.
- 🔴 **D7 shipped the author's verbs only.** Edit-own + delete-unanswered, no report/flag, no hide.
  That is a complete answer for FB-001 and an **incomplete** one for FB-005 and FB-013, both of
  which were ruled *in* the same day and both of which take third-party content. ⚠️ Do not infer a
  posture for them from D7 — it was ruled on the bench, and the question comes back.
- **R-templates: curated first.** The share button files a submission; publishing stays Richard's.
  ECO-002's G3 gate is **not** reopened, and the licence trap (P69: *"20/20 ≠ fit to publish"*)
  stays parked until a later ruling opens uploads.
- **D6 narrows D21.** Recorded in phase-72 README §4 with both of Richard's instructions named, so
  a session reading D21 alone does not read the narrowing as a regression.

## Order

Tiers are in `TASKS.md`. The shape: **verify prod deploy state first** (one older handover says
nexus-1 is at `0cbd716`; the 08-21 record says `8d40b63` deployed — measure, don't inherit),
then the quick wins (FB-008, FB-004, FB-002), then the build-the-caller family (FB-007, FB-010,
FB-003) which needs no rulings, then the ruling-gated work as rulings land.

⚠️ Platform work trips **four derived-from-disk gates** on any new table/column/route (schema
mirror, data-inventory census, route inventory with a D15 verdict, no-lesson-slugs-in-src) plus
the `/v1` envelope contract test — run the whole platform suite early, **after `npm run build`**
or the real-HTTP file self-skips. Editor work: `test:main` is safe beside a live stack;
`test:ci` is not.
