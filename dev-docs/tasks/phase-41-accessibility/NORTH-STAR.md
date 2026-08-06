# North Star — Accessibility

**Created:** 2026-08-05
**Status:** doctrine. This document does not schedule work; it says what we believe and what
"done" means. The ladder of tasks is in [README.md](README.md).

---

## The position

**Accessibility is a property of the tool, not a feature of each app.**

Every other builder on the market treats accessibility as something the author does — a checkbox
in a settings page, a plugin, an overlay widget bolted on at the end. That framing has failed
everywhere it has been tried, for a reason that is not about effort or goodwill: the author is
almost never the person who knows, and the moment they would need to know has already passed by
the time anyone runs a scanner.

Our position is the opposite one. **The output of NodeGX should be accessible because of what
NodeGX emits, not because of what the author remembered.** An author who does nothing at all
should ship an app that is keyboard-operable, screen-reader-navigable and correctly structured.
An author who *wants* to do better should find the controls in front of them, at the moment the
decision is being made, expressed as a number rather than a rule. An author who does something
wrong should be told, in the same panel that already tells them about every other kind of
mistake.

That is a claim about defaults, not about documentation. Nothing in this phase is a docs page.

---

## Why this is not already true

Four mechanisms. Only one of them is about people not caring, and it is the least important.

### 1. The training data is the broken web

WebAIM's 2026 *Million* report found detectable WCAG failures on **95.9%** of home pages, up from
94.8% the year before. Every model that writes front-end code learned from that corpus, and so
reproduces its median. The median is `<div onClick>`.

This is not a fixable property of models. It is a fixable property of *harnesses* — the 2025 ACM
Web4All study found that accessibility-oriented prompting materially improves WCAG compliance in
LLM-generated UIs. The knowledge is present in the model. Nothing in the loop asks for it. That
is a seam, and seams are our business.

### 2. Accessibility is invisible to every feedback signal

A missing `alt` does not fail a type check, does not fail a test, does not change a screenshot,
does not throw, and does not look wrong. Both humans and agents optimise hard against checkable
signals. Accessibility produces none of them, so it is *structurally* invisible in a way that an
off-by-one is not.

Everything in Tier 2 of this phase exists to convert accessibility from an invisible property
into a checkable one. That is the whole idea.

### 3. `<div onClick>` is a genuine local optimum

Fewer characters, no user-agent styling to reset, works perfectly in the demo, matches every
framework tutorial ever written. It only fails for someone who is not in the room. Being right
here costs more than being wrong, at the moment of writing, for the person writing — which is
precisely the shape of problem a tool is supposed to absorb on the author's behalf.

### 4. A visual canvas has no natural home for semantics

This is the builder-specific one, and it is the deepest.

Position, size and colour are *visible* properties: you drag them and you see the result. "Is
this element a button, or a heading, or a region?" has **no visual consequence whatsoever**. In a
WYSIWYG tool, a property with no visual consequence has nowhere to live unless somebody
deliberately builds it a home, gives it a good default, and puts a check behind it.

Our existing `as` ports are the proof. Someone already understood this — [`text.ts:47`] and
[`group.ts:247`] both carry a Tag enum described, verbatim, as *"changes nothing visually but
matters for screen readers and SEO"*. The concept landed. The **default** did not (`div`, in both
cases), and nothing checks. That gap — right concept, wrong default, no check — is the shape of
almost every finding in the audit below.

---

## What the audit found

Read on 2026-08-05, against source, at the phase open. Cited so a later reader can re-check
rather than believe.

### The runtime that generates every app contains one accessibility attribute

Across the whole of `packages/noodl-viewer-react/src/`, the complete inventory of ARIA and
semantic markup is:

- `aria-hidden="true"` + `focusable="false"` on the icon SVG — `components/visual/Icon/IconGlyph.tsx:41`
- `alt=""` on five decorative `<img>` tags (Button, TextInput, Checkbox, RadioButton, Select, Icon)

Not one `role`. Not one `aria-label`. Not one `aria-live`. Not one `aria-describedby`.

### Every default control ships with its focus ring deleted

`src/assets/style.css` sets `outline: none` on Button (`:20`), Checkbox (`:41`), RadioButton
(`:60`), Select (`:122`) and Range (`:135`, `:175`). Line 121 reads:

> `/* Remove focus outline, will add on alternate element */`

The replacement was never written. There is not one `:focus-visible` rule in the file. This is a
direct **WCAG 2.4.7** failure and **Opquast 165** in every app the tool has ever produced, and it
is roughly a fifteen-line fix. It is ACC-001 and it goes first.

### There is no anchor element anywhere in the runtime

`<a>` exists in the Text node's tag list and is **commented out** — `nodes/visual/text.ts:65`.
External Link calls `window.open()` — `nodes/std-library/externallink.ts:63`. Navigation goes
through the router. `rg '<a ' packages/noodl-viewer-react/src` returns nothing.

So **every link in every NodeGX app is a div with a pointer handler**: absent from the tab order,
absent from a screen reader's link list, no middle-click, no open-in-new-tab, no `href` for a
crawler, no `:visited`. The tool is currently incapable of emitting a link.

### A clickable group is not operable

`components/visual/Group/Group.tsx:332` renders `<Component {...props.dom} {...PointerListeners(props)}>`
— the `as` tag flows through, pointer handlers attach, and there is no `tabIndex`, no `role`, and
no key handling anywhere on the path. "Make any group clickable" is the single most-used
interaction pattern in the tool and it produces something a keyboard cannot reach.

### A route change is silent

`nodes/navigation/router.tsx:524` and `:861` call `Noodl.SEO.setTitle` on page change. Nothing
moves focus, and there is no live region anywhere in the runtime. A screen-reader user navigating
a NodeGX SPA is told nothing happened.

### The groundwork that *is* there

Worth stating plainly, because it changes the size of this phase:

- **Image has an Alternate text port** with a screen-reader tooltip — `nodes/visual/image.ts:107`.
  It defaults to `''` and sits at `index: 1000`, i.e. dead last, below every other property.
- **Text has a Tag enum** — h1–h6, p, span — `nodes/visual/text.ts:47`. Default `div`.
- **Group has a Tag enum** carrying the full landmark set — section, article, aside, nav, header,
  footer, main, span — `nodes/visual/group.ts:247`. Default `div`.
- **Every labelled control wires `<label htmlFor>` correctly** — Checkbox `:141`, TextInput `:233`,
  Select `:182`, RadioButton `:178`. But only when `useLabel` is switched on, and nothing says so.
- **`<html lang="en">` is present** in the deploy shell — hardcoded, not project-derived.

Four of the six hardest primitives already have their port. This phase is mostly about defaults,
checks and one missing element, not about inventing a surface.

### The editor's own state

62 ARIA attributes and 15 `role=` usages across 271 `.tsx` files. 11 files use `tabIndex`. 25 use
`onKeyDown`. The node graph is Canvas2D — `views/nodegrapheditor/CanvasShell.ts:72` — i.e. pixels,
with no accessible representation of any kind.

### Nothing in the codebase knows the word

`rg -i 'wcag|contrast ratio|a11y|accessib'` over `packages/*/src` returns **the three node files
quoted above and nothing else**. There is a complete design-token system with a `resolveColor`
function that makes author-time contrast checking computable today, and no code anywhere computes
a contrast ratio.

---

## The two obligations

The standard that names this split is **ATAG 2.0** (W3C, Authoring Tool Accessibility Guidelines).
It exists precisely for tools like this one and divides the problem in two:

| | ATAG | Question | Who it serves |
|---|---|---|---|
| **Part A** | *The authoring tool is accessible* | Can a disabled person **build** with NodeGX? | Our users |
| **Part B** | *The tool supports accessible authoring* | Can a disabled person **use** what NodeGX built? | Our users' users |

Both are in scope. They are not equally cheap, and they do not have the same reach.

**Part B is the higher-leverage half.** It is mostly small runtime changes, it multiplies across
every app anyone ever builds with the tool, and it improves apps that were built before we did the
work — a template that already exists gets its focus rings back the moment ACC-001 lands, with no
migration and no author action. **Part B goes first.**

**Part A is the harder half**, and honesty about that is part of the doctrine: full screen-reader
parity for a Canvas2D node graph is a phase of its own, not a slice. But the non-canvas surfaces —
panels, dialogs, property editor, node picker, topbar — are plain React and are largely fixable
with ordinary work, and low-vision support is nearly free given the token system we already have.
We do the tractable parts of Part A properly and we are explicit in public about the canvas gap
rather than quiet about it.

---

## Who this is for

Not a lecture — a working taxonomy. Each row is a real set of people, what they actually need, and
what it demands of each half. Where a row says *strength*, that is a claim we can already make.

| Group | What they need | Part A — the editor | Part B — the apps |
|---|---|---|---|
| **Blind** (screen reader) | Everything reachable and named in a linear, structured form | The hard wall: the canvas is pixels. Needs a parallel accessible tree built from the graph model (ACC-020) | Roles, names, landmarks, heading order, live regions, real links. Tiers 0–2 |
| **Low vision** | Magnification, high contrast, reflow, no text-in-image | Canvas zoom that scales *text* and a high-contrast canvas theme (ACC-019), plus a token contrast ratchet in CI (ACC-016) | Contrast enforced at author time (ACC-010), zoom not blocked, no fixed pixel text |
| **Colour vision deficiency** | Never colour alone as an information carrier | Node state, warning dots and diff colours must carry a second signal | A lint for colour-only state; the design system already has icon+shape vocabulary |
| **Motor / dexterity** (keyboard-only, switch, voice, eye-tracking, tremor) | No required drag, large targets, no timing | The hard wall: drag-to-connect. Every drag needs a keyboard equivalent (ACC-018) | Target size ≥ 24×24 (WCAG 2.5.8) linted, no drag-only interaction, focus order sane |
| **Deaf / hard of hearing** | Captions, transcripts, no audio-only information | Lesson and docs video needs captions — the docs platform, not the editor chrome | Captions track and transcript slot on the Video node (ACC-009) |
| **Speech** | Voice control needs visible labels to match accessible names | Visible button text must match its `aria-label` | Same rule, linted: WCAG 2.5.3 Label in Name |
| **Cognitive & learning** (dyslexia, ADHD, memory, aphasia) | Plain language, consistency, forgiving errors, no memorisation | **Strength.** Visual dataflow removes syntax, spelling and memorisation from programming. Reinforce with density settings and consistent placement | Clear error text (Opquast 79–82), no redundant re-entry (WCAG 3.3.7), consistent help placement (3.2.6) |
| **Neurodivergent / sensory** | Predictability, no unexpected motion or sound, control over density | Honour `prefers-reduced-motion` on canvas pan/zoom and panel transitions | Same at runtime (ACC-014); media user-triggered, never autoplay (Opquast 124/125) |
| **Vestibular** | No large parallax, no unexpected movement | Canvas easing behind reduced-motion | Transitions behind reduced-motion; the Router's page transitions are the specific risk |
| **Photosensitive epilepsy** | Nothing flashing above threshold | Low risk in the editor | A lint is disproportionate; a documented constraint on animation nodes is not |
| **Situational & temporary** | Bright sunlight, one hand free, a broken wrist, a noisy train, a bad connection | Everything above, for everyone, some of the time | Same |

That last row is the argument that wins internally when the others do not. Every fix in this phase
is used by people who are not disabled, constantly, without noticing. Focus rings help anyone who
tabs. Captions are used overwhelmingly by hearing people. Contrast is what makes a phone readable
outdoors.

---

## The standards we hold ourselves to

**Target: WCAG 2.2 Level AA**, for both the editor and the default output. AA is the level every
regulation references; AAA is not a coherent whole-product target and we will not claim it.

**EN 301 549** is the EU harmonised standard and is WCAG 2.1 AA plus non-web provisions. Meeting
WCAG 2.2 AA covers it.

**The European Accessibility Act** applies from **28 June 2025** — the deadline has passed.
Products and services placed on the EU market after that date must comply now; services that
predate it have until 28 June 2030. E-commerce, banking, telecoms, transport, e-books and media
are in scope, which is a large fraction of what people build in a tool like this.

**ATAG 2.0** is the frame for the phase, as above.

**Opquast** (245 rules, 14 themes) is the *working checklist*, and it earns its place for a reason
worth stating: it is broader than WCAG and more concrete. A rule like *"the user is notified when
new windows are to be opened"* (146), *"copy-and-paste is possible in the form's fields"* (92) or
*"internal and external links are differentiated"* (142) is not a WCAG success criterion, is
trivially implementable, and is exactly the kind of thing a builder should do for the author
without being asked. Where a Tier 1 or Tier 2 rule has an Opquast number, the task cites it.

---

## Doctrine

Six positions. These decide the arguments the individual tasks will have.

### 1. Defaults over documentation

If the accessible thing is not what happens when the author does nothing, we have not shipped it.
A docs page explaining that you *should* set the Tag port is a confession, not a mitigation. The
test for every task in this phase: *does an author who never opens this panel get the right
result?*

### 2. The number at the point of decision

The single highest-leverage piece of UI in the phase is a contrast ratio displayed **in the colour
picker, while the colour is being dragged** (ACC-010). Not in a report, not in a panel, not in CI.

This is what Opquast training actually does to people: it converts a rule you would have to
remember into a fact you cannot avoid seeing. A linter that runs afterwards asks the author to go
back and undo a decision they have already emotionally committed to. A number in the picker
changes the decision itself, silently, for people who have never heard of WCAG.

### 3. Warnings, not errors — with an opt-in gate

Accessibility findings enter the existing `ProblemsPanel` / `warningsmodel` surface as **warnings**.
They do not block the build. A project setting turns them into a deploy gate for teams under a
compliance obligation, off by default.

We already learned this in phase 40: a check nobody can ship past gets disabled, and a check that
never blocks anything gets ignored. The warning surface with an opt-in gate is the shape that
survives both failure modes.

### 4. The author deletes, they do not add

Templates and new components are born with the accessible structure already in place — a landmark
skeleton set via the `as` ports, an `h1` on a new page. An author who wants something else removes
it. This is the only mechanism that reliably changes aggregate behaviour, because it does not
depend on anyone knowing anything.

### 5. The agent is a first-class author, held to the same contract

Everything in Tiers 0–3 is wasted if the Build panel generates around it. The accessibility ports
go into the vocabulary the model is given, and the accessibility rules go into
`validation/SemanticValidator.ts` alongside the parameter-value rules, so agent output is checked
by exactly the same code as hand-authored graphs. One rule set, two authors. This is the
one-fact-in-two-places trap the phase-40 live pass named, and we do not pay for it again.

### 6. No overlays, and no automated-only claims

We will never ship, recommend or integrate an accessibility overlay widget. They are widely
opposed by disabled users, they do not achieve compliance, and they would directly contradict
position 1.

And we will not describe an app as "accessible" on the strength of a passing scanner. Automated
tooling detects a minority of WCAG failures — commonly cited at around a third — and is blind to
the ones that matter most: whether a name is *meaningful*, whether reading order makes sense,
whether alt text is *right* rather than merely present. Our language is "no detected issues", the
gate is advisory, and a manual pass is what backs any claim we make in public.

---

## What "done" looks like

Measurable, not aspirational. These are the phase's exit criteria in doctrine form; the README
carries their per-task acceptance.

**Part B — the apps**

1. A reference app built through the tool, with the author doing **nothing accessibility-specific**,
   passes an axe-core sweep with zero violations, and passes a manual keyboard-only pass and a
   screen-reader pass (VoiceOver + NVDA).
2. Every shipped template and every wizard-built app clears the same bar, cold.
3. Every interactive primitive is reachable and operable by keyboard, with a visible focus
   indicator, and announces its role and name.
4. A route change moves focus and is announced.
5. The tool can emit a real `<a href>`.
6. Contrast is checkable at author time and a failing pair produces a warning.

**Part A — the editor**

7. The design token set passes a contrast ratchet in CI (4.5:1 body, 3:1 large text and UI
   boundaries), enforced by a test, not a review.
8. Every non-canvas surface — panels, dialogs, property editor, node picker, topbar, launcher — is
   fully keyboard-operable with a visible focus indicator and correct dialog focus behaviour.
9. Every canvas action reachable by drag has a keyboard equivalent.
10. The node graph exposes an accessible tree that a screen reader can navigate, kept in sync with
    the canvas.
11. `prefers-reduced-motion` is honoured throughout.

**Published**

12. An accessibility statement that is *true*, naming what conforms, what does not, and where the
    known gaps are — including the canvas, for as long as it is a gap.

Criteria 1–6 are the ones that make the commercial claim. Criterion 12 is the one that makes it
credible.

---

## The commercial argument

Worth writing down, because it is what gets this scheduled.

The EAA deadline has passed. Every agency, every SaaS founder and every internal team building for
an EU audience now has a legal obligation they mostly cannot discharge, because the tools they use
do not help them and hiring an audit is expensive. WebAIM's number says 95.9% of the web fails, so
this is not a niche anxiety.

**No low-code or AI app builder is currently selling accessibility by default.** Not one. The
category standard is an overlay recommendation and a docs page.

"Apps built with NodeGX are accessible out of the box, and the builder tells you when they are
not" is therefore not a feature line. It is a compliance shortcut, it is defensible, it is
differentiating, and — uniquely among the things we could differentiate on — it is *true for free*
for every existing user the moment the runtime changes land.

It is also the right thing to do, which is the actual reason, and the paragraph above is how we
get to do it.

---

## What this phase is not

- **Not an overlay.** See doctrine 6.
- **Not a certification programme.** We are not auditing anyone's app or issuing conformance
  claims on their behalf.
- **Not AAA.** Individual AAA criteria may be met where they are cheap; the target is AA.
- **Not a docs deliverable.** Docs follow the behaviour, they do not substitute for it.
- **Not a full canvas screen-reader implementation in the first pass.** ACC-020 is scoped as its
  own body of work and is explicitly last. Pretending otherwise would make the whole ladder
  unschedulable, which is how accessibility phases usually die.

---

## Sources

- [Opquast Web Quality Assurance Checklist](https://checklists.opquast.com/en/web-quality-assurance/) — 245 rules, 14 themes
- [ATAG 2.0 — Authoring Tool Accessibility Guidelines (W3C)](https://www.w3.org/TR/ATAG20/)
- [WCAG 2.2 (W3C)](https://www.w3.org/TR/WCAG22/)
- [When LLM-Generated Code Perpetuates User Interface Accessibility Barriers (ACM Web4All, 2025)](https://dl.acm.org/doi/10.1145/3744257.3744266)
- [Human or LLM? A Comparative Study on Accessible Code Generation Capability (2025)](https://www.researchgate.net/publication/390038372_Human_or_LLM_A_Comparative_Study_on_Accessible_Code_Generation_Capability)
- [European Accessibility Act Goes Live (Davis Wright Tremaine, 2025)](https://www.dwt.com/insights/2025/07/european-accessibility-act-digital-products)
- [European Accessibility Act: June 2025 deadline has arrived (Covington)](https://www.insideglobaltech.com/2025/06/10/european-accessibility-act-june-2025-deadline-has-arrived/)
- WebAIM *Million* 2026 — 95.9% of home pages with detectable WCAG failures (cited via the 2026
  accessibility trend analysis; re-verify against webaim.org before quoting externally)
