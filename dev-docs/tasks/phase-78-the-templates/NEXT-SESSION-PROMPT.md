# Phase 78 — next session

## Where it stands

**TPL-001 (the members' area) is built and gated. It has never been run.**

| | |
|---|---|
| artefact | `templates/members-area/` — 19 components, 10 pages, `startPage: /Pages/Landing` |
| policy | `templates/members-area.security.json` → copied in as `nodegx.security.json` |
| graphs | `tpl001Components.ts` · `tpl001Cloud.ts` · `tpl001Vocabulary.ts` |
| gate | `tpl001Template.test.ts` — 41 specs |
| regenerate | `npm run template:members` |
| gates at commit | `typecheck:mcp` clean · noodl-mcp 834/834 · `test:ci` 2875 specs, **4 failures = the known AIX-006 floor by name** |

Read **TPL-001 §10 and §11** before touching any of it. §11's first finding is the one that
changes how you work: **the door does not check a connection to a component-instance port at all**
— no error, no warning, not even an info — and every gate in this template is an instance port.
The spec is the only thing that checks them.

## 🔴 Defects to fix — [DEFECTS-THE-TEMPLATES-FOUND.md](DEFECTS-THE-TEMPLATES-FOUND.md)

**Richard, 2026-08-28:** *"If you find a problem with the codebase or MCP or whatever, add it to
the next session prompt to fix. We're making templates to surface bugs and issues with the whole
NodeGX concept as well."* So building the template is only half the job — **what it turned up is
the other half, and it is a deliverable.**

Five rows so far, measured while building TPL-001. The two worth doing something about:

- **D1 — the MCP door accepts wires to ports that do not exist**, in three classes
  (component-instance ports, `CloudFunction2` `in-*`/`out-*`, `RouterNavigate` `pm-*`), all
  silently, all resolvable from components the door has already read off disk. Measured by
  sabotage: three runs, each diagnostically **identical** to the clean one. This is the class
  SB-018 (1) lived in for five sessions, and it is the one an agent authoring through the door
  cannot detect for itself. Cheap half if the full check is too big: **emit an info naming the
  wires it did not verify**, as it already does for parameters.
- **D2/D3 — the browser cannot read its own roles, and nothing can enumerate a role's members.**
  Together these mean every membership app needs a bespoke cloud function to decide whether to
  show a page, and the ordinary "member list" screen cannot be built at all. These are concept
  gaps rather than bugs, which is precisely what this exercise is for.

**D4 is an open question the drive answers** (does a refused query look different from an empty
one?) — do not skip it, it decides whether D2 is a convenience or a necessity. **D6 is a
disproved candidate**, kept so nobody re-derives it.

⚠️ **Add to that file as you go**, and keep its house rules: a row is a measurement, disproved
candidates stay marked, and each row says where it bites a person.

## Next, in order

1. **🔴 THE DRIVE. It is the whole of what is left, and nothing else should start before it.**
   Everything so far is a graph that has never executed. The editor seat is **free** (P77 finished
   SBR-004's drive and announced the checkout clear); announce your launch **and** your teardown.
   - Drive on a **copy**, on a wizard-fresh project. Opening a project writes three files into it
     and dirties every component.
   - The setup flow needs `ASSOCIATION_SETUP_TOKEN` provisioned in the backend's own
     `secrets.json` (or `NODEGX_SECRET_ASSOCIATION_SETUP_TOKEN`). Nothing works before that: no
     token, no moderator, no approvals.
   - **AC2 and AC3 are the ones that matter.** Signed out sees *nothing*; a **pending** member is
     refused exactly as a stranger is — each beside a **known-firing signed-in read**, or the
     absence measures nothing. Grade both with the policy actually enforcing: `devOpen: true`
     disables row-level ACL entirely, so a members-only app tested with it on looks like it works
     and is wide open.
   - Then AC4 (a member cannot post — UI *and* server) and AC5 (approve → they can read).
   - ⚠️ Expect the drive to find defects in the wiring the door could not check: `in-*`/`out-*`
     on the cloud functions, `prop-*` on the records, `qp-today`, and the eight instance ports.
     That is what it is for.

2. **Ask Richard two things** (both in TPL-001 §10, both cheap to answer, neither guessable):
   - **The member directory.** *"See the member list"* is in scope and is **not buildable** with
     the nodes that exist — nothing enumerates a role's members. It needs a `Member` projection
     row written on approval, which is a second copy of a fact `_Role` already holds.
   - **The privacy trade.** `requestAccess` answers an address that already has an account exactly
     as it answers a new one, so the app never reveals who belongs to the congregation — at the
     cost of a returning person getting a cheerful non-answer. One edge and one message to change.

3. **TPL-002** (email) only after TPL-001 stands on its own.

## Standing

- Delivery is **curated**: build a directory, Richard publishes. Touches no editor source.
- Shared checkout: commit **by pathspec**, untracked ⇒ add+commit in one chain. `test:ci` alone.
  Announce editor launches **and** teardowns.
- If you change a component set, run `npm run template:members` and commit the artefact — the
  gate compares every byte, including the policy.
