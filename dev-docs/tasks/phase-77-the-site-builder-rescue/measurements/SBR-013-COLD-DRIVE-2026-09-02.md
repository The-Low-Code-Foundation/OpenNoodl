# SBR-013 AC2 — the cold authoring drive, both arms

**Date** 2026-09-02 · **Session** s41 · **Rig** the phase-55 replay rig
(`claude -p --output-format stream-json` against a real `noodl-mcp` stdio server), reduced with
`dev-docs/tasks/phase-55-llm-authoring-support/measurements/extract-transcript.js`.

## The command, both arms identical

```
claude -p "Build a small site with NodeGX. Create the project in this directory: <dir>.
           It is a site for a two-person pottery studio: a home page and a contact page.
           This is a non-interactive run — pick sensible defaults for anything unspecified
           and do not ask questions. Build it."
  --output-format stream-json --verbose
  --mcp-config <server: bin/noodl-mcp.js --allow-writes, bootstrap mode>
  --strict-mcp-config --model sonnet --permission-mode bypassPermissions
  --disallowedTools "Bash Write Edit NotebookEdit" --max-budget-usd 4
```

`--strict-mcp-config` so no other server is in reach; `Bash`/`Write`/`Edit` withheld so authoring
has to go through the MCP and the sequence means something. Bootstrap mode, so the run also covers
`create_project` → self-bind → `bound.guidance`, which is the door phase 77's own template author
came through.

🔴 **The arms differ in the BUILT SERVER, not in the prompt.** The control was produced by reverting
`instructions.ts`, `design.ts` and `decomposition.ts` to committed HEAD and re-running
`packages/noodl-mcp/build.mjs` — the dist is what the drive loads, and a source-only revert would
have measured the shipped build twice. Verified before each run by grepping the built `.cjs`
(`decide the component tree FIRST` = 1 / `LOOK FIRST` = 0 for the control; the reverse after).

## The sequences

| | control (HEAD) | shipped (SBR-013) |
|---|---|---|
| turns | 30 | 46 |
| cost | $1.41 | $2.05 |
| duration | 394 s | 573 s |
| calls | 29 | 45 |
| rejections | 1 | 2 |

**Control**, first eight calls:

```
create_project → get_project_info → get_style_vocabulary → get_component
→ get_node_type ×2 → get_example ×4 → create_plan → stage_plan_operation ×8
```

**Shipped**, first thirteen:

```
list_projects → create_project → get_project_info → get_style_vocabulary → get_component
→ find_tools → set_style_preset → set_project_tokens
→ list_node_types ×4 → get_node_type → get_example ×5 → create_plan → stage_plan_operation ×10
```

Full sequences and every rejection: [`sbr013-control-calls.txt`](sbr013-control-calls.txt),
[`sbr013-shipped-calls.txt`](sbr013-shipped-calls.txt).

## 🔴 The finding, and it is about the acceptance criterion as much as the change

**AC2 as written is green in BOTH arms.** It asks that "its first tool calls include the style
vocabulary before the first `create_component`" — and the control called `get_style_vocabulary` as
its third call, before everything. So did the phase-55 haiku baseline, in 2026-08. **A predicate
that was already true before the work cannot be the evidence for it**, and had this drive been run
once, against the shipped build only, it would have certified the change by measuring something the
change did not cause.

What the two arms actually disagree about is not whether the vocabulary was READ. It is whether the
project's identity was **written down**:

| | control | shipped |
|---|---|---|
| `get_style_vocabulary` before the first component | ✅ | ✅ |
| `find_tools({group:"theme"})` — the deferred write tools reached at all | ❌ never called | ✅ |
| `set_style_preset` / `set_project_tokens` | ❌ neither, ever | ✅ both, before `create_plan` |
| **`metadata.designTokens` on disk when the run ended** | **absent** | **present — 34 custom tokens** |

The control read the design system, held the result in its head, and expressed it one component at a
time — which is phase 77's failure exactly, reproduced on demand in 394 seconds. The shipped arm
settled the identity into the project before any component existed.

✅ **So the criterion that discriminates is the doctrine's own sentence**, the one added to
`DESIGN_DOCTRINE_MD` so a person could check it: *somebody can open the project and read back the
accent, the surface ramp and the page list before a single component has been authored.* On the
control project there is nothing to read back. On the shipped one there are 34 tokens.

⚠️ **n = 1 per arm, one model (sonnet), one brief.** These runs are not a distribution. They are a
demonstration that the change moves the behaviour it was written to move, and a control that says
the naive reading of AC2 would not have shown that.
