# HLS-004 — An export that builds

A CLI whose output fails `npm run build` has shipped nothing. This is the fourth repeat of
**correct and usable were never the same criterion**, and the fix is a close condition, not a patch.

## 1. The person sentence

**Someone exports an app they did not write, runs `npm install && npm run build`, and gets a built
site — without editing a generated file.**

## 2. What was reported, and what the code says

[#24](https://github.com/The-Low-Code-Foundation/NodeGX/issues/24): a freshly exported project fails
`tsc` on the exporter's own output —

```
src/pages/Anomalies.tsx(13,53): error TS18048: 'k' is possibly 'undefined'.
```

…from a wrapper the exporter emitted for an `Expression` node.

🔴 **The reporter calls the fix "one character class". The code says it is structural.** Measured
2026-09-09:

- `analyze/plan.ts:4655` — *"Props: every `Component Inputs` port is a **typed optional prop**,
  source order."*
- `emit/scaffold.ts:206` — the emitted `tsconfig.json` sets `strict: true`.
- `emit/scaffold.ts:160` — the emitted `build` script is `tsc -b && vite build`.

So **every** arithmetic use of **any** component input in **any** generated project is TS18048. #24
is one instance of a rule, and defaulting `k` fixes that instance. The task is the rule.

## 3. Scope

- Decide the prop contract: optional-with-a-typed-default, or required, or narrowed at the use site.
  It is a contract question — an input that genuinely may be absent and one that always arrives are
  different, and the graph knows which. Take one and write the reason.
- 🔴 **The gate: `tsc --noEmit` over the emitted app, in the exporter's own suite, over the corpus
  that already exists.** This, not the fix, is the deliverable — #24 was found by a stranger
  because nothing on our side ever compiled the exporter's output.
- Decide whether `vite build` joins the gate or stays out for cost. Say which, and what the chosen
  one cannot see.

## 4. Acceptance criteria

1. **(person)** Export a project containing an `Expression` doing arithmetic on a component input.
   `npm install && npm run build`. It builds. Open the built page: the arithmetic is right.
2. The gate compiles the emitted output of every corpus project and fails on a type error. It fails
   on the **reverted** arm — the defect restored, not the repair removed — and passes at HEAD.
3. A **presence control**: a deliberately broken emission is caught by the gate. Without it, a green
   gate might be compiling nothing (`Tests: 0 total` wears the same face as a pass).
4. The chosen prop contract is asserted at the type level, not by the absence of an error: a spec
   reads the emitted `Props` interface for an input the graph guarantees and for one it does not,
   and they differ.

## 5. Traps

- 🔴 **`tsc -p` emits in place.** The gate must use `--noEmit` — this repo has already lost 85 suites
  to that once.
- 🔴 **A gate that compiles the exporter's output must run in a directory with the emitted
  `tsconfig.json`**, not the repo's. Compiling the generated files under repo settings measures the
  wrong compiler and can be green while the user's build is red.
- ⚠️ AC2's "reverted arm" must still compile as a program. A reverted arm that does not build grades
  nothing — reconcile the file counts.
- ⚠️ Watch for the export producing a project whose `npm install` differs from CI's. Pin what the
  gate installs.
