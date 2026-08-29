# Phase 80 — task list

Status legend: ⬜ open · 🟡 partial · ✅ done · 🔒 blocked on a ruling · 🧭 needs Richard

Ranked by **who it bites**, not by cost. See
[THE-SWEEP-2026-08-29.md](../phase-77-the-site-builder-rescue/THE-SWEEP-2026-08-29.md) §4 for the
derivation and [README.md](README.md) for why the phase exists.

| id | status | task | source rows | bites |
|---|---|---|---|---|
| DEF-001 | ✅ done | [The defaults fail accessibility on the two controls every app has](DEF-001-THE-DEFAULTS-FAIL-ACCESSIBILITY.md) | P78 D11, D13 | every **end user** |
| DEF-002 | ✅ done | [The door does not check connections](DEF-002-THE-DOOR-DOES-NOT-CHECK-CONNECTIONS.md) | P77 D1, D10 · P78 D1 | every **agent-authored app** |
| DEF-003 | ✅ done | [Three authoring acts with no honest surface](DEF-003-THREE-AUTHORING-ACTS-WITH-NO-SURFACE.md) | P77 D8 = P76 F15 · P77 D7 · P76 F16 | every **author** |
| DEF-004 | ✅ done | [When it goes wrong you cannot see where](DEF-004-WHEN-IT-GOES-WRONG-YOU-CANNOT-SEE-WHERE.md) | P77 D2, D3 | anyone **debugging** |
| DEF-005 | 🔒 ruling | [Membership is a category the graph cannot express](DEF-005-MEMBERSHIP-IS-UNEXPRESSIBLE.md) | P78 D2, D3 | every **membership app** |
| DEF-006 | ✅ done | [The design system punishes the agent that uses it](DEF-006-THE-DESIGN-SYSTEM-PUNISHES-ITS-USER.md) | P78 D12, D15, **D20** | every **agent** styling on-system |
| DEF-007 | ⬜ open | [A project means one thing on disk and another once loaded](DEF-007-DISK-AND-LOAD-DISAGREE.md) | P78 D9 residual · P77 D5 | the **next template** |
| DEF-008 | ⬜ open | [The measurement owed](DEF-008-THE-MEASUREMENT-OWED.md) | P77 D6 · P78 D5 | nobody yet — a re-drive |
| DEF-009 | ⬜ open | [A public write door ships with no limit](DEF-009-A-PUBLIC-WRITE-DOOR-WITH-NO-LIMIT.md) | **P76 F3** | a **site owner** whose form fills their database |
| DEF-017 | 🟡 C2 done, **C1 open** | [Track C, handed over by phase 78](../phase-78-the-templates/TRACK-C-HANDOFF.md) | **P78 D18, D19, D26** | every app: controls in the wrong face; one content surface for nine kinds of thing |
| DEF-014 | ⬜ open | [A filter on a column nothing has written is a 500](DEF-014-A-QUERY-AGAINST-A-COLUMN-LESS-CLASS.md) | **P77 SBR-015 s12 drive** | every **site owner on day one** — the site-builder cannot publish its first page |
| DEF-015 | ⬜ open | [The backend card calls three components undeployed that can never deploy](DEF-015-THE-CARD-WARNS-ABOUT-WORKERS.md) | **P77 SBR-015 s12 drive** | every **author with a Run Tasks worker** — a green deploy that reads as failed |
| DEF-016 | ✅ done | [External Link reports Failure on every new tab it opens](DEF-016-EXTERNAL-LINK-ALWAYS-REPORTS-FAILURE.md) | **P18 EXP-011 Tier 2.5 s41 drive** | every **author who wired Done or Failure** on the node — a link that worked, reported as blocked |

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

## Reds that belong to someone else, named so they stop reading as regressions

- ✅ **`noodl-mcp/tests/templateAppearance.test.ts` — `site-builder has the pinned page count`,
  expected 5, received 6 — CLOSED 2026-08-29 by phase 77.** I attributed it to TPL-001 because the
  pin lives in their file; **phase 77 took it instead and was right to**: SBR-017 is what made the
  site-builder six pages, so the pin's disagreement was their consequence. Pin bumped to 6, the new
  page answers §4's bare-page floor, noodl-mcp is **938/938**. ⚠️ **Worth keeping as a shape: the
  owner of a red is whoever moved the measured thing, not whoever owns the file the number sits in.**
- ✅ **`catalog:check` — a PR CI gate (`pr.yml:198`) — was RED at HEAD** because `0c011b6b`
  (DEF-016) changed three `External Link` port descriptions without regenerating the catalog.
  **Fixed as a side effect of DEF-003's regeneration.** Recorded because it is last session's own
  lesson arriving twice: *a closed task's outstanding debts need an owner, not just its carried rows.*
- 🔴 **`catalog:examples` — a PR CI gate (`pr.yml:210`) — is RED at HEAD, 60/62, and has been since
  2026-08-29.** Measured by DEF-006 s7 before it changed anything, and again after: unchanged either
  way. Two shipped recipes carry a warning each, and `catalog:examples` is warnings-as-errors:
  `comp-repeater-set-item-object` fires `signal-into-value-port` on a checkbox's `checked`, and
  `fn-aggregate-stats-function` fires `failure-reaches-nothing` on a cloud aggregate. **Both example
  files date to `c0d6c86f` (2026-07-23) and are unchanged; what moved is the rules** —
  `failure-reaches-nothing` was promoted by **DEF-002** on 2026-08-29. DEF-002's closing note says
  what remains of that rule's corpus is *"two deliberately-malformed test probes"*; these are neither.
  They are the recipes `get_example` hands every agent, teaching the two defects phases 76 and 77
  filed as findings. 🔴 **Owner: `NONE`** — a closed task cannot own its debt, and this one is a PR
  gate that fails every PR until somebody takes it. Fix is a graph edit to two recipes, ~20 minutes,
  and both diagnostics carry their own `suggestion`.
- ⚠️ **`packages/noodl-mcp/dist/noodl-mcp.cjs` is stale**, so a *running* MCP server still answers
  `notFound` for `Page.title` until the next build. Source, suites and committed catalog are correct.
  **Owner: whoever cuts the next 0.2.1 build.**

## Findings this phase raised that nobody owns

- 🔴 **There is no semantic token for error TEXT, and that is why a composition has to reach for a
  raw palette token to stay legible.** Owner: **`NONE`**. Found by DEF-006 s8 while sourcing
  `fieldError` (see that file's **§7.4**).

  `--destructive` is the only semantic red in the set and it is a **fill** colour — sized for white
  text on top of it. Measured as 14px text on the `--surface` a form card sits on, it is **4.38:1
  under Playful and 4.49:1 under Soft**, both under AA's 4.50. So `fieldError` ships `--red-700`,
  which holds 6.03:1 or better in all six palettes but which **no preset re-themes** — a re-themed
  app keeps a brick-red error line while everything else moves.

  **Neither option is right, and that is the finding.** What is missing is a token like
  `--destructive-text` that presets move *and* that clears 4.5:1 as type. 🔴 **It is not a
  one-line addition**: it means a value in `DefaultTokens.ts` **and in all five presets**, each
  chosen against the contrast floor — a design decision with a budget attached, which is why s8
  registered it instead of inventing it. ⚠️ **The gate now catches the mistake if somebody tries
  the easy version** — `design-token-contrast.test.ts` arm (e) grades text on `--surface` as well
  as `--background`, which is what would have caught `--destructive` here.

  🧭 **Plausibly Richard's**, on the same grounds DEF-001's `--primary` ruling was: it changes what
  every re-themed app looks like.

## Rulings needed (Richard)

- 🧭 **Does this phase exist, or do these fold into 0.2.1's bug-fix phase?** The tasks are written to
  survive either answer. What they must not do is stay inside a template phase — a template phase
  closes when its template ships, and these outlive it.
- 🧭 **DEF-005 is a security-posture ruling before it is code.** The cloud-only rule on role *writes*
  is correct and must survive; the question is whether a browser may **read** its own roles. Reading
  one's own roles grants nothing — the server still decides every request — but it is a posture
  change and it is yours.
- ✅ **DEF-001 — RULED 2026-08-29.** Richard: **`--primary` moves, white text stays.** Landed at
  `30eb92b2`. See DEF-001's §7.
- ✅ **DEF-002 — CLOSED 2026-08-29.** All three rules and AC6. `1bc1cb8a` (1a), `95be7b4c` (3),
  `820fde86` (AC6 + the calibration script), `c8e0f262` (1b/1c), `b91d696a` (2).
  🔴 **One decision is deferred, and its recorded reason was corrected at `d3461020`.** Promoting
  `failure-reaches-nothing` into `AUTHORED_BLOCKING_WARNINGS` looked blocked by the **shipped
  templates**; it was not. It was blocked by **two false positives in the rule** (a `completed` that
  already answers, and a parallel branch that already answers), both now exits with arms and
  controls. Corpus **249 → 182 → 33**, templates **clean**. What is left is **two deliberately-
  malformed test probes** — wire their `failure` or exempt them, then add the code to the set. Small
  and named, recorded in `authoredCandidate.ts` beside the set.
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

### DEF-017 — Track C, and why it is phase 80's rather than phase 78's

🔴 **Renumbered from DEF-010 on 2026-08-29.** `DEF-010` was assigned **twice** in this register —
here, and to SB-009 in the carry table above. SB-009 holds the number: its own banner
(*"OWNED BY PHASE 80 AS DEF-010"*) and phase 76's closing carry table both pin it, and both predate
Track C's registration. **Commits and notes written before this date that say `DEF-010` and mean
Track C mean DEF-017** — `e87ea775` and `42325550` are the two.


🧭 **Richard scoped the members'-area repair into three tracks and ruled Track C ours**: it is
product source (`StyleCompositions.ts`, the viewer's control CSS), and phase 78 has deliberately
never touched editor source — that isolation is what has kept the two phases from colliding.
Everything is measured with file and line in
[TRACK-C-HANDOFF.md](../phase-78-the-templates/TRACK-C-HANDOFF.md); it was verified at source
before any of it was acted on, and every measurement in it held.

- ✅ **C2 (D18/D19) — DONE `42325550`.** `assets/style.css` had **exactly one `font-family`
  declaration in the whole file**, on `.ndl-controls-select`; `button` and `textinput` now
  inherit too. `StyleCompositions.ts`'s `body` description was corrected in the same commit —
  it told an author controls inherit the page font, which is what a generator reads *before
  deciding not to set one*, so the CSS repair alone would have been rewritten.
  🔴 **D19's cause is located, 2026-08-29, and it is wider than the row says.** The label is not
  hardcoded `#000` — **nothing sets a colour on it, and there is no colour floor to inherit.**
  `TokenResolver.generateCss` (POL-006) appends exactly one applied rule after the `:root` block:

      body { font-family: var(--font-sans); }

  **font-family only.** There is no `color: var(--foreground)` anywhere in the viewer, the two
  static HTML templates, or the token CSS — grepped, zero hits. So *any* element that does not set
  its own colour renders the browser's black, and the label is simply the one somebody looked at.
  `--foreground` is a token nothing reads at the floor — **the same defect class as
  `--surface-raised` in D26**, which C1 has just fixed.

  ✅ **The fix is one line in the place designed for it**, and POL-006's own reasoning transfers
  verbatim: *"a floor, not an override — `body` is the weakest place to say it, so any node that
  sets its own still wins."*
  ⚠️ **State the blast radius before doing it**: every element in every project that does not set
  a colour moves from `#000` to `var(--foreground)`. In the default theme that is `#0f172a`, a
  near-black and a small change; **in a dark theme it is a large one, and the correct one** —
  which is the argument for the fix rather than against it.
  ⚠️ **Not applied yet, deliberately**: `TokenResolver.ts` is under `noodl-editor/src`, which a
  peer's running `dev:debug` watches, and a hot rebuild under someone's live drive is not a thing
  to do behind their back. Apply after teardown.

  ⚠️ **D19 (a control's own `<label>` renders `#000`) is NOT done** — the colour comes from the
  label style group (`TextInput.tsx:235`, and the same in Checkbox/RadioButton), not from the
  stylesheet, so it is a different fix from D18's and was left rather than guessed at.
- ✅ **C1 (D26) — DONE `2c6a8876`.** Two compositions, `raised` and `ruled`, both **lifted verbatim
  from `ui-data-table`** and diffed against their source nodes — identical. `raised` reads
  `--surface-raised`, the token that was in the set and read by nothing; `ruled` carries **no fill
  at all**, which is what stops a list reading as a stack of cards.
  🔴 **The file's doctrine is that parameters are copied from a shipped, gated recipe and that a
  composition which cannot be grounded is LEFT OUT rather than invented.** Worth knowing before
  touching this file: "add a composition" is not a design task here, it is a sourcing task. Two
  details came free from obeying it that taste would have got wrong — `ruled` uses
  `--border-subtle` where `raised` uses `--border`, and `ruled` has no `backgroundColor`.
  ⚠️ **`raised` only reads as raised on a `--surface` ground** (`--surface-raised` and
  `--background` are both `#ffffff`), and its description says so.
  ⚠️ **A drift sweep of all 20 compositions was run and NOT reported, twice, because both readings
  were the checker** — a regex flattened `maxWidth: { value: 1200, unit: 'px' }` into a top-level
  `unit` parameter, and every false positive carried that key. The doctrine holds. A mechanical
  gate is worth having and needs a real parser.
  🟢 **Phase 78's B3 is unblocked.**

- ⬜ ~~**C1 (D26) — open**~~ Of eighteen compositions
  exactly **two** carry a content fill (`bandSurface`, `card`) and **both are `var(--surface)`**,
  so there is one way to make something look like a distinct object and **nine kinds of thing
  wear it**. That is the "standard bootstrap feel" Richard named. 🔴 **It is cheap:
  `--surface-raised` is already in the token set, declared once and read by nothing** — verified:
  0 references in `StyleCompositions.ts`, and its single occurrence in the members-area is a
  *declaration* in the project token block, not a paint. The second surface does not need a
  palette decision, it needs a **reader**. Same shape as *a token nothing reads is a theme
  nobody sees*.
  ⚠️ **Not more variants of `card`** — what is missing is contrast *between* compositions: a
  **raised** treatment on a `--surface` ground, and a **ruled** treatment so a list stops looking
  like a stack of cards. 🔴 **Phase 78's B3 is capped until C1 lands.**
- ✅ **C3 (D20)** — filed at `f9367dc7` as DEF-006 §0(c).

- **P76 F10 / F12 / F13** — already owned by **SB-010** / **SB-011**.

## Session log

- **2026-08-29 (s8)** — **DEF-006 (c) closed, and the survey's one judgement was wrong.** The six
  compositions landed verbatim — the vocabulary is **26** and now names a form field, a control that
  takes typing, an error line and an empty state. 🔴 **§6.4 said to source `fieldError` from
  `--destructive`; measured, that fails AA as text in two of the five presets** (Playful 4.38, Soft
  4.49 on `--surface`) where `--red-700` never drops below 6.03. The survey measured against
  **white** rather than the ground a form card sits on, and against the **default palette only** —
  which its own next line warned against. 🔴 **The contrast gate would have passed it**: it graded
  undeclared backgrounds as `--background`, where the same token clears in all six. Gate widened to
  both implicit grounds (**55 → 86 pairs**, nothing reddened) and pinned by arm (e), which a
  narrowing mutant reddens **alone**. The recipe's own note was right and its **number was stale** —
  3.60:1 was exact for `#ef4444`, the value `--destructive` held before DEF-001 moved it that
  morning. Missing `--destructive-text` registered above with owner `NONE`.
  Commits: see the phase-80 next-session prompt.

- **2026-08-29 (s7)** — **DEF-006's scope closed; (c) left, with a sourcing survey rather than a
  sentence.** The audit AC2 asked for found **1** inert parameter in 20 compositions — and widening
  the same instrument to the recipes those compositions are copied from found **11**, of which
  **2 were the rule's own false positives**: `conditionIsUnsatisfied` answered from the authored
  parameter bag while the canonical evaluator falls back to the port's default. Fixed in the rule,
  measured over compositions + 62 examples + 40 projects (1,601 nodes) at **3 removed / 0 added**,
  with a sabotage control at **70 added** so the zero is a reading. 🔴 **The contract test that
  existed to catch exactly this could not**: its model of the canonical evaluator was a bag lookup
  with the default fallback deleted. `find_tools` now finds a group by id/title/keywords — its own
  description had been promising that already — at **8,255 → 8,254** resident tokens.
  Commits: see the phase-80 next-session prompt.

- **2026-08-29** — Phase created from the three-register sweep. 54 findings across phases 76, 77 and
  78 — **including phase 76's 28, which had no register at all** ([now it has one](../phase-76-the-site-builder/DEFECTS-PHASE-76-FOUND.md)). 17 still real, product-side and unowned; 3 already owned. Nothing built yet.
