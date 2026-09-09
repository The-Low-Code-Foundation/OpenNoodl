# CMP-002 — Build brief. Read this file and nothing else in this folder.

🔴 **If you have already read `README.md`, `CMP-001`, `CMP-003`, `CMP-004` or `STUDIED-APPS.md` in
this folder, you are the wrong session for this job.** Say so and stop. Those files contain the
answers this build is meant to measure, and a session that has read them measures itself.

## What this is

A graded baseline. We are measuring **what the NodeGX MCP server actually leads a competent model to
build**, so that later changes to the server can be shown to have changed something. You are the
instrument, not the author. The value of this run is entirely in its fidelity.

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
