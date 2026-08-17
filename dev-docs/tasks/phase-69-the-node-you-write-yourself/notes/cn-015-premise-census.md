# CN-015 — the measure-first pass, session 22 (2026-08-18)

Run **before writing any code**, per the phase's standing obligation. Four of the task's premises
were checked against the code and against real data. **One is backwards, one is half-built already,
one is true, and one cites a list that does not exist.**

---

## 1. 🔴 The collision premise is BACKWARDS at runtime — and a shipped message says the wrong thing

CN-015 says: *"CN-003 gives built-ins precedence; this task makes the shadowing **visible** rather
than a silent override."*

**Precedence is not one rule. It is two rules that disagree.**

| Layer | Who wins a name collision | Established by |
|---|---|---|
| **Catalog / validation** | the **built-in** — the kit node is dropped and a `collision` recorded | `packages/nodegx-kit-catalog/src/index.js:336-339` (read) |
| **Runtime** | the **kit** — it overwrites the built-in | **measured**, see below |

`NodeRegister.register` is an unguarded assignment (`noderegister.ts:41-45`,
`this._constructors[name] = nodeDefinition`), and `viewer.jsx` registers built-ins **first**
(`:151`, and `:54` on the SSR path) and module nodes **after** (`:159-171`, `:62-74`). Last writer
wins, so the kit wins.

**Measured, not inferred** — a probe registered a built-in-named node then a kit-named one and
asserted the *built-in*, so the failure would print the truth:

```
AFTER KIT REGISTER, metadata.tag = KIT
createNode returns tag = KIT
  ● expected "BUILTIN", received "KIT"
```

### The consequence, and it is worse than either half

A kit declaring `Text` gets: **validation checking the built-in `Text`'s ports, and the runtime
running the kit's `Text`.** A project can pass its own gate and behave differently. This is the
"a node behaving unlike its name" case the task itself calls an **error**.

🔴 **And the author is currently told the opposite of what happens.**
`scripts/validate-project.ts:154-159` prints:

> `WARN kit "X" declares "Text", which is a built-in type name. The built-in wins; the kit's node is
> not available.`

The second sentence is **false at runtime**. Anyone who trusted it would debug the wrong node.

⚠️ **Whether the runtime should change so built-ins win is a ruling, not an implementation
detail** — some existing module may deliberately override. CN-015's own scope is *visibility*, so
the build should correct the message and report the shadowing; **changing runtime precedence is
Richard's call.** See the owed question in the handover.

---

## 2. The load-failure premise is HALF ALREADY BUILT — the gap is the editor

CN-015 says a throwing kit "currently produces… something, in a console nobody is watching".

**On the headless/MCP path that is already false.** `packages/noodl-mcp/src/kitExtract/entry.js`
already wraps both the `require` (`:124-133`) and the registration (`:137-152`) and pushes a
`{kitModule, dirPath, message}` into `failures` — with a comment that names this task:
*"CN-015 owns turning `failures` into something a user sees."* `scripts/validate-project.ts:151-153`
already prints them.

**The editor has nothing.** It reads what the running viewer sent over `sendNodeLibrary`
(✅ D3), so a kit that threw is simply *absent from the payload* — and the editor cannot
distinguish **"this kit threw"** from **"this kit is not installed"**. That is AC1's real target,
and it is the half nobody has built.

---

## 3. The malformed-definition premise is TRUE, and sharper than written

`createNodeFromReactComponent` (`react-component-node.ts:775`) has **no guard at all** — not on
`name`, not on `getReactComponent`. It goes straight into `frame` handling.

**Measured:** a definition with no `name` does not get refused and does not get dropped —
it registers under the **literal string key `"undefined"`**:

```
keys after nameless register = ["undefined"]
```

So it *occupies a type name*, and a second nameless definition — from a **different kit** — silently
replaces the first.

---

## 4. AC4's "three known-zero shipped modules" — the list does not exist; I built one

LBR-006 (P65 `TASKS.md:15`) asserts *"Three 'modules' register zero nodes"* and **names none of the
three**. AC4 requires them as a known-broken input, so the census was run for real: dom-shim +
a `Noodl` collector, `require` each module's `main`, count what arrived.

**⚠️ The census lied twice before it was right, and both fixes matter:**

1. Without `window.React` as a global, **9 healthy modules threw** `React is not defined` and read
   as broken. The real runtime loads React before module scripts; the shim must too.
2. Collecting only `defineModule` missed **`defineNode`**, the logic-node path (CN-012's subject).
   A module using it would have read as *"registers nothing"* — the exact false negative the census
   exists to prevent.

**Result, with both closed (29 module dirs):**

| Outcome | Count |
|---|---|
| loads and registers ≥ 1 node | **15** |
| loads and registers **ZERO** | **1** — `form-validation/noodl-validation-module` |
| **unmeasured** — threw inside the harness (React internals, canvas, style-loader needing a real DOM head) | **5** — `avatar`, `chart-js`, `lottie`, `mapbox`, `simple-tooltips` |
| no `main` — iconset/asset, registers zero **by design** and correctly skipped | 7 |

🔴 **`asked − answered = absent`.** One zero-node module is *confirmed*; the other two LBR-006
counted are **not disproven** — 5 modules are unmeasured, and LBR-006 may also have been counting
the no-`main` iconsets. **Do not report "there is only one".**

✅ **AC4 now has a real known-broken input** (`form-validation`) and AC5 has 15 known-good ones.

---

## Instrument note, transferable and expensive

🔴 **`rg -r` in this harness is `--replace`, not `--recursive`.** `rg` is a shell function wrapping
the claude binary in ugrep mode. `rg -rn "collisions" …` printed every match with the matched text
**rewritten to the literal `n`**, and silently dropped line numbers — so the output looked like a
normal result set while the quoted source text was fabricated. Proven against a known-content
control:

```
$ rg -rn "collisions" probe.txt   →  hello n world
$ rg -n  "collisions" probe.txt   →  1:hello collisions world
```

⚠️ Also: **`cd` persists between Bash calls in this harness.** A `cd` into `packages/noodl-runtime`
made every later relative path resolve there; `ls dev-docs/tasks/phase-65-the-library/` returned
"No such file or directory" and was briefly written up as *"a peer deleted it mid-session"*. It had
not. **Prefer absolute paths, or `git -C`.**
