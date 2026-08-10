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

⚠️ The rig could not do this until 2026-08-10 — `--tools` narrowed the surface and nothing widened
it back, so **the control was unrunnable and the question unanswerable from evidence**. The driver
now takes `--all-tools`.

## As run — 2026-08-10

Both runs: `deepseek-ai/DeepSeek-V4-Pro`, verbatim brief (700 chars), fresh `create_project` mint,
`--max-turns 30 --max-tokens 16384`, temperature 0.2, no rescues.

| | **deferred (20 tools)** | control (`--all-tools`, 90) |
|---|---|---|
| tool schema payload | 28,297 chars | 102,162 chars |
| turn-one prompt tokens | **8,458** | 27,380 |
| billed input / cost | **1,555,184 / $2.07** | 1,825,493 / $2.43 |
| tool calls / rejections | 41 / 1 | 48 / 6 |
| `provision_backend` | **turn 5** | turn 15 |
| `apply_plan` | **turn 25** | **never** |
| catalog-research calls | 14 | 22 |
| stop | max-turns 30 | max-turns 30 |
| **what is on disk** | **the whole app** | **nothing — no write ever applied** |

### The four questions

| # | | |
|---|---|---|
| 1 | works out it needs a backend | ✅ reached for `Record`/`User` nodes unprompted |
| 2 | finds it *can* have one, from a surface where the tools are hidden | ✅ **`find_tools({group:"backend"})` at turn 3**, cold — 60 tools revealed, one `tools_list_changed` |
| 3 | provisions one, columns declared | ✅ `StockItem{name:String, count:Number, supplier:String}` |
| 4 | the page works against it | ✅ `DbCollection2` → `For Each(template:"/Components/StockItemRow")`; `New`/`Set`/`DeleteDbModelProperties`; `prop-count`/`prop-name`/`prop-supplier` resolved from the provisioned columns; `User`/`LogIn`/`SignUp`/`LogOut` present and the start page is the sign-in gate |

It also wired the brief's hardest line without being told how: `Expression "count === 0"` →
`out_of_stock_bg.visible`.

### ⚠️ The two doors were scored separately, and only one of them has ever been walked

`backendToolsRevealed` appears **zero times** in the transcript. The model searched *before* it
authored, so `ToolDisclosure.revealForNodes` never fired. **The search door is proven by a model;
the auto-reveal is still proven only by spec.** A run that authored a `Record` node before searching
would exercise it, and no run has.

### The control answered the question it was built to answer, and inverted the expected sign

The failure mode AWP-006 was afraid of is *a model that never provisions a backend because it never
knew it could*. **The control is the run that failed** — 90 tools, everything visible, and it never
applied a single write. It provisioned ten turns later than the deferred run, spent 22 calls
browsing the node catalog, staged eight operations, discarded the plan at turn 28, started a second
one, and ran out.

So the brief's own test resolves cleanly in the direction that matters: **the defect is not
disclosure.** Deferral did not cost the capability; the deferred surface is the one that shipped a
working app, for less money and with a sixth of the rejections.

⚠️ **Do not read the inverse as established.** This is **n=1 per arm** at temperature 0.2, and the
sign could be run variance. What the pair licenses is the negative — deferral did not break it —
and a *hypothesis* worth another pair of runs: that `find_tools` handed the model a grouped map of
the capability at turn 3, where 90 undifferentiated tools sent it into the catalog instead. The
cheap way to test it is two more runs per arm; nothing in phase 58 depends on the answer.

**Backends left behind: none.** Both stopped with their MCP server, as `provision_backend` documents
— port free, pids gone, verified after each run.
