# HLS-009 — Something other than a mouse opens a project

Severable from the CLI, and the one that actually closes the agent/human loop.

## 1. The person sentence

**An agent creates a project and it appears in the editor the person already has open — nobody
writes a JSON file by hand and nobody drives the UI over a debug port.**

## 2. What was measured

[#38](https://github.com/The-Low-Code-Foundation/NodeGX/issues/38): no `--project <dir>`, no
registered `nodegx://` handler (the renderer's own comment says deep linking *"has never actually
worked in the desktop app"*), and the MCP server never touches the launcher's recent-projects store.
The reporter wrote `recently_opened_project.json` by hand and then clicked the project card over
CDP, because that was the only route.

## 3. Scope

Any one of three, and the third is the interesting one:

- `nodegx --project <dir>` on the desktop app;
- a registered `nodegx://open?path=…` handler;
- 🧭 **`open_in_editor(project_dir)` over MCP** — the agent authors on disk, the project *appears* in
  the editor the person already has open, and nobody fights over the file.

Pick one and say why. The MCP tool is recommended: it is the only one that works when the editor is
**already running**, which is the human/agent collaboration case.

⚠️ Related and not the same: [#28](https://github.com/The-Low-Code-Foundation/NodeGX/issues/28) — a
project created through the MCP server never appears in Recent projects. **That is half of this
task's mechanism**; check whether it closes on the way.

## 4. Acceptance criteria

1. **(person)** With the editor open on the projects screen, ask an agent to create a project. It
   appears — no click, no restart, no hand-edited file.
2. Opening a project the person already has open does not open it twice, and does not lose unsaved
   work. Driven, not reasoned about.
3. The recent-projects store has one writer after this task, not two. Cardinality.
4. #28's symptom is either fixed or explicitly still open with a reason.

## 5. Traps

- 🔴 **Opening a project writes three files into it.** An "open" triggered by an agent is a write to
  the user's project — say so, and check it does not race an autosave.
- 🔴 The editor is the only writer of the launcher store today. Adding the MCP server as a second one
  is a two-writers-one-file shape; use the store's own API, not a JSON write.
- ⚠️ A drive over CDP needs focus emulation on the same connection, and a stray Chrome steals port
  9222 — use `NOODL_REMOTE_DEBUG_PORT`.
