# NAT-011 — The University beside your project

| Field | Value |
|---|---|
| **Tier** | 3 |
| **Effort** | M/L |
| **Surface** | `editor`, `core-ui`, `platform` |
| **Rulings** | ✅ D4 · ⚠️ touches **phase 67b UNI-007** and **phase 68** |
| **Depends on** | **NAT-005**, **NAT-006** |

## The job

`/university`, `/tutorials` and `/tutorials/[slug]` are the learning wing. The editor sees article
*titles* (through `/v1/community/home`) and hands you to a browser for the body.

Learning is the surface where leaving the editor costs the most, because the whole point of a
tutorial is to do the thing **while reading it**. Alt-tabbing between Chrome and a node graph is
the experience this phase exists to delete.

Bring the syllabus and the tutorial body into the editor, readable **beside** the canvas.

## Acceptance criteria

1. The University syllabus is browsable in the editor: what the wing contains, in its order.
2. A tutorial renders in full in the editor — body, code, images, graph fragments — through the
   same `Block[]` path as posts. 🔴 No raw HTML, for the same reason.
3. It is readable **while working**: the rail panel hosts a tutorial next to the canvas, and the
   canvas stays usable. A tutorial that only opens in the launcher is a tutorial you read before
   you start and forget by the time you need it.
4. Progress — if the platform tracks it — is visible and updates from the editor. If it does not,
   this file says so plainly rather than leaving a reader to assume.
5. D15 is at its most consequential here: this is the wing an **org-minor's school switches off**.
   Nothing drawn. Permitted control beside it in the spec.
6. Offline: an opened tutorial stays readable. Learning material is the strongest case in the phase
   for local caching, and the strongest argument for a tool that promises local development.
7. **Filed by FB-004 (2026-08-22), on Richard's word — read it before starting.** *"I'm also
   confused about the difference between 'your path' which only exists in the launcher, and
   'university' which only exists in the community web page. I feel like they're gunning for the
   same thing, can they be reconciled and made universally accessible?"* He is right that they
   look like one thing, and they are two views of one curriculum: **Your path** is the
   personalised projection (intake → `pathFor`), **University** is the full syllabus (D17: a view,
   never the install route). So they must present as **one surface — the syllabus with *your* path
   marked on it** — not as two sibling lists in two different apps. The path must also be visible
   on the web, not only in the launcher; the platform already serves it (`GET /v1/me/path`).
   ⚠️ FB-004 has already split the launcher's Learning tab into `Installed lessons` / `Your path`
   (`views/learningTabs.ts`), which is the shape this AC has to stay consistent with.

## Traps

- 🔴 **Three phases own adjacent ground and this task must not fork any of them.**
  **UNI-007's intake half** (the lesson beamed into the editor) is **phase 67b**;
  **UNI-006's assign/grade bridge** is **phase 67b**; **phase 68 (Learnbook)** owns learning
  content in the editor from another direction. Read all three before writing a line. If this task
  finds itself building a lesson *runner*, it has walked into 67b or 68 and should stop.
- 🔴 **But this task builds the client those two will need, so build it to be built on.** 67b's own
  ordering says UNI-006 and UNI-007 must be one tranche *because they share a client and a
  transport* — and this task gets there first. The community API client, auth handling and error
  states belong in a module the assignment bridge can import, not inside a University panel. A
  second community client in this editor is the drift failure UNI-011 already paid for once.
  ⚠️ This is a *shape* obligation, not a licence to build 67b's features here.
- 🔴 **A finding here may already be another task's acceptance criterion.** Grep the phase-67b and
  phase-68 task files for the *behaviour* — not the task number — before claiming anything is new.
- ⚠️ **Tutorial bodies are the longest user-authored content in the phase** and the most likely to
  contain something the `Block[]` renderer has no case for. Skip visibly; never fall through to raw.
- ⚠️ A tutorial rendered beside the canvas competes for width with the panel that is already there.
  This is a layout decision in an editor with a known history of `overflow: hidden` clipping
  hit-testing — drive it, do not reason about it.
