# Phase 41 — Accessibility (Track A)

**Created:** 2026-08-05
**Doctrine:** [NORTH-STAR.md](NORTH-STAR.md) — read it first. It carries the position, the audit
evidence, the disability taxonomy, the standards map and the definition of done. This file is the
ladder.

**Origin:** not the roadmap. Richard completed **Opquast** web quality certification and came back
with an observation that turned out to be a codebase fact:

> *"There are a whole list of basic accessibility options in HTML and front end design that exist
> but are rarely used."*

And the two questions the phase exists to answer:

> *"How could we make **A.** Noodl accessible for disabled users, and **B.** the apps Noodl makes
> contain easy to complete accessibility options that encourage builders to make their apps
> accessible by default?"*

Those two questions are, exactly, **ATAG 2.0 Part A and Part B**. The phase is organised on that
split. Part B goes first — it is cheaper, it multiplies across every app anyone builds, and it
improves projects that already exist without any migration.

## What this phase is

The opening audit (2026-08-05, all citations verified against source) found that the runtime which
generates every NodeGX app contains **exactly one accessibility attribute** — an `aria-hidden` on
the icon SVG — and that **every default control ships with its focus ring deleted**, under a
comment promising a replacement that was never written.

It also found that four of the six hardest primitives **already have their port**: Image has
Alternate text, Text and Group have semantic Tag enums, and every labelled control wires
`<label htmlFor>` correctly. The concepts landed. The defaults did not, and nothing checks.

So this is not a phase about inventing an accessibility surface. It is a phase about **changing
defaults, adding one missing element, and putting a check behind both** — with a much larger and
more honest piece of work at the end for the editor's own canvas.

## The findings, and what each one actually is

Mechanisms read in source at phase open. Where something is a hypothesis, the row says so.

| # | Finding | Mechanism | Task |
|---|---|---|---|
| 1 | Nothing in a generated app has a visible focus indicator | `assets/style.css` sets `outline: none` on Button `:20`, Checkbox `:41`, RadioButton `:60`, Select `:122`, Range `:135`/`:175`. Line 121 reads *"Remove focus outline, will add on alternate element"* — **the replacement was never written**. Zero `:focus-visible` rules in the file. WCAG 2.4.7, Opquast 165, in every app ever built with the tool. | [ACC-001](ACC-001-THE-FOCUS-RING-EXISTS.md) |
| 2 | The tool cannot emit a link | `<a>` is present-and-**commented-out** in the Text tag enum (`nodes/visual/text.ts:65`). External Link calls `window.open()` (`std-library/externallink.ts:63`). `rg '<a '` over the runtime returns nothing. Every link is a div with a pointer handler: no tab order, no link role, no middle-click, no `href`. | [ACC-002](ACC-002-A-LINK-IS-AN-ANCHOR.md) |
| 3 | A clickable Group is unreachable by keyboard | `components/visual/Group/Group.tsx:332` renders `<Component {...props.dom} {...PointerListeners(props)}>` — no `tabIndex`, no `role`, no key handling on the path. This is the most-used interaction pattern in the tool. | [ACC-003](ACC-003-A-CLICKABLE-GROUP-IS-OPERABLE.md) |
| 4 | A route change is silent to assistive tech | `nodes/navigation/router.tsx:524`/`:861` call `Noodl.SEO.setTitle` and nothing else. No focus move, no live region anywhere in the runtime. A screen-reader user is told nothing happened. | [ACC-004](ACC-004-A-ROUTE-CHANGE-IS-ANNOUNCED.md) |
| 5 | The document shell is hardcoded | `static/deploy/index.html:2` is `<html lang="en">` regardless of the project. No skip link anywhere. Opquast 130, 164; WCAG 3.1.1, 2.4.1. | [ACC-005](ACC-005-THE-DOCUMENT-SHELL.md) |
| 6 | Semantic ports exist but default to `div` | `text.ts:47` and `group.ts:247` both carry a Tag enum described as *"changes nothing visually but matters for screen readers and SEO"*, both defaulting to `div`. Right concept, wrong default, no check — the shape of most of this phase. | [ACC-013](ACC-013-TEMPLATES-ARE-BORN-WITH-LANDMARKS.md) |
| 7 | Alt text is technically present and practically invisible | `nodes/visual/image.ts:107` — `alt` port with a correct screen-reader tooltip, defaulting to `''` at `index: 1000`, i.e. below every other property on the node. An empty alt is currently indistinguishable from a deliberate decorative choice. | [ACC-007](ACC-007-AN-IMAGE-HAS-AN-ALTERNATIVE.md) |
| 8 | Labels work, conditionally, silently | Checkbox `:141`, TextInput `:233`, Select `:182`, RadioButton `:178` all wire `htmlFor` correctly — **only when `useLabel` is on**, and nothing anywhere says that turning it off breaks the field. Opquast 69. | [ACC-008](ACC-008-A-FORM-DESCRIBES-ITSELF.md) |
| 9 | Forms cannot describe their own errors or purpose | No `autocomplete` port (Opquast 95, WCAG 1.3.5), no `required` reflected in the label (Opquast 71), no `aria-invalid`/`aria-describedby` path from a validation error to the field (Opquast 79/80). | [ACC-008](ACC-008-A-FORM-DESCRIBES-ITSELF.md) |
| 10 | No text alternative path for media | Video node has no captions track and no transcript slot. Opquast 121/122. | [ACC-009](ACC-009-MEDIA-HAS-A-TEXT-ALTERNATIVE.md) |
| 11 | Nothing in the codebase computes a contrast ratio | `rg -i 'wcag\|contrast ratio\|a11y\|accessib'` over `packages/*/src` returns **three node files and nothing else** — despite a full design-token system with `resolveColor`, which makes author-time contrast checking computable today. | [ACC-010](ACC-010-THE-CONTRAST-READOUT.md), [ACC-016](ACC-016-THE-TOKEN-CONTRAST-RATCHET.md) |
| 12 | There is no accessibility check of any kind | `ProblemsPanel` / `ProjectValidationService` / `warningsmodel` all exist and none of them know about accessibility. The seam is built; there is no tenant. | [ACC-011](ACC-011-THE-ACCESSIBILITY-RULE-SET.md) |
| 13 | The agent is not told any of this | `validation/SemanticValidator.ts` and `validation/parameterValues.ts` check parameter values and nothing structural. The authoring vocabulary does not mention `as`, `alt`, or labels. Everything in Tiers 0–3 is generated around unless this lands. | [ACC-015](ACC-015-THE-AGENT-KNOWS-ACCESSIBILITY.md) |
| 14 | The editor is minimally instrumented | 62 ARIA attributes and 15 `role=` across 271 `.tsx` files; 11 files with `tabIndex`; 25 with `onKeyDown`. Panels, dialogs and the property editor are plain React and largely fixable. | [ACC-017](ACC-017-THE-EDITOR-CHROME-IS-OPERABLE.md) |
| 15 | Every canvas action requires a mouse | Connect, move, select, box-select and pan are drag-only. No keyboard equivalent exists for any of them. This excludes keyboard-only, switch, voice and eye-tracking users from the product entirely. | [ACC-018](ACC-018-EVERY-DRAG-HAS-A-KEYBOARD-EQUIVALENT.md) |
| 16 | The node graph is pixels | `views/nodegrapheditor/CanvasShell.ts:72` — Canvas2D, with no accessible representation. The graph model behind it is complete and structured, which is what makes a parallel accessible tree possible at all. | [ACC-020](ACC-020-THE-GRAPH-HAS-AN-ACCESSIBLE-TREE.md) |

---

# Part B — the apps (ATAG Part B)

## Tier 0 — the substrate

**No new UI. No author action. Retroactive.** Every one of these changes what the runtime emits, so
every project that already exists gets the fix the moment it ships — no migration, nothing to
opt into, nothing to learn. This tier is the highest value-per-line in the phase and it goes first.

| Task | What it does | Standards |
|---|---|---|
| **ACC-001** — The focus ring exists | Replace the `outline: none` rules in `assets/style.css` with `:focus-visible` styling drawn from the design tokens, meeting 3:1 against adjacent colours. Includes the Select "alternate element" the comment promised. | WCAG 2.4.7, 2.4.11; Opquast 165 |
| **ACC-002** — A link is an anchor | Uncomment `<a>` in the Text tag enum. Give Group an `href` path so a navigating group renders as a real anchor. Rework External Link to emit an anchor rather than `window.open`, keeping the existing popup-blocked outcome reporting. Notify on new-window links. | WCAG 2.1.1, 4.1.2; Opquast 136, 137, 142, 146 |
| **ACC-003** — A clickable group is operable | When a Group has a click event wired and is not already an interactive element, emit `role="button"`, `tabIndex={0}` and Enter/Space activation in `Group.tsx`. One change; the most common failure in every NodeGX app disappears. | WCAG 2.1.1, 4.1.2 |
| **ACC-004** — A route change is announced | On page change, move focus to the new page root (`tabIndex={-1}`) and announce the new title via a polite live region mounted once at the app root. Roughly twenty lines in `router.tsx`, next to the existing `setTitle` calls. | WCAG 2.4.3, 4.1.3 |
| **ACC-005** — The document shell | `<html lang>` from project settings rather than hardcoded. A skip link emitted by the deploy shell. Verify the page title is set before first paint on SSR/SSG. | WCAG 3.1.1, 2.4.1, 2.4.2; Opquast 102, 103, 130, 164 |

**Acceptance for the tier:** an existing project, unmodified, rebuilt — every interactive element
is reachable by Tab with a visible ring, links appear in a screen reader's link list, and a route
change is announced.

## Tier 1 — the ports exist

Give the author the controls, in an obvious place, with good defaults. Nothing here is *required*
of the author; Tier 0 already made the floor safe. This tier is about the ceiling.

| Task | What it does | Standards |
|---|---|---|
| **ACC-006** — The accessibility property group | An **Accessibility** group on every visual node: `Label` (accessible name), `Description`, `Role`, `Hidden from assistive tech`, `Tab index`. One shared mixin, applied through the node-definition layer rather than per node. | WCAG 4.1.2, 1.3.1 |
| **ACC-007** — An image has an alternative | Promote `alt` from `index: 1000` to a prominent slot on the Image node. Add an explicit **Decorative** toggle so an empty alt becomes a *decision* rather than a default. Feeds the Tier 2 rule. | WCAG 1.1.1; Opquast 116, 117, 118 |
| **ACC-008** — A form describes itself | `autocomplete` port on Text Input. `required` reflected in the visible label and in `aria-required`. An error slot wired to `aria-invalid` + `aria-describedby`. Input-format and max-length hints associated in the source, not merely placed nearby. Make the `useLabel=false` case emit an accessible name rather than nothing. | WCAG 1.3.5, 3.3.1, 3.3.2, 3.3.3; Opquast 69–74, 79–82, 95 |
| **ACC-009** — Media has a text alternative | Captions track port and transcript slot on Video. Autoplay gated behind `prefers-reduced-motion` and never for audio. Duration exposed. | WCAG 1.2.1, 1.2.2, 1.4.2; Opquast 121–126 |

## Tier 2 — the checklist in the loop

**This is the tier that changes behaviour**, and ACC-010 is the single most important piece of UI
in the phase. See NORTH-STAR doctrine 2 — *the number at the point of decision*.

| Task | What it does |
|---|---|
| **ACC-010** — The contrast readout | A live contrast ratio in the colour picker itself — `propertyeditor/components/ColorPickerFields.tsx` and `DesignTokenPanel/components/ColorsTab` — showing the ratio and AA/AAA pass/fail against the resolved background, updating as the colour is dragged. Uses the existing `resolveColor`. Converts a rule the author would have to remember into a fact they cannot avoid seeing. |
| **ACC-011** — The accessibility rule set | Static analysis over the graph, entering the existing `ProblemsPanel` via `ProjectValidationService`, surfaced on the existing warning dot. Rules below. Static only — no runtime, no headless browser, no build step. |
| **ACC-012** — The opt-in deploy gate | A project setting promoting accessibility warnings to build-blocking errors. **Off by default.** For teams under an EAA obligation. See NORTH-STAR doctrine 3. |

**ACC-011's opening rule set** — each cites its criterion, each must be checkable from the graph
alone, and each must have a fix the author can perform in one action:

| Rule | Criterion |
|---|---|
| Image with no alt, not marked decorative | WCAG 1.1.1 / Opquast 118 |
| Interactive element with no accessible name | WCAG 4.1.2 |
| Page with no `h1`, or heading levels skipped | WCAG 1.3.1 / Opquast 234 |
| Form input with no associated label | WCAG 3.3.2 / Opquast 69 |
| Text colour failing 4.5:1 against its resolved background (3:1 large) | WCAG 1.4.3 / Opquast 182 |
| Interactive target smaller than 24×24 | WCAG 2.5.8 / Opquast 186 |
| Link text of "click here", "read more", "link" | WCAG 2.4.4 / Opquast 137 |
| Visible label not contained in the accessible name | WCAG 2.5.3 |
| Duplicate DOM id | Opquast 236 |
| State conveyed by colour alone | WCAG 1.4.1 |

## Tier 3 — defaults and templates

The author deletes rather than adds. See NORTH-STAR doctrine 4.

| Task | What it does |
|---|---|
| **ACC-013** — Templates are born with landmarks | Every shipped template and every new Page component starts with a landmark skeleton — `header` / `nav` / `main` / `footer` set via the existing `as` ports — and an `h1` Text. Depends on nothing; blocked by nothing; changes the aggregate more than any lint. |
| **ACC-014** — The runtime honours user preferences | `prefers-reduced-motion` respected by Router page transitions, the animation nodes and any autoplaying media. `prefers-color-scheme` and `prefers-contrast` plumbed to the token layer so an app can respond without the author wiring it. Zoom never blocked (Opquast 193); text never justified (191). |

## Tier 4 — the agent

Everything above is wasted if the Build panel generates around it.

| Task | What it does |
|---|---|
| **ACC-015** — The agent knows accessibility | The Tier 0/1 ports enter the authoring vocabulary. The Tier 2 rules enter `validation/SemanticValidator.ts` so **agent output is checked by exactly the same code as hand-authored graphs** — one rule set, two authors. And an axe-core sweep in the sandbox preview becomes an input to the AAQ-007 self-review loop, so the agent can see and fix its own violations rather than being told about them in a prompt. |

Depends on phase 40's AAQ-005 (one substrate) and AAQ-007 (the agent sees its work) for the second
half. The vocabulary half is text and can land at any time.

---

# Part A — the editor (ATAG Part A)

Sequenced by cost. A1 is ordinary work with broad reach; A3 is a body of work in its own right and
the phase is honest about that rather than pretending it is a slice.

## Layer A1 — cheap and broad

| Task | What it does |
|---|---|
| **ACC-016** — The token contrast ratchet | A test that walks every foreground/background token pair in the design system and fails CI below 4.5:1 (3:1 for large text and UI boundaries). We already know the failure mode — phase 39 found a muted button at **1.00:1 against its own panel, at 143 call sites**. The fix for that was a fix; this is the ratchet that stops it recurring. |
| **ACC-017** — The editor chrome is operable | Panels, dialogs, property editor, node picker, topbar, launcher: correct roles and names, visible focus indicator, focus trapping and restoration in dialogs, Escape to dismiss, sane tab order, no keyboard traps. Plain React, ordinary work, and it is what makes the majority of the product usable without a mouse. |

## Layer A2 — the canvas, without rewriting it

| Task | What it does |
|---|---|
| **ACC-018** — Every drag has a keyboard equivalent | Connect ports, move nodes, select, and pan — all from the keyboard, via a command palette and arrow-key manipulation. Scoped deliberately as *"give every drag a non-drag route"* rather than *"make dragging accessible"*. Power users want this too, which is how it gets funded. |
| **ACC-019** — The canvas is legible at any size | Canvas zoom that scales **text**, not just the bitmap. A high-contrast canvas theme. `prefers-reduced-motion` on pan/zoom easing. Node state never encoded by colour alone. |

## Layer A3 — the hard one

| Task | What it does |
|---|---|
| **ACC-020** — The graph has an accessible tree | Render a parallel, focusable DOM tree from the existing node-graph model — nodes as `role="treeitem"`, connections announced as relationships, kept in sync with the canvas — so the canvas becomes *the sighted view of an accessible structure* rather than the only view. This is the single largest item in the phase. It is last, it is scoped as its own body of work, and until it lands the accessibility statement says so. |

---

# Standing

| Task | What it does |
|---|---|
| **ACC-021** — The accessibility statement | A published statement that is **true**: what conforms, what does not, where the known gaps are, and how to report a barrier. Written last, from what actually shipped. NORTH-STAR criterion 12 — the one that makes the commercial claim credible. |
| **ACC-022** — Found along the way | The register. Anything filed-not-fixed gets a row, per the phase-39 rule. |

---

## Order of work

**Tier 0 first, in parallel, and it should be a single session.** Five small runtime changes with
mechanism verified and citations in hand. Nothing above them matters while the floor is broken, and
they are the only tier that improves apps built before the work was done.

**Then ACC-010 alone**, ahead of the rest of Tier 2. It is the highest-leverage UI in the phase and
it has no dependency on Tier 1 — the token system and `resolveColor` already exist. Shipping it
early also means the Tier 1 and Tier 3 work is done by people who can see the number.

**Then Tier 1 and Tier 3 together.** ACC-006's shared mixin is the risk-bearing task; ACC-007,
ACC-008 and ACC-009 sit on it. ACC-013 depends on nothing and can land at any point.

**Then the rest of Tier 2.** ACC-011's rule set is much easier to write once the Tier 1 ports
exist, because half the rules are "this port is unset and not explicitly waived". ACC-012 is small
and follows it.

**ACC-015 whenever phase 40's substrate is ready.** The vocabulary half is text and is not blocked.

**Part A in layer order.** A1 is schedulable now and independent of everything in Part B. A2
depends on nothing but is larger. A3 is its own project and should be planned as one.

**ACC-021 last, from reality. ACC-022 worked opportunistically.**

## Dependencies

```
Tier 0 (001–005) ──── independent, parallel, retroactive
        │
ACC-010 ───────────── independent (tokens + resolveColor exist today)
        │
ACC-006 ──┬── ACC-007
          ├── ACC-008          ACC-013 ── independent
          └── ACC-009          ACC-014 ── independent
        │
ACC-011 ──── ACC-012           (easier after Tier 1; not blocked by it)
        │
ACC-015 ──── needs AAQ-005 / AAQ-007 for the self-review half
        │
Part A:  ACC-016, ACC-017 ── independent
         ACC-018, ACC-019 ── independent, larger
         ACC-020 ────────── its own body of work
        │
ACC-021 ──── last, written from what shipped
```

## Exit criteria

The twelve criteria in [NORTH-STAR.md § What "done" looks like](NORTH-STAR.md). Summarised:

1. **A reference app built through the tool, with the author doing nothing accessibility-specific,
   passes axe-core with zero violations and passes a manual keyboard and screen-reader pass.**
   That single sentence is the phase.
2. Every shipped template and every wizard-built app clears the same bar, cold.
3. The token set passes the CI contrast ratchet.
4. Every non-canvas editor surface is fully keyboard-operable.
5. Every canvas drag has a keyboard equivalent, and the graph exposes an accessible tree.
6. A published accessibility statement that is true, including about the gaps.

Criterion 1 is the commercial claim. Criterion 6 is what makes it credible. Per NORTH-STAR doctrine
6, **"passes a scanner" is explicitly not the bar** — automated tooling catches a minority of
failures and is blind to whether a name is *meaningful*, whether reading order makes sense, or
whether alt text is *right* rather than merely present. A manual pass backs anything we say in
public.

## A note on evidence

Every mechanism in the findings table was read in source on 2026-08-05, with file and line cited so
a later reader can re-check rather than believe. Nothing in this phase was filed from a symptom.

Two things to carry forward from phase 40, because they apply directly here:

- **One fact in two places.** The accessibility rules must live in one place and be read by both
  the editor's validation and the agent's. ACC-015 exists to make sure they are not written twice.
- **Read the mechanism before trusting a task's stated facts, including this README's.** Phase 40
  found finding #7's *fourth* mechanism after three earlier ones were each real, each fixed, and
  none of them the cause.

There is one specific place that rule bites here. **The `alt`, `as` and `htmlFor` ports all exist
and all look correct in source.** That is exactly the condition under which phase 40 found a port
that had silently stopped emitting for a year. Before Tier 1 builds on any of them, drive one in a
real preview and confirm the attribute reaches the DOM.
