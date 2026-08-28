# Phase 78 — next session

## Where it stands

**TPL-001 (the members' area) is built, gated and DRIVEN.** It runs. AC2, AC3, AC4 and AC5 are
measured against a real enforcing backend in a real browser.

| | |
|---|---|
| artefact | `templates/members-area/` — 19 components, 10 pages, `startPage: /Pages/Landing` |
| policy | `templates/members-area.security.json` → copied in as `nodegx.security.json` |
| graphs | `tpl001Components.ts` · `tpl001Cloud.ts` · `tpl001Vocabulary.ts` |
| byte gate | `tpl001Template.test.ts` — 41 specs · regenerate with `npm run template:members` |
| **the drive** | `packages/nodegx-backend/tests/tpl001-members-drive.test.ts` — **39 specs** |
| **D4's arm** | `packages/nodegx-backend/tests/tpl001-refused-query.test.ts` — **6 specs** |
| **the harness** | `packages/nodegx-backend/tests/helpers/members-drive.ts` |
| gates at commit | nodegx-backend **1280 passed / 10 skipped, 111 suites** · `typecheck` clean · noodl-mcp **834/834** · `typecheck:mcp` clean |

Read **TPL-001 §12 and §13** first — what the drive measured, and the four ways the instrument
itself lied before it was fixed.

⚠️ `test:ci` was **not** run: no editor source was touched, and a peer held the editor seat for
SBR-004 all session. If you touch editor source, that changes.

## 🔴 What the drive settled, and what it changed elsewhere

- **D4 is answered and the answer is the opposite of the one on file.** `DbCollection2.failure`
  **does** fire on a 403 — measured with a two-wire twin and a control arm. So a refused query is
  *not* an empty one, and **D2 drops from high to medium**: an app can branch on the refusal of
  the query it was going to run. ⚠️ It does not loosen TPL-001's design — branching that way means
  issuing the members-only query for every stranger and flickering through "nothing here" on the
  way to "you may not", where `myStanding` stops it being issued at all.
- **Every wire class D1 names was exercised and none was wrong**: the eight component-instance
  ports, `in-*`/`out-*` on all four `CloudFunction2` nodes, `prop-*` on both records nodes,
  `qp-today`. That is evidence about **this template**, not about the door — **D1 stands**, and it
  still costs a whole drive per template to say that much.

## Next, in order

1. **🔴 Ask Richard the three things.** All cheap, none guessable, and the first two have been
   waiting a session (TPL-001 §10):
   - **The member directory.** *"See the member list"* is in scope and is **not buildable** —
     nothing enumerates a role's members (D3). It needs a `Member` projection row written on
     approval, a second copy of a fact `_Role` already holds. Build it, or cut it from scope?
   - **The privacy trade.** `requestAccess` answers an address that already has an account exactly
     as it answers a new one, so the app never reveals who belongs to the congregation — at the
     cost of a returning person getting a cheerful non-answer. One edge and one message to change.
   - **🆕 Publish it?** The template is done to the limit of what can be done without him.
     **AC1 cannot be graded until it is on the shelf** — curated delivery means there is no picker
     row to pick — so **T5 is now the blocker on finishing TPL-001**, not more building.

2. **AC6, the one criterion with no reading against it.** The drive seeds content before the first
   visit, so the designed empty states — `NO_ANNOUNCEMENTS_TEXT`, `NO_MEETINGS_TEXT`,
   `NO_REQUESTS_TEXT` — have never been seen. Cheap: one more `withRenderedPage` on a backend with
   no rows, asserting each empty state paints and no list draws. It is the **first impression** a
   person gets on a fresh install, and it is the only part of the template nothing has looked at.

3. **TPL-002** (email) once TPL-001 is published, or T4/T3 if it is not.

## 🔴 Read this before you drive anything

Four instrument failures from §13, all of which passed as findings first:

- **An absence read off `innerText` is not a measurement.** `innerText` skips `display: none`;
  `textContent` does not. Use the harness's **`present` / `painted` / `reachable`** split — an
  absence claim belongs on `painted`.
- **…and `reachable` alone makes an absence satisfiable by scrolling.** `elementFromPoint` answers
  `null` outside the viewport, so a button below the fold reads exactly like one behind a modal.
  Both click helpers now scroll first and only then say "blocked".
- **Never build an instrument out of a seam you know is broken.** The first D4 twin wired a
  `failure` **signal** into a `visible` **value** port and read *exactly inverted*. Signal to
  signal, always.
- **mtime is not evidence about an artefact's contents.** The viewer bundle was rebuilt because it
  predated three commits; it already contained all of them (the changes were in the tree before
  they were committed, and one of the three touched no runtime source at all). **Grep the artefact
  for a marker.** The drive now stamps the bundle at both ends of a run and reddens if it moved —
  a peer's dev stack rewrites that file.

## Standing

- Delivery is **curated**: build a directory, Richard publishes. Touches no editor source.
- The drive needs **no editor seat** — it is `BackendService` + headless Chrome via
  `withRenderedPage`. It does read `packages/noodl-editor/src/external/viewer/noodl.viewer.js`,
  which a peer's dev stack rewrites; that is what the bundle stamp is for.
- Shared checkout: commit **by pathspec**, untracked ⇒ add+commit in one chain. `test:ci` alone.
  Announce editor launches **and** teardowns.
- If you change a component set, run `npm run template:members` and commit the artefact — the byte
  gate compares every byte, including the policy.
- ⚠️ **Keep adding to [DEFECTS-THE-TEMPLATES-FOUND.md](DEFECTS-THE-TEMPLATES-FOUND.md)** and keep
  its house rules: a row is a measurement, disproved candidates stay marked (D6, D8), and each row
  says where it bites a person.
