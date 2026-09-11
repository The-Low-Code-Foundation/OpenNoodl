# Phase 76 → the next phase — a handoff to Fable

**This is not a continuation of Phase 76's build. It is the scoping run for a NEW phase**, ruled by
Richard on 2026-08-28 after driving the template in the editor for the first time.

Phase 76 is closed in spirit. It was scoped to flush core backend bugs by building the hardest
template we ship, and it did that — eighteen tasks, real defects found continuously, honest specs
and mutants throughout. What it never produced is an application anyone would use.

> "I'm pretty amazed that we've spent 18 tasks creating an app that has a front end with basically
> one page and no actual usefulness." — Richard, 2026-08-28

He is right, and the diagnosis matters more than the complaint: **every one of the eighteen tasks
asked "does the graph do the correct thing?" and none asked "would a person get anywhere?"** The
template was an instrument for finding platform bugs and was never handed to an owner who wanted it
to be a product.

## Read these first, in this order

1. **The assessment artifact** — https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b
   ("Site Builder Rescue"). Seven measured findings and five proposed workstreams.
2. **The screens artifact** — https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810
   ("Site Builder Screens"). Six screens with their features, all styled from a theme record's
   tokens, switchable live at the top of the page. **The switcher is the proposal's argument**:
   change the record, change the site.
3. `README.md` §2 here — what the template was supposed to be, in the original words.
4. `TASKS.md` session log, entry **s19** — the last build session, and the state the code is in.

## The rulings already taken (do not re-litigate)

- 🧭 **This is a NEW PHASE**, not the tail of 76. Its acceptance criteria are about usability;
  76 keeps meaning what it meant.
- 🧭 **It ships with 0.2.1.** Richard's call, made against a recommendation to hold it back.
- 🔴 **DO NOT SCOPE BY TIME.** Explicit instruction, 2026-08-28: *"don't start talking about time,
  what you think takes 3 weeks takes 3 hours, don't do ANYTHING related to a time limit."* No
  estimates, no phasing by duration, no "quick win" framing. Scope by dependency only.
- 🧭 **UX/UI scoping comes before building** — and Richard extended this past this template:
  *"the MCPs should follow that rule too."* The authoring doctrine should require a token set and
  screens before components. That is part of this phase's scope, not a side note.

## The measured findings this phase exists to fix

All measured on 2026-08-28 against the shipped artefact and in a running editor. Counts are from
`site-builder.content.json`, not from task files.

| # | finding | measurement |
|---|---|---|
| 1 | **The project wizard never attaches a backend** | Confirmed by Richard: template → summary → straight into the project. Editor's own panel reads *"No backend attached · 11 others"*; port 8577 not running. Template ships `devOpen: false`, so it can do nothing. |
| 2 | **No backend ⇒ a white void, not an error** | Viewer `visibleText: 0`. The "not set up" screen needs a query that **answered**; with no backend nothing answers, `resolveSlug` returns early, and the not-found panel sits in the DOM **hidden**. F27 covers "no rows"; nothing covers "no backend". |
| 3 | 🔴 **The theme editor changes nothing** | `--primary`, `--background`, `--foreground` are written once each by `applyTheme` and consumed **0** times. The only tokens used anywhere are 7× `--font-bold`, 4× `--font-semibold`, 2× `--text-3xl`, 1× `--text-base`, 1× `--font-normal`. |
| 4 | **There is no visual design** | 78 visual nodes, **27** carry any style parameter. `rowGap` **3**, `maxWidth` **1** (an image), colour / border / radius **0**. Never scoped in any of the 18 task files. |
| 5 | **Five section kinds, one rendering** | `hero`, `gallery`, `richText`, `cta`, `contact` in the model; `SectionView` is 1 Image + 1 Text and a script whose only outputs are `showImage`, `showBody`, `weight`, `size`. |
| 6 | **Live preview promised twice, never built** | README §2 and the SB-005 row both name `Subscribe to Changes` / the SSE realtime hub. Occurrences in the template: **0**. No task ever recorded deferring it. |
| 7 | **The deployed admin panel cannot save a field** | SB-017 §11.4, already priced. 19 dropped wires, read live off the warnings chip and matching the census exactly. Works in preview, breaks on deploy. |

⚠️ **One correction to carry.** "It's basically one page" is half right in a way that matters: the
public site is **one component rendering any slug from a record**, which is the correct architecture
and stays. What is missing is that nothing has ever authored a page for it to render.

## Your job, step by step

The goal of the session is **new phase task docs**. Get there in this order; do not skip to writing
tasks.

### Step 1 — Read the two artifacts and challenge them

They are a proposal, not a ruling. Specifically worth pushing on:

- Is **B** (style every component from theme tokens) really one job rather than two? The claim is
  that styling the template and making the theme real are the same work. Test that claim.
- Are the six screens the right six? The Messages screen is **new** — the contact form has always
  stored records with an admin-only ACL that nothing reads back. Is that in scope or a separate app?
- Is the token set in the contract table wide enough, and is "no component may set a raw value" a
  rule a gate can actually enforce?

### Step 2 — Settle the token contract before anything else

Everything downstream depends on it. It is the artifact's first section. Produce the concrete list:
token name, what it carries, its default, and where the default comes from when a site has no
`Theme` row yet — that last one is load-bearing, because a fresh site has no row and must still
render.

⚠️ **`claimSite` mints `SiteSettings` and `Theme`.** So the theme record exists after a claim and
does not before. The unclaimed public site must therefore render from token **defaults**, and those
defaults have to live somewhere the deploy keeps.

### Step 3 — Decide the design direction with Richard

Ruled already: **opinionated but quiet** — it is a demo of NodeGX as much as a starting point, and a
bland one demonstrates nothing. The three presets in the screens artifact (Studio / Press / Night)
are a starting proposal, not a decision. Get the direction pinned before writing tasks, because it
changes what "style every component" means.

### Step 4 — Then write the task docs

One task per coherent piece of work, in dependency order. The five workstreams in the assessment
artifact are the proposed shape:

- **A — Make it start.** Wizard attaches a backend when a template declares it needs one; the
  zero-backend state says so on screen; the project opens on `Pages/Setup`, not the blank `App`
  shell. ⚠️ This is **launcher/wizard work, not template work** — a different part of the codebase,
  and it blocks evaluating everything else, including by us.
- **B — Make the theme real and let it carry the design.** Extend the token set; style all 19
  components from it; add a gate that fails on a raw colour.
- **C — Make the sections worth having.** Four kinds that render differently; a CTA you can click.
- **D — Make the admin panel survive deployment.** SB-017 §11.4, unchanged and still Richard's.
- **E — Live preview: build it or strike the promise.** It is currently in the README and a task
  summary and in neither the template nor any deferred note, which is the one state it must not be
  in.
- **F — The doctrine rule.** Richard's extension: the MCP authoring guidance should require a token
  set and screens before components. This is the finding that stops the next template arriving the
  same way.

Each task needs at least one acceptance criterion **written as a person's sentence** — *"a client
can change their site's colour and see the site change"* — alongside the graph-level ones. That
absence is the root cause of this whole situation and the fix belongs in the task template.

## State of the code, as of s19

Everything below is committed on `cline-dev` at `354b4525`.

- ✅ **SB-018 closed** — all three items fixed, and all three of that file's own dispositions were
  wrong. See SB-018 §7. 13 specs across four packages, 6 mutants.
- ✅ The two `For Each.Changed` wires are renamed to `itemOutputSignal-Changed`; the census in
  SB-017 §11 is now **19**, all `prop-`, one family. Confirmed live: the editor's chip read exactly
  19 with the project open.
- ✅ Every wired `Text` carries a standing value — confirmed in the running viewer, the `<h1>` is
  `""` and no longer the literal word `Text`.
- ✅ `submitContactForm` answers `{"received": true}` on the stored path.
- ⬜ **None of the three has been driven with a backend attached**, because the wizard never gave
  the project one. Behaviour end-to-end through the panel's own UI remains unverified.

## Gates and traps

- **Floor: `test:ci` — `2863 specs, 4 failures`**, all four `AIX-006 style vocabulary` **by name**.
  s19 read seed 88522, HEAD `b385049e`, 71 s. A build failure has **no summary line**, so the run is
  *not measured* rather than red.
- 🔴 **`typecheck:backend-tests` OOMs at 4 GB and 8 GB, and it is not ours.** Reverting s19's one
  file in that program to HEAD reproduces it; `git diff e78f35fb..HEAD` over the include set is
  otherwise empty. Richard's machine is 16 GB and swapping hard (Firefox 2.5 GB, VS Code 1.2 GB,
  Chrome 1.1 GB), which is the likeliest explanation. Not a Phase 76 defect.
- 🔴 **A poisoned jest transform cache reads as red specs with EMPTY failure messages.** s19 mutated
  `noodl-runtime/src/node.ts` for grading and restored it; the cache went on serving the broken
  module and four SB-017 cases failed with `failureMessages: ['']`. ✅ **HEAD's inputs failed
  identically** — that is the proof it was not the session's change. `npx jest --clearCache` fixes
  it. **Prefer artefact and test mutants over source mutants.**
- 🔴 **The launcher process exits and the watchdog reaps the stack with it.** Happened twice in s19
  — `npm run dev:debug` under `run_in_background` returned exit 0 with an empty log while the editor
  was still wanted. Check `npm run cdp -- health` before trusting that a stack is up.
- 🔴 **A frozen fixture answers a different question once its subject moves.**
  `sb017-deploy-connection-parity.test.ts` compares against a **recorded deploy**; a deliberate
  template removal makes its shortfall non-empty. It now asserts the shortfall **equals** a named
  `REMOVED_BY_SB018` list. An exemption, not a relaxation — see SB-017 §12.1.
- 🔴 **The artefact and the component sets are two populations.** Edit a component set and
  **regenerate** (`npm run template:site-builder`) or `sb007Template.test.ts` reddens.
  ⚠️ `site-builder.security.json` is **NOT** generated — hand-edited, deliberately.
  ⚠️ Adding a node moves `sb-007/site-template.test.ts`'s id count (now **194**) and the backend
  helper's connection total (now **101**).
- 🔴 **The door remaps node ids** — `save` ships as `save-3`. Assert template wires by node
  **label**, never by the id the component set used.
- 🔴 **`setDynamicPorts` REPLACES a node's dynamic port list.** Two writers on one node erase each
  other — why the cloud adapters are partitioned by node type, and why a fourth browser adapter is
  not available at all.
- 🔴 **A parameter is not a connection.** The export filters wires and copies parameters verbatim.
- Driving: **the modal renders twice** and `cdp click` hits an element's centre — stamp the copy not
  under a `[class*=Measuring]` ancestor and `elementFromPoint` before every click. **`const` leaks
  between `cdp eval` calls** — wrap every eval in an IIFE. The launcher project card's name is a
  `span`, not a `div`.
- Shared checkout: commit by pathspec (untracked ⇒ `add` + `commit` in **one chain**), never
  stage-then-commit; **announce before any editor launch AND teardown** to every peer; `test:ci`
  alone.

## The one thing not to lose

The reason this happened is not that anyone did bad work. It is that **"correct" and "usable" were
never the same acceptance criterion**, and only one of them was ever written down. If this phase
produces a beautiful template and does not fix that, it will happen again on the next one — which is
exactly why **F** is in the list and why Richard extended the rule to the MCP doctrine.
