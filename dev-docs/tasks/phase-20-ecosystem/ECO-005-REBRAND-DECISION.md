# ECO-005: Rebrand Decision

## Metadata

| Field | Value |
|-------|-------|
| **ID** | ECO-005 |
| **Phase** | Phase 20 — Ecosystem (Revival Horizon 3) |
| **Status** | 🔒 **Gated — deliberately late; requires traction worth renaming** |
| **Scale** | A decision, then 2–4 weeks if the answer is yes |
| **Prerequisites** | Demonstrated traction (post Gate G2 at minimum) |
| **Recommended executor** | 🔵 **Fable 5** — the deliverable is a judgement about identity, timing, and cost, informed by where the product actually landed. The mechanical rename afterwards is Sonnet work. |

*This is a specification, not an implementation plan. See the [phase PROGRESS notes](./PROGRESS.md) for why.*

## What this is

Deciding whether to rename the product — the original Phase 8 proposed "Nodegex" — and, if so, executing it.

## Why it is last, on purpose

The original roadmap placed a rebrand in Phase 8, relatively early. The revival plan moves it to the very end of Horizon 3, and the reasoning is worth stating because it will otherwise look like an oversight.

Renaming is a cost paid against existing recognition. When there is no recognition, the rename is free but pointless — nobody is confused, because nobody is looking. When there is recognition, the rename has a purpose but a real price: documentation, search results, community links, muscle memory, and installed applications all have to move.

The useful window is therefore *after* a product has found its audience and *before* that audience is large. Since the entire revival plan is structured around discovering whether an audience exists, the rename decision cannot sensibly precede that discovery. Doing it early would also mean renaming a product whose identity is still being decided — and the right name for an AI-collaborative builder is probably not the right name for a learning tool, which is exactly what Gate G3 resolves.

There is a further consideration specific to this project. "OpenNoodl" carries a real inheritance: it signals continuity with Noodl, which is how anyone who knew the original product finds this one. That is an asset while the community is small and drawn from Noodl's former users, and a diminishing one as new users arrive who never knew Noodl at all. The balance shifts over time, which is another reason to decide late rather than early.

## Open questions to resolve first

- **What is the product, now that it is known?** The name should follow the identity Gate G3 clarifies, not precede it.
- **How much recognition exists**, and is it Noodl-inherited or newly built? Analytics, community, and search data should inform this rather than intuition.
- **Is there an actual problem with the current name?** Trademark, confusion with the original Noodl or its successors, poor searchability, or a mismatch with the audience — a rename needs a reason beyond preference.
- **What is the migration cost?** Package names, application identifiers (which affect installed applications and their stored data), auto-update feeds, documentation, domains, and community links.
- **Can the transition be gradual** — an alias period rather than a hard cutover?

## Rough shape of the work, if the answer is yes

Name selection and trademark clearance; package and repository renaming; application identifier migration with a path for existing installations (this is the part most likely to break things — an application identifier change can orphan users' data and their update path); auto-update continuity; documentation and domain migration; a communications plan.

## The default answer

**Absent a specific problem with the current name, the default is no.** A rename consumes attention and goodwill that a small project can spend better elsewhere, and "OpenNoodl" is serviceable, descriptive, and carries useful inheritance. This task exists so the question is answered deliberately once, rather than recurring as a distraction — and recording a well-reasoned "not now" is a perfectly good outcome.

## Dependencies

- Gate G2 at minimum (traction), ideally G3 (identity clarified)
- REV-007's release infrastructure (any identifier migration runs through it)

## Scale

The decision itself is a short piece of work. Execution, if the answer is yes, is 2–4 weeks — most of it in application-identifier migration and communications rather than in code.
