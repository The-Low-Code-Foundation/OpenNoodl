# BST-002 and BST-005 — what was built, and what is still an expectation

**Session of 2026-08-11/12.** Two tasks built, four client behaviours measured, one defect fixed
(F87), one pre-existing typecheck error removed. **The phase's code is complete; its acceptance is
not**, and §4 is the honest list of what remains.

## §1 — The two measurements came first, and one of them changed the build

Both open tasks were gated on premises about a client nobody here controls. The prompt said to
measure before writing, and it paid: **§2.1 confirmed a design, §2.2 confirmed two more, and F94
reversed one.** Full protocol logs in
[MEASUREMENTS-CLIENT-CONTRACT.md](MEASUREMENTS-CLIENT-CONTRACT.md).

🔴 **The technique is the reusable part.** The probe reveals its second tool **on a timer**, not on a
tool call — so booting a client is the entire trigger and no conversation turn happens. Four
behaviours of a real Claude Code, for zero model spend. A reveal triggered by `tools/call` would have
needed a paid drive and the answers would still be sitting in §5 of the prompt.

| | Answer |
|---|---|
| Does Claude Code re-list on `list_changed`? | ✅ **yes, 3ms** — with a control that issues one list and never a second |
| `.mcp.json` key shape | ✅ `{mcpServers:{name:{type,command,args,env}}}`, read off `claude mcp add --scope project` |
| Unapproved project server | ✅ `⏸ Pending approval`, **never spawned**, other servers unaffected |
| Does project scope collide with user scope? | 🔴 **user scope wins, silently** — see §2 |

## §2 — 🔴 F94, the finding that changed a decision

BST-005 §2 argued the file should register the bare name `nodegx`, because *"inside a file that only
applies to this folder there is nothing to collide with"*.

There is exactly one thing to collide with, **and BST-003 puts it there**. The launcher's "Connect
Claude Code" card registers `nodegx` at **user scope**. Measured: with both present, `claude mcp list`
run inside the project folder shows **one row**, the user-scope one. The project entry is not listed
at all — not as connected, not as pending, not as a conflict. Remove the user-scope entry and the
project one appears in the same directory.

So the intended cold-start sequence would have ended like this:

1. user clicks the launcher card → user-scope `nodegx`, **unbound**
2. agent runs `create_project` → project written, `.mcp.json` naming `nodegx`
3. user opens that folder tomorrow → **loads step 1's unbound bootstrap server**

An agent in a folder that already is a project, holding `list_projects` and `create_project`, no
authoring tools, and nothing anywhere saying why. **That is this phase's founding complaint,
delivered by the file written to prevent it.**

The file now carries `authoringServerName(dir)` → `nodegx-<slug>`. TALK-004 decision 4's per-project
name turns out to be load-bearing in project scope too: project scope does not exempt a file from the
collision, it just makes the collision invisible.

⚠️ **The general form is worth more than the finding.** The §2 argument was sound and its premise was
false, and the premise was about a *neighbouring task in the same phase*. "Nothing to collide with"
is a claim about the world, not about the file.

## §3 — What was built

### BST-005 (`5bb1767b`)

One pure renderer — `models/template/agentConfig.ts`, **importing nothing**, which is what lets
`noodl-mcp` reach it through `editor-deps`. It owns the copy, the never-overwrite rule and the
`.gitignore` merge; the filesystem arrives as a three-method host, so the MCP server writes with `fs`
and the editor writes with `@noodl/platform` over **one implementation**. Two callers, no drift.

- `create_project` builds its registration from `process.execPath` + `process.argv[1]` — **correct by
  construction, because it *is* the server being registered**, rather than a path re-derived by
  something that would have to guess what BST-004 decided.
- The editor goes through `LocalProjectsModel.newProject`, beside `installStarterAssets` and for the
  same documented reason: **both** branches, **after** the template, **never** overwriting.
- ⚠️ Placed after the template on the second attempt. The first put it before, where a downloaded
  template's own `.gitignore` would have clobbered ours — `installStarterAssets`' comment says
  exactly why it sits where it does, and it was right about this too.

### BST-002 (`140f7076`)

Three halves, in one commit because two are invisible alone:

1. `ProjectBinding.bind()` + the disclosure registry leaving bootstrap mode. `--all-tools` is
   remembered from startup and honoured at bind — F72 refused it in bootstrap because there was
   nothing to change into; **at bind there is**.
2. **Bind once.** A second `create_project` creates the project and does not repoint the server, and
   the result names the project the tools are still about.
3. 🔴 **`find_tools`' description**, revised via `RegisteredTool.update()`. This is the one the task
   predicted would be missed, and the prediction was good: everything else about the bind works
   without it, and it would have left the bootstrap copy — *"this tool cannot reveal them here"* —
   advertised on a bound server. The door out of the deferred set, described as bolted shut, in the
   one place a model looks.

And **the silent half**: `instructions` is fixed at `initialize`, so the bind result carries
`projectInstructions(...)` itself. Both the bootstrap briefing and the bind note point at it.

⚠️ BST-006 required the bootstrap briefing's last sentence to be rewritten when this landed. The
assertion pinning the old wording was **flipped, not deleted** — the rule is symmetric, and the next
person to change that paragraph should still fail a test if it stops matching the build.

### F87

The briefing said *four* tools; `tools/list` served *five*. The manifest already knew — its comment
said "these four plus `find_tools`" — and only the two human-facing strings were wrong. Both now
derive from `BOOTSTRAP_ADVERTISED`, `applyPolicy` uses the one list instead of a list plus a special
case, and the gate asserts the count **against `tools/list` itself** rather than against another
constant.

## §4 — 🔴 What is NOT done, stated plainly

The code of this phase is complete. Its acceptance is not, and none of these is an effort problem.

| # | Outstanding | Why it did not happen |
|---|---|---|
| 1 | **BST-002's real acceptance: a bound session that builds pages that RENDER, with a Router that lists them** | Needs a live model. This is §3's failure mode, and it **passes every green row in the suite** — the tools appear, the calls succeed, and the pages are unreachable. A paid drive is the only instrument that can see it |
| 2 | **BST-005's consequence: a fresh agent opening the folder and changing something with the tools** | Same — the acceptance explicitly says presence of the files is *not* the test |
| 3 | **BST-006's ordering acceptance** | Unchanged, and still blocked on `mcp-model-driver.js` needing a no-project mode |
| 4 | **The editor half of BST-005, driven** | Written and unit-tested; nobody has created a project in the running editor and looked in the folder |
| 5 | **Windows** | No Windows machine. `selfRegistration` composes the strings; that `NodeGX.exe` under `ELECTRON_RUN_AS_NODE=1` spawns and speaks clean stdio remains BST-004's expectation |
| 6 | **F65** | Unchanged and structural — summary mode copies `examples` verbatim and the corpus is meant to grow. Bounding the list per type is the fix that holds |

⚠️ **Debts 1 and 2 are one debt**: a paid model turn against a bound server. It is the single
measurement that would close this phase, and it needs Richard's authorisation.
