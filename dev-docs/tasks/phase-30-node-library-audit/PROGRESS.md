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
| NDA-012 Remaining 147 nodes | ⬜ Not started | Register generated; 0/155 verdicts filled |

## Audit coverage

| | Count | |
|---|---|---|
| Nodes with a machine-derived smell row | 155 | ✅ `NODE-REGISTER.md` |
| Nodes whose implementation has been read | 8 | the ones Richard named |
| Nodes with a hand-written verdict | 0 | NDA-012 |
| Systemic defect classes identified | 4 | A reactivity, B failure, C documentation, D string contracts |
| Findings live-verified in the running editor | 0 | everything in `FINDINGS.md` is read from source |

## Decisions awaiting Richard

1. **NDA-002 §1** — should a mutation performed inside a change listener coalesce? Recommendation:
   no; keep the existing cycle breakers and surface them through the NDA-004 error channel.
2. **NDA-003 §1 corollary 3** — should Number/String variables hold a real `null`, distinguishable
   from `0`/`''`? Recommendation: yes, with a per-node `Treat empty as` input for back-compat. The
   smaller alternative (fix the casts only) is written into the task's Risks section.
3. **NDA-002 §2** — approach A (patch prototype methods) or B (Proxy, matching `Model`).
   Recommendation: B. It is the higher-risk change and the only one that covers `arr[0] = x`.

## Log

- **2026-07-28** — Phase created from Richard's list of eight nodes plus the cross-cutting reactivity
  report. First-pass audit done: catalog swept (155 nodes), four systemic defect classes evidenced
  with file:line citations, eight named nodes read. Register generator added at
  `scripts/node-audit/register.js`. Tier 1 specced. One reported symptom (Component Stack scroll
  jump) could not be located in source and is recorded as unreproduced rather than guessed at.
