# Phase 47 — Internationalisation (Track I)

**Created:** 2026-08-06
**Status:** 📋 Specced, not started — 9 tasks. Post-alpha.
**Doctrine:** the same one as [phase 41](../phase-41-accessibility/NORTH-STAR.md), applied to a
second invisible property.

> Richard, 2026-08-06: *"i18n as well would be a genius thing to add as default to NodeGX projects
> to allow multi lingual apps out of the box. I know the old Noodl team made a 'Module' for it, and
> it still exists today, but I think the UX was shit (you had to maintain your own JSON file at app
> root or something)."*

That diagnosis is exactly right, and the reason it was shit is the same reason accessibility
overlays are shit: **it put the burden on the author at the moment they were least able to carry
it.** A JSON file you maintain by hand is a discipline, and disciplines lose.

## The position

**Internationalisation is a property of what the tool emits, not a feature the author remembers to
use.**

An author who does nothing at all should produce an app whose every string is already extracted,
keyed, and ready to translate — because the platform did it while they typed. Adding a locale should
be a button, not a project. The author should never open the string file, and in the common case
should never learn that one exists.

This is the phase-41 argument transplanted, and it holds for the same reason: the moment the author
would need to know is already past by the time anyone notices.

## Why this is the one place the substrate is *structurally* better than code

Worth stating up front because it changes how the phase should be sold.

**In a graph, strings are already discrete addressable parameters.** `text` on a Text node,
`label` on a Button, `placeholder` on a Text Input — each one has an id, a component, a port name
and a type. Extraction is a walk.

**In JSX, strings are text nodes in a syntax tree.** Extraction is a build-time tool, a babel
plugin, a lint rule and a convention that someone has to set up and everyone has to follow —
which is why so many React codebases have i18n architecture and hardcoded strings at the same time.
The reference app declares *"all strings externalised from day one"* as a rule, and rules of that
kind are enforced by vigilance.

So this is not NodeGX catching up to React. On this one axis NodeGX starts ahead, and has simply
never collected.

## The AI prize

An agent authoring a page emits a **key plus a base-locale string**. Translation then becomes a
single batch model call over the string table — with full component context available for
disambiguation, which is the thing that makes machine translation of UI strings bad when it is bad.

*"Build me this app in six languages"* becomes a demo that works, and it is a demo Claude Code
writing React does **not** do well by default. Worth building for that reason alone; the market
reach is a bonus.

## Tasks

| ID | Title | Est. | Notes |
|---|---|---|---|
| **INT-001** | The string table | 3 d | `nodegx.strings.<locale>.json`, sibling to `nodegx.styles.json`. One file per locale so translators touch one file and merges never collide across languages. Key format: stable, derived from component path + node id + port, **never from the string itself** — a key containing the thing it keys is the POL-013 trap. |
| **INT-002** | Translatable parameters, at the one seam | 1 wk | `Ports.renderParams` is already **the** seam every property row goes through. The affordance goes there once and appears on every string port in the product, uniformly, including on nodes nobody has written yet. Author types French; the platform mints the key silently. |
| **INT-003** | Extraction and the migration | 1 wk | Existing projects: walk every string parameter, mint keys, write the base locale, rewrite parameters to references. Mechanical, reversible, and safe **because** v2 is per-component — the diff is reviewable per file rather than one 4MB blob. |
| **INT-004** | The Translations panel | 1.5 wks | Every string, grouped by component, untranslated counts per locale, filter-to-missing, inline editing. "Add a locale" is a button. **The author never opens the JSON** — that is the whole design, and if the panel is bad they will, and the phase has failed. |
| **INT-005** | The runtime locale | 1 wk | A locale on the runtime; re-render on change; `<html lang>` set from it (which also closes [ACC-005](../phase-41-accessibility/ACC-005-THE-DOCUMENT-SHELL.md)'s hardcoded `lang="en"` — the two phases meet here); resolution order: explicit → route → `navigator.languages` → project default. |
| **INT-006** | Intl-backed format nodes | 1 wk | Node 22 and every browser ship full ICU, so this is mostly plumbing: Format Number, Format Currency, Format Date, Format Relative Time, and **Plural** via `Intl.PluralRules` — the one every naive i18n gets wrong. The reference app's `formatCurrency` utility stops being code. |
| **INT-007** | Locale routing and SSR per locale | 1 wk | `/fr/...` renders French HTML **server-side**, with `hreflang` alternates and a per-locale sitemap. This composes with the SSR that already ships and is a capability almost no visual builder has. Depends on [phase 49](../phase-49-discovery/README.md) for the sitemap half. |
| **INT-008** | RTL | 1 wk | A direction token flipping the layout engine's start/end and the icon mirroring rules. **Cheap now, expensive later** — doing it after a thousand projects exist with hardcoded `left`/`right` is a migration nobody will run. This is the argument for doing it in this phase rather than a future one. |
| **INT-009** | The agent contract | 4 d | Authoring vocabulary: emit keys, never literals. Validator: a literal in a translatable port on an i18n-enabled project is a warning. MCP: `list_strings`, `set_translations` so a batch translation is one tool call, not N. |

**Total: ~7 weeks**, of which INT-001…005 (~4.5 wks) is a coherent shippable first half.

## Deliberately out of scope

- **Translation memory, glossaries, TMX import/export, translator seats.** Real needs for real
  localisation teams, and every one of them is a product rather than a feature. Ship the substrate;
  let evidence decide whether a localisation product exists.
- **Automatic translation as a default.** The button exists (INT-009 makes it cheap); it does not
  run without being asked. Silently machine-translating someone's product copy is not a favour.

## Exit criteria

1. A new project is i18n-capable with no setup, and its author never sees a JSON file.
2. An existing project migrates with one action and renders identically afterwards.
3. Adding Dutch to a finished app is: click Add Locale, click Translate, review, ship.
4. `/nl/prijzen` is server-rendered in Dutch with correct `lang` and `hreflang`.
5. An Arabic locale mirrors the layout without any author-authored CSS.
6. An agent asked for a six-language app produces one, and the strings are in the table rather than
   the graph.
