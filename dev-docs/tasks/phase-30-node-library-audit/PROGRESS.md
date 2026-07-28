# Phase 30 — Progress

**Track O — Node Library Audit & Remediation**

| Task | Status | Notes |
|---|---|---|
| NDA-001 Node behaviour corpus | ⬜ Not started | Specced. Must land red before NDA-002/003 |
| NDA-002 Reactivity contract | ⬜ Not started | Specced. §1 needs Richard's call on listener-coalescing |
| NDA-003 Empty-value contract | ⬜ Not started | Specced. §1 corollary 3 needs Richard's call on nullable Numbers |
| NDA-004 Failure contract | ⬜ Not specced | Briefed in README |
| NDA-005 Port documentation sweep | ⬜ Not specced | Briefed in README |
| NDA-006 Columns | ⬜ Not specced | Briefed in README + FINDINGS §1 |
| NDA-007 Icon | ⬜ Not specced | Briefed in README + FINDINGS §2 |
| NDA-008 Component Stack | ⬜ Not specced | **Blocked on reproducing the scroll jump** — no cause found in source |
| NDA-009 Run Tasks | ⬜ Not specced | Briefed in README + FINDINGS §4 |
| NDA-010 Popups | ⬜ Not specced | Briefed in README + FINDINGS §5 |
| NDA-011 REST → HTTP | ⬜ Not specced | Briefed in README + FINDINGS §8 |
| NDA-012 Remaining 142 nodes | ⬜ Not started | Register generated; 0/155 verdicts filled |
| NDA-013 Repeater Refresh re-reads source | ⬜ Not specced | **Tier 1.** Small, standalone, cause confirmed at `foreach.tsx:509-527` |
| NDA-014 `object`/`array` type dead ends | ⬜ Not specced | Type-table decision, not a node fix |
| NDA-015 Explicit targeting for scope-resolved nodes | ⬜ Not specced | Subsumes half of NDA-010 |
| NDA-016 `Layout.size` unset-`sizeMode` branch | ⬜ Not specced | **Diagnosis unfinished** — needs the running editor |

## Audit coverage

| | Count | |
|---|---|---|
| Nodes with a machine-derived smell row | 155 | ✅ `NODE-REGISTER.md` |
| Nodes whose implementation has been read | 13 | 8 named by Richard + 5 from his second list |
| Nodes with a hand-written verdict | 0 | NDA-012 |
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

## Log

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
