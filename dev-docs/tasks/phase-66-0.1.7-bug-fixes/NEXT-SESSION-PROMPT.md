# Phase 66 — next session

**Written 2026-08-15, session 19.** **FIX-017 §B is built and AC4 is discharged** (`5d793d83`).
`Noodl.Records.` and nine more namespaces now answer at their own dot, pinned by 11 specs that were
**run against a known-broken control**. Thirteen tasks stay closed; FIX-017 moves from `open` to
**partly built, undriven**.

🔴 **The finding that outlives this task: a register "reconciled against git" can still lie.**
Phase-61's `TASKS.md` was swept on 08-14 and the sweep read the **status column**. FUN-007's row went
on saying its §2 was *"not done"* in the prose beside the corrected status, while `97e465a2` had
built it on 08-12. **A register is reconciled when its sentences are right, not when its states
are.** And FIX-017's own §1 — the paragraph warning that this register was stale — was itself the
stale thing. §3.

⚠️ **This session drove nothing, and that was forced.** Nine Electron editors were live on the
checkout. §2 and §5.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, overwritten each session. It carries exactly four things:

1. **Built vs. driven**, per task, as a table — *built* is code plus gates; *driven* is the app
   doing it. Never let the two blur into "done".
2. **Gate readings with their date and tree**, so the next session compares NAMES against a reading
   it can trust rather than re-deriving one.
3. **What this session settled**, so nobody re-litigates or re-measures it.
4. **What to do next and why**, ordered, with rulings owed by Richard called out separately.

Learnings that outlive the phase go to memory, not here.

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-017** | ◐ **§B only** | 🔴 **no** | **NEW this session** (`5d793d83`). §B + AC4 done; **§A and §D untouched**. See §4 |
| **FIX-014** | ✅ | ✅ both clients | **CLOSED** s18. 🔴 driven ≠ shipped — the packaged app still lacks the pass |
| **FIX-019** | ✅ | ✅ 4/4 | **CLOSED** s18 — 14(a) ruled *no sweep* |
| **FIX-001** | ✅ | ✅ 5/5 | **CLOSED** s17. 🟡 §1a.5 stretch open, and worth re-deciding not building |
| **FIX-002** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-003** | ✅ | ✅ 5/5 | **CLOSED** — `will-navigate` proven (s13) |
| **FIX-007** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-009** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-010** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-011** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-012** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-018** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-020** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built; **C needs a measurement from Richard** |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Thirteen closed, one partly built.** FIX-017 is the phase's only partly-driven row — do not let it
blur into "done" the way FIX-014's did for three sessions.

---

## 2. Gate readings

**Tree: `5d793d83`.** ⚠️ **`test:ci` was NOT run this session and that is deliberate** — nine
Electron editors were live on the checkout, and both a launch *and* a teardown reap a running suite.
The reading below is therefore **narrower than usual**; do not quote it as a `test:ci` floor.

| Gate | Reading | When |
|---|---|---|
| `noodl-core-ui` jest — the changed file | ✅ **51/51** (41 pre-existing + 10 new) | 22:0x |
| `noodl-core-ui` jest — full package | ✅ **24 suites / 395**, 0 failed | 22:0x |
| `noodl-core-ui` `tsc --noEmit` | ✅ **adds nothing** — 44 errors, *all* `../noodl-editor/**` alias `TS2307`, **0** in `code-editor` | 22:0x |
| **known-broken control** | ✅ **5 of the 10 new specs go red** with one-level behaviour restored | 22:0x |
| `test:ci` (jasmine) | ⬜ **not run** — checkout busy. Last trustworthy reading is s18's: **6 by NAME** at `seed 39393` | 08-15 19:51 |

🔴 **Quote the six by NAME, never the count** — `totalCount` moved 2779 → 2843 in a day. A mismatch
is almost always age, not a regression.

✅ **`noodl-core-ui`'s jest is plain Node and package-local** — it is safe beside live editors, which
is why this session had any gate at all. It is **not** in `test:ci`; the two do not cover each other.

---

## 3. 🔴 The finding: a reconciliation that reads the status column

FIX-017's AC4 asked for phase-61's `TASKS.md` to be reconciled. Two layers, and the second is the
one worth carrying:

| Claim | Reality |
|---|---|
| FIX-017 §1: "it is four tasks stale, you will rebuild three finished tasks" | **Already fixed on 08-14**, before this session |
| phase-61 FUN-007's row: "§2's gutter rendering is **not done**" | **Built 08-12** by `97e465a2` — `runtimeDiagnostic.ts` + 176 spec lines, in the tree, specs passing |

The 08-14 sweep announced itself as *"corrected against git, not against this table"* and it was —
for the **status column**. The stale claim sat in the **prose of a row whose status it had just
corrected**. A status glyph is a handful of tokens and gets checked; the prose is where the actual
claims live, and it is where a sweep stops reading.

**And a stale warning about staleness is worse than none.** FIX-017 §1 would have sent its reader to
fix four rows already fixed, and **past the one thing that was not**. When a doc tells you a register
is stale, read the register first — that warning is itself a dated claim.

Saved as `a-reconciliation-pass-fixes-status-and-leaves-prose`.

---

## 4. What this session settled — do not re-derive

### FIX-017 §B, built (`5d793d83`)

`ApiMember` gained `members?`; `apiMembersAtPath` walks a dotted path **anchored at `Noodl`**. Ten
namespaces answer: Records, Users, CloudFunctions, Navigation, Files, SEO, Config, Object/Model,
Array/Collection, Events/eventEmitter.

🔴 **Three of the task's own citations were wrong, each found by opening the file** — the general
lesson being that a task doc's citation list is a set of claims, not a bibliography:

1. `dist-types/…/records.d.ts`, recommended as *"generated — best"*, is accurate but **gitignored**
   (`.gitignore:225`). A citation there cannot be checked on a fresh clone. Used `records.js`, which
   ships — **11 methods, not the 12 claimed**.
2. `model.js` / `collection.js` are **`.ts`**. The citation does not resolve.
3. **`Config` cannot be a static list at all.** It is a Proxy over App Setup *plus the project's own
   config variables* (`api/config.ts:73-90`). Shipped as an explicitly-partial floor that says so,
   rather than a contents page that would tell a user their own variable does not exist.

**Two things the specs caught that the build did not:**

- ⚠️ **An alias assertion passed vacuously.** `expect(labelsFor('Noodl.Model.')).toEqual(labelsFor('Noodl.Object.'))`
  is `null === null` on the old build — it **agreed with the defect**. Only the known-broken control
  exposed it. It now pins that each side answered *before* pinning that they agree. This is the
  [[a-behavioural-guard-can-be-decoration]] shape, in a test.
- 🔴 **Ordering in `memberCompletions` is load-bearing.** `Variables` is a name in *both* surfaces
  and only the project has its members, so `resolveNamespace` must run **before** the static walk.
  Reversed, `Noodl.Variables.` silently loses the project's real variable names. Commented at the
  site and pinned by a spec.

### A `*/` inside a doc comment

Citing `dist-types/**/records.d.ts` in a JSDoc block **ended the comment at the glob**, truncating
the module. 🔴 The compiler then reported `globalsFor` — an export months old and untouched — as
missing. **When a module reports an export you did not touch, suspect truncation, not the export**;
typecheck the suspect file *alone* to get the real `TS1443` line. Saved to memory.

---

## 5. What to do next and why

1. 🔴 **Drive FIX-017 §B — it is one popout.** Open a Function node, type `Noodl.Records.`, see
   `query`/`create`/`save`/`delete`. That closes criterion 2 and it is the cheapest open criterion in
   the phase. **Do it the moment the checkout is quiet**, and check first — this session could not.
2. **FIX-008 fix C** — Richard owes a measurement on C's copy. The oldest open item.
3. **FIX-017 §A** — answer at an empty position. 🔴 The task requires driving it **both ways**
   ("typing ordinary code is not smothered"), so it is not startable on a busy checkout either.
   §D (the browse button) is small and independent.
4. **FIX-013**, **FIX-016** — open, each needs its ruling (§6). ⚠️ Note FIX-016's §2 (the
   declared-String-but-called diagnostic) has **no ruling attached** and a ready home in
   `portDiagnostics.ts` — it is buildable today, same as §B was.
5. 🟡 **FIX-001 §1a.5 stretch** — re-decide rather than build.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 6. Owed by Richard

- 🔴 **`scripts/library/check.ts` is STILL uncommitted and STILL unattributed.** Unchanged from s18;
  six sessions were asked and none claimed it. It is the script behind `library:check`, and
  `cloud-library:check` **is a PR gate**. One `git add -A` from riding along, one `git checkout --`
  from vanishing. **Attribute it or bin it.** I did not touch it.
- 🔴 **FIX-013's four rulings** — they decide the task's shape, not its details. Ruling 2 (does the
  AI authoring preview keep its toolbar?) is the big one: "yes" retires a written constraint, "no"
  makes ~1,500 lines genuinely deletable.
- 🔴 **FIX-016's signal-input semantics** — re-run the body vs named handlers, or rule signal inputs
  out and document `run` as the only trigger.
- 🔴 **The `noodl-mcp` repackage** — deployment debt, not a blocker. The packaged app has 0
  occurrences of FIX-014's layout pass, so it reaches no real user until rebuilt.
- 🔴 **`MEMORY.md` is over its budget and the hook now nags on every edit.** It cannot be brought
  under by rewording — getting under means **dropping live trap entries**, which is a call about your
  own knowledge base. I added two lines and tightened them, but did not drop anyone else's.
  ⚠️ Several sessions edit it concurrently; targeted single-line edits only.
- ⚠️ **`d061bc6e` (the sweep fix) is committed but STILL UNPROVEN in the wild** — unchanged from s18.
  No session has launched over a genuinely running suite with it loaded.
- 🟡 **`run-editor/SKILL.md:23` teaches `nohup … &`**, which reparents the stack to PID 1 and
  destroys launch provenance; it also does not mention `npm run cdp` is root-only.
- 🟡 **s13's datum on `linkify`**: the scoping model *declines to emit links* (3 refusals).
- **FIX-004** conversion block shape · **FIX-005** category name · **FIX-006** demote Script? ·
  **FIX-008** leftovers (incl. a measurement) · **FIX-015** / **FIX-021** are their own sessions.

---

## 7. Standing constraints

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call (⚠️ **the Bash
cwd persists between calls** — use absolute paths); **pathspec-scope every `git add`/`git commit`**.

⚠️ `dev-docs/tasks/phase-65-the-library/` and `phase-69-the-node-you-write-yourself/` are untracked
and belong to neither this phase nor 67 — `MEMORY.md` links into them, so they are one `git clean`
from gone. **Leave them.**

**Announce before *and* after any `test:ci`, `test:main` or editor launch, and announce your PIDs.**
🔴 **Check the checkout before planning a drive, not after** — `ps -Ao pid,ppid,lstart,command`
grepped for `electron/dist` took one call this session and changed the whole plan. Nine editors were
live; `ListAgents` showed nine sessions, but a *listing is not a process* — the `ps` is the evidence.

⚠️ **Two hazards, two different windows** — a **launch or teardown** is destructive for a whole
`test:ci` run; the **~40s webpack** window bounds **source edits** only.

✅ **A package-local jest run is the gate you can still take on a busy checkout.** `noodl-core-ui`'s
jest is plain Node, spawns no Electron, matches no `DEV_TOOL` pattern, and finished in ~1s.
