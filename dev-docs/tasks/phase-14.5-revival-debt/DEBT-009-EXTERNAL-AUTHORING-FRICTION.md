# DEBT-009: External-Authoring Friction

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEBT-009 |
| **Phase** | Phase 14.5 — Revival Debt |
| **Priority** | 🟡 Medium (rises to High as AIX-002 approaches live use) |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 3–5 days |
| **Prerequisites** | None; coordinate with AIX-002 (in progress) |
| **Recommended executor** | 🟠 **Opus 4.8** — three engineering items plus one rollout decision; the decision (v2 flag default) should be confirmed with a human before flipping |

## Objective

Close the friction findings SUB-010's GO-verdict assessment *routed* to owners but nobody actioned — the items standing between "the external authoring loop is provable" and "it is usable without tribal knowledge."

## Background

SUB-010 demonstrated an external agent authoring a valid page end-to-end and returned GO. Its [assessment](../phase-13-format-ai-substrate/SUB-010-EXTERNAL-AUTHORING-DEMO.md) (see `demo/` and the LEARN-001-adjacent assessment doc referenced from phase-13 PROGRESS) was equally clear about what it hit on the way. Each finding got a routing note ("SUB-008's highest-value tweak", "a choice for SUB-002/SUB-008") — and the audit confirmed none were actioned. With AIX-002 (the in-editor authoring loop) actively building on this substrate, the friction now compounds daily.

## Scope

### 1. `get_node_type` output blowout (MCP)

Seven node types returned ~126 KB and blew the MCP host's tool-result cap; the overflow hint ("saved to file") is useless to a filesystem-less agent. Flagged as *"SUB-008, highest-value tweak."*

- [ ] Add a compact/summary mode (ports and one-line descriptions by default; full enrichment on request per-type), and make the overflow path return an in-band continuation (pagination or per-type fetch), never a file pointer.
- [ ] Verify against the same 7-type request that failed.

### 2. First-editor-save normalization noise

First open of an externally-exported project rewrites ~93 files (v3→v4 upgrade + save-path enrichments), burying the user's actual feature diff. Assessment verdict: *"lossless, but noisy once"*, with a named choice: **either the exporter/MCP adopt the editor-normalized shape, or first-open normalization becomes a visible, separate step.**

- [ ] Make the choice (recommend: exporter/MCP emit editor-normalized output — it kills the noise at source and keeps git history clean for the graph-native diff story; the visible-step option leaves every external tool emitting a dialect).
- [ ] Implement in `packages/noodl-mcp` / the export path; acceptance: export → open → save produces a **zero-file diff**.

### 3. Editor preview vs deploy render discrepancy

The demo's "Button Primary" renders cyan in editor preview, purple via the deploy path — a pre-existing divergence between the two render pipelines ("worth a look"). An authoring loop that verifies against preview while users ship via deploy is verifying the wrong thing.

- [ ] Root-cause the discrepancy (style-token injection order? `noodl-design-tokens` stamping — cf. REV-009's deploy-path fix in `html-processor.ts`, which is suspiciously adjacent territory).
- [ ] Fix so preview and deploy render identically, or precisely document the residual difference where AIX-002's verification step will see it.

### 4. The `formatV2.enabled` default (decision)

The whole external loop requires the v2 flag, which ships **default OFF** — SUB-010: *"the hand-off silently fails without it."* SUB-001 left it off pending large-project validation.

- [ ] After DEBT-002's SUB-001 checks pass, decide the flip (or at minimum: detect a v2 hand-off with the flag off and fail *loudly* with an enable-me message instead of silently). The loud-failure floor is in scope regardless; the default flip should get human sign-off.

## Success Criteria

- [ ] `get_node_type` usable by a filesystem-less agent for arbitrary type sets — no silent truncation
- [ ] Zero-diff on first editor save of a freshly exported project
- [ ] Preview/deploy render parity (or a documented, bounded residual)
- [ ] v2 hand-off can no longer fail *silently*; default-flip decision recorded with sign-off
- [ ] AIX-002's NOTES updated — these were its onboarding papercuts

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Normalized-shape emission drifts from the editor's save path over time | Add a round-trip CI check: export → headless open/save → assert empty diff (the SUB-009 headless recipe makes this cheap) |
| AIX-002 is mid-flight on the same surfaces | Coordinate via its NOTES before touching `validation/` or MCP tool shapes; land tool-shape changes behind additive parameters |

## References

- [SUB-010-EXTERNAL-AUTHORING-DEMO.md](../phase-13-format-ai-substrate/SUB-010-EXTERNAL-AUTHORING-DEMO.md) + its assessment findings (§ Finding 2, render discrepancy, `get_node_type`)
- [SUB-008-MCP-SERVER.md](../phase-13-format-ai-substrate/SUB-008-MCP-SERVER.md) deferred list; REV-009 (`html-processor.ts` token stamping)
