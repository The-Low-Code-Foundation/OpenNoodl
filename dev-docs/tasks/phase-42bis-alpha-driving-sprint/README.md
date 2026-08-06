# Phase 42bis — The alpha driving sprint

**Created:** 2026-08-06
**Status:** open, blocks the alpha cut
**Measured against:** `91fcd680` (clean tree)
**Origin:** Richard's own live driving on 2026-08-06, during the ALPHA-001 first-hour run

## Why this phase exists

ALPHA-001 Part A — the cold-install first hour — started on 2026-08-06 against a clean
tree at `91fcd680`. It got through §1 (launcher and first run, which passed) before
**Richard, driving the editor himself in parallel, filed thirteen findings in one
message** and stopped the run:

> *"It looks like we have to write up another bug fixing sprint before we continue the
> alpha launch please"*

That is the correct call, and the reason is worth stating plainly: **an hour of a human
building a real thing found more than the scripted pass was going to.** He was building
an app against the SQLite backend — creating records with ACLs, making roles, wiring a
String node, using Record — and every finding came out of trying to finish a task, not
out of walking a checklist.

**Nothing here is a regression.** Every one of the thirteen is a first sighting, because
every surface involved is code-complete-never-driven. That is the same category ALPHA-001
exists to empty, and it is why the first hour must resume after this phase rather than
instead of it.

## The through-line

Three of the thirteen are the same defect wearing different clothes:

> **The product knows something true and shows the user something else.**

- The backend's access-control model is real, correct and property-tested — and the data
  browser will not show you a record's ACL, so you cannot debug it (SPR-001).
- The runtime marks 139 ports "you cannot wire this" — and the Ports tab lists them as
  ports anyway (SPR-003).
- Cloud functions have a template, an icon, a sheet and a create gesture — and the panel
  that hosts them reads as a filter called "All" (SPR-005).

In each case the engineering landed and the surface that reports it did not. A fourth,
Record (SPR-004), is the same shape: it shows you nodes firing and then leaves you with
nowhere to go.

## The thirteen findings

F-numbers continue the shared sequence; F81 was allocated this session for the parked
ERG-005 specs. **Every row below was verified at file:line on 2026-08-06** — the
confidence column says how far, because this repo's registers have a history of rows
that outlived their fixes.

| # | Finding | Task | Confidence |
|---|---|---|---|
| F82 | The Ports tab lists ports the canvas refuses to connect | SPR-003 | ✅ mechanism confirmed |
| F83 | Cloud function authoring exists and cannot be found | SPR-005 | ✅ mechanism confirmed |
| F84 | The data browser hides the ACL, so ACLs cannot be debugged | SPR-001 | ✅ absence confirmed |
| F85 | Collection permission rules are free-text where they should be a closed vocabulary | SPR-001 | ✅ confirmed |
| F86 | No node can put a user in a role, so roles cannot be used at signup | SPR-001 | ✅ absence confirmed |
| F87 | Access Control Rules on data nodes — do they work? | SPR-001 | ✅ **answered: yes, on this backend** |
| F88 | The schema manager's edit button on an existing table does nothing | SPR-002 | ⚠️ reported, not yet reproduced |
| F89 | The Search page is unreadable to a non-programmer | SPR-002 | ✅ confirmed by report |
| F90 | Record's provenance pane sticks on a preview-instantiation warning | SPR-004 | ⚠️ reported, not yet reproduced |
| F91 | Record shows nodes firing and offers no route to the results | SPR-004 | ✅ confirmed by report |
| F92 | The Properties/Ports tab labels are not centred | SPR-003 | ✅ confirmed by screenshot |
| F93 | Port name and type collide on one line | SPR-003 | ✅ confirmed by screenshot |
| F94 | The port explainer popup is occluded by the panels around it | SPR-003 | ✅ confirmed by screenshot |

## Tasks

| Task | Tier | What it covers |
|---|---|---|
| [SPR-001](./SPR-001-ACCESS-CONTROL-SURFACE.md) The access-control surface | 1 | F84, F85, F86, F87 — the backend is right and unusable |
| [SPR-002](./SPR-002-BACKEND-PANEL-DEFECTS.md) Schema edit and Search legibility | 2 | F88, F89 |
| [SPR-003](./SPR-003-PORTS-TAB-TRUTH.md) What the Ports tab claims | 1 | F82, F92, F93, F94 |
| [SPR-004](./SPR-004-RECORDING-DEAD-END.md) Record's dead end | 2 | F90, F91 |
| [SPR-005](./SPR-005-CLOUD-FUNCTION-DISCOVERY.md) Finding cloud functions | 1 | F83 |

## Recommended order

1. **SPR-003** — one filter, one line of code, and it stops the panel lying about 139
   ports. Cheapest correctness-per-line in the phase.
2. **SPR-005** — near-cheap, and it unblocks anyone trying to use the backend at all.
   Overlaps phase 43's remit; check there before designing.
3. **SPR-001** — the largest, and the one with a genuine design question in it (F86's
   node). Do F84 first: without it nobody can verify any of the rest.
4. **SPR-002**, **SPR-004** — need reproduction before they need fixing.

## Scope

**In scope.** The thirteen findings, and only those. Each is a defect in a shipped
surface, not a feature.

**Out of scope.** The visual ACL editor (F84 ships a JSON editor deliberately —
Richard: *"json editor for now, we'll do visual stuff later"*). Nested roles (F86 notes
Parse allowed role-in-role; whether NodeGX should is a design question this phase
records but does not answer). The BYOB REST backends, which drop ACLs by design and say
so — see SPR-001 §1.

## Exit criterion

Every one of the thirteen either fixed and **driven in a real editor**, or filed with a
measured reason it was not. Then ALPHA-001 Part A resumes at §2, from a clean tree, with
the commit recorded.

## What this phase must not become

A rewrite of the backend panels. Three of these are one-line fixes and two are copy
changes; the register is long because Richard drove for an hour, not because the
surface is rotten. **A sprint that turns into a redesign stops covering ground** — the
same failure mode ALPHA-001 §Part C warns about.
