# DEF-006 — The design system punishes the agent that uses it

**Rank 6.** Sources: phase 78 **D12**, **D15** and **D20**. All **NONE**-owned.

Cheap, and it removes a standing reason the next template arrives unstyled.

⚠️ **D20 was agreed into this task by both sessions on 2026-08-29 and then sat in a chat message
for a day without reaching the file.** It is recorded here because that is the exact failure the
whole phase-80 process exists to stop: an agreement is not an owner.

## 0. (c) The vocabulary has no composition for a field, a notice or an empty state — P78 D20

Measured 2026-08-29 over `StyleCompositions.ts`: **18 compositions ship**, and searching their ids
for `field`, `input`, `label`, `notice`, `alert` and `empty` returns **nothing** for all six.

```
band · bandSurface · shell · sectionHead · card · cardBody · primaryButton · outlineButton
cardImage · gridAutoFit · columnsTwoUp · displayHeadline · sectionHeading · cardTitle
eyebrow · lead · body · meta
```

Everything the system names is **page furniture**. Every app also has forms, validation messages
and empty lists, and for those an author has no recipe to follow — so they invent parameters, which
is the divergence (a) and (b) punish them for on the parts that *are* covered.

🔴 **This is the mechanism behind P78 D10** (the generators bypass the design system): a generator
cannot apply a composition that does not exist. D10 is the symptom seen from the generator; this is
the cause seen from the vocabulary. ⚠️ **Fixing this may make D10 fixable without fixing D10** —
re-measure D10 after, do not close it on this.

**Where it bites:** every agent authoring any app with a form, which is nearly all of them.

## 1. (a) `primaryButton` ships a parameter the runtime never reads

Applying `composition('primaryButton')` verbatim produced **12 `warning
inactive-conditional-parameter` diagnostics** on one generation run:

> *`net.noodl.controls.button`'s "borderWidth" only applies when borderStyle is solid or dashed or
> dotted, so this parameter is never read.*

The composition sets `borderStyle: 'none'` **and** `borderWidth: 0`. Both are its own.

🔴 **`get_style_vocabulary` presents compositions as *"ready-made parameter sets… each naming the
recipe that shows it assembled"*.** An agent that follows the design system exactly as instructed is
rewarded with a warning per button, and its only options are to **ignore a real diagnostic** or to
**diverge from the system**. Both are bad lessons, and the first one is how a real diagnostic stops
being read.

✅ Repaired *at the point of use* in `tpl001Components.ts` (`withoutInertBorderWidth`) — **one
template, no users.**

## 2. (b) `find_tools` searches tool NAMES only

**Confirmed at HEAD**, `packages/noodl-mcp/src/tools/disclosure.ts:395-398`:

```ts
const needle = args.query.toLowerCase().trim();
const matches = TOOL_GROUPS.flatMap((g) => g.tools).filter(
  (name) => needle.length > 0 && name.toLowerCase().includes(needle)
);
```

Group titles and purposes are never searched. So the group whose title is **"Design tokens"** and
whose purpose is *"change the design system"* holds `set_project_tokens` and `set_style_preset` — and
`query: "theme"`, `"design"`, `"colour"`, `"style guide"`, `"palette"` all reveal **nothing**, while
`group: "theme"` reveals both.

🔴 **This is a contributing cause of phase 78's D10** — *"the template generators bypass the design
system"*. The style write tools are deferred behind disclosure; an agent told to style on-system
searches for the words it is thinking in and is told there is nothing there.

## 3. Scope

1. Remove `borderWidth` from the `primaryButton` composition (and audit the other compositions for
   the same shape — a parameter inert under the composition's own other parameters).
2. Match `find_tools`'s `query` against **group titles and group purposes** as well as tool names.

## 4. Acceptance criteria

1. **A person's sentence:** *when I ask the thing I am building for the tools that change how my app
   looks, using the words I would actually use, it shows me them.*
2. Applying every shipped composition verbatim to its documented element type produces **zero**
   `inactive-conditional-parameter` diagnostics. 🔴 Over **all** compositions — the audit is the
   task; `primaryButton` is the instance.
3. `query: "theme"`, `"design"`, `"colour"`, `"palette"`, `"style"` each reveal
   `set_project_tokens` and `set_style_preset`.
4. A **negative arm**: a query matching nothing still reveals nothing. Widening a search until it
   matches everything is not a fix.
5. `tpl001Components.ts`'s `withoutInertBorderWidth` workaround **lapses** — it was written as a rule
   so it would. Assert it is a no-op afterwards rather than deleting it silently.

## 5. Traps

- 🔴 **MCP has three budgets and the tool surface has a token gate.** Matching more text does not
  change the surface, but adding fields to the response might — measure `toolDisclosure` before and
  after.
- ⚠️ **A stale `dist/` hides a merged change** and can refuse correct work. Run the tool's functions
  **from `src`** when measuring.
- 🔴 **A checker's population is part of the checker.** "Zero warnings" over the compositions this
  template happens to use is not "zero warnings over the compositions we ship".
