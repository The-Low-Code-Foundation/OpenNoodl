# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## 🔴 THE BOARD — re-derived from the task FILES, 2026-09-02 (s41)

🔴 **Standing rule, set by Richard 2026-08-30 — read
[`dev-docs/guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md) first:**

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.**
> Otherwise it is filed with an owner, and **the next session builds the next task.**

| task | state, read off its own file |
|---|---|
| SBR-001 | ✅ closed s2 |
| SBR-002 | ✅ closed s4 |
| SBR-003 | 🟡 built s4 — **owes the `var(--token)` dimension-port probe**, and owns [D38](DEFECTS-THE-SITE-BUILDER-FOUND.md#d38) |
| SBR-004 | ✅ built s5, driven s8b |
| SBR-005 | 🟡 built s36 — AC1's second half is **Richard's to look at**, not a session's |
| SBR-006 | ✅ closed s33 |
| SBR-007 | 🟡 **AC3 CANNOT BE MET** — D15, no runtime drop-target capability, re-measured at HEAD with a boundary control at s29. The phase must not close pretending otherwise |
| SBR-008 | ✅ built |
| SBR-009 | 🟡 built s37 — **AC1's live half and AC3 are owed to SBR-014**, not blocked |
| SBR-010 | ✅ built and driven s38 |
| SBR-011 | 🟡 built and driven s39 — **AC3 open, blocked by [D46](DEFECTS-THE-SITE-BUILDER-FOUND.md#d46)** |
| SBR-012 | ✅ built s35 |
| SBR-013 | ✅ **closed s41 — all three ACs** ([§5](SBR-013-THE-DOCTRINE-RULE.md)) |
| **SBR-014** | ⬜ **never built** — and it is the phase's end condition |
| SBR-015 | ✅ built s13 |
| SBR-016 | ✅ fixed and driven s15 |
| SBR-017 | ✅ built and driven s14 |

🟢 **SBR-014 is now the ONLY task in this phase that has never been built.** Everything else is
either closed, owed to SBR-014, owed to Richard's eyes, or blocked by a named defect.

---

## 🟢 FIRST JOB: **[D46](DEFECTS-THE-SITE-BUILDER-FOUND.md#d46)** — and it now blocks the last task too

s41 built a task, so the rule's *2-sessions-0-ACs* arithmetic is reset and the next session is free
to take a defect. **D46 is the one to take, and the reason has changed since the last handoff:** it
no longer only blocks SBR-011 AC3. **SBR-014 step 5** — *"pick Night, watch the local preview, save,
watch the open site repaint live"* — is the same behaviour, so the last unbuilt task in the phase
cannot be driven past step 5 while D46 stands.

| | what | note |
|---|---|---|
| **first** | **D46** — six subscriptions silence the app | The fix is **one shared SSE connection per backend with a registry POSTing the union**. The row names the two traps: per-subscription **filters** would over-deliver on a shared stream, and the **PocketBase** dialect keys its change event on the collection name, so listeners must be added and removed with the registry. ⚠️ **Do not close it by raising the 15s deadline.** Then re-run `sbr011-live-preview-drive` and settle AC3 — `liveCollections` names which of the three went live. |
| **then** | **SBR-014** — the phase's acceptance run, and the gate on closing | It re-verifies every person sentence. It also collects **SBR-009's AC1 live half and AC3**, which are not blocked — `helpers/site-drive.ts` has existed for thirteen sessions. ⚠️ Its AC2 says a step that cannot be driven is recorded **⬜ against that task by name**, never rounded off. SBR-007 AC3 (D15) is one such step and is known in advance. |
| ⚠️ **before** SBR-014 | **[D47](DEFECTS-THE-SITE-BUILDER-FOUND.md#d47)** | Two drives are red in the working tree — `sbr010-messages-drive` 17/17 and `sb008-public-site-drive` 7. SBR-014 re-drives both of those stories through the panel UI, so a session that starts SBR-014 without settling D47 will meet it as a mystery halfway through. **Re-derive, do not relay** — the register carries the controls, not a diagnosis. |
| last | **SBR-003's remainder** — the `var(--token)` dimension-port probe, and D38 | small, and nobody has rendered D38 |

---

## 🔴 What s41 learned that the next session will need

- 🔴 **Grep the seam the CONSUMER reads, not the one you remember writing.** Six doctrine strings
  reach a model and exactly **one** already said what SBR-013 was asked to add — the in-editor
  planner's. The five an external agent reads did not, and the MCP briefing said the opposite in so
  many words. *"The repo teaches design-first"* was true; *"the product teaches design-first"* was
  false; reading the editor's own prompts would have confirmed the wrong one.
- 🔴 **The acceptance criterion can be green before the work.** SBR-013 AC2 asked for the style
  vocabulary to be read before the first component. **The control arm, built from committed HEAD,
  did that** — and so did the phase-55 haiku baseline in August. One arm would have certified the
  change by measuring something the change did not cause. What actually discriminated was
  `metadata.designTokens` **absent vs 34 tokens on disk**. ✅ **Run the control arm even when the
  shipped arm looks like a pass — especially then.**
- 🔴 **A cold-drive control has to be BUILT, not just reverted.** The drive loads
  `packages/noodl-mcp/dist/noodl-mcp.cjs` and it was two days stale. Reverting the source and
  running would have measured the shipped build twice and reported it as a control. Grep the built
  `.cjs` for the changed string before each arm.
- 🔴 **The MCP resident surface has SEVEN tokens free** —
  [D48](DEFECTS-THE-SITE-BUILDER-FOUND.md#d48), owner `NONE`. That is ~28 characters. The next
  clause added to any tool description breaks the gate, and the gate's own header says there must
  not be a third renegotiation. ⚠️ **Anything that widens a tool description or the instructions is
  now a design question, not an edit.**
- ⚠️ **zsh does not word-split an unquoted variable.** `FILES="a b c"; for f in $FILES` iterates
  ONCE with the whole string. Nothing was lost here because the paths did not exist — the same shape
  with a `>` that resolves truncates a file silently. `FILES=(a b c)` and `"${FILES[@]}"`.

---

## 🔴 The register

### [D48](DEFECTS-THE-SITE-BUILDER-FOUND.md#d48) — 🔴 NEW, owner `NONE`. Seven tokens of MCP surface headroom

Measured on a passing run (8,274/6 free before SBR-013, 8,273/7 after — SBR-013 gave one back).
Already blocks a real thing: `create_plan`'s description still says nothing about what must precede
a plan. The row carries one measured, **undriven** way to buy ~39 tokens back.

### [D46](DEFECTS-THE-SITE-BUILDER-FOUND.md#d46) — 🔴 owner `NONE`. Six realtime subscriptions on one origin silence the app

Unchanged. Blocks SBR-011 AC3 **and SBR-014 step 5**. Fix named and sized in the row.

### [D47](DEFECTS-THE-SITE-BUILDER-FOUND.md#d47) — ⚠️ owner `NONE`. Two drives are red in the working tree

Unchanged. ✅ Measured **not** to be D45's fix, with the fix reverted and at committed HEAD.
`sbr010` draws no text input at all. Phase 82's REL-002a edits are in the tree and in the built
bundle — a lead, not a finding.

### [D45](DEFECTS-THE-SITE-BUILDER-FOUND.md#d45) — 🟡 half closed. The leak is fixed

`render-from-disk.js`'s proxy destroys its upstream when the downstream closes. Mutant-graded.

### [D40](DEFECTS-THE-SITE-BUILDER-FOUND.md#d40) — nothing on a published page scrolls. Owner SBR-002

**Unchanged, still the cheapest open control in the phase:**

> Render `templates/members-area/` through the **same** `withRenderedPage` and read the same four
> numbers. If it scrolls, D40 is the site-builder's ground and SBR-002 owns a real defect. If it does
> not, D40 is `render-from-disk.js` and the row is about the harness.

⚠️ It still contradicts phase 81's VIB-001 (`unreachablePx: 0` on all 44 shots); two instruments
disagree and neither reading is safe to relay until one is re-derived. ⚠️ **Phase 82's REL-002a is
editing exactly this** — check that lane before re-deriving.

### [D43](DEFECTS-THE-SITE-BUILDER-FOUND.md#d43) — a refused list says "No pages yet". Owner `NONE`

Unchanged. `/Pages/Admin`'s `count` is still wired `true`; `sbr010Messages.test.ts` holds it as a
measurement, so a fix reddens the arm.

### [D38](DEFECTS-THE-SITE-BUILDER-FOUND.md#d38) — the hero's scrim vs `colorOnPrimary`. Owner SBR-003

⚠️ A hypothesis with a named test. Nobody has rendered it.

---

## 🔴 The phase's end condition, unchanged

**SBR-014 is the gate on closing phase 77**, and it re-verifies every person-sentence AC. **It is no
longer waiting on SBR-013** — that closed at s41 — so the distance to done is D46, D47 and then
SBR-014 itself. 🔴 **That is the distance, not the length of the register.**

⚠️ **AC3 of SBR-007 cannot be met at all** — D15, re-measured at HEAD with a boundary control at
s29. Phase 77 must not close pretending AC3 is met.

⚠️ **Richard still owes two looks**, and no session can substitute for them: whether the five
section kinds (SBR-005 AC1's second half) and the rebuilt theme editor (SBR-009 AC1) are worth
*looking* at. The SBR-005 pictures are in
`dev-docs/tasks/phase-81-the-look-is-the-product/verdicts/sbr-005/2026-09-01/site-builder-living/`;
**no pictures exist of the theme editor, the Messages screen, or the live site updating** — a shot
list is a cheap thing for SBR-014 to add.
