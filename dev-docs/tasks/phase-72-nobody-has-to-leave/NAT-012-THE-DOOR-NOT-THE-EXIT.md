# NAT-012 — The door, not the exit

| Field | Value |
|---|---|
| **Tier** | 4 |
| **Effort** | M |
| **Surface** | `editor`, `core-ui` |
| **Rulings** | 🔴 **D6 OPEN** (what stays browser-only) · inherits **D15**, **D21** |
| **Depends on** | **NAT-007** through **NAT-011** — this is the task that makes them one place |

## The job

By the time Tier 3 lands there are six community surfaces in the editor and no story about how you
move between them. Today's navigation is one tab, one rail icon, and `platform.openExternal`
everywhere else.

Decide and build the shape: **the launcher tab is the community's home** — where you browse people,
jobs, coaching, University and the full discussion list — and **the rail panel is the door from
inside a project**, showing what is relevant to what you are doing and opening the same views.

Richard's framing, which is the acceptance bar: *"whatever you do in the editor can be viewed and
solved in the editor, even if it means leaving your project to go look at the launcher main
community page."* Leaving your **project** for the launcher is fine. Leaving the **editor** is not.

## Acceptance criteria

1. One navigation model across both surfaces, with a real back/forward relationship. Opening a
   profile from a thread and returning to the thread works.
2. **`openExternal` survives on exactly one kind of affordance**: an explicitly labelled "opens in
   your browser" control, for the D6 long tail and for things the editor genuinely should not host
   (a video call, a payment). 🔴 An audit lists every remaining call site and the reason it is
   still there. A call site nobody can justify is deleted.
3. Going from the rail panel to the launcher home **does not lose your project or your place**.
4. `AskAboutNodeDialog` no longer ends at a browser: asking opens the thread in the editor.
5. **D6 is answered and visible.** Orgs, assignments and shelf items either have editor surfaces or
   have honest hand-offs — never a dead end and never a silent jump to Chrome.
6. D15 holds across the whole navigation graph: there is **no path** by which a refused viewer
   reaches a drawn community surface. This is a reachability claim over routes, so it is derived
   from the code and **driven**, not asserted from a component test.

## Traps

- 🔴 **A route is outside every sweep.** P67 learned this the expensive way: ruling that a place
  behaves does not check that it does, and a route-shaped surface is invisible to component specs.
  Derive the surface list **from disk** and drive it.
- 🔴 **The rail icon is drawn for a viewer D15 refused** — `SidebarModel.register` is synchronous at
  setup with no async predicate. That is a **known open remainder owned by phase 67b**. This task
  must not fix it in passing (it belongs to 67b's ledger) and must not build navigation that
  assumes it is already fixed. An icon is a door.
- ⚠️ **The tab ships even when empty** (D21 reversed D16). Navigation must not reintroduce a
  gate — no "unlock the community when…", no hidden nav entries pending a threshold.
- ⚠️ **Conditional UI in this editor goes through `mounted`, not `visible`** — a navigation model
  that hides panels by CSS keeps them alive, and a `BaseDialog` renders twice. Any spec counting
  what is on screen has to know both.
