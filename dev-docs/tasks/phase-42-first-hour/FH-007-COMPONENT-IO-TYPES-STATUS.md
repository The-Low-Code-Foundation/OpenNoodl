# FH-007 — Type selection on Component Inputs/Outputs: status, and the decision that's waiting

Covers reported item **6**. Mostly an answer; the buildable part is gated on a decision.

## What was reported

> I had understood that we added type selection for the 'Component Inputs' and Outputs nodes? I
> don't see them.

## Status — never built, and ERG-005 explicitly forbade building it yet

What ERG-005 (`phase-35-authoring-ergonomics/ERG-005-COMPONENT-INTERFACE.md`) actually is:

- **§0** — measurement only, done 2026-08-02.
- **§1** — carry the *derived* type + a description channel out to disk/catalog/AI loop.
- **§2** — the question "should a Component Input carry an **explicit** type instead of inferring
  one?" — written up as **a decision for Richard**, gated on §1, with the task's own success
  criterion: *"No typing behaviour changes in this task."*

So the remembered feature is §2, which is a recommendation awaiting a yes — not a landed build.

How it works today, confirmed in source: types on Component Inputs/Outputs are derived statelessly
on every read from their connections (`componentmodel.ts:91-205`; one connection → that type;
several → `findCompatiblePortType` walking the typecast table in order; none → `'*'`). Nothing is
serialised (`toJSON` emits no `ports` key). The Port Editor panel hard-codes `type: {name:'*'}` for
every port it creates (`componentinputs.ts:24-37`, `componentports.tsx:285-297`) and has **no type
control anywhere** — add is a name popup, edit is rename/delete/group. No feature flag involved.

## ⚠️ Concurrent-session warning

This checkout contains **untracked ERG-005 §1 tests written against an API that does not exist
here**: `packages/noodl-editor/tests-unit/erg-005/` expects `componentPorts()` to return typed port
objects, a `formatComponentPort` export (zero hits in src), and a validator that reads component
`ports`. None of the implementation files are modified in this checkout — §1 is mid-flight,
almost certainly in another session. **Do not start §1 or §2 work from this session without
checking whether that session is live.** Never `git add -A`; the erg-005 test files are not ours to
commit.

## What to do

1. **Richard answers ERG-005 §2** (this is the talk-shaped nub — one question, so it lives here
   rather than a TALK doc): add explicit type selection with inference as the default, or stay
   inference-only? The §2 write-up's own recommendation is *add the explicit option, keep inference
   as the default*. Relevant new fact since §2 was written: an alpha user (you) expected the
   feature to exist — which is evidence for the explicit option.
2. If yes: the build is a type dropdown in the Port Editor rows
   (`componentports.tsx`/`ComponentPortsView.tsx`), a stored type that wins over `_deriveType` when
   present, serialisation of chosen types, and validator awareness — **sequenced after the other
   session's §1 lands**, since §1 changes the same seams.

## Criteria (for the eventual build, if §2 is a yes)

1. Adding a port offers a type (default: inferred/`*`).
2. A chosen type survives save/reload and appears in the catalog and MCP `get_component`.
3. Connecting an incompatible source to an explicitly-typed input raises a validator warning.
4. Inference-only projects behave exactly as today.
