# CN-017 — Trust

| Field | Value |
|---|---|
| **Tier** | 6 |
| **Effort** | L |
| **Surface** | `runtime`, `editor`, `library` |
| **Rulings** | ✅ **D6** — local kits run freely; third-party **verified on install**, provenance recorded, **explicit consent** |
| **Depends on** | CN-006b (provenance display), CN-003 |
| **Gates** | CN-016 for anything not first-party |

## What we are actually shipping

A kit is **arbitrary JavaScript with full page access**, injected by `<script>` tag into the same
context as the app. It can read anything the app can read, call anything the app can call, and reach
the network. That is not a flaw to be engineered away — it is what makes a custom node as capable as
a built-in, which is **P1**. It does mean the honesty bar is high.

Note also that the runtime's sandbox responder already carries a `noodl_modules/` path pattern
(`responder.ts:36`), so there is an existing carve-out whose intent this task must establish rather
than assume.

## ✅ D6, in three parts

**1. Locally-authored kits run freely.** A kit you wrote in your own project is not gated. Gating it
would couple authoring to distribution — you could not validate your own work until you had published
it — and would make CN-006's scaffold useless. This is the part that keeps the phase's promise
intact.

**2. Third-party kits are verified on install.** Reuse ERG-002's **`verifyLibrarySource`**: it runs
fetched source in a `vm.createContext` sandbox shaped like a browser tab (`window`/`self`/`globalThis`
aliased, stub `document`/`navigator` so a UMD wrapper's `typeof` probes fall through) and confirms
what it actually defines. Its three distinguished failure shapes (ES module, CommonJS, wrong global)
are the right model: **a check that says what went wrong and what to do**, not a boolean.

⚠️ Be precise about what verification buys. `verifyLibrarySource` establishes *what a script defines*,
**not that it is safe**. Do not let the install dialog imply otherwise. Sandboxed execution is a
smoke test for shape, not a security boundary.

**3. Provenance recorded, explicit consent for non-first-party.** This is what makes CN-006b's
provenance display load-bearing rather than cosmetic: the property panel is where a user finds out
whose code is running in their app.

## What to build

1. **Verification on install** for library/URL-sourced kits, reusing `verifyLibrarySource` and
   ERG-002's verify-before-write discipline (a failed check writes nothing to disk).
2. **A provenance record** per kit — local / library / URL, source, when, and what was consented to.
   `registerLibrary` already writes a `kind: 'external-library'` manifest marker so list/remove never
   touch a hand-authored module; kits need the equivalent.
3. **A consent step** for non-first-party kits that states plainly what a kit can do. One clear
   sentence beats a wall of warning.
4. **Establish what the sandbox responder's `noodl_modules/` pattern is for** and whether it
   constrains anything today. If it is vestigial, say so; if it is load-bearing, document it.

## Acceptance criteria

1. A locally-scaffolded kit runs with **no prompt and no gate** — the D6 promise, and the easiest one
   to accidentally break.
2. Installing a third-party kit runs verification, and a failing kit **writes nothing**.
3. Provenance is recorded and visible in the property panel (CN-006b) and the kits list.
4. The consent copy states what a kit can do, in one sentence, without either minimising or
   catastrophising.
5. ⚠️ **Verification is honest about its limits** — no UI text claims a verified kit is "safe".

## Traps

- 🔴 **Put the guarantee on the decision, not the observation.** A record saying "verified: true" next
  to one saying "source: local" invites a reader to conclude local kits were verified. Make the
  fields incapable of contradicting each other — this repo has a recorded case of exactly two fields
  made to contradict.
- ⚠️ **A behavioural guard can be decoration.** Test that consent actually blocks execution, on a
  fixture that tries to run without it.
- ⚠️ **Connect writes the real `~/.claude.json`** — a recorded case of a feature touching a live user
  file. Any provenance store must not write outside the project without saying so.

## Out of scope

- Signing, a registry of trusted authors, or runtime sandboxing of kit code. All are defensible
  futures; none are D6, and pretending otherwise would delay the phase indefinitely.
