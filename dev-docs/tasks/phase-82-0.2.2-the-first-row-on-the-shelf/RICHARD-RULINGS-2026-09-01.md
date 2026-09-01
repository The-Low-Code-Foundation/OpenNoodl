# Richard's rulings — 2026-09-01

Taken in session 6, against the decision list derived from run-sheet rows 6, 7 and 8. **These are
the decisions; the sessions that build rows 6–8 work from this file.** Where a ruling contradicts
an AC as written in [`TASKS.md`](TASKS.md), the ruling wins and the AC is amended below it.

🔴 **Two items are still open** — §E's mechanism and §G4 — and are marked **AWAITING RICHARD** at
the point of decision. Do not guess them.

---

## Row 6 — REL-002c, the redesign

### A. Scope — 🔴 **ALL THIRTEEN PAGES**

> *"In theory we should do all 13, shipping the first template that's only 1/3 usable would be
> pretty sad."*

**This amends the AC.** `TASKS.md` §REL-002c reads *"the landing page and one members page"*; that
was written when only 4 pages had been ruled. The close condition is now **every page in
`templates/members-area/components/Pages/`**:

`Account · Announcement · Directory · Join · Landing · Meeting · Meetings · Members · Post ·
Requests · Setup · SignIn · Unsubscribe`

⚠️ **The build is not 13× the work; the grading is.** Most of the look lives in seven shared
components — `Members/Chrome`, `AnnouncementRow`, `InsideTile`, `MeetingRow`, `MemberRow`,
`RequestRow`, `Standing` — so redesigning the chrome and the row family lifts most of the thirteen
at once. What scales linearly is the **close protocol**: 13 pages × 2 states × 3 widths = **78
renders**. See §A2.

### A2. How the thirteen get graded — ⏳ AWAITING RICHARD

Nobody should ask Richard to look at 78 PNGs. Proposed split, for confirmation:

| | option | what it means |
|---|---|---|
| **A2a** | **Richard rules a representative six; the Judge grades the rest** | He personally rules `/` (landing, both states), `/setup`, `/join`, `/members`, `/directory` — the four he already ruled plus the two richest row pages. The other seven are graded by the VIB-001 Judge against the written rubric, and any SHITTY verdict is escalated to him. **Recommended** |
| **A2b** | He rules all thirteen | Complete, and a lot of looking |
| **A2c** | He rules the six, the other seven ship on the Judge alone | Same as A2a without the escalation — cheaper, and the failure mode is a page nobody looked at |

### C. The measure — ✅ **C1, `maxWidth: 1200`**

Every structural shell carries `maxWidth: 1200` with `--space-6` gutters and `alignItems: center`,
matching [`ui-landing-page`](../../../docs/node-catalog/examples/ui-landing-page.json) — whose own
description argues the point: *"Each band is exactly ONE shell (maxWidth 1200, --space-6 either
side), so all eight gutters agree; a band that disagrees reads as a bug rather than a choice."*

🔴 **The measure goes on the SHELL, never on the text** (V29's ruled mechanism). `ctaBand` is the
worked example: shell carries `maxWidth` + `alignItems: center`, the type carries `textAlignX:
center` and **no `maxWidth` at all**. A `maxWidth` on the type strands the white space on one side,
which is the thing Richard called *"weird"*.

### D. Imagery — ✅ **D1, photographs on the public pages**

Photographs on `/` (hero ground) and `/join`; **icons only** inside the gated area. The gated pages
are app chrome and are exempt from the marketing tells — they are not exempt from showing a
decision.

✅ **Costs the template nothing.** The 44 CC0 photographs, six ground textures and 1,998 icons are
installed into every new project by `STARTER_ASSETS`, and the submission's excluded-files list is
derived from that same constant — so the template **references** `noodl_modules/starter-imagery/…`
and ships none of the bytes. The template contains **zero images today**, and *"no imagery and no
iconography anywhere"* is a fired tell on the landing page's baseline verdict.

### E. Copy — ✅ **E3, no invented copy — but the editable text must be unmissable**

> *"E3 but make it obvious how to edit the texts and which ones need to be edited (so the user
> doesn't accidentally publish with some generic web dev copy on some page they forgot), not sure
> how but have a think."*

**The thought, and the recommendation: make the copy DATA, not text nodes.**

The failure mode Richard named — *publishing with generic copy on a page you forgot* — only exists
because the copy lives in thirteen places a person has to remember to visit. It does not exist if
the copy has **one** home, and the template already has the door for it: **`/setup` asks the owner
for the association's name at first run.** Extend that door and the problem is designed out rather
than signposted.

| | option | what it means |
|---|---|---|
| **E-i** | **Owner-entered copy** — `/setup` collects name, tagline, and the landing blurb; the pages read them from the record | There is no generic copy to forget, because there is none. Strengthens `/setup`, which is being redesigned anyway. Covers the copy that actually varies per association. **Recommended as the spine** |
| **E-ii** | **Marked placeholders** for what genuinely cannot be data — structural strings that stay in the graph | Every one is written to be *obviously* unfinished (*"Your association's name here"*, never a plausible fictional club), and every such node is named with an `EDIT —` prefix so the editor's node tree lists them |
| **E-iii** | **A `Start here` note** shipped in the project — one page listing what to change and where | Cheap, honest, read once and forgotten. Useful **beside** E-i, useless instead of it |
| **E-iv** | A product-side gate that refuses to deploy while placeholder strings remain | Strongest, but it is **new product surface**, not template work — a separate task in a later phase |

⏳ **AWAITING RICHARD: confirm E-i + E-ii + E-iii as the package** (data-driven where it varies,
obviously-unfinished-and-named where it cannot be, one note page pointing at both), and whether
E-iv is worth registering as a future product row.

### F. The "not connected yet" card — ✅ **F1, designed as a first-class state**

`waitingCard` is **the only node in the template mounted by default**
([`react-component-node.ts:1900`](../../../packages/noodl-viewer-react/src/react-component-node.ts#L1900)
— `mounted` defaults to `true`), so it is the literal first frame of a fresh install. It gets a
proper panel that says what is happening and what to do next, and it is **ruled with the rest**.

---

## Row 7 — REL-001, the publish

### G1. Category — 🔴 **`starter`, NOT `data-app`** *(overrules TASKS.md and TPL-001 AC8)*

> *"data app sounds like it analyses data. Call it starter."*

**This amends two ACs**: `TASKS.md` §REL-001 AC1 and `TPL-001` AC8 both say `category: 'data-app'`.
They now read **`category: 'starter'`**, which the picker draws as **"Starter"**.

The vocabulary is fixed by a DB `CHECK` constraint — `starter · data-app · dashboard · site · form ·
integration` — so `starter` is valid and needs no migration. See
[`templateFilter.ts:110`](../../../packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectCreationWizard/steps/templateFilter.ts#L110)
for the slug→label map, and `template-search.test.ts` for the constraint. ⚠️ **Any spec asserting
`data-app` for this template moves with the change** — `template-search.test.ts` and
`template-install-over-http.test.ts` both carry the literal.

### G2. The card's title — ✅ **"Members' area"**

### G3. The summary — ✅ **as proposed**

*"members only site for a club, charity or church"*. 🔴 **Title + summary is the entire ranked
search document** — the search ORs terms over the two, nothing else. That is why the sentence
carries the words a person would actually type and not the word *"template"*.

### G4. Curated or community — ⏳ AWAITING RICHARD *(and it is nearly not a choice)*

The distinction is **how the row gets onto the shelf**, not how it is badged in the picker:

- **`curated`** — published directly by a curator holding a **database credential**, via
  `publish-project-template.ts` in the **`nodegx-community` repo** (present at
  `~/vscode_projects/nodegx-community`). No review queue, because the curator *is* the review.
- **community** — arrives through the app's own `shareAsTemplate`, which files a **submission** and
  publishes nothing until somebody approves it.

So "community" for this template would mean routing NodeGX's own flagship template through a
submission queue Richard also operates. **Recommend `curated`**, as `TASKS.md` already assumes.
⚠️ Both are served by `nodegx-community`, so the picker badge reads *Community* either way — that
is a badge about the **source**, not about provenance, and it is what P80/DEF-007 s41 photographed.

### G5. Timing — ✅ **G5a, publish as soon as the look rules**

Do not wait for the cut. **Measured**: a published template is *served*, reaches everyone already on
0.2.0 with no app update, and touches no editor source (README §1.2). The shelf currently reads
`total: 0`.

---

## Row 8 — REL-004, the cut

### H1. The number — ✅ **`0.2.2`**, and the notes say why

> *"0.2.2 and we can explain that 0.2.1 was internal and we didn't release because it was too
> buggy."*

**Recorded so no later session 'corrects' it back to 0.2.1.** `v0.2.0` is still the newest tag and
`packages/noodl-editor/package.json` still reads `0.2.0`. The release notes carry a line saying
0.2.1 was an internal cut held back as too buggy — which is also the honest frame for a release
whose content is *"we used the product and wrote down everything that broke"*.

### H2. Release notes — ✅ **H2c, split across two artefacts**

> *"There's an artifact created yesterday with all the release notes which you can use, go with H2c
> please (make the artifact the full log and write highlights into release notes with the link to
> the artifact)."*

- **The artefact** — [NodeGX 0.2.2](https://claude.ai/code/artifact/70d4e79e-78ce-44c8-b9f5-e06c6b0b6d11),
  updated 2026-08-31 — becomes **the full log**. It is today a curated narrative (masthead, ship
  gate, headlines, then sections for the look / code export / the door / templates) built on a
  stat band reading **559 commits · 251 fixes & features · 1,989 files · 11 days**.
  🔴 **Those figures are stale: `git log v0.2.0..HEAD` counts 567 commits as of 2026-09-01.** Refresh
  the band and complete the log to cover everything since `v0.2.0` before the tag.
  ⚠️ **Viewers currently see a pinned earlier version, not the live one.**
- **The release notes** — the GitHub release body — carry **highlights only**, plus a link to the
  artefact for the full log.
- ⚠️ The artefact's own ship-gate section still lists the site-builder template as holding and
  TPL-001 as unpublished. Both need re-reading against reality at tag time.

### H3. *"Huh?"* — answered, and **already settled by G5a**

The question was badly put. It asked whether the template publish and the app release are **one
moment or two** — whether you'd announce "0.2.2 is out, and here's the first template" together, or
put the template on the shelf as soon as it looks good and cut the app later.

**Your G5a answer decides it: two moments.** The template goes up the moment REL-002c rules WORTHY,
and the app cut follows when it is ready. There is no technical dependency in either direction.

---

## The three housekeeping answers

1. ✅ **`sb007Template.test.ts` is not Richard's.** Measured: it is **tracked and modified**, not
   untracked — `+23/−1`, and the change is **documentation only**: a comment block recording that
   the DEF-007 AC3 gate reads one shipped artefact of two (TPL-001 disagrees in 57 places), plus a
   rename of the `describe` from *"the shipped template"* to *"the shipped SITE-BUILDER template"*.
   It is an orphan from the closed P80 work and its content is correct. **Disposition: commit it
   with the rest**, attributed to P80's Row 10 in `UNOWNED-ROWS-TO-MEASURE.md` (owner `NONE`).
2. ✅ **Commit as you go.** 82 files are uncommitted, carrying s1–s5's doc edits plus the source
   changes from s4 and s5. 🔴 `git commit <pathspecs>`, **never** `git add` — a sibling's commit
   sweeps staged files.
3. ✅ **The five "blocked on Richard" items all roll forward**, unchanged: FB-009 (syllabus prose),
   FB-012 (tutorial content), FIX-026, the `tsfixme` baseline, and the production
   `ANTHROPIC_API_KEY` (**no deadline** — that urgency was retracted). None gates 0.2.2.
