# Phase 33 — Alpha Launch (Track R)

**Created:** 2026-07-30, from a readiness review against the phase register.

Every other phase asks "is this feature good?". This one asks a narrower and more
awkward question: **if a stranger downloaded NodeGX tomorrow, what would happen?**

The answer today is that they could not, on a Mac. And if they could, and it broke,
we would never find out.

## Why this is a phase and not a checklist

The register is in good shape. Phases 13, 16, 19, 22, 23, 25 and 28 are complete;
30 is in flight and is the highest-leverage work in the plan. What is missing is not
features — it is the thin layer between "the software works on our machine" and
"a person who has never met us can use it and tell us when it doesn't."

That layer has five parts, and **none of them were owned by any phase** before this
one existed. Three are not engineering at all, which is precisely why they had not
been scheduled: nobody's task list contains "get the certificates".

## The tasks

| ID | Title | Tier | Why it is here |
|---|---|---|---|
| [ALPHA-001](./ALPHA-001-FIRST-HOUR.md) | The cold-install first hour | 1 | A large amount of shipped work has never been seen by a human, and it clusters on the first ten minutes of use |
| [ALPHA-002](./ALPHA-002-RELEASE-CUT.md) | A release that reaches a Mac | 1 | The v0.1.0 draft has Windows and Linux artifacts and **no macOS artifacts at all** |
| [ALPHA-003](./ALPHA-003-CRASH-AND-FEEDBACK.md) | Find out when it breaks | 2 | No crash reporting, no log file, no in-app feedback path |
| [ALPHA-004](./ALPHA-004-USER-DOCS.md) | Documentation for someone who is not us | 2 | Everything in `docs/` is developer reference. There is no "what is a node" |
| [ALPHA-005](./ALPHA-005-LEGAL-SURFACE.md) | The paperwork that ships with a binary | 2 | We distribute an app that sends project content to third-party AI providers |
| [ALPHA-006](./ALPHA-006-DOCS-PLATFORM.md) | The docs platform, and the old site's disposition | 2 | Split from ALPHA-004 on 2026-07-31. **54 of 156 nodes have no working documentation page**, and the docs origin turns out to be the editor's content CDN for seven payload types — six of which are not documentation |
| [ALPHA-007](./ALPHA-007-FEEDBACK-LOOP.md) | A feedback loop that closes | 2 | Split from ALPHA-003 on 2026-08-02. In-app report composer → pre-filled GitHub issue, and the contributor-side triage loop that consumes it. **Transmits nothing, so it is the only Tier 2 task with no prerequisites** |

ALPHA-006 was not part of the original five. It exists because ALPHA-004 assumed a
site to write into, and the site is a 413 MB fork of Noodl's that three editor panels
silently depend on.

ALPHA-007 was not either. It exists because ALPHA-003's "report a problem" half turned
out to be separable from its "find out when it breaks" half — the report path can be
built so that nothing leaves the machine except through the user's own browser, which
removes the privacy-policy gate and makes it the one Tier 2 task that can start today.

**Tier 1 gates the alpha. Tier 2 makes the alpha worth running.** You could ship
without Tier 2 — you would simply learn nothing from having shipped, which defeats
the point of an alpha.

## What this phase deliberately excludes

- **Feature work of any kind.** If it makes NodeGX better rather than shippable or
  observable, it belongs to its own phase.
- **Phases 18, 20, 26, 31, 32** — code export, ecosystem, deployment, readiness
  operations and reality check are all post-alpha by decision (2026-07-30).
- **Phase 17 (Learn).** LEARN-002 waits on a human learning designer, and the
  education wedge is a G3 question.

## The standing decision this phase inherits

Per [`COMPATIBILITY-POLICY.md`](../../reference/COMPATIBILITY-POLICY.md), NodeGX is a
fresh start and legacy Noodl projects are not a design constraint. ALPHA-001 tests a
**new** project's first hour, not an imported one. LIB-006 owns the honest-import
promise separately, and this phase does not wait for it.

## Exit criterion

A person who has never seen NodeGX can, on any of the three platforms:

1. download a build that their OS lets them run,
2. reach a working app of their own without asking us anything,
3. and, when something breaks, tell us in a way we can act on —

with each of those three demonstrated by someone who is not Richard and did not
build it.
