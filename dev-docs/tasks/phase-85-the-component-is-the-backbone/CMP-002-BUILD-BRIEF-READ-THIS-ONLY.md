# CMP-002 — Build brief. Read this file and nothing else in this folder.

🔴 **If you have already read `README.md`, `CMP-001`, `CMP-003`, `CMP-004` or `STUDIED-APPS.md` in
this folder, you are the wrong session for this job.** Say so and stop. Those files contain the
answers this build is meant to measure, and a session that has read them measures itself.

## What this is

A graded baseline. We are measuring **what the NodeGX MCP server actually leads a competent model to
build**, so that later changes to the server can be shown to have changed something. You are the
instrument, not the author. The value of this run is entirely in its fidelity.

## 🔴 Setup, before you author anything — two checks, and neither is optional

Three sessions have reached this point and produced nothing, both times because of the setup below
rather than the build. It is operational only: nothing here tells you anything about how to build,
and nothing here is a hint.

### 1. Use the `nodegx` server. Do not use `nodegx-puppy-test-3`.

This machine runs **two** NodeGX MCP servers and they are different builds:

| server | binary | use it? |
|---|---|---|
| **`nodegx`** | this repo's `packages/noodl-mcp/dist/noodl-mcp.cjs` | ✅ **this one** |
| `nodegx-puppy-test-3` | `/Applications/NodeGX.app/…` — the INSTALLED APP | ❌ never, for this run |

`nodegx` starts **unbound**, so it advertises only a handful of tools until you give it a project —
`create_project` is the door, and it binds **once** per session. `nodegx-puppy-test-3` is already
bound to an unrelated project and advertises the full authoring toolset immediately, which makes it
the path of least resistance and the **wrong instrument**: it is a shipped release, not this
checkout, and a run against it measures the wrong thing while looking completely normal.

### 2. Confirm your own server is not older than the bundle it is meant to serve

An MCP server is a child of the CLI process and keeps whatever bundle it loaded **at startup**. A
rebuild after your session began does not reach you, and rebuilding mid-run does not fix it — the
running server keeps its loaded image. 🔴 **A server serving an old bundle does not error.** It
returns responses that are missing fields, and an absent field reads exactly like a field that has
nothing to say.

Run this. It finds *your* server specifically, not the several others on this box:

Run this from the repo root. It finds *your* server specifically, not the several others on this
box, and it returns a verdict rather than two dates to compare by eye:

```sh
BUNDLE=packages/noodl-mcp/dist/noodl-mcp.cjs
p=$$; cli=""
while [ -n "$p" ] && [ "$p" != "1" ]; do
  case "$(ps -o comm= -p $p 2>/dev/null)" in *claude*) cli=$p; break;; esac
  p=$(ps -o ppid= -p $p 2>/dev/null | tr -d ' ')
done
bt=$(stat -f '%m' "$BUNDLE"); found=0
for s in $(pgrep -f "$BUNDLE"); do
  [ "$(ps -o ppid= -p $s | tr -d ' ')" = "$cli" ] || continue
  found=1
  st=$(date -j -f "%a %b %e %T %Y" "$(ps -o lstart= -p $s)" +%s 2>/dev/null)
  echo "bundle written $(date -r $bt '+%F %T') / my server pid $s started $(date -r $st '+%F %T')"
  [ "$st" -gt "$bt" ] && echo "OK — server is newer than the bundle" \
                      || echo "STALE — STOP, this session cannot run CMP-002"
done
[ "$found" = 1 ] || echo "NO SERVER — you are not talking to this repo's nodegx server. STOP."
```

**Anything but `OK` means stop and tell Richard** — say which line you got and paste the two dates.
Do not rebuild and carry on: the running server keeps its loaded image, so it needs a new session.

⚠️ Both branches of this check were exercised when it was written (2026-09-11), against a session
that was genuinely stale and against a control with the comparison inverted — so a printed `OK` is a
reading, not a default.

⚠️ If `dist/` itself is older than the newest change under `packages/noodl-mcp/src/`, the bundle is
stale regardless of process age. `dist/` is gitignored, so it is a local artefact of unknown
provenance and a commit date proves nothing about it.

## What to build

A **business landing page** — a single-page site for a small local business (a bakery, a garage, a
dental practice; pick one and commit to it). Build the whole page, not a fragment: whatever a real
small business would need on the one page a customer lands on.

Use the NodeGX MCP server. Create a fresh project somewhere under
`/Users/richardosborne/vscode_projects/NodeGX test projects/` — name it `CMP-002 baseline` — and
build it there.

## 🔴 The one rule

**Follow the MCP's own guidance and nothing else.** Read what its tools tell you — the instructions,
`get_project_info`'s doctrine fields, `get_style_vocabulary`, `get_node_type`, `get_example`,
whatever a tool hands you — and do what a diligent model would do with that and only that.

Do **not** apply outside knowledge about how Noodl components should be built. Do not go looking at
`library/prefabs/`, at other projects on this machine, or at this folder. If you find yourself
thinking "I know a better way to structure this" from experience rather than from something a tool
just told you — **that is the measurement**. Do not act on it. Write it down (see below).

This will feel like building with one hand tied. That is the point: the question is what the server
teaches, not what you already know.

## What to record as you go

Keep a running log alongside the build — `BUILD-LOG.md` in the project folder:

1. **Every tool call, in order.** Name and one-line purpose. The order matters as much as the
   content: we want to know what you consulted before you authored, and what you never found.
2. **Every decision point**, with what decided it. Especially: what made you choose a component
   boundary, a port, or a node type — was it a tool response, an example, or a habit?
3. 🔴 **Every pull you resisted.** Any moment you wanted to do something the guidance did not ask
   for. Say what you wanted to do and what in your own experience prompted it. **This list is the
   single most valuable output of the run** — more than the page.
4. **Every friction.** A tool that did not answer the question you had. A field whose meaning you had
   to guess. Something you looked for and could not find. A response that was hard to act on.
5. **Anything you searched for and failed to find.** Name the search, not just the absence.

Be honest in the log even where it is unflattering to the server or to you. A log that reports a
clean run is only useful if the run was clean.

## When you are done

1. The page renders. Verify it, do not assume it.
2. Post the `BUILD-LOG.md` and the project path back to Richard.
3. **Do not grade your own build** and do not read the rest of this folder to find out how you did.
   Grading is a separate step, with a committed script, run by someone else.

## What "done" is not

Not "it looks good". Not "the validator passed". This run is done when the page is genuinely finished
as a page a business could use, and the log honestly records how it got that way.
