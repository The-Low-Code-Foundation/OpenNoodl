# Phase 62 — the code is done; the phase is not. What is left, and who can do it

**Written 2026-08-12** by the session that built BST-002 and BST-005. It **supersedes** the previous
prompt in this file, which sent you to build those two.

---

## §0 — Read this first

**All six tasks are built.** BST-001, 003, 004, 006 landed on 08-11; **BST-002 (`140f7076`) and
BST-005 (`5bb1767b`) landed 08-12**, along with F87 and two defects found while checking them.

🔴 **That is not the same as the phase being finished, and the difference is the whole point of what
follows.** Phase 62 exists because a cold user could not get from "install" to "an agent building my
app". Every mechanism for that now exists and is unit-tested. **Nobody has watched a model use it.**

This phase has already been caught once reporting a successful `claude mcp add` as the deliverable.
Do not repeat it in a larger form by reporting "6/6 built" as "phase closed".

| What is genuinely finished | What is not |
|---|---|
| Every mechanism, with suites | The **consequence** of any of it, with a model |
| Four client behaviours, **measured** | The launcher card, **still never rendered** |
| The phase's own gates, at their floors | Windows, at all |

### §0.1 — Gates, with provenance

| Gate | Result | Provenance |
|---|---|---|
| `cd packages/noodl-mcp && npx jest` | **1 failed / 450 passed of 451** | ✅ measured 08-12. Total was **419** before this session; +32 is exactly the specs added. The red is **F65** by name |
| `cd packages/noodl-editor && npx jest` | **131 suites / 1892 tests, green** | ✅ measured 08-12 |
| `npm run test:ci` | ⚠️ **see §0.2 — unresolved** | measured twice, disagreeing |

🔴 **Compare the MCP suite by TOTAL (451) and the failures by NAME.** A gitignored build artifact can
make a whole file's specs vanish and still read as a pass.

⚠️ `packages/noodl-mcp` **does not typecheck clean at baseline** — 8 pre-existing errors in test
files, now 7 (one was a stale `CreateProjectResponse` import naming the wrong module). Jest
transpiles per file and never typechecks the graph, so nothing reports them. **Do not read a green
jest run as a clean package.**

### §0.2 — 🔴 `test:ci` gave 9 failures, and three of them are unexplained

The measured run: **`Jasmine: 2672 specs, 9 failures`**. The recorded floor is 6.

**Six match the register exactly** — four `AIX-006 style vocabulary`, two `AI model registry`.

**Three are new, and all three are one describe block:**

```
BEN-001 the harness export mounts the component as a child of a synthetic parent, with its inputs set
BEN-001 the harness export mounts a logic-only component instead of refusing it
BEN-001 the harness export hands back the interface, so the rail does not re-derive it
```

⚠️ **They are not from this session's work by area** — BST-002/005 touch `noodl-mcp`, `agentConfig`,
`LocalProjectsModel` and `mcpCommands`; BEN-001's harness export is phase 56's component bench. But
**"not mine by area" is an argument, not a measurement**, and this register has been burned by
exactly that reasoning before.

There are two live candidates and they are not distinguishable from the log:

1. **A real regression from phase 50**, which a concurrent session landed overnight
   (LEG-001/002/005, and `b0ad50ed` at 00:17). LEG work moves node `metadata`, and a harness export
   that mounts a component with its inputs set is plausibly downstream of that.
2. **Phantoms.** `.logs/dev.log` was written at **00:01, during the run** — the other session was
   driving a live editor. That is the documented `test:ci` + live-stack phantom condition precisely.

**A clean re-run was started alone at 00:18** into
`scratchpad/testci-clean.log`. 🔴 **Read its result before doing anything else.** If BEN-001 is green,
the floor is still 6 and this paragraph is history. If it is red, **that is a real regression in
phase 50's work and it is the first thing to fix** — before any of §1.

### §0.3 — The rules that still hold

- ⚠️ **A concurrent session shares this checkout.** `git add -A` is a loaded gun; check
  `git status --short` and name your paths. Three commits this session were staged path-by-path and
  two of the four `git status` calls showed another session's files sitting there uncommitted.
- ⚠️ **`npm run dev:stop -- --list` is the ONLY spelling that lists.** `dev:stop --list` kills.
- ⚠️ **Never launch the editor while a `test:ci` is up** — `start.ts` sweeps and reaps it.
- ⚠️ **The exit code lies.** Only the `Jasmine:` line counts.

---

## §1 — What is left, in the order it should be done

### 1. 🆓 Render BST-003's launcher card, with zero projects — **free, and overdue**

Still the oldest unpaid debt in the phase. Blocked on 08-11 by another session's `test:ci`, and on
08-12 by *this* session's. Nothing else blocks it.

The acceptance asks for **an empty project list, driven** — not reasoned about. This machine's
launcher has projects, so you need a profile that has none. The list comes from `electron-store`
`recently_opened_project` in the user-data dir, so a throwaway `--user-data-dir` (or moving that one
store file aside and restoring it) gives a genuine zero-project launcher.

Then: `npm run dev:debug -- --quiet`, wait for the compile, `npm run cdp -- screenshot`, and **click
the button**. `npm run cdp -- health` first — a window that opens and renders nothing is this app's
signature failure.

⚠️ Clicking it performs a **real user-scope registration** of `nodegx`. Remove it afterwards
(`claude mcp remove --scope user nodegx`), and note that while it exists it will **shadow** any
project-scope `nodegx` — see §3.

### 2. 💰 The one drive that closes three debts — **needs Richard's authorisation**

🔴 **Debts 1, 2 and 3 in `NOTES-BST-002-005.md` §4 are one experiment**, and nobody has noticed that
until now. Designed as one run, a single cold session closes all of them:

> Register **only** the unbound bootstrap server. Give a model the prompt *"open my app"* — then, when
> it correctly reports there is nothing there, *"build me a reading list app"*.

That one transcript answers:

| Debt | What in the transcript answers it |
|---|---|
| **BST-006's ordering** | Does turn 1 call `list_projects` and **not** `create_project`? |
| **BST-002's acceptance** | Does the same session go on to author pages, and does `render_report` return something **drawn**, with the Router listing them? |
| **BST-005's consequence** | Does the created folder carry both files, and does a **second** session opened in it act through the tools? |

⚠️ **Blocker, and it is small:** `scripts/devtools/mcp-model-driver.js` **requires `--project`**
(`:387`, `:404` — it exits 2 without one). It needs a no-project mode that starts the server with
`--allow-writes` and no directory. That is the BST-006 debt, unchanged, and it is now blocking three
things instead of one. **Do this part first; it costs nothing.**

🔴 **Then ask Richard before spending.** A real Anthropic provider is configured and a drive costs
money.

🔴 **And know what you are looking for.** The failure this drive exists to catch is the one BST-002
§3 names: a bound session that authors **unreachable pages** because the Router was never mentioned.
It passes every green row in `bindOnCreate.test.ts`. **A drive that only checks "did tools appear"
has not run the experiment** — the evidence is the render and the Router, not the tool count.

### 3. Drive the editor half of BST-005

Written, unit-tested, **never run in the app**. Create a project at the launcher and look in the
folder for `.mcp.json` and `CLAUDE.md`. Fold this into §1 — the stack is already up.

⚠️ The registration comes from `mcp:front-door` over IPC. If the bundle is unresolved in a dev
checkout, `CLAUDE.md` is written **without** a server and says so — which is correct behaviour and
will look like a bug. Run `npm run build:sidecars` first, or expect it.

### 4. F65 — the MCP suite's one red

Structural, not an overshoot: summary mode does `s.examples = full.examples` verbatim and the corpus
is *meant* to grow. Raising the cap to 31,000 buys time until the next recipe; **bounding the example
list per type is the fix that holds.**

### 5. Windows — nobody here

`selfRegistration` composes `process.execPath` + `process.argv[1]` + `ELECTRON_RUN_AS_NODE`. That the
strings are right is asserted. That `NodeGX.exe` spawns and speaks clean stdio is **an expectation**,
unchanged from BST-004.

---

## §2 — What this session measured, so you do not pay for it again

Four client behaviours of **Claude Code 2.1.217**, at **zero model spend**. Full logs in
[MEASUREMENTS-CLIENT-CONTRACT.md](MEASUREMENTS-CLIENT-CONTRACT.md).

🔴 **The technique generalises and is the most reusable thing here.** The probe reveals its second
tool **on a timer**, not on a tool call — so booting a client is the entire trigger and no
conversation turn happens. Two premises had been sitting unverified because everyone assumed they
needed a paid drive. They did not.

```bash
{ sleep 2; printf '\r'; sleep 30; } | script -q /dev/null \
  claude --mcp-config /abs/cfg.json --strict-mcp-config
```

`script` supplies the pty; **`printf '\r'` answers the trust-folder prompt**, which sits *in front of*
MCP connection and otherwise looks exactly like the client ignoring your config.

**Before asking for a paid drive, ask what actually triggers the behaviour.** If time can trigger it
instead of a model decision, it is free.

| | Answer |
|---|---|
| Re-list on `list_changed`? | ✅ **3ms** — with a control that issues one list and never a second |
| `.mcp.json` shape | ✅ `{mcpServers:{n:{type,command,args,env}}}` — same as `~/.claude.json`'s entry |
| Unapproved project server | ✅ `⏸ Pending approval`, never spawned, other servers unaffected |
| Same name, two scopes | 🔴 **user scope wins, silently** — §3 |

---

## §3 — 🔴 F94, and why it matters beyond the line it changed

BST-005 §2 argued for the bare name `nodegx` in `.mcp.json`, because *"inside a file that only applies
to this folder there is nothing to collide with"*.

There is exactly one thing to collide with, **and BST-003 puts it there.** With a user-scope `nodegx`
present, `claude mcp list` inside the project folder shows **one row — the user-scope one**. The
project entry is not listed at all: not connected, not pending, not a conflict. Absent.

So the phase's own intended sequence would have ended:

1. user clicks the launcher card → user-scope `nodegx`, **unbound**
2. `create_project` writes `.mcp.json` naming `nodegx`
3. user opens the folder tomorrow → **gets step 1's unbound bootstrap server**

An agent in a folder that already is a project, holding `list_projects` and `create_project`, no
authoring tools, nothing saying why. **This phase's founding complaint, delivered by the file written
to prevent it.** The file now carries `nodegx-<slug>`.

⚠️ **The general form is worth more than the finding.** The argument was sound and its premise was
false — and the premise was about a *neighbouring task in the same phase*. "Nothing to collide with"
is a claim about the world, not about the file.

---

## §4 — Two defects this session found in its own work, both after the suites were green

Worth naming because neither was caught by a test, and both were caught the same way.

- 🔴 **A bind failure was reported as a creation failure.** The project is on disk by the time the
  bind runs; a throw reached `guarded` and came back as `create_project` failing, so an agent would
  retry into the directory it had just filled and be refused with *"not empty"* — a real project lost
  to a plumbing fault, with the second error naming the wrong cause. Fixed, `02adb017`.
- 🔴 **`CLAUDE.md` promised a backfill the build does not perform** — *"a teammate cloning this
  repository generates their own by opening the project in NodeGX"*. Nothing backfills a clone. Same
  failure BST-006's rule names about the bootstrap briefing, one file over. Fixed, `98d58407`.

⚠️ **Both were found by rendering the artifact and reading it**, not by a check. Every assertion on
that copy is a substring, and **a substring cannot notice a true sentence about an untrue thing.**
When a task's deliverable is prose, print it and read it.

---

## §5 — What needs Richard, not a session

- 🔴 **Authorisation to spend on the drive in §1.2.** It is one run and it closes three debts.
- **F82** — `nodegx-observe` reported `✘ Failed to connect` in one `claude mcp list` and
  `✔ Connected` twenty minutes later, same binary. **Intermittent, not the flat failure the register
  records.** Not investigated.
- **F51** (the 25% `ACCENT_CEILING`), **F33**, and **`§9`'s prose** — unchanged.

## §6 — Definition of done for the next session

- [ ] `testci-clean.log` read, and §0.2 resolved **by name** — BEN-001 green, or fixed
- [ ] BST-003's card rendered with **zero projects**, clicked, screenshot in the register
- [ ] The editor half of BST-005 driven, in the same stack
- [ ] `mcp-model-driver.js` given a no-project mode
- [ ] Richard asked about the drive; if authorised, run it and **judge it on the render and the
      Router**, not on the tool count
- [ ] Everything unrun named — Windows included
