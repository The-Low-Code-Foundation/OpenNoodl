# Phase 53 — Trust & Compliance (Track T: passing an audit)

**Created:** 2026-08-06
**Status:** 📋 Specced, not started — 7 tasks. Post-alpha. **The least glamorous phase on the roadmap
and one of the two that widen the envelope rather than deepen the middle.**
**Origin:** [the counter-review](../../reviews/NODEGX-VS-CODE-THE-COUNTER-REVIEW.md) §B.6, and the
*compliance load* row of
[the fitness envelope](../../reviews/NODEGX-WHAT-IT-IS-FOR.md#1-the-fitness-function-as-thresholds).

## What this phase buys, precisely

The envelope's compliance row is currently **green for low, red for payroll / medical / KYC**, and
that red excludes real categories the platform is otherwise ideal for:

- **HR and people tools** — absence, onboarding, reviews, right-to-work documents
- **Charity and public-sector casework** — the exact thing §3.3 of the envelope had to caveat, where
  the coordination is a perfect fit and the personal data is not
- **Education records** — pastoral notes, SEN provision, safeguarding-adjacent logging
- **Anything sold to a company with a security questionnaire**, which is most B2B above about ten seats

**Be honest about the ceiling: this phase does not get you to payroll, medical records or payments
processing.** It gets you from *"cannot responsibly hold personal data"* to *"can hold ordinary
personal data and answer for it"*, which is the difference between excluding four categories and
including them.

## Where we start from — better than you would guess, and incomplete in a specific way

Genuine credit first, because the foundations are unusually good and both comparison documents
undersold them:

| Have | Where |
|---|---|
| Per-record ACL + class permissions + roles + scoped API keys + read-only admin tier | `security/model.ts` |
| A SQL ACL predicate with a **property-tested JS twin**, so query filtering and realtime filtering cannot drift | same |
| A privileged-action audit trail — permission edits, role changes, schema changes, backups, admin logins | `query_backend_audit` |
| Structured logging with **`redact()` on every field**, so a caller cannot log a secret by handing it a config object | `ops/logger.ts` |
| Rate limits per route class, trusted proxies, CORS origins, audit retention | `ops/model.ts` |
| Backups and tested restore | BAK-007 |

That is a better starting position than most bespoke stacks, and better than the reference app's.

**What is missing is everything that faces outward** — the artifacts an auditor, a DPO or a customer's
security questionnaire asks for. The data protection is real; the *accountability* for it is
unbuilt.

## Tasks

| ID | Title | Est. | Notes |
|---|---|---|---|
| **TRU-001** | Subject access export | 1.5 wks | "Give me everything you hold about this person, as a file." Harder than it sounds and the reason it is first: personal data is not only in the `users` row — it is in records they created, files they uploaded, audit entries naming them, and execution history payloads. Needs a **declared** notion of which collections carry personal data, authored per project. |
| **TRU-002** | Erasure, and what it means for the things that must not change | 2 wks | The genuinely hard task. Deleting a user must not silently corrupt an audit trail whose integrity is the point, or leave their data in backups and execution history. The answer is per-surface and must be **written down before it is coded**: records deleted, audit entries pseudonymised (the action stays, the actor becomes a tombstone), execution payloads purged on a schedule, backups aged out with a stated maximum. |
| **TRU-003** | Retention as a project surface | 1 wk | Execution history, audit entries, realtime buffers and orphaned files all accumulate. Today retention is an ops config with one knob. A project should declare per-collection retention and the backend should enforce it — which is also the honest answer to *"how long do you keep it"* on every questionnaire. |
| **TRU-004** | SBOM for the artifact | 4 d | A deployed backend is an esbuild bundle plus — after [phase 44](../phase-44-compute-ceiling/README.md) — a compiled-in module kit. Nobody can currently answer *"what is inside this and am I affected by CVE-X."* Emit CycloneDX at build; stamp it into the artifact. |
| **TRU-005** | An advisory and patch path for the kit | 1 wk | ⚠️ **The consequence of MOD-002 that phase 44 does not cost.** Kit packages are compiled into the bundle, so a CVE in the xlsx reader needs a platform release *and* every customer rebuilding and redeploying. Needs: an advisory feed, a "your artifact contains an affected version" check, and a documented emergency-release path. Without it, the curated kit is a liability the moment it is popular. |
| **TRU-006** | Access review export | 3 d | "Who can see what, as of today" — principals, roles, collection rules, active API keys — as a signed, dated artifact. `check_backend_access` already answers this one question at a time; this is the same data as a report. Cheap, and it is the single most-requested item in enterprise reviews. |
| **TRU-007** | The threat model, written down | 1 wk | Including — **especially** — the things we have decided not to defend. A cloud function has full `process` authority by explicit decision (MOD-005 rejects a sandbox as dishonest); the trust model is "the author of a function deploys the backend"; that assumption breaks for agent-authored functions (MOD-007) and for any platform where users author logic. **An auditor who finds this themselves concludes you did not know. An auditor who reads it in your threat model concludes you did.** Same fact, opposite outcome. |

**Total: ~7.5 weeks.** TRU-004 + TRU-006 + TRU-007 (~2.5 wks) is a coherent first slice that answers
most of a security questionnaire without touching the data layer.

## The pattern this phase must break

Two "reachability mistaken for access control" defects have already shipped — FH-024 (the local admin
API was cross-origin readable **and writable**) and OBS-004 (the observability relay was readable by
any web page) — and [phase 45](../phase-45-streaming/README.md)'s own README flags a third waiting in
STR-004.

**An auditor does not read that as three fixed bugs. They read it as a pattern in a codebase with one
reviewer.** TRU-007 should name the class explicitly and state the rule that prevents the fourth
instance, rather than leaving three incidents to be discovered separately.

## Deliberately out of scope

- **SOC 2 / ISO 27001 certification.** An organisational programme, not a phase, and it needs more
  than one person to sign anything.
- **Payments compliance (PCI).** Do not hold card data. Use Stripe's hosted surfaces. This is a
  documentation answer, not a feature.
- **Medical (HIPAA / DSP Toolkit) and payroll.** Out of the envelope even after this phase, and the
  fitness document should keep saying so.
- **Encryption at rest beyond the filesystem's.** Real, and it needs a key-management story that does
  not exist; scope it when someone asks with a budget attached.

## Exit criteria

1. A DSAR for one user produces a file containing their records, their uploads and the audit entries
   naming them — and a reviewer agrees nothing is missing.
2. Erasing a user leaves the audit trail *intact and attributable to a tombstone*, and the written
   policy for every surface predates the code.
3. A deployed artifact answers "what is inside you" in a machine-readable format.
4. A CVE in a kit package produces an actionable notice naming the affected artifacts.
5. "Who can access what" is one export, dated and signed.
6. The threat model states, in plain words, what a cloud function can reach and who is trusted to
   write one.
