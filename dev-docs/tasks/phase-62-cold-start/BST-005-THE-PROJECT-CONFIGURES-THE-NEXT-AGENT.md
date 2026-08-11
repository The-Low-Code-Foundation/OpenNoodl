# BST-005 — The project configures the next agent

**Status:** 📋 open · **Track: the project on disk** · independent of BST-002 · the cheapest task
that helps **every session after the first**

## The gap, stated precisely

A NodeGX project directory holds nothing that tells an agent what it is.

Checked on disk, a real project made by this product
(`NodeGX test projects/Puppy test 3`):

```
.gitignore  .nodegx  components  docs  nodegx.project.json  noodl_modules
```

No `.mcp.json`. No `CLAUDE.md`. No `AGENTS.md`. So the second session — the user opens their agent in
the folder they have been working in, which is the *obvious* thing to do — is exactly as cold as the
first, and colder in one way: they now believe they connected something yesterday.

Everything the phase builds upstream is a first-run story. **This is the one that makes the tenth run
work.**

## §1 — Two files, doing different jobs

| File | Job | Read by |
|---|---|---|
| `.mcp.json` | Registers this project's authoring server, scoped to this folder | The MCP client, on opening the directory |
| `CLAUDE.md` | Says what this project is, what NodeGX is, and the handful of rules that are true of every NodeGX build | The model, as context |

⚠️ **Neither is a substitute for the other, and shipping only the first is the trap.** A registered
server with no context gives a model 20-plus advertised tools and a project it has no vocabulary for.
A `CLAUDE.md` with no server gives it vocabulary and no way to act. The complaint that opened this
phase — *"doesn't know wtf it is and can't connect the MCPs"* — is those two failures in one
sentence.

## §2 — `.mcp.json`

Project-scoped MCP configuration, written into the project root, pointing at this project:

```json
{
  "mcpServers": {
    "nodegx": {
      "command": "<runtime>",
      "args": ["<…>/noodl-mcp.cjs", "<project dir>", "--allow-writes"]
    }
  }
}
```

⚠️ **Confirm the schema and the approval behaviour before writing one.** `.mcp.json` at a project
root is a documented Claude Code mechanism and clients prompt before trusting it — but the exact key
shape, and whether an unapproved server is silently ignored, are ⚠️ **unverified here** and the file
is worthless if either is wrong. Verify by writing one and opening the folder.

Three decisions the file forces:

- **Absolute paths, not relative.** Resolved against the client's cwd, which is not reliably the
  project root. The editor knows both paths exactly; spend that knowledge.
- ⚠️ **Which makes the file machine-specific**, and it will be committed to the user's git repo and
  then break on their colleague's laptop — a paste-the-bundle-path problem arriving by a new route.
  Either `.gitignore` it (the project already ships a `.gitignore`) or accept it and say so in
  `CLAUDE.md`. **Ignoring it is the right default**; a broken registration in a teammate's checkout
  is worse than no registration.
- 🔴 ~~**`nodegx`, unsuffixed, inside a project-scoped file.**~~ **REVERSED by measurement, 2026-08-11
  — the file uses the per-project name `nodegx-<slug>`.** The argument was that a file applying only
  to this folder has nothing to collide with. It has exactly one thing to collide with, and BST-003
  puts it there: the launcher card registers `nodegx` at **user scope**, and
  [user scope silently shadows project scope on the same name](MEASUREMENTS-CLIENT-CONTRACT.md#4--f94-user-scope-shadows-project-scope-on-the-same-name--this-reverses-bst-005-2)
  — the project entry is not listed at all, not even as a conflict. A user who clicked the launcher
  card and then opens their project folder would get the **unbound bootstrap server**, in a folder
  that is already a project, with no authoring tools and nothing saying why. That is this phase's
  founding complaint delivered by the file written to prevent it. So:
  `authoringServerName(dir)` — TALK-004 decision 4's name, which turns out to be load-bearing in
  project scope too.

## §3 — `CLAUDE.md`

Short, and it earns its place by being **specific to this project** rather than a copy of the
server's instructions.

⚠️ **Do not restate the `instructions` string.** The server already sends its briefing at
`initialize` ([`server.ts:53-112`](../../../packages/noodl-mcp/src/server.ts#L53)), and the
paragraphs in it exist because measured models failed without them. Two copies is how one silently
stops matching the product — the same argument BST-002 §3 makes. What the file adds is what the
*server cannot know*:

1. **What this app is** — one paragraph, from the scope `create_project` already captured. It
   already writes `docs/BRIEF.md`, `ARCHITECTURE.md` and the rest
   ([`createProject.ts:420-421`](../../../packages/noodl-mcp/src/tools/createProject.ts#L420)), so
   this is a pointer to a file that exists, not new prose.
2. **That this is a NodeGX project and the tools are the way in** — the sentence that stops an agent
   editing `components/*/nodes.json` by hand. ⚠️ **This is the highest-value line in the file.** A
   capable agent finds JSON in a folder and edits it; every validation, every diagnostic and every
   `registeredPages` side effect lives in the tool layer, so hand-editing produces a project that
   loads and is subtly wrong.
3. **Where the docs are** — `docs/`, which the review and docs tools already read.

## §4 — Who writes them, and the seam that matters

**Both project-creating paths, not just the MCP one.** A project made in the launcher must carry the
same files as one made by `create_project`, or the answer to "why doesn't my agent know about this
project?" becomes "depends how you made it" — which is unanswerable by the user.

- `create_project` — [`createProject.ts`](../../../packages/noodl-mcp/src/tools/createProject.ts),
  where the file list is assembled around `put(...)`
  ([`:280-290`](../../../packages/noodl-mcp/src/tools/createProject.ts#L280)).
- The editor's own new-project path, alongside the template write.

⚠️ **The runtime and bundle path are known in different processes.** `create_project` runs inside the
MCP server, which knows its own entry path (`process.argv[1]`) but has no idea what BST-004 decided
about runtimes. The editor knows both, via the front-door resolver. Do not have the server guess:
either it writes `.mcp.json` from its own argv (correct by construction — it *is* the server being
registered) or it writes only `CLAUDE.md` and the editor completes the pair on first open. **The
former is simpler and self-consistent**; take it unless driving proves otherwise.

⚠️ **Never overwrite.** A user who has edited their `CLAUDE.md` or added servers to `.mcp.json` keeps
them. Write only when absent — including on a project the editor opens and finds without them, if
backfilling is taken up.

## Acceptance

- A project created by `create_project` contains both files, with correct absolute paths.
- A project created in the launcher contains the same two files, with the same content shape.
- **The consequence:** open the project folder in a fresh Claude Code session with **no user-scope
  registration at all**, ask it to change something, and it does — using the tools, not by editing
  JSON. That is the test; the presence of the files is not.
- The registration is approved through the client's own prompt, and an unapproved one degrades to
  "no tools" rather than to a broken client. Drive it.
- `.mcp.json` is git-ignored (or the choice not to is written down in `CLAUDE.md`, per §2).
- Neither file is overwritten if it already exists.
- `CLAUDE.md` does not duplicate any sentence from the server's `instructions`. Assert it — a
  substring check across the exported constant is enough and it will catch the copy-paste.

## Register

| # | Finding | State |
|---|---|---|
| F20 | A real NodeGX project on disk carries no agent configuration of any kind — no `.mcp.json`, no `CLAUDE.md` | ✅ verified on disk, `NodeGX test projects/Puppy test 3`, 2026-08-11 |
| F21 | `create_project` already writes a `docs/` tree with the captured scope, so `CLAUDE.md` points at content rather than inventing it | ✅ verified, [`createProject.ts:420-421`](../../../packages/noodl-mcp/src/tools/createProject.ts#L420) |
| F22 | `.mcp.json` key shape, and whether an unapproved server is ignored or fails loudly | ✅ **measured 2026-08-11.** Shape read off `claude mcp add --scope project` — `{mcpServers:{name:{type:'stdio',command,args,env}}}`, identical to the `~/.claude.json` entry BST-003 measured. Unapproved: **`⏸ Pending approval`, never spawned, every other server unaffected** — the exact degradation the acceptance asks for. [MEASUREMENTS §2–3](MEASUREMENTS-CLIENT-CONTRACT.md) |
| F94 | 🔴 **User scope shadows project scope on the same server name**, invisibly — the project entry is not listed at all. Reverses §2's naming decision; the file uses `nodegx-<slug>` | ✅ **measured 2026-08-11**, [MEASUREMENTS §4](MEASUREMENTS-CLIENT-CONTRACT.md) |
| F23 | Absolute paths make the file machine-specific and it will be committed — a new route to the same broken-path failure | ⚠️ ours to design; `.gitignore` is the default answer |
| F24 | The two project-creating paths are in different processes with different knowledge of the runtime | ⚠️ ours to design; §4 leans to the server writing its own argv |
