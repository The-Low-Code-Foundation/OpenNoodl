# Phase 30 — Progress

**Track O — Node Library Audit & Remediation**

**All 16 tasks specced as of 2026-07-29.** None started.

| Task | Tier | Status | Notes |
|---|---|---|---|
| NDA-001 Node behaviour corpus | 1 | ⬜ Not started | Must land **red** before NDA-002/003/013 |
| NDA-002 Reactivity contract | 1 | ⬜ Not started | §1 needs Richard's call on listener-coalescing; §2 on Proxy-vs-patch |
| NDA-003 Empty-value contract | 1 | ⬜ Not started | §1 corollary 3 needs Richard's call on nullable Numbers |
| NDA-013 Repeater Refresh | 1 | ⬜ Not started | Cause confirmed `foreach.tsx:509-527`. ⚠️ watch the add/remove queue race |
| NDA-004 Failure contract | 2 | ⬜ Not started | §1 (the channel) is independently useful — NDA-002 wants it for cycle warnings |
| NDA-005 Port documentation | 2 | ⬜ Not started | Do the shared port definitions first and re-measure; batch with NDA-012 |
| NDA-006 Columns | 2 | ⬜ Not started | Checked: `Columns.tsx` is the **only** file special-casing `ForEachComponent` |
| NDA-007 Icon sets | 2 | ⬜ Not started | §1 is an interface decision; check LIB/styles before inventing an asset path |
| NDA-008 Component Stack | 2 | ⬜ Not started | **§0 blocking** — scroll jump has no located cause |
| NDA-009 Run Tasks | 2 | ⬜ Not started | §1 alone closes corpus F1 |
| NDA-010 Popups | 2 | ⬜ Not started | §2 shared with NDA-015 |
| NDA-014 Type dead ends | 2 | ⬜ Not started | Recommend option A now, C as the direction |
| NDA-015 Explicit binding | 2 | ⬜ Not started | §2 includes a sweep for other instances of the pattern |
| NDA-016 `Layout.size` | 2 | ⬜ Not started | **§0 blocking** — a contradiction between the mechanism and the default path |
| NDA-011 REST → HTTP | 3 | ⬜ Not started | First output is an assessment, not a change |
| NDA-012 Per-node audit | 3 | ⬜ **1 of 17 categories** | Variables done (4/4) as the worked example. Opt-in, resumable, stop on find-rate decline |

## Audit coverage

| | Count | |
|---|---|---|
| Nodes with a machine-derived smell row | 155 | ✅ `NODE-REGISTER.md` |
| Nodes with a pre-filled audit worksheet | 155 | ✅ `audit/`, 17 category files |
| Nodes whose implementation has been read | 15 | 8 named by Richard + 5 from his second list + Boolean/Color |
| Nodes fully audited against the 12 checks | **4** | Variables, as NDA-012's worked example |
| Systemic defect classes identified | 6 | A reactivity, B failure, C documentation, D string contracts, **E type dead ends**, **F implicit binding** |
| Findings live-verified in the running editor | 0 | everything in `FINDINGS.md` is read from source |

**Calibration:** the second pass found five real defects in six nodes. The structural sweep found
none of them. The 142 unread rows are unaudited, not clean — do not read a blank Verdict as a pass.

## Decisions awaiting Richard

1. **NDA-002 §1** — should a mutation performed inside a change listener coalesce? Recommendation:
   no; keep the existing cycle breakers and surface them through the NDA-004 error channel.
2. **NDA-003 §1 corollary 3** — should Number/String variables hold a real `null`, distinguishable
   from `0`/`''`? Recommendation: yes, with a per-node `Treat empty as` input for back-compat. The
   smaller alternative (fix the casts only) is written into the task's Risks section.
3. **NDA-002 §2** — approach A (patch prototype methods) or B (Proxy, matching `Model`).
   Recommendation: B. It is the higher-risk change and the only one that covers `arr[0] = x`.

## Find rate (NDA-012 stop signal)

| Category | Nodes audited | Nodes with ≥1 defect | New defects |
|---|---|---|---|
| Variables | 4 / 4 | 4 | 3 |

Three new defects in the *simplest* category in the library — `latestValue` initialising to `0`
regardless of type, `color` being a type dead end, and the String `length` getter that will throw the
moment NDA-003 makes `null` storable. Consistent with the second-pass calibration. Stop NDA-012 when
this table shows a category producing nothing new.

## Log

- **2026-07-29 (later)** — All 16 tasks specced. Added the NDA-012 per-node audit protocol: twelve
  checks derived from defect classes A–F, and `scripts/node-audit/worksheets.js` generating one
  pre-filled worksheet per category (checks B1/B3/C1/E1/H1 answered from the catalog). Audited the
  Variables category as the worked example — 4/4, 3 new defects, one of which is a fix-ordering
  hazard for NDA-003.
- **2026-07-29** — Second pass, from Richard's five further reports. Four confirmed against source
  (Repeater Refresh rebuilding from a stale private copy; Parent Component Object binding to the
  nearest ancestor with no targeting; `object` outputs reaching 4 of 1,750 input ports; `Layout.size`
  having no branch for an unset `sizeMode`). Repeater Item **not** confirmed as broken — but `Try
  Remove` reaches only `forEachActions[0]` while `Added` fans out to all, which is a real asymmetry.
  Two new systemic classes: **E** (type dead ends) and **F** (implicit binding). Four tasks added;
  NDA-013 is Tier 1 because it stands alone and makes the Repeater recoverable before NDA-002.
  Recorded the calibration point: the structural sweep found none of these, so the register's blank
  rows carry no assurance.
- **2026-07-28** — Phase created from Richard's list of eight nodes plus the cross-cutting reactivity
  report. First-pass audit done: catalog swept (155 nodes), four systemic defect classes evidenced
  with file:line citations, eight named nodes read. Register generator added at
  `scripts/node-audit/register.js`. Tier 1 specced. One reported symptom (Component Stack scroll
  jump) could not be located in source and is recorded as unreproduced rather than guessed at.
