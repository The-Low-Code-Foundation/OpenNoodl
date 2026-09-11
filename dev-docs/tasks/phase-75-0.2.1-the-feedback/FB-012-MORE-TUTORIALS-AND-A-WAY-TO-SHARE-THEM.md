# FB-012 — more tutorials, and a way to share them

**Filed:** 2026-08-22, from Richard's item 12. **Status: mixed — (b) is ✅ already built, (a) is
🧭 content, (c) is 🟡 + new scope.** Size: L overall, but it decomposes.

> *"Let's roll in to this bug fixing phase to create a new batch of tutorials to add to the
> community tab as default ones that everyone will see when they try the community out, and make
> it easy for us to commit new tutorials in the near future, and maybe add a button to share
> your tutorials with others (at least the ability to download them from the web page or
> launcher and share the file with another community member?)"*

---

## (b) The commit pipeline — ✅ built, verify it's live

- `npm run lessons:check` (`scripts/check-lesson-bundles.ts`) + its own `Lesson bundles
  (FIX-027)` CI job, **graded by mutation in CI** (7 derived breaks + empty-corpus exit 2).
  Landed `2ba69638`, on CI since 08-21. Adding a tutorial = add the bundle under
  `project-examples/lessons/`, register it, and the gate validates manifest + starter +
  solution.
- ⚠️ Still open from FIX-027: **`state-on-a-page` ships from nowhere** (the bundle exists in
  neither checkout; its `source.path` is a dead `/tmp` path) — that question must be answered
  before the pipeline covers the *whole* corpus. And `knownCollections` derivation (TUT-002
  AC3) is deliberately unsupplied.
- Authoring surface: UNI-010 §8.2 ✅ — MCP `get_lesson_brief` / `create_lesson` / `check_lesson`
  / `derive_starter` (starter built by subtracting the lesson from its own solution). This is
  the tool the batch gets authored with.

## (a) The batch — the wall is prose, not machinery

- Corpus today: **one** bundle (`log-a-thing`, 0 findings). The 15 University lessons are all
  `in-writing` and their prose is Richard's (67b: *Needs Richard*).
- **Publishing needs words too**: `publish-tutorial-bundle.ts` attaches a bundle to an existing
  `articles` row, `articles.body` is `not null`, and **prod has no articles at all** —
  `/api/v1/community/tutorials` answers an honest `total: 0`. That is why the community tab's
  tutorial section is empty for everyone.
- Proposal: pick **3–5** from the curriculum's early tier, author with the MCP surface against
  the brief, Richard supplies/edits the prose, publish as `curated`. Tutorials are *served*, so
  each one reaches every 0.2.0 install with no app update — this is the highest-leverage
  content work in the phase.
- 🆕 **One of the batch is set (test-user session, 08-22): a CSS-basics / responsiveness
  lesson** — the box model, absolute vs flow positioning, why a group takes full width, sizing
  modes, centring — for *"people who've no idea what absolute position even means"*. ⚠️ Checked
  against `curriculum.json` (2026-08-22): **none of the 15 lessons covers layout/CSS**, so this
  is new scope, not a pick — it needs a curriculum entry too (the no-slugs-in-src gate means
  adding it is a `curriculum.json` edit, which is the design working). Pairs with FB-016's
  overlay and FB-017's basic tier — the lesson teaches what those surfaces show.

🆕 (Jordan session 2, §7) **A batch lesson must carry accumulating state** — *"It forgets you
poke it twice. Nothing accumulates."* Whatever lesson taught that session didn't hold state
across interactions, which is the property that separates teaching from a sequence of clicks
— EL-004 requires the same of the scenario template. Bar for the batch: each lesson's app
accumulates visible state the learner caused. (⚠️ Clarify with Richard which lesson Jordan
meant — the curriculum's own early lessons are literally named "poke-it"/"it-forgets-you",
so this may be a critique of an installed lesson's *content*, not the lesson machinery.)

## (c) Sharing — finish the built half, then the file route

- **First-party download/install is TUT-004** — 7/8 ACs closed, R2 answered (`curated`), web =
  download, panel = one-click. **What's left is the drive (AC1/AC8).** Finish that first.
- **User-to-user sharing has no task anywhere** (the only mention is UNI-007's deferral of
  "community-authored lessons"). The cheap v1 that matches Richard's ask, without opening
  public *hosting* of user lessons (that would be FB-005-shaped moderation scope):
  1. **Export**: a "Share this tutorial" button in the launcher exports the installed bundle as
     a single file (the bundle directory zipped — the format already exists; D17 requires
     local-directory installability anyway).
  2. **Install from file**: the launcher accepts that file and installs it through the same
     register path, `source.kind: 'local'`, with `lessons:check`-grade validation on import —
     an imported bundle failing validation is refused with the findings shown, not installed
     broken.

## Acceptance criteria

- AC1 (a): ≥3 new tutorials pass `lessons:check`, are published with prose, and render in both
  the web list and the community tab; `total` on prod > 0.
- AC2 (c): TUT-004's AC1/AC8 drive done (one click from the panel, download from the web).
- AC3 (c): export → send file → install-from-file round-trips on another machine/account;
  a deliberately corrupted bundle is refused with findings named.
- AC4 (b): `state-on-a-page` has a home in a checkout and the gate covers it (closes FIX-027
  §18's other half).

## Traps

- A lesson bundle executes in the learner's editor — install-from-file is an untrusted-input
  surface; validation on import is load-bearing, not politeness.
- Driving lesson installs mutates real learner state on this machine
  (the-dev-editor-uses-the-live-app-userdata) — drive on a copy.
