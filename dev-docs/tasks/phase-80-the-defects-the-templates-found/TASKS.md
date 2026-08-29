# Phase 80 — task list

Status legend: ⬜ open · 🟡 partial · ✅ done · 🔒 blocked on a ruling · 🧭 needs Richard

Ranked by **who it bites**, not by cost. See
[THE-SWEEP-2026-08-29.md](../phase-77-the-site-builder-rescue/THE-SWEEP-2026-08-29.md) §4 for the
derivation and [README.md](README.md) for why the phase exists.

| id | status | task | source rows | bites |
|---|---|---|---|---|
| DEF-001 | ⬜ open | [The defaults fail accessibility on the two controls every app has](DEF-001-THE-DEFAULTS-FAIL-ACCESSIBILITY.md) | P78 D11, D13 | every **end user** |
| DEF-002 | ⬜ open | [The door does not check connections](DEF-002-THE-DOOR-DOES-NOT-CHECK-CONNECTIONS.md) | P77 D1, D10 · P78 D1 | every **agent-authored app** |
| DEF-003 | ⬜ open | [Three authoring acts with no honest surface](DEF-003-THREE-AUTHORING-ACTS-WITH-NO-SURFACE.md) | P77 D8 = P76 F15 · P77 D7 · P76 F16 | every **author** |
| DEF-004 | ⬜ open | [When it goes wrong you cannot see where](DEF-004-WHEN-IT-GOES-WRONG-YOU-CANNOT-SEE-WHERE.md) | P77 D2, D3 | anyone **debugging** |
| DEF-005 | 🔒 ruling | [Membership is a category the graph cannot express](DEF-005-MEMBERSHIP-IS-UNEXPRESSIBLE.md) | P78 D2, D3 | every **membership app** |
| DEF-006 | ⬜ open | [The design system punishes the agent that uses it](DEF-006-THE-DESIGN-SYSTEM-PUNISHES-ITS-USER.md) | P78 D12, D15 | every **agent** styling on-system |
| DEF-007 | ⬜ open | [A project means one thing on disk and another once loaded](DEF-007-DISK-AND-LOAD-DISAGREE.md) | P78 D9 residual · P77 D5 | the **next template** |
| DEF-008 | ⬜ open | [The measurement owed](DEF-008-THE-MEASUREMENT-OWED.md) | P77 D6 · P78 D5 | nobody yet — a re-drive |
| DEF-009 | ⬜ open | [A public write door ships with no limit](DEF-009-A-PUBLIC-WRITE-DOOR-WITH-NO-LIMIT.md) | **P76 F3** | a **site owner** whose form fills their database |

## Carried forward from phase 76, by reference

🔴 **These four were `⬜ open` when phase 76 closed.** They are **not re-authored here** — a second
copy of a task drifts from the first, and phase 76's files hold the measurements. Phase 80 owns
them; **read the linked file, not a summary of it.**

| id | status | task | source | bites |
|---|---|---|---|---|
| DEF-010 | ⬜ open | [SB-009 — a component named in a **parameter** is not checked](../phase-76-the-site-builder/SB-009-A-COMPONENT-NAMED-IN-A-PARAMETER.md) | P76 F1 | every agent-authored app; **13 `component`-typed ports, 1 has an owner** |
| DEF-011 | ⬜ open | [SB-010 — the door does not derive a JS node's script ports](../phase-76-the-site-builder/SB-010-THE-SCRIPT-PORTS-THE-DOOR-DOES-NOT-WRITE.md) | P76 F10 | **every cloud component any agent authors** — dead signal outputs, a 30s 504 |
| DEF-012 | ⬜ open | [SB-011 — a query widens when it cannot narrow](../phase-76-the-site-builder/SB-011-A-QUERY-THAT-WIDENS-WHEN-IT-CANNOT-NARROW.md) | P76 F12/F13 | a cloud query returns **every row** when asked for a few |
| DEF-013 | 🔒 ruling | [SB-012 — three spellings of a component name](../phase-76-the-site-builder/SB-012-THREE-SPELLINGS-OF-A-COMPONENT-NAME.md) | P76 s6 | **an app whose pages link to each other cannot be authored in one pass** |

⚠️ **DEF-010, DEF-011 and DEF-013 are the same door as
[DEF-002](DEF-002-THE-DOOR-DOES-NOT-CHECK-CONNECTIONS.md)** — `noodl-mcp/src/validate.ts` and its
reference resolution. DEF-002 grades **wires**; DEF-010/013 grade **references named in
parameters**; DEF-011 is **port derivation**. Four checks, one file. 🔴 **Sequence them, and assert
cardinality where they meet** — a check in a second pipeline is a duplicate first.

🔴 **Three of the four say the same thing about their own fix: it needs a corpus sweep** to decide
whether the new check *blocks* authored output or merely warns. That sweep is shared work and
should be done **once**, not three times.

## Rulings needed (Richard)

- 🧭 **Does this phase exist, or do these fold into 0.2.1's bug-fix phase?** The tasks are written to
  survive either answer. What they must not do is stay inside a template phase — a template phase
  closes when its template ships, and these outlive it.
- 🧭 **DEF-005 is a security-posture ruling before it is code.** The cloud-only rule on role *writes*
  is correct and must survive; the question is whether a browser may **read** its own roles. Reading
  one's own roles grants nothing — the server still decides every request — but it is a posture
  change and it is yours.
- 🧭 **DEF-001 changes the shipped default palette.** That is a visible product change and it moves
  every project created after it. Ruling wanted on whether `--primary` moves or
  `--primary-foreground` does.
- 🧭 **P76 F8, still open since s4** — `contactRecipient` cannot live in a world-readable
  `SiteSettings` row. Carried in phase 76 with no register; recorded here so it stops being invisible.
  It blocks the claim that a contact form reaches anyone.
- 🧭 **DEF-009: should a public cloud function's `rateLimit` default to something rather than
  `null`?** A default too low breaks a legitimate burst; `null` is what shipped.

## Not in this phase, and why

- **P77 D4** (a refused query and an empty collection are the same screen) — 🔄 **reclassified as
  template work.** `DbCollection2` carries both `failure` (signal) and `error` (string) at HEAD, and
  phase 78's D4 drove it: a 403 fires `failure`. The site builder never wired them. → SBR-006/SBR-010.
- **P78 D10** (the generators bypass the design system) — template-generator work with a named home
  in phase 78. Disproved as a platform limitation: `metadata.designTokens` persists and the artefact
  ships it.
- **P77 D9** (deploy drops wire-only `prop-*`) — already owned by **SBR-008**.
- **P76 F10 / F12 / F13** — already owned by **SB-010** / **SB-011**.

## Session log

- **2026-08-29** — Phase created from the three-register sweep. 54 findings across phases 76, 77 and
  78 — **including phase 76's 28, which had no register at all** ([now it has one](../phase-76-the-site-builder/DEFECTS-PHASE-76-FOUND.md)). 17 still real, product-side and unowned; 3 already owned. Nothing built yet.
