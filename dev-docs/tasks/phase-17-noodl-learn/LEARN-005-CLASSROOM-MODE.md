# LEARN-005: Classroom Mode

## Metadata

| Field | Value |
|-------|-------|
| **ID** | LEARN-005 |
| **Phase** | Phase 17 — Noodl Learn (Revival Track E) |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 6–8 weeks |
| **Prerequisites** | LEARN-002 (curriculum), AIX-001 (local models); informed by LEARN-006 |
| **Branch** | `task/learn-005-classroom-mode` |
| **Recommended executor** | 🟠 **Opus 4.8** — conventional application features (dashboard, sharing, configuration) whose difficulty lies in privacy and deployment constraints rather than algorithms. Should be driven by pilot feedback, not designed in the abstract. |

## Objective

Make OpenNoodl deployable and usable in a real classroom: teacher visibility, easy project sharing, offline and account-free operation, and AI that runs locally.

## Background

The gap between "a good learning tool" and "a tool a school will actually use" is mostly non-technical, and it is where educational software usually dies. A teacher evaluating OpenNoodl faces questions the product currently answers badly or not at all: Can I see how my students are getting on? Can they start without creating accounts? Does student work leave the building? Will this work when the school network is unreliable? Can I install it on thirty machines without a week of IT tickets?

None of these are hard engineering problems. All of them are blocking, and they compound: a teacher who cannot answer the privacy question does not get to the point of caring how good the curriculum is.

Two constraints shape this task in ways worth naming. **Privacy is close to absolute** — sending minors' work to a third-party AI API is a non-starter in many jurisdictions and institutions, which is precisely why AIX-001's local-model support is a prerequisite here rather than a nice-to-have. And **friction budget is near zero**: a teacher trying this out has a free period, not a project plan. Anything requiring accounts, configuration, or IT escalation before the first lesson will simply not be attempted.

This task should follow rather than precede the pilots where possible. LEARN-006 will surface what actually blocks real classrooms, and building this in the abstract risks solving imagined problems.

## Current State

- No teacher-facing features exist. The editor assumes a single developer working alone.
- Project organisation (folders, tags) exists in the launcher — potentially reusable for classroom structure.
- AIX-001 introduces local-model support via Ollama, making offline AI feasible.
- LEARN-002 provides the curriculum with progress tracking per learner (LEARN-001's persistence).
- LEARN-003's web viewer provides link-based sharing that requires no install.
- REV-007's signed builds and auto-update make institutional installation practical.

## Desired State

- A teacher can set up a class and see who has progressed how far through the curriculum.
- Students can start immediately: no account, no sign-up, no email.
- Student work can be shared with the teacher and, optionally, with the class.
- AI tutoring runs locally, with no student data leaving the machine or the school network.
- Everything works offline after installation.
- Installation is one artifact per platform that an IT department can deploy.

## Scope

### In Scope
- [ ] Teacher dashboard: class roster, curriculum progress per student
- [ ] Account-free student start (local identity; no third-party sign-up)
- [ ] Project sharing: student → teacher, and optionally student → class
- [ ] Local-model AI configuration made genuinely easy (this is the difference between "supported" and "usable")
- [ ] Offline operation for the whole lesson flow
- [ ] Deployment guide for IT departments
- [ ] Privacy documentation stating plainly what data exists and where it goes
- [ ] Teacher setup flow achievable within one free period

### Out of Scope
- Hosted classroom service with cloud accounts (ECO-004, and a much larger commitment including data-protection obligations)
- Grading, assessment scoring, or LMS integration (worth considering only if pilots ask for it)
- Student-to-student real-time collaboration (ECO-001)
- Identity federation (SSO, Google Classroom) — assess after pilots

## Technical Approach

### Design constraints

**No accounts by default.** Student identity should be local — a name on a device, or a class code — with no external service. Accounts are a privacy liability, an IT obstacle, and a friction point, and the educational value does not require them.

**Local-first data.** Student work lives on the student's machine; sharing is an explicit action, and the teacher dashboard aggregates what has been shared rather than surveilling continuously. This is both the privacy-respecting design and the simpler one.

**Local AI must be genuinely easy**, not merely possible. If configuring Ollama requires a terminal, no teacher will do it. Consider bundling or scripted setup, model-download guidance, and clear messaging about which features work with local models and which need more capable ones.

### Sharing mechanism

The obvious approaches — shared network folder, a class code with a lightweight local server, or exported bundles via the LEARN-003 viewer — differ mainly in what IT will permit. Let the pilots decide; build the mechanism that the pilot schools' constraints actually allow, rather than the most elegant one.

## Implementation Steps

1. **Wait for pilot input if possible.** LEARN-006's early findings should shape this task; building first and discovering constraints later is the expensive order.
2. **Local student identity and account-free start.**
3. **Progress tracking** per student, built on LEARN-001's persistence.
4. **Sharing mechanism** chosen against real pilot constraints.
5. **Teacher dashboard** — roster and progress, deliberately simple.
6. **Local AI setup flow** that a non-technical teacher can complete.
7. **Offline verification** of the entire lesson flow.
8. **IT deployment guide and privacy documentation.**
9. **Test the full setup with a real teacher**, timed — if it exceeds a free period, simplify.

## Testing Plan

- A teacher unfamiliar with the product completes setup within one free period, unaided.
- Full lesson flow works with networking disabled.
- Local AI tutoring answers questions with no external requests (verify at the network level, not by assertion).
- Sharing works under realistic school network restrictions.
- Dashboard reflects student progress accurately.
- Installation via the IT guide succeeds on a managed machine.

## Success Criteria

- [ ] Teacher can set up a class and see curriculum progress
- [ ] Students start with no account and no sign-up
- [ ] Sharing works within a real school's network constraints
- [ ] AI tutoring runs locally with verified zero external data transmission
- [ ] Entire lesson flow works offline
- [ ] Teacher setup completed within one free period by a real teacher
- [ ] IT deployment guide and plain-language privacy documentation published

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Features built for imagined classrooms rather than real ones | Sequence after (or alongside) LEARN-006 pilots; let real constraints drive the design |
| Local model setup is too technical for teachers | Treat setup UX as a primary deliverable; bundle or script it; test with a non-technical user |
| Local models are too weak for useful tutoring | Test explicitly during AIX-001; if quality is inadequate, be honest in documentation and consider a school-network-hosted model as an alternative to per-machine setup |
| Privacy claims are stronger than reality | Verify at the network level and document precisely; over-claiming here is both an ethical and a legal problem |
| Scope drifts toward a hosted service | Explicitly out of scope; ECO-004 is where that decision belongs |

## References

- [Revival roadmap — Track E (E-05)](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- [Viability report — §2.2 (education is a distribution problem)](../../reviews/NOODL-VIABILITY-REPORT.md)
- Depends on: LEARN-002, AIX-001 (local models), LEARN-001 (progress persistence), REV-007 (installable builds). Informed by: LEARN-006

## Checklist

- [ ] Branch `task/learn-005-classroom-mode`; review LEARN-006 findings first
- [ ] Local identity and account-free start
- [ ] Progress tracking and teacher dashboard
- [ ] Sharing mechanism chosen against real pilot constraints
- [ ] Local AI setup flow tested with a non-technical user
- [ ] Offline verification at the network level
- [ ] IT deployment guide + privacy documentation
- [ ] Timed real-teacher setup test; CHANGELOG; open PR
