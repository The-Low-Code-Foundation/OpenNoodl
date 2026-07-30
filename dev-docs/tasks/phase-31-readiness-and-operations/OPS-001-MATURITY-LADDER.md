# OPS-001: The Maturity Ladder & the Readiness Panel

## Metadata

| Field | Value |
|-------|-------|
| **ID** | OPS-001 |
| **Phase** | Phase 31 — Readiness & Operations (Track P) |
| **Tier** | 1 — the frame |
| **Priority** | 🔴 Critical — every other task in both new phases hangs off this |
| **Difficulty** | 🟡 Medium — the code is small; the taxonomy is the work |
| **Estimated Time** | 1–1.5 wks |
| **Prerequisites** | none |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** — this task *defines* a vocabulary that eight sibling tasks and a whole second phase register against. Getting the rung boundaries wrong is expensive to reverse |

## Objective

A project declares what it is for, and NodeGX shows the whole ladder of what that implies — including
the rungs above, unchecked, with the level each item belongs to. Nothing above the declared level is
enforced, nagged about, or even rendered as a warning.

## Background

The [observability chapter](../../../../ai-coding-docs/docs/part-5/observability.md) makes an argument
that generalises well past observability:

> "The plan and the current maturity level are *declared*. […] The Phase column on the checklist is
> the 'indicator of when' — human or AI can see at a glance what is deliberately deferred versus
> actually missing."

That distinction — **deferred vs. missing** — is the whole feature. A checklist with eleven red
crosses is demoralising and gets ignored. The same checklist with a Level column, where seven of the
crosses are labelled *Scale* and the project has declared *Sharing*, is a map.

NodeGX has an unusually wide audience for one tool: a LEARN-001 lesson, a hobbyist, and someone with
real users are all in scope, and the roadmap's G3 gate does not resolve which one wins. A declared
level is how one product serves all three without the third one's concerns leaking into the first
one's first hour.

## Current State

| Piece | State |
|---|---|
| Project settings | `views/panels/SettingsPanel/` — PNL-008 consolidated three settings panels into one |
| Project metadata | `metadata.*` in `project.json`; `ProjectModel.setSetting` (RUN-002 fixed it throwing) |
| Panel registration | `router.setup.ts` — the phase-25 rail; `experimental: true` hides a panel (WFA-002) |
| A readiness concept | none. Nothing in the product knows the difference between a lesson and a live app |

## Desired State

### 1. The level is a project setting

Four values, stored in project metadata, defaulting to **Playing** for a new project and for anything
opened from LEARN.

```
playing | sharing | live | scale
```

Chosen once in a first-class place (project settings, and offered in the deploy popup the first time
someone deploys). Changeable at any time in either direction, with no ceremony for going *down* — a
project that was live and is now a sketch again is a normal thing.

**The level is declared, never inferred.** The panel may make exactly one suggestion — if a project
has a deploy target with a public URL and is still at Playing, offer Sharing once, dismissible
permanently. Anything more than that is the product telling the user what their project is.

### 2. A registry other tasks register into

The checklist is not a hardcoded list in a React component. It is a registry that OPS-002…009 and
Phase 32's RCK-008 add entries to, so the panel is composed rather than edited:

```ts
interface ReadinessItem {
  id: string;                       // 'ops.build-identity'
  level: 'sharing' | 'live' | 'scale';
  title: string;                    // 'You can prove what is deployed'
  why: string;                      // one sentence, plain language, no jargon
  irreversible?: boolean;           // see §4
  check(project): Promise<ReadinessState>;
}

type ReadinessState =
  | { kind: 'met'; evidence: string }         // a fact, not a tick
  | { kind: 'unmet'; because: string }
  | { kind: 'not-applicable'; because: string }  // 'this app has no backend'
  | { kind: 'unknown'; because: string };        // never silently a cross
```

Three rules the registry must enforce and the panel must honour:

- **`met` carries evidence, not a boolean.** "Verified 2026-07-30, digest `a3f9…`" beats a green tick,
  and it is what makes the panel useful during a phase audit.
- **`unknown` is rendered as unknown**, distinct from `unmet`. The guide's whole deploy-verification
  argument is that "no signal" reads as "success" and that is how people ship old code. A check that
  could not run says so.
- **`not-applicable` is a first-class result.** A frontend-only app has no backup story and must not
  carry a permanent cross for it.

### 3. The panel shows the whole ladder

A readiness panel on the phase-25 rail, hidden entirely at Playing. It renders every registered item
grouped by level, with the declared level marked, items above it visibly deferred rather than failed,
and a one-line *why* on each. The deferred styling matters: those rows are informational, not amber,
not red.

At the top, one sentence stating what the project is currently ready for. Not a score, not a
percentage — a sentence: *"Ready to share with people you know. Not ready for strangers: 3 Live items
outstanding."*

### 4. Irreversible items are called out at every level

The guide's central asymmetry — *setting up the plumbing is cheap and reversible; not having it is
irreversible* — needs a visual channel, because it is the one argument that justifies doing something
at Playing that only pays off at Live.

Items flagged `irreversible` show a distinct marker and a distinct sentence: *"Cheap now, impossible
later — every error from before you switch this on stays unreadable."* Exactly two items should carry
the flag in this phase (OPS-005's source maps and release tagging), and adding a third should require
an argument.

### 5. `readiness` in the deploy popup

Deploying is the moment the level becomes real. The deploy popup shows the readiness summary for the
target level and, above Sharing, requires an explicit acknowledgement of any unmet item — which is
recorded on the artifact (OPS-002) and displayed in the Ops panel afterwards (OPS-004).

Acknowledgement, not approval. One click, no essay, and it never blocks. OPS-006's critical security
findings are the sole exception in this phase and that task owns the exception.

### 6. The AI can read it

One MCP tool on `packages/noodl-mcp/src/tools/` — `project_readiness` — returning the same structure.
An agent asked to "get this ready for real users" should be able to see the list rather than guess it.

## Implementation Steps

1. **Write the taxonomy first, in prose, in this folder** — the four levels, and for each candidate
   item: which level, why that level, and what evidence `met` produces. Circulate before writing code;
   the eight sibling tasks are downstream of these names.
2. Project setting + default + LEARN default, with migration for existing projects (they get `playing`,
   not a guess).
3. The registry, the `ReadinessState` union, and a test that a registry with zero items renders a
   coherent empty panel.
4. The panel, hidden at Playing, with the deferred/unmet/unknown/n-a treatments visually distinct.
5. The one-time Sharing suggestion, permanently dismissible.
6. Deploy popup summary + acknowledgement record.
7. `project_readiness` MCP tool.
8. **Live pass**: a Playing project shows nothing anywhere; the same project at Scale shows a full
   ladder of mostly-unmet items without anything reading as broken. Screenshot both, both themes.

## Success Criteria

- [ ] A new project and a LEARN lesson are `playing`, and no readiness UI exists anywhere in either.
- [ ] The four levels are settable and reversible; going down is as easy as going up.
- [ ] The panel renders items above the declared level as *deferred*, visually distinct from *unmet*.
- [ ] `unknown` never renders as a cross, and its `because` is shown.
- [ ] `not-applicable` items disappear from the count rather than sitting as permanent failures.
- [ ] A `met` item shows evidence, not a tick.
- [ ] The irreversible marker exists and carries its own sentence.
- [ ] Deploying above Sharing with unmet items records an acknowledgement that is visible afterwards.
- [ ] `project_readiness` returns the same data the panel renders.
- [ ] Screenshots: Playing (nothing), Sharing (short list), Scale (full ladder), both themes.

## Out of Scope

- **Any actual check.** This task ships the frame and, at most, one trivial reference item to prove
  the registry works. OPS-002…009 and RCK-008 supply the real ones.
- **Auto-detecting the level.** One suggestion, dismissible. That is the ceiling.
- **Scoring or gamification.** No percentages, no badges, no streaks. The Reality Check gate in Phase
  32 is a gate; this is a map.

## Traps

- **The taxonomy is the deliverable and the code is not.** A registry is two hours. Deciding that
  "verified backup restore" is Live and not Scale is the part that will still matter in a year, and it
  is the part that is expensive to move once eight tasks have registered against it.
- **Do not let `unknown` collapse into `unmet`.** It will want to — every naive `check()` returns a
  boolean. The guide's nine failure modes are all instances of "no signal read as success," and this
  union is the one place to refuse that.
- **Playing must be genuinely empty, not styled-empty.** No greyed-out panel, no "unlock" affordance,
  no rail slot. A nine-year-old must not be able to find this.
- **`ProjectModel.setSetting` used to throw** (RUN-002). Confirm the fix is in the path you use before
  assuming settings persistence works.
- **Levels must survive export and re-import.** A project that round-trips through DEP-008's artifact
  and comes back at `playing` has silently discarded an acknowledgement record.
- **The deploy popup currently has one tab** (`views/DeployPopup/DeployPopup.tsx:26`) and Phase 26
  restructures it. Coordinate the insertion point with DEP-002 rather than building a summary into a
  layout that is about to change.
</content>
