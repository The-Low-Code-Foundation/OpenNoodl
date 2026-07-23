# SUB-010 Demo Setup — external agent authors a page, live preview, editor hand-off

Reproducible recipe for the demo recorded in [ASSESSMENT.md](./ASSESSMENT.md).
Everything runs locally; the only credentials involved are your own agent
host's (Claude Code or Claude Desktop).

## 0. Prerequisites (one-time)

```bash
npm install
npm run build -w @noodl/mcp             # → packages/noodl-mcp/dist/noodl-mcp.cjs
npm run build:editor:_viewer            # deployed viewer runtime for the preview
```

## 1. A real target project, in v2 format

The demo uses **"Shine Phase 2"** (`packages/noodl-editor/tests/testfs/git-repo-utf8`) —
a real production app from the corpus: 44 components, 688 nodes, articles /
auth / comments / popups. Any legacy project can be exported the same way; the
exporter is pure:

```js
// export-v2.mjs — bundle with esbuild against the editor sources
import { ProjectExporter } from '<repo>/packages/noodl-editor/src/editor/src/io/ProjectExporter';
const project = JSON.parse(fs.readFileSync('<legacy>/project.json', 'utf-8'));
for (const f of new ProjectExporter().export(project).files) {
  // write f.relativePath / f.content (JSON) under the target dir
}
```

(ts-node does not work in this repo under Node 22 — bundle ad-hoc scripts with
`npx esbuild script.ts --bundle --platform=node`.)

Then make the workspace diff-able:

```bash
cd <demo-project> && git init && git add -A && git commit -m baseline
```

## 2. Live preview (SUB-009)

```bash
npm run preview -- <demo-project> --open     # serves http://127.0.0.1:8575
```

It watches the folder; every MCP write triggers a validate → rebuild → reload
cycle (measured 200–250 ms rebuilds on this project). Read-only, so it is safe
alongside the MCP server.

## 3. Connect an agent host to the MCP server

**Claude Code (interactive):**

```bash
claude mcp add nodegx -- node <repo>/packages/noodl-mcp/dist/noodl-mcp.cjs <demo-project> --allow-writes
```

**Claude Desktop** (`claude_desktop_config.json`) / any MCP host:

```json
{ "mcpServers": { "nodegx": {
    "command": "node",
    "args": ["<repo>/packages/noodl-mcp/dist/noodl-mcp.cjs", "<demo-project>", "--allow-writes"]
} } }
```

**Headless, hermetic (what the recorded run used).** To make the fair-test
properties enforceable — no filesystem access, no codebase access, transcript
captured — run Claude Code non-interactively from an empty directory:

```bash
mkdir agent-workdir && cd agent-workdir      # empty cwd: nothing local to read
cat > mcp-config.json                        # the JSON above
claude -p "<the ask — see below>" \
  --mcp-config mcp-config.json --strict-mcp-config \
  --allowedTools "mcp__nodegx__*" \
  --disallowedTools Bash Read Write Edit Glob Grep WebFetch WebSearch Task TodoWrite NotebookEdit \
  --output-format json --max-turns 80 > agent-result.json
```

The session transcript lands under `~/.claude/projects/<cwd-slug>/*.jsonl`;
every MCP call's arguments and result sizes can be extracted from it — that is
the context-budget log.

## 4. The ask

The prompt used (verbatim in the assessment): the app 404s at the root URL
because the main router starts on the Article page — *add a Home page following
the app's visual conventions, with a welcome heading, short description, and a
button to the Profile page, and make it the router's start page.* Plus ground
rules: read only what you need; use the catalog tools for exact type/port
names; validate until zero new errors.

## 5. Editor hand-off

Open the same directory in the NodeGX editor (Launcher → open project, or the
dev stack via `npm run dev`). The editor reads v2 directories natively. Verify:

- the agent's page appears in the component tree and opens as a normal graph;
- make a manual edit (move/add a node, change a parameter) and save;
- `git diff` in the project dir shows only the intended change — nothing
  rewritten or dropped;
- re-run `validate_project` (or `scripts/validate-project.ts`) — still clean.

## Gotchas found while setting this up

- **Chrome headless + the preview's SSE stream:** `--screenshot` hangs forever
  waiting for load; pass `--timeout=15000` to force the capture.
- The corpus project `big-merge-test-mine` exports and validates but does not
  paint (its own bundled module is ES5-incompatible with today's runtime
  Collection class) — use Shine (`git-repo-utf8`) for anything visual.
- The MCP server re-stats files on open; a file-watcher keyed on mtimes may see
  one spurious event at server startup.
