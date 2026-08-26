# FB-005 — templates anyone can share

**Filed:** 2026-08-22, from Richard's item 4. **Status: ⬜ OPEN — R-templates ruled 2026-08-22:
CURATED FIRST.** Size: L+. Slice before starting.

📋 **The slice exists: [FB-005-SCOPE.md](FB-005-SCOPE.md) (2026-08-25).** ✅ **T1 (s40), T2 (s42) and T3 (s43) are closed — AC1, AC2 and AC3 are met. T4 is next.** 🔴 Read §1 before anything else: the sweep bullet below is wrong, and the correction changes where the work is.

🔴 **What is now true and was not**: a builder can start a new project from a template, through a picker, from the launcher. What is still **not** true is that anybody has published one — the community shelf is empty and the platform is undeployed, so the *curated* half of R-templates has a mechanism and no content.

✅ **R-templates, as ruled:** Richard publishes; a share button **files a submission, it does not
publish**. Same posture as tutorial curation. 🔴 This is *not* Richard's item 4 as written — he asked
for "just let anyone upload anything" and ruled against his own phrasing, so **ECO-002's G3 gate
stays shut** and the licence trap (P69: *"20/20 ≠ fit to publish"*) stays parked until a later
ruling opens uploads. Ratings/categories/search are still in scope over the curated set.
⚠️ **D7 gave no moderation posture for third-party content** — it was ruled on the bench only.

> *"When can we add 'templates' to the things you can upload to the community? Shouldn't be
> complicated I imagine? Just let anyone upload anything, make a star rating system and show the
> top rated ones first, filter by categories, text search."*

---

## What exists (swept 2026-08-22) — and why "shouldn't be complicated" needs qualifying

- 🔴 **WRONG, corrected 2026-08-25 — see [FB-005-SCOPE.md](FB-005-SCOPE.md) §1.** ~~There is no
  template mechanism in the product at all.~~ There is a complete one — `TemplateRegistry`, an
  `ITemplateProvider` interface and **four** providers — and it is **unreachable**.
  `templateRegistry.list()` has **zero callers**, so there is no picker; `handleCreateProjectConfirm`
  hardcodes `projectTemplate: ''`, which is falsy, so the registry's download branch never runs.
  Every new project is in fact created *from* a template (`embedded://hello-world`), via a direct
  `new EmbeddedTemplateProvider()` that bypasses the registry. ⚠️ The dead path also contains a
  **hang** (no `xhr.onerror`) and a Windows path bug. Still true: P70's README (*"there is no
  template picker in the product, only style presets"*) and MCP `create_project` skipping
  templates entirely.
- **ECO-002** (`phase-20-ecosystem/ECO-002-MARKETPLACE.md`) is the marketplace spec — **gated on
  G3 (community critical mass)**. Richard asking for it is evidence toward the gate, but opening
  it is a ruling, not a drift.
- **UNI-005's org shelf** already publishes prefabs/templates **org-scoped** — the storage and
  visibility machinery is a working precedent, deliberately not public.
- **Ratings were ruled out of v1** in UNI-004's not-in-v1 list (dev reviews/ratings) — a star
  system partially reverses that; name it.
- **E7's object store exists** (SigV4 to Hetzner, grant pattern) — the blob half is solved; the
  grant/prefix traps from E7 apply verbatim (refuse keys outside the prefix, sniff bytes).
- P69's licence finding is the trust problem in miniature: *"20/20 ≠ fit to publish"* — ~9 kit
  modules vendored libs with no licence text. **"Let anyone upload anything" ships other
  people's code to strangers.**

## R-templates — what Richard is deciding

1. Open public template upload now (partially opening ECO-002's gate), org-shelf machinery
   generalised — or a curated first batch (we publish, users download) as v0?
2. Star ratings v1 (one rating per account, no text reviews) — reverses UNI-004's exclusion?
3. Moderation floor: D7's report/flag verbs apply to templates too; who takes one down?
4. Licence posture: uploader asserts a licence from a fixed list; no assertion, no listing?

## Proposed v1 slice (after the ruling)

- A template = a project export (zip) + metadata (name, description, category from a fixed
  vocabulary, licence). Upload from the launcher ("Share as template"), stored via the E7
  object-store pattern, listed under a new `/templates` section with the existing facet-bar +
  FTS machinery (UNI-023's pattern).
- Install = "New project from template" in the launcher — this is the half that touches the
  editor (`projectTemplate` finally gets a value) and is the reason this is L+, not M.
- Stars: one per account, sort by rating with a count floor (a 5.0 with one vote must not beat
  a 4.6 with forty — say the formula in the spec).

## Acceptance criteria (sketch — firm up after R-templates)

- AC1: upload → listed → downloadable by another account; the file round-trips byte-identical.
- AC2: "New project from template" produces a working project from a downloaded template.
- AC3: categories + text search work through the existing facet machinery; rating sort states
  its formula and its bound.
- AC4: a template with no licence assertion cannot be listed; report/flag present per D7.
- AC5: the four platform gates + envelope contract pass; new columns classified in the census.
