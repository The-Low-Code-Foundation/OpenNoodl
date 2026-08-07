# Phase 31 — Progress

**Track P — Readiness & Operations**

**All 10 tasks specced as of 2026-07-30. None started.**

| Task | Tier | Status | Notes |
|---|---|---|---|
| OPS-001 Maturity ladder & readiness panel | 1 | 📋 Specced | The taxonomy is the deliverable, not the registry code. Eight sibling tasks plus RCK-008 register against these level boundaries |
| OPS-002 Build identity & deploy verification | 1 | 📋 Specced | Generalises WF-003's content-digest build id to all five targets. The mismatch path must be produced for real before the task is called done |
| OPS-003 Findings store & feedback hotkey | 1 | 📋 Specced | **Phase 32 does not ship without this.** `componentPath` + `nodeIds` + `focusNodeId` is the part no code project can copy |
| OPS-004 Ops panel | 2 | 📋 Specced | A view over BAK-009/BAK-007/BAK-003. Adding a backend endpoint is a finding, not a licence |
| OPS-005 Observability plumbing & analytics module | 2 | 📋 Specced | The only irreversible items in the phase. Verify in a *deployed* build — NDA-004's H-ii is the precedent |
| OPS-006 Security sweep & deploy interlock | 3 | 📋 Specced | Provenance (does this value reach the client?) must land first; every check inherits it. Pen-testing deliberately deferred, scoped in Out of Scope |
| OPS-007 Content, links & meta panels | 3 | 📋 Specced | Derive, never store in parallel. Key derivation stability is the expensive-to-change decision |
| OPS-010 Launch guidance | 3 | 📋 Specced | Added 2026-07-30. The `how` the ladder lacked. The system prompt is the deliverable; the model must never declare an item complete — only `check()` does |
| OPS-008 Project journal & `query_context` | 4 | 📋 Specced | The authored quarter of the Project Brain. NodeGX already has the derived three-quarters |
| OPS-009 Authoring budget & circuit breakers | 4 | 📋 Specced | Must precede RCK-004 in practice regardless of priority tag — that task ships a button that spawns a fleet |

## The exit criterion

The phase is done when a user who has never read a devops document can answer these five questions
about their own app, from inside the editor, without asking anyone:

1. Is what is running the thing I built? *(OPS-002)*
2. What broke, and can I read the stack trace? *(OPS-005)*
3. Will any of my secrets be visible to visitors? *(OPS-006)*
4. What am I not ready for yet, and when will it matter? *(OPS-001)*
5. Everything I noticed while using my app — where did it go? *(OPS-003)*
6. I have never done any of this before — where do I start, and who is helping me? *(OPS-010)*

Question 3 is the one that justifies the phase on its own. Question 6 is the one the intended audience
actually asks first.

## Open questions for Richard

| # | Question | Why it is his call |
|---|---|---|
| 1 | **The four level names** — Playing / Sharing / Live / Scale. | They are user-facing vocabulary and they appear in the LEARN curriculum eventually. Naming is his. |
| 2 | **Does `security.no-client-secrets` really sit at Sharing?** The spec puts it there on the argument that showing five friends a link still exposes a key. | It is the only Critical-severity item below Live, and it is the one place the phase nags a hobbyist. |
| 3 | **Analytics module: PostHog first, GlitchTip second — or neither by default?** | The guide argues PostHog consolidates six of eight gaps. Committing to a vendor's shape in a shipped module is a product decision. |
| 4 | **Journal committed by default?** OPS-008 says yes (reasons should travel with the project); the counter-argument is that it can leak. | Defaults about what enters someone's git history are his to set. |
| 5 | **How far do the legal templates go?** OPS-010 §6 proposes privacy policy, terms, cookie notice and *mentions légales* skeletons, filled from the project's own schema and configured processors, each carrying a non-dismissible "not legal advice" banner in the generated page. | Liability-adjacent, and the line between "explains what a document is for" and "tells you what the law requires" is a product-voice decision, not an engineering one. |
| 6 | **Where does end-user onboarding live?** "Getting *your users* into *your app*" — item 9 of the scoping list — is a template plus a set of nodes, i.e. phase 21, not a checklist item. OPS-010 puts it Out of Scope on that basis. | It is the more valuable and less owned of the two readings, and filing it wrongly means nobody finds it. |
| 7 | **Which guidance content does he write himself?** The spec treats summaries, step wording and legal templates as authored product voice (the LEARN-002 precedent). Fifteen items is a lot of prose. | Same call he already made for the curriculum: whether the voice is his or delegated with review. |

## Decisions already taken

Recorded in [README.md](./README.md) — declared-not-inferred levels, no convention files, no backend
extension, third-party observability as a module, and nothing blocking a deploy except OPS-006's
critical findings with a recorded override.

## Notes for whoever starts

- **Start with OPS-001's taxonomy in prose**, and circulate it before any code. Everything downstream
  registers against those boundaries and moving them later touches nine files across two phases.
- OPS-002, OPS-003 and OPS-007 have disjoint territories and can run concurrently from day one.
- The [parallel worktree traps](../../reference/) apply: worktrees are created from `origin/main`, so
  read `git reflog` rather than trusting `HEAD`, and live-verify from the primary checkout.
- Every task in this phase has a live pass in its Implementation Steps and none of them are optional.
  This is a phase about telling the truth to users; a task verified only by unit tests has not
  demonstrated that it does.
</content>
