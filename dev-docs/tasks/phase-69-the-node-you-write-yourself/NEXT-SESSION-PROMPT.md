# Phase 69 — next session (s26)

**Written 2026-08-18, end of session 25.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first.

> ## 🔴 The one thing that changed, and it is a warning as much as a result
>
> **CN-013's cloud half is BUILT, DRIVEN and COMMITTED** — the last D18 obligation of any size.
> But the way it was built is the part worth carrying: **a ruling's stated reason was false**, and
> **a diagnostic I shipped in commit 1 made an existing diagnostic lie, which commit 2 fixed.**
> §2 is both. Neither was found by a gate.
>
> **Bundle A did not run**, and the reason is in §4. It is still the right next move.

---

## 1. Where the phase is

| Task | Built | Driven | Left |
|---|---|---|---|
| **CN-001**…**CN-006**, **CN-018**, **CN-019**, **CN-006b**, **CN-015**, **CN-012** | ✅ | ✅ | — closed s4–s24 |
| **CN-013** | ✅ **cloud half s25** | ✅ **both build shapes s25** | **AC2, AC4**; SSR **measured not fixed** — §3 |
| **CN-007** | ✅ s14 | ✅ s15 | **AC2**; 🔴 **AC5 is STALE** — Bundle B |
| **CN-008** | ✅ s16 | ⚠️ | **AC1 needs a live model** — Bundle A |
| **CN-009** | ✅ s17 | ⚠️ | **AC5's consequence needs a live model** — Bundle A |
| **CN-010** | ✅ s18 | ✅ AC1 s19 | **AC4 not started** — Bundle B |
| **CN-011** | 📋 | — | all of it — Bundle B |
| **CN-014** | ✅ AC1's library half s20 | ✅ s20 | **AC1's 2nd clause, AC2, AC3** — Bundle A |
| **CN-016**, **CN-017** | 📋 | — | 🔴 **DEFERRED — do not start.** Wants its own scoping conversation |

**Ruled work still outstanding:** **D10** (kit `docsUrl`, unblocks CN-007's docs link) · **D12**
(`channelPort` rejected at kit-load — **not started**, ⚠️ see §5) · **D13** (`validate:project`
checks parameter values) · **D14** (close `NodeDefinitionOptions`' index signature) · **D16**
(narrow the `Page` parameter-skip `info`). ✅ **D17 is DONE** — and half of it already was, see §2.
✅ **D18 is DONE.** **D9, D11, D15** need no work.

## 2. 🔴 Two things s25 found that generalise beyond this phase

### A ruling can be right for a reason that is false, and the obligation it derived is then unsatisfiable

D18 bound the builder to *"verify preview AND production — the isolate and the service process are
different execution contexts and this ruling exists because they disagree."* **This repo has one
context.** Nothing loads `sandbox.isolate.js`; its `console`/`fetch`/`setTimeout` shims all call a
`_noodl_api_call` that has **no implementation anywhere in this repo**; and the editor's "cloud
preview" spawns **`nodegx-backend/dist/cli.js`**, the bundle a deploy target runs.

✅ **D18's conclusion stands** — on premise 4 (a deployed backend is one prebuilt `cli.js` with
nowhere for an npm package to land), which is untouched. Only the *reason* and the *verification
obligation* were wrong. The honest replacement — **one context, two BUILD SHAPES** (source via the
`@cloud-runtime` alias, and the esbuild bundle) — is what was actually verified, and it caught
nothing, which is itself the useful record.

🔴 **The finding was already in the repo when D18 was ruled** — in
`nodegx-backend/tests/cloud-logic-builder-log.test.ts`' header, in another phase's file, in its own
words: *"this file is not one of two paths, it is the path."* **Before accepting a premise about a
mechanism, grep the test headers for the mechanism.** That is where this repo puts its measurements.

### 🔴 Shipping a capability turns working diagnostics into lies, and no gate catches it

Commit 1 built the cloud loader. `effectiveKitRuntimes` in `nodegx-kit-catalog` then reported every
cloud-enabled kit as running **nowhere**, and `kit-loads-nowhere` told authors to *"add browser"* —
both correct the day before, both false the moment the loader landed. **All suites stayed green.**

⚠️ The function had literally predicted it: *"The day a cloud loader exists, this function is the
one place that has to learn about it."* **It was right and it still did not fire.** A comment naming
its own future breakage is not a gate.

✅ **What to do about it, generalised: after building a capability, grep for the diagnostics that
assert its ABSENCE.** `kit-loads-nowhere`, `not-cloud-enabled`, `runs nowhere`, `nothing loads` —
these are the sentences that go stale silently, because a message is not type-checked and a passing
test only proves the message did not *change*.

🔴 **And the sharpest instance was a test fixture.** `health.test.js` built an overlay with
`declaredRuntimes: ['cloud'], availableIn: []` — a shape the producer **can no longer emit**. It
went on passing while grading a state the code cannot reach. It now uses `['ssr']`, which is a real
counter-example (measured: nothing loads a kit under SSR). **A hand-built fixture outlives the
producer that justified it, and only re-deriving it from the producer catches that.**

⚠️ **D17 was half-satisfied before it was written:** `typecheck:mcp` was already in `pr.yml`. Only
`typecheck:editor` was missing. **Check the gate file before implementing a ruling that says "add a
gate".**

## 3. CN-013's SSR half — measured, NOT fixed, and item 4 is now dangerous

🔴 **A kit does not render under SSR, and the globals being set is exactly why everyone assumed it
did.** `runtime-globals.js` creates `globalThis.__noodl_modules = []` and installs a working
`defineModule`; **no file in `static/ssr/` ever evaluates a kit's `index.js`**, so nothing calls it.
The server render is handed `[]` every time. Measured beside a known-firing control
(`noodl-viewer-react/tests/ssr-kit-modules.test.js`).

🔴 **The consequence is CN-001's shape again — not a blank, worse.** The kit `<script>` tags *are*
in `public/index.html` and `noodl_modules/` ships verbatim, so **the client loads the kits and the
server does not**: the server renders the page with the kit nodes missing (skipped **with their
connections**) and hydration then renders a different tree.

🔴 **Therefore CN-013 item 4 must not be built next.** A `kitNeedsSsrWarning` on
`libraryNeedsSsrWarning`'s model would warn about **browser-only** kits — and under SSR *every* kit
is missing, whatever its `runtimes` says. It would name the wrong kits and stay silent about the
rest. **Fix item 1 first, or do neither.**

✅ **The fix is small and already designed twice.** `kitModules.ts` is the missing piece in a second
runtime; server-side it can read the files straight off disk, so it needs no bundle-shipping half at
all. ⚠️ **It wants its own slice — D18 does not rule on SSR.**

⚠️ **Not measured: a rendered SSR page.** The seam is measured; the visible consequence is derived.
[notes/cn-013-ssr.md](notes/cn-013-ssr.md) names the drive that would close it.

## 4. 🔴 BUNDLE A — why it did not run, and what to do about it

Still the right move and still the whole speed-up. **It did not run because a peer was live in the
editor's source with uncommitted changes** (`communityapi.ts`, `AskAboutNodeDialog.tsx`, edited
11:53–12:05 while I worked). Launching a stack would have compiled **their half-finished code** and
every observation would have been unattributable — which is precisely the false reading this phase
keeps finding. ✅ **They have since committed** (`179c6432`, `4c23f869`, `3482c1da`).

✅ **Check this before launching, every time:** `git status --short` for uncommitted editor source,
and `stat -f "%Sm %N" -t "%Y-%m-%d %H:%M"` on anything that shows up. **A clean-looking `ps` is not
the same as a clean tree.**

### The bundle, unchanged

| Drive | What it wants |
|---|---|
| **CN-008 AC1 + CN-009 AC5** | a live model authoring in a project that has a kit — spawn the MCP bundle over stdio from a **scratch** esbuild path, never over `packages/noodl-mcp/dist/` |
| **CN-014 AC1** | rename a port in a kit → panel shows the new name, old connection **dropped with a diagnostic** |
| **CN-014 AC2** | add a node to a kit → appears in the picker, no restart |
| **CN-014 AC3** | a kit with a **syntax error** reports it rather than leaving the previous version silently running |
| **CN-013 SSR** | ⚠️ **NOW A DIFFERENT DRIVE.** The answer is known — deploy at `deployRenderingMode: 'ssr'`, `curl` the HTML, confirm the kit node's output is **absent from the server response** with a built-in in the same page as control |

✅ **The fixture the bundle needs, still to build:** one project with a healthy kit, a kit to rename
a port in, a kit to add a node to, a kit to break, and a pure-JS logic kit. ✅ **Start from
`NodeGX test projects/cn012-drive`** (s24's `cp -R`, has `tally-kit`). ⚠️ Read the cashflow kit via
`cp -R`; never write to it. ⚠️ Opening a project **writes three files into it**.

⚠️ **Write every observation down before launching.** A bundled drive is exactly where *"it looked
fine"* gets in.

## 5. ✅ Owed by Richard — nothing. The queue is still empty

**Wanting task numbers, none blocking:**
- 🔴 **An SSR kit loader** (§3). The measurement is done and the fix is designed; it is not D18's.
- 🔴 **The deploy-time kit warning.** The editor could name, *before* pushing, a cloud function whose
  graph uses a node type from a kit that has not opted into `cloud` — the node library already
  stamps `module` on every kit node (CN-003). Turns a 504 into a warning in the editor.
- **Server-side SDK dependencies** (Richard's actual ask behind D18) — its own task and probably its
  own phase; reopens backend packaging, the isolate's `require` and the trust boundary together.
- **The open-panel refresh** (D11, deferred *by decision*) · `render-from-disk.js` answers only `/`
  and `/index.html` · the `@noodl/mcp` provisioning flake · `ViewerConnection.sendRefresh()` dead at
  both ends · the half-registered kit (s22) · ⚠️ `kitDiagnostics` prints outside
  `validate:project`'s summary, so an `ERROR` appears above `0 error(s)`.
- 🔴 **The cashflow kit is OUTSIDE the repo and the copies differ** — unversioned, no gate, and D5
  makes CN-007 depend on it.

⚠️ **D12 was scoped this session and not started.** The seam is `nodegx-kit-catalog/src/health.js`'s
`kitDiagnostics` (where `kit-loads-nowhere` and `kit-registered-nothing` already live) fed by
`toDynamicPorts` in `src/index.js:213`, which is the one place `channelPort` is recognised. The
census stands: **one occurrence in 177 types, a test fixture's own kit node.**

## 6. Checkout conditions as s25 left them

- ✅ **NO editor stack was launched.** No `dev:debug`, no `dev:stop`, nothing reaped. The only
  processes I started were **two `nodegx-backend` servers built to a SCRATCH path** (ports 8611 /
  8612), both confirmed dead. ✅ **Never built over `packages/nodegx-backend/dist/cli.js`** — the
  editor spawns that file and a peer's backend can start from it at any moment.
- ⚠️ **A peer worked on phase 67 throughout**, committing `179c6432`, `4c23f869`, `3482c1da` between
  my two commits. Same git user, so **the author field cannot separate us** — attribute by content
  and time. No broadcast was sent: the peer could not be tied to a socket, and 22 sessions are
  listed of which most are days old.
- **My commits:** `c6dcb3a2` (the loader, 15 files) and `112fbb50` (the catalog correction + D17,
  6 files). 🔴 **A `test:ci` contamination window covers both**: `noodl-viewer-cloud`,
  `nodegx-module-inject`, `nodegx-kit-catalog`, `nodegx-backend`, `noodl-editor` and
  `.github/workflows/pr.yml`.
- ✅ **Suites after the change:** `@noodl/cloud-runtime` **189 / 9** · `@noodl/nodegx-backend`
  **1090 / 101** · `@nodegx/module-inject` **21** · `@nodegx/kit-catalog` **66 / 3** · `noodl-mcp`
  **641 / 54** · `noodl-viewer-react` **913 / 72** · editor `test:main` **3752 / 244**.
  `typecheck:cloud` **0**, `typecheck:editor` **0**, `typecheck:mcp` **0**.
- 🔴 **`test:main` FLAKED once and it cost a re-run.** The first run reported **3 failed in 2
  suites**, one of them `tests-unit/bld-004/reasoningChannel.test.ts:238`; an immediate re-run on
  the **same tree** was **3752/3752 green**. Not my change — but ⚠️ **I piped that first run to
  `tail`, which destroyed both the failure list and the exit code** (`| tail` reports the pipe's
  last command, so it read 0 while tests were failing). **Redirect a suite to a file; never pipe
  it.**
- 🔴 **`test:ci` still stands where s12 left it** (`2843 / 6 @ 39393`); s13–s25's commits are not in
  it. **Re-measure before quoting; never quote a handover's number.** ⚠️ `noodl-runtime` was not run
  — not touched.
- ⚠️ **Peer work live in the tree, untouched:** `dev-docs/tasks/phase-50-legibility/notes/`,
  `dev-docs/tasks/phase-65-the-library/` (untracked), `phase-68-learnbook/README.md`,
  `scripts/library/check.ts`, `dev-docs/tasks/phase-70-the-course-is-an-app/` (untracked).
- Whoever you tell you are starting, tell you have stopped.
