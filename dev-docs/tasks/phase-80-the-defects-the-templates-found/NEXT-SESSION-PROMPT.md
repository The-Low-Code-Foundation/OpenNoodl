# Phase 80 — next session

## The board, re-derived from TASKS.md this session

**36 rows. 33 ✅ · DEF-007 🟡 partial · 2 open — DEF-033 (P18's) and DEF-036 (new, s34's).**

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | grep -av '✅'
```

s34 closed **DEF-035** by driving its owed AC5, and the drive produced a new row. Commit
`7ec2a6cd`. **No source changed this session — no gate was re-run and none is claimed.**

---

## 🧭 THE ONE THING TO PUT IN FRONT OF RICHARD

**A decision, not a fix: should a wire be allowed to declare a column on the *accounts*
table, the way it already can on an app table?**

P77's SBR-008 built `recordWiredFieldPorts` on the principle *"the wire is the
declaration"* — with no schema to read, a Record node still offers a `prop-<field>` port
for any field one of its own wires names, typed `'*'`. Its docblock states the price
openly: **a mistyped `prop-titel` now writes a `titel` column instead of warning.**

That was accepted for app tables. **DEF-036 asks for the same net on `_User`**, and a
stray column on the accounts table is not obviously the same kind of accident. The
alternative — leave it, and accept that a sign-up form silently stops writing its custom
fields whenever the schema is cold — is what ships today.

🔴 **This is not hypothetical.** 271 wires across 21 of the 118 corpus projects sit on
the unprotected side.

---

## What s34 did: the drive, and what the drive found out about its own row

### 1. AC5 is met — two exports, one project, no edit, different builds

A **copy** of `LearnBook` opened in a real `dev:debug` Electron editor, exported through
the product's own path (`exportToJSON` → `exportComponent` → the health filter). The
control arm is the pre-fix build, rebuilt from `e5b68d30^` and reloaded.

| | fixed (HEAD) | pre-fix |
| --- | --- | --- |
| export before the trigger | 2,587 conns · 176 schema wires | 2,587 · 176 |
| `_fetch` calls the trigger drove | **2** | **1** |
| what was written | **nothing** | `dbCollections=undefined`, `systemCollections=undefined`, `dbVersionMajor=undefined` |
| export after | 2,587 · **176** | 2,573 · **162** |
| `project.json` on disk | md5 unchanged | **the `dbCollections` key is gone from the file** |

**14 wires lost, 0 gained, diffed by name.** Full readings and controls: DEF-035 §6.

### 2. 🔴 The lesson: THE POPULATION A PORT *COMES FROM* IS NOT THE POPULATION THAT *DIES*

DEF-035's own §2.2 said **3,783 wires in 28 projects**. The drive lost **14 of 176** on a
fixture that section ranked fifth. Both numbers were right about different things.

3,783 counts every wire on a `prop-*` port the **schema generates**. But
`recordWiredFieldPorts` re-mints those ports from the node's own wires when the schema is
gone — and **the Record family calls it while the User family does not**. So:

| | wires | projects |
| --- | ---: | ---: |
| schema-generated (what §2.2 counted) | 3,783 | 28 |
| Record — protected by SBR-008's net | 3,579 | — |
| **User — actually vanishes** | **271** | **21** |

✅ **The corroboration is the part to copy.** The re-derived predicate predicts **14** for
`LearnBook`; the real editor lost **14**, every one `net.noodl.user.*`. Two instruments
from opposite directions on one number.

🔴 This is the **third** consecutive session to find a row whose population was named by a
*derivation rule* rather than by the *failure*. s32: a row named an example and missed
half its population. s33: a metric named a superset (`prop-*`, 2.4× over). s34: a
population named where the ports **come from**, when the question was where they **are not
replaced**. The question that catches all three is the same one: **ask what your metric
would count if the defect were absent.**

### 3. What the drive did NOT show — read before quoting it

- ⚠️ **No arm had a running built-in backend.** No corpus project binds one; they all
  point at remote Parse servers. The arm driven is the one the defect lives in — a
  backend the editor *cannot reach*. The warm/cold pair was made by the trigger, which is
  the variable D13 named.
- ⚠️ **The fix does not heal an already-wiped project.** The pre-fix fixture is still
  missing `dbCollections` on disk and the fixed build correctly leaves it alone.
- ⚠️ **"The Record wires survive" is not "nothing is lost"** — `recordWiredFieldPorts`
  types its ports `'*'`, so the narrowed column type and the Class dropdown are gone while
  the cache is cold.

---

## The work, in the order it should be done

### 1. DEF-036 — needs Richard's ruling first (see above), then it is small

Two code paths, and **fixing one leaves the other**:
`userPropertyPorts` (`user-ports.ts:242`, serving `User` + `SetUserProperties`) and
`SignUp`'s own inline loop in a **different package** keyed on a **different metadata
key** (`noodl-viewer-react/…/signup.ts:215`, `systemCollections`). AC3 is the one to write
the spec around: a wire naming `prop-password` must not resurrect that port.

### 2. Five rows are built and undriven — that is still the phase's largest debt

DEF-035 is now off this list. What remains, by what a drive would settle:

- **DEF-028** — its own AC5. ⚠️ **s34 narrowed it but did not close it.** The drive spied
  `flushEvaluateHealth` firing **211 times, once per component**, in one real export of a
  2,228-node project — so the unconditional flush is affordable at scale. It is *not* the
  two-takes-differ measurement DEF-028 asks for.
- **DEF-034 AC5** — `LearnBook › Pretty button`, the gate driven by a wire.
- **DEF-029** — 🔴 a drive serves a **built bundle**; rebuild `noodl-viewer-react` first
  (~40s). ⚠️ The ports fold into **`Advanced CSS`**.
- **DEF-031**, **DEF-005's `Roles` output**, **DEF-009's default**, **DEF-025's editor
  half** — all undriven.

✅ **The drive harness is written and works.** `evalfile.js` + the `p0`–`p9` probes are in
this session's scratchpad; the reusable parts are the launcher-card stamp
(`window.__def035Label` → `[data-def035]` → a real `cdp click`), the webpack-require seam,
and — the one that matters — `p7-which-build.js`, which reads
`SchemaHandler.prototype._fetch.toString()` in the running renderer so an arm cannot
silently run on the wrong bundle.

### 3. DEF-033 — do NOT take it without checking P18

`Substring`'s panel says `End = 0`, the node behaves as `End = -1`. **Registered by P18**
at `6f91ae2a`; its own text says the fix is a **decision**. 🔴 Check
`phase-18-code-export-v2/` files and mtimes first — a peer may be doing your exact task.

### 4. The unowned rows

[UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md) — six. §1 disproved; §6 measured.
**Measure one fully before starting the next.** ⚠️ **`DEF-036` is taken; the next free id
is `DEF-037`.**

---

## What DEF-007 still owes

- ⚠️ **AC2 and AC4 are open.** AC2 (a curated template installed **through the picker**
  opens on its home) cannot be driven until a template is published. AC4 is §6's table,
  which exists — someone should decide whether that discharges it.
- 🔴 **The pin is on the site-builder generator ONLY.** `tpl001Template.ts` is the other
  generator and is **unmeasured**; it writes a **v2 directory**, so its graph needs
  assembling into the legacy shape first. **Measure whether TPL-001 disagrees at all
  before porting anything.**
- 🔴 **§3.3's replacement is still undecided** — refuse a missing home at publish, or
  resolve-and-warn at install as `noodl-preview` already does. **6 of 97** projects carry
  no home. 🧭 A decision, not a fix to be guessed at.

## Owed elsewhere

- 🔴 **DEF-005 AC5 — TPL-001's member list**, a roster page on `List Users In Role`.
- 🔴 **P77 D33 — the six `/Pages/ThemeEditor` rows** DEF-007 §3.2 armed. A peer reported
  s31 set `true` on all six, so the editor now runs them where it used to silence them;
  a `[runtime/cyclic-loop]` on the theme editor is **D33 surfacing, not a regression**.

---

## Gates

🔴 **None were run, and none is claimed.** This session changed **no source** — the only
edit to `packages/` was a temporary revert of `schemahandler.ts` to take the control arm,
restored before commit (`git status` clean for it). The floors carried forward from s33,
unverified at this HEAD: `test:ci` **4** (all AIX-006, by name), 2916 specs;
`test:main` **5 pre-existing failures** (`sb-007`, `sb-018`, `aib-007`) that are
**somebody's open work — do not read them as this phase's floor and do not "fix" them**.

## Traps carried

- 🔴 **The population a port COMES FROM is not the population that DIES.** Three sessions
  running. Ask what your metric would count if the defect were absent.
- 🔴 **An absence needs a known-firing signal beside it.** Arm A's headline was *nothing
  was written*. Without the `_fetch` counter, "the fix declined to write" and "the trigger
  never fired" are the same reading with opposite meanings.
- 🔴 **Measure which build is under the drive, in the renderer.** `_fetch.toString()`.
  A watcher that had not finished would have let the control arm run on the fixed bundle
  and report *no defect* — the shape that closes a row wrongly.
- 🔴 **An editor rebuild here is ~5 minutes, not seconds**, and a `cdp reload` issued
  during one hangs on `wait until bundle finished` and reads as a dead renderer. Wait for
  `"reactMounted": true`, and 🔴 **do not grep for `mounted` — it matches `reactMounted:
  false`.** Grep the literal `"reactMounted": true`.
- 🔴 **`wc -c` output carries leading whitespace**, which broke a `tail -c +$N` wait loop
  into a spin. Wrap it or use `$(...)` arithmetic.
- ⚠️ **A webpack chunk push needs a unique id** — reuse it and `req` comes back
  `undefined`, which looks exactly like the seam being unavailable.
- 🔴 **`git add` untracked files individually, then `git commit <pathspecs>`.** Never stage
  tracked files — a sibling's commit sweeps them.
