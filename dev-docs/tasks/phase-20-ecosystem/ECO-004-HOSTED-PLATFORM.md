# ECO-004: Hosted Platform

## Metadata

| Field | Value |
|-------|-------|
| **ID** | ECO-004 |
| **Phase** | Phase 20 — Ecosystem (Revival Horizon 3) |
| **Status** | 🔒 **Gated — do not start before Gate G3 and an explicit commercial decision** |
| **Scale** | 6+ months, plus permanent operational commitment |
| **Prerequisites** | Gate G3; a business model decision; likely LEARN-004's outcome |
| **Recommended executor** | 🔵 **Fable 5** — the technical work is conventional; the decision architecture (what to host, for whom, at what obligation) is where this succeeds or fails, and it is largely a business question with technical consequences. |

*This is a specification, not an implementation plan. See the [phase PROGRESS notes](./PROGRESS.md) for why.*

## What this is

A first-party hosted service: one-click deployment, hosted collaboration, and managed classroom accounts.

## Why it might matter

This is the item most likely to be the commercial engine, if there is to be one. Everything else in the revival plan produces a tool people run themselves; a hosted platform produces recurring revenue and, more importantly, removes the setup friction that blocks the least technical users — which is precisely the audience Phase 17 targets.

It is also the item that most changes what the project *is*. Running a hosted service means uptime obligations, on-call, security response, data protection compliance, payment handling, and support — permanently. A project that has been dormant for five months because one person got busy cannot casually acquire those obligations. That is not an argument against doing it; it is an argument for deciding deliberately, with a plan for who operates it, rather than drifting into it because deployment felt like a natural next feature.

## The specific hazard: hosting minors' data

If the education wedge wins Gate G3, hosted classroom accounts mean storing schoolchildren's work. That carries legal obligations that vary by jurisdiction and are not optional — consent, retention limits, deletion rights, breach notification, and often specific certifications before a school district may use the service at all.

Phase 17's design deliberately avoids this by keeping student data local and account-free. A hosted platform reverses that decision, and the reversal must be a considered choice with proper legal advice, not an implementation detail.

## Open questions to resolve first

- **Is there a business model?** Who pays, how much, and for what? Without an answer, this is a cost centre with an operational tail.
- **Who operates it?** Uptime, security response, and support require people, not just code.
- **What is hosted** — application deployment, collaboration sync (ECO-001), classroom accounts, the marketplace (ECO-002), or all of them? Each has a different risk profile.
- **Does LEARN-004's web-editor verdict change the shape?** A browser-based editor would make hosting far more central; a desktop-only product makes it optional.
- **Data protection**, especially for minors — jurisdiction, certification, and consent.
- **What happens if it shuts down?** Users' work must remain theirs and retrievable. Phase 18's export is the honest answer here and should be a hard requirement, not a nice-to-have.

## Rough shape of the work

Accounts and identity; deployment and hosting infrastructure; collaboration sync backend (if ECO-001 needs it); classroom/organisation management; billing; support tooling; compliance and data-protection work; incident response processes.

## Dependencies

- Gate G3 plus an explicit commercial decision
- Possibly ECO-001 (sync backend), ECO-002 (marketplace hosting), LEARN-004 (web editor verdict)
- Phase 18 export as the guaranteed exit path — non-negotiable

## Scale

6+ months to launch, and then indefinitely. Treat the ongoing operational cost as the real number, not the build cost.
