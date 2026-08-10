# The backend brief — the fixture that needs the hidden half

**Why this file exists:** AWP-006 defers 60 of the server's 90 tools, and its own warning is that
**a tool the model cannot see is a capability the product does not have.** The storefront brief
cannot test that, because it touches none of the 60. This is the brief that does.

It is written to the same rules as [STOREFRONT-BRIEF.md](../phase-55-llm-authoring-support/STOREFRONT-BRIEF.md):
the voice of a user, no mechanism named, no architecture enumerated. It says nothing about
backends, collections, `Record` nodes or `find_tools` — **whether the model discovers it needs a
backend, and then discovers it can have one, is the whole test.** A brief that said "provision a
backend first" would prove only that the model can follow an instruction.

Deliberately small. It exists to answer one question, and a twelve-component build would cost ten
times as much to answer it no better.

---

## The brief (give this to the model verbatim)

> Build a **stock cupboard** for a small café — one page, for the staff.
>
> The page needs:
>
> - A list of what is in the cupboard: item name, how many are left, and the supplier.
> - A way to add a new item, and a way to change the count on one that is already there.
> - Items that have run out should stand out from the rest.
> - Only staff should be able to see any of it, so there needs to be a way to sign in, and the
>   page should say who is signed in.
>
> The counts have to survive a reload — if someone changes a number on one machine, the next
> person to open it sees the new number.

## What it is testing, and what a pass looks like

The last paragraph is the load-bearing one: **the data has to persist and be shared.** A model can
satisfy every other line with `Static Data` and never need a backend at all, which is exactly the
distinction under test.

| # | The question | A pass |
|---|---|---|
| 1 | Does the model work out that this needs a backend? | It reaches for `Record`/`User` nodes, or says the data must be stored |
| 2 | Does it find out it *can* have one, from a surface where the tools are hidden? | A `find_tools({group:"backend"})` call, **or** an authored `Record` node whose write reveals the group unasked |
| 3 | Does it then provision one? | `provision_backend` called, with the collection's columns declared |
| 4 | Does the page work against it? | `Record`/`Collection` nodes with `prop-*` ports wired; sign-in present |

⚠️ **Question 2 is the only one AWP-006 introduced.** Questions 1, 3 and 4 were already answerable
before it and a failure there is a phase-40/AAQ-011 finding, not a disclosure one. Classify before
concluding — the failure mode this brief exists to catch is *specifically* a model that gets 1
right and never gets to 3, and its signature is a graph with `Record` nodes and no
`provision_backend` call anywhere in the transcript.

**Two disclosure paths, and they must be scored separately.** The auto-reveal
(`ToolDisclosure.revealForNodes`) fires on the write that first introduces a backend-needing node,
so a model that authors before it searches gets the tools without ever calling `find_tools`. That
is by design and it is a pass — but a run that passes *only* that way has not shown the search door
works, and the reverse is also true. Record which one fired.

## Running it

Same rig and protocol as the storefront brief, minus the size:

```
node scripts/devtools/mcp-model-driver.js \
  --project <fresh-project-dir> --model deepseek-ai/DeepSeek-V4-Pro \
  --prompt-file <this brief> --max-turns 30 --max-tokens 16384 \
  --price-in 1.30 --price-out 2.60 --out backend-brief.jsonl
```

⚠️ **`--max-turns 30`, not 60.** This is a two-component app; a run still going at turn 30 has
stalled, and a stall is the data.

⚠️ **It provisions a real backend** — a process and a database, per AAQ-011/F13 — so the run leaves
one running. `provision_backend`'s reaper cleans up orphans at the *next* server start; to check,
`list_backend_processes`, and `stop_backend` when done.

⚠️ **Run it against `--all-tools` too, at least once.** The same brief on the undeferred surface is
the control: if the model fails to build the app in both, the defect is not disclosure.
