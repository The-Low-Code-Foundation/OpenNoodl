# SM-005 — A kit can be sold

| Field | Value |
|---|---|
| **Tier** | 1 |
| **Effort** | M |
| **Surface** | `kit`, `catalog`, `editor` |
| **Rulings** | 🔴 **D2 — do we sell kits at all?** If no, **cut this task; do not descope it into ECO-002** |
| **Depends on** | P69's kit substrate and install routes. D2 |

## The job

Build an **entitlement primitive**: can *this project* use *this kit*? Nothing more.

Today there is no licensing or entitlement concept anywhere in the catalog or scaffold packages —
verified in source. Kits can be shared; they cannot be sold. If SM-009's premise holds and a vertical
kit is the product, that is the gap between a research finding and a business.

**Deliberately narrow.** This is *not* [ECO-002 Marketplace](../phase-20-ecosystem/ECO-002-MARKETPLACE.md)
and *not* [ECO-004 Hosted Platform](../phase-20-ecosystem/ECO-004-HOSTED-PLATFORM.md) — both are gated
Horizon-3 specifications that explicitly require a commercial decision and, in ECO-004's case, warn
that a hosted service is *"permanently"* an operational obligation. This task builds no storefront, no
payment handling, no hosting, and no discovery. It answers one question at install and at build time,
and leaves the commercial machinery for a phase that has decided to own it.

**What the ecosystem evidence says about the shape:**

- **Certification-gated tiers are what make an entitlement worth anything.** Odoo requires 1/3/6
  certified staff for Ready/Silver/Gold and pays 10/15/20% *including on renewals*; the credential
  version-decays across three releases so the certified stock re-buys itself. Where nothing requires a
  credential it is free, every time — Grafana at $400M+ ARR, n8n, Make, Airtable, Retool, Strapi.
- **Creator splits have moved decisively toward the creator.** Webflow went to **95/5** in October
  2025; **Bubble's 25% take is now the uncompetitive end**. Whatever D2 decides, taxing a young kit
  ecosystem is the wrong optimisation.
- **The buyer objection is on record.** A configurator freelancer, unprompted: clients *"do not want
  to pay an additional subscription to third-party software… a client purchases once and has it
  forever."* Perpetual-per-project may fit this market better than recurring.

## Acceptance criteria

1. **A kit can declare that it requires an entitlement**, and a project can hold one. The
   representation is inspectable, diffable and lives in plain files like everything else.
2. **All five install routes honour it**, or explicitly and visibly do not. P69 found five routes and
   that three converge on `apply()`'s copy loop — an entitlement checked on one route and not the
   others is worse than none, because it reads as enforcement while not being it.
3. 🔴 **The export path is covered.** The same copy loop runs for exports; a kit must not leave in a
   stranger's zip in a state that silently grants entitlement.
4. **Absence is a clear, actionable message, never a silent failure or a broken graph.** The user
   learns what they need and how to get it.
5. **Offline and self-hosted still work.** A check that requires a call home breaks the self-hosted
   promise and the air-gapped industrial case that SM-001 may be about to validate.
6. **Build the caller**: a gated kit is installed with and without entitlement, and a project using it
   is built and deployed both ways. The AC is the *difference* between the two runs.
7. 🔴 **A written non-goal section** naming what this is not: no storefront, no payments, no licence
   server, no revocation-at-a-distance. The scope creep here is the risk.

## Traps

- 🔴 **If D2 says no, cut it.** Merging a half-built entitlement into ECO-002 leaves a gated
  Horizon-3 spec carrying live code it never asked for.
- 🔴 **An explicit file manifest silently drops a new file** (P69). If entitlement metadata is a new
  file in the kit, the manifest will not carry it unless told.
- 🔴 **Do not build DRM.** The realistic threat model is honest users on the wrong plan, not attackers.
  Anything that inconveniences the former to deter the latter is a mistake, and the freelancer quote
  above says exactly how the market feels about it.
- ⚠️ **Entitlement without a partner ladder is a lock with no door.** SM-007 is where it acquires
  meaning; if D3 is also "no", reconsider whether D2 was really "yes".
