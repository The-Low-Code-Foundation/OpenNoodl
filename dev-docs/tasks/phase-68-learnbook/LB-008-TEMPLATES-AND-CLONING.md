# LB-008 — templates and cloning

**Surface:** platform · **Tier 2** · **Effort:** M · **Blocked on:** LB-001/002 (there must be a
tree worth cloning)

## Premise

The biggest authoring cost in the original LearnBook's model, unnamed in its scope: a coach
delivering the same program to five coachees or a second cohort **rebuilds the tree by hand**.
This task makes a program's structure a reusable asset: save as template, instantiate for a new
coachee/group, and (for orgs) share templates on UNI-005's shelf. It is the difference between
LearnBook as a tool for one engagement and LearnBook as a coaching *practice's* tool.

## Scope (v1)

- **Save as template**: from any program the coach owns — captures the tree (modules, threads'
  opening posts, thread kinds, assignment definitions, embedded/attached media by reference) and
  **none of the exchange** (no replies, no done-state, no participants, no session notes —
  🔴 the template boundary is a privacy boundary: a template must be shareable without leaking a
  single word any coachee wrote).
- **Instantiate**: template → new program for a chosen coachee or group (LB-004's attach
  semantics), everything hidden by default (LB-005's pacing starts fresh), media **copied, not
  shared** — editing a new cohort's post must never mutate the template or an old cohort.
- **Template management**: list, rename, describe, delete; instantiating records provenance
  (which template, which version) so a coach knows which cohorts came from what.
- **Org shelf sharing**: an org-member coach can publish a template to UNI-005's shelf
  (org-scoped, same publish flow as prefabs — the shelf is the mechanism, a template is one more
  shelf item type); members instantiate from the shelf.
- **Update semantics, the honest v1**: instantiated programs are **detached copies**. No
  propagate-template-changes-to-live-cohorts — that is a hard sync problem v1 refuses (recorded
  here so it is a decision, not an oversight).

## Acceptance criteria

1. Template round trip: build a program with all three thread kinds and media → save → instantiate
   for a new coachee → the new program is structurally identical, empty of exchange, fully hidden.
2. The privacy boundary proved mechanically: a template serialisation of a program containing
   replies, notes, and done-state contains none of them (a test over the serialised form, not a
   UI check).
3. Media independence: replacing an image in the instantiated program leaves the template and a
   sibling instantiation untouched (three distinct blob references verified).
4. A shelf-published template is instantiable by another org member and invisible outside the org
   (UNI-005 criterion 2's standard).

## Not in v1

Template versioning/changelogs, propagating updates to live cohorts, a public template
marketplace (the phase-67 "marketplace rev-share" deferral applies), cross-org sharing,
template-level analytics.
