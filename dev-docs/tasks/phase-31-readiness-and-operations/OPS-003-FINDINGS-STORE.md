# OPS-003: The Findings Store & the Graph-Aware Feedback Hotkey

## Metadata

| Field | Value |
|-------|-------|
| **ID** | OPS-003 |
| **Phase** | Phase 31 — Readiness & Operations (Track P) |
| **Tier** | 1 — the frame |
| **Priority** | 🔴 Critical — Phase 32 does not exist without it |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1–1.5 wks |
| **Prerequisites** | none |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** — the finding schema is consumed by six later tasks across two phases and by the AI authoring loop. The shape is the decision |

## Objective

One store for everything anyone noticed about the app — the builder using it, a synthetic tester
(Phase 32), a human tester, or a production error — captured with enough graph context that the AI
authoring loop can act on it without asking a single clarifying question.

## Background

The [feedback-loop chapter](../../../../ai-coding-docs/docs/part-5/feedback-loop.md) describes a
dev-only hotkey that captures free text, a 1–5 priority, a screenshot and a JSON context blob to a
gitignored `.feedback/` folder. Its argument:

> "Every missing detail is a round-trip. The AI asks which page, you answer. It asks what data was
> loaded, you answer. Half the conversation is rebuilding context that was on your screen the moment
> you hit the bug."

Its context blob is `route`, `device`, `browser`, `viewport`, `params`, and whatever app state the
project thought to include — and the chapter is candid that the interesting fields (`rowsLoaded: 0`,
`lastError: "422 /api/export"`) are ones the author had to remember to add.

**NodeGX does not have to remember.** The viewer owns the component tree, the node instances, the live
port values, the last cloud-function call and its response, and the route. A finding captured in a
NodeGX preview can carry *the graph path that produced the screen*, and "fix the highest-priority open
finding" hands AIX-002 a bug report with the graph attached. No code project can do that, and it is
the single cheapest differentiator in either new phase.

## Current State

| Piece | State |
|---|---|
| Preview | `packages/noodl-preview` (SUB-009); AIX-008 renders a staged component beside its graph |
| Runtime introspection | node instances, port values, `Collection`/`Model` state — all reachable in-process |
| Cloud call records | WF-004/WF-006 executions; `GET /executions` (WFA-002) |
| Problems panel | `views/panels/ProblemsPanel/` — SUB-006's validator output, editor-time only |
| Anything user-noticed | nothing. There is no place to put "this button confused me" |

## Desired State

### 1. A finding is one shape, whatever produced it

```ts
interface Finding {
  id: string;
  createdAt: string;
  source: 'builder' | 'synthetic' | 'human' | 'runtime-error';   // Phase 32 adds the middle two
  priority: 1 | 2 | 3 | 4 | 5;
  status: 'open' | 'done' | 'wont-fix';
  text: string;                 // authored, or the tester's own words
  resolution?: string;          // one line, on close
  context: FindingContext;
  attachments: { screenshot?: string; recording?: string };
}

interface FindingContext {
  route: string;
  componentPath: string[];      // the component stack that rendered the screen
  nodeIds: string[];            // nodes on screen at capture
  focusNodeId?: string;         // the node under the pointer, when there was one
  portValues: Record<string, unknown>;  // redacted; see §4
  lastBackendCall?: { function: string; status: number; durationMs: number; executionId?: string };
  viewport: { width: number; height: number; dpr: number };
  device: string;
  buildId?: string;             // OPS-002; ties a finding to a specific artifact
}
```

`componentPath` + `nodeIds` + `focusNodeId` are the fields that make this worth building. Everything
else the guide already has.

### 2. Captured by a hotkey, in preview and in dev deployments

`Ctrl/Cmd+Shift+F` in the preview window and in any artifact built at Playing or Sharing level. A small
modal: textarea, 1–5 priority, submit. On submit it captures the screenshot and assembles the context
without asking.

**Guarded, and the guard is structural.** The overlay and its write path must be absent from the bundle
at Live and Scale, not merely disabled at runtime — a dev-only tool that ships to production is a
finding in its own right. A build-level assertion, not an `if`.

### 3. Stored in the project, and gitignorable

`.findings/` beside the project, one JSON per finding plus its screenshot, matching the guide's
`.feedback/` layout closely enough that its `.clinerules` prose transfers.

Two rules from the chapter carry over unchanged and belong in the code, not in documentation:

- **Resolve, never delete.** Closing a finding sets `status` and writes a one-line `resolution`. The
  history is the record of what confused people and what was done about it — and Phase 32's calibration
  work depends on it existing.
- **Never capture secrets.** See §4.

### 4. Redaction is a whitelist, not a blacklist

`portValues` will, sooner or later, contain a password, a token or a customer's email. The chapter's
rule ("MUST NOT include passwords, tokens, API keys, or raw JWTs") is a blacklist and blacklists leak.

- Capture port values by **type and shape by default** — `string(24 chars)`, `array(17)`, `null`,
  `object{id,name,total}` — which is what a diagnosis actually needs.
- Literal values only for ports the project has marked safe, or for primitives on nodes with no data
  provenance.
- Any port on a node in the auth or cloud-data families is shape-only, always.
- `nodegx-backend` already has `ops/redact.ts` (BAK-009) — reuse its rules rather than writing a second
  policy that will diverge.

### 5. A Findings panel

On the rail: open findings sorted by priority then age, with screenshot thumbnails, a filter for
open/done, and a click-through that opens the component and selects `focusNodeId` on the canvas. That
last one — *click a finding, land on the node* — is the payoff and should be built first.

### 6. The AI reads it and closes it

MCP tools: `findings_list`, `findings_get`, `findings_resolve`. The prompt the chapter is built around
— *"fix the highest-priority open finding"* — must work end to end: select, read context, look at the
screenshot, open the right component, propose a change through AIX-002's diff review, and on accept set
`status: done` with a resolution line.

## Implementation Steps

1. The `Finding` schema, the store, and the resolve-not-delete rule with tests.
2. Redaction via `ops/redact.ts`, with a test that a password-typed port never reaches disk in the
   clear.
3. Context assembly in the viewer — `componentPath`, `nodeIds`, `focusNodeId`, `lastBackendCall`.
4. The hotkey + modal + screenshot in preview.
5. Build-level exclusion above Sharing, asserted by a test that greps the built artifact.
6. The Findings panel, starting with click-through-to-node.
7. MCP tools + the AIX-002 loop closing a finding.
8. **Live pass**: break something on purpose in the QA fixture, capture a finding from preview, and
   drive "fix the highest-priority open finding" to a resolved status without typing any context.

## Success Criteria

- [ ] A finding captured from preview carries `componentPath`, `nodeIds` and `focusNodeId`, verified
      against what was actually on screen.
- [ ] Clicking a finding opens the right component and selects the right node.
- [ ] A password-typed port value never appears in a stored finding; a test proves it.
- [ ] The overlay and write path are **absent from** a Live-level artifact — grepped, not assumed.
- [ ] Resolving writes `status` + `resolution` and never deletes.
- [ ] `findings_list/get/resolve` work, and one end-to-end AI fix closes a real finding.
- [ ] The screenshot is legible at panel-thumbnail size and full size.

## Out of Scope

- **Production error capture.** `source: 'runtime-error'` is in the schema so OPS-005 can write to it;
  wiring the error tracker is OPS-005's job.
- **Synthetic and human sources.** Phase 32 fills those in. This task must not special-case them, only
  leave room.
- **A customer-facing feedback widget.** The chapter is explicit and so is this: *"This is a
  vibe-coding tool for you, not a customer feedback widget."* Real end-user feedback is PostHog or a
  form the user builds — not this.
- **Session recording.** `attachments.recording` exists in the schema for Phase 32's use; this task
  writes screenshots only.

## Traps

- **`portValues` is the whole risk surface of this task.** It is one careless default away from
  writing a customer's email into a file that gets pasted into a chat window. Whitelist by shape from
  the first commit; do not plan to tighten it later.
- **The dev-only guard must be a build-time exclusion.** A runtime `if (isDev)` survives into the
  bundle and can be flipped. The chapter's warning is right and its suggested mechanism is too weak.
- **`nodeIds` at capture time ≠ nodes in the graph.** A repeater produces many instances of one node.
  Record the instance path, and make sure click-through lands on the *definition* while saying which
  instance was involved.
- **Screenshots in the preview window are not free.** Verify what the capture path actually produces
  under Electron before designing the panel around a thumbnail size.
- **`.findings/` in a project that gets exported.** DEP-008 owns artifact contents — make sure findings
  are ignored there, or a support screenshot ships to production.
- **Do not let this become a second Problems panel.** SUB-006's validator output is editor-time truth
  about the graph; findings are human-time observations about the app. Keeping them separate is
  deliberate — if they merge, the validator's precision gets diluted by opinion.
</content>
