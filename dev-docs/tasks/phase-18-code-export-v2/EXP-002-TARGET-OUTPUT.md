# EXP-002 step 2 — the exported project we want, written by hand first

> "**Write the target output by hand first**, as in EXP-001. For each of the main node categories,
> hand-write what good generated code looks like, review it as if in a pull request, and only then
> write the generator that produces it."
> — [EXP-002](./EXP-002-DETERMINISTIC-GENERATORS.md), node coverage strategy

EXP-001's exercise ([EXP-001-TARGET-OUTPUT.md](./EXP-001-TARGET-OUTPUT.md)) hand-wrote four
*components* to derive the runtime library's API. This one hand-writes a whole small *project* to
derive the generator's decisions: file layout, style extraction, naming, stubs, routing,
scaffolding. The source is real and v2-native: **Puppy test 3**
(`~/vscode_projects/NodeGX test projects/Puppy test 3`), a five-page adoption site authored
entirely through the MCP server — per-component `nodes.json`/`connections.json`, design tokens in
`nodegx.project.json`, styles written as `var(--token)` references throughout.

Two components are written out in full below: `/Components/PuppyCard` (a pure visual leaf fed by
`Component Inputs`) and `/Pages/Landing` (a page: visual tree, `For Each` repeater, `DbCollection2`
query, form controls, `RouterNavigate`). Between them they exercise every generator EXP-002's scope
lists except state stores and events — those were settled by EXP-001's §3–§4 and are not re-derived
here.

**The headline finding, stated up front:** this entire project exports with **zero imports of
`@nodegx/core`**. No global stores, no signals crossing component boundaries, no collections shared
between pages — so the library never appears. EXP-001's rule ("most exported code should not
mention the library") holds at project scale: the library is earned per-construct, and a project
that never uses those constructs exports as a plain React app.

---

## 1. `/Components/PuppyCard` — props, style extraction, and naming

The graph: ten visual nodes and a `Component Inputs` node with five ports, wired:

```
cardInputs photo       → photo    src        cardInputs age         → ageText  text
cardInputs name        → nameText text       cardInputs description → descText text
cardInputs name        → photo    alt        cardInputs breed       → breedText text
```

```tsx
// src/components/PuppyCard.tsx — generated from /Components/PuppyCard
import styles from './PuppyCard.module.css';

export interface PuppyCardProps {
  photo?: string;
  name?: string;
  breed?: string;
  age?: string;
  description?: string;
}

/** Card. */
export function PuppyCard({ photo, name, breed, age, description }: PuppyCardProps) {
  return (
    <div className={styles.card}>
      <img className={styles.photo} src={photo} alt={name} />
      <div className={styles.body}>
        <div className={styles.nameRow}>
          <p className={styles.nameText}>{name}</p>
          <div className={styles.agePill}>
            <p className={styles.ageText}>{age}</p>
          </div>
        </div>
        <p className={styles.breedText}>{breed}</p>
        <p className={styles.descText}>{description}</p>
      </div>
    </div>
  );
}
```

```css
/* src/components/PuppyCard.module.css */
.card {
  display: flex;
  flex-direction: column;
  width: 340px;
  background-color: var(--surface-raised);
  border: var(--border-1) solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: 0 1px 3px 0 #0f172a14;
  overflow: hidden;
}

.photo {
  width: 100%;
  height: 230px;
  object-fit: cover;
  border-top-left-radius: var(--radius-xl);
  border-top-right-radius: var(--radius-xl);
}

.body {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: var(--space-5);
  row-gap: var(--space-2);
}

.nameRow {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  column-gap: var(--space-3);
}

.nameText {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
  letter-spacing: var(--tracking-tight);
  color: var(--foreground);
}

.agePill {
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: var(--muted);
  border-radius: var(--radius-full);
  padding: var(--space-1) var(--space-3);
}

.ageText {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  letter-spacing: var(--tracking-wide);
  color: var(--muted-foreground);
}

.breedText {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  letter-spacing: var(--tracking-wide);
  color: var(--primary);
}

.descText {
  margin: 0;
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--muted-foreground);
}
```

**What this settles.**

- **A `Component Inputs` node is a typed props interface.** Every port becomes an optional prop —
  optional because the graph never guarantees a connection, and C3 ("`undefined` is never sent")
  means an unwired input simply keeps its default. Port types come from the catalog when the port
  is typed, `string` otherwise.
- **One input feeding two sinks is two interpolations**, not a variable: `name` lands in both
  `<p>{name}</p>` and `alt={name}`. The wire graph disappears into JSX.
- **A node's parameters split into two piles.** *Content and behaviour* (`text`, `src`, `alt`,
  `label`, handlers) go to JSX. *Layout and style* (everything else) go to one CSS-module class per
  visual node. The split is decided per parameter from the catalog, not guessed: the visual
  generator carries an explicit content-vs-style classification for each of the ~27 visual types'
  ports.
- **Class names come from the author's node ids**, camelCased, with id-collision suffixes stripped
  when unambiguous: the author's `card-3` and `body-2` (dedup noise from the editor) become `.card`
  and `.body` because no sibling claims those names; `nameText` stays as written. v2 ids are
  author-chosen and semantic — this is EXP-006's "authoring intent carries through" happening a
  phase early, for free.
- **Token references pass through verbatim.** The project's styles are already written as
  `var(--space-5)` / `var(--radius-xl)`; the generator does not resolve them to pixel values,
  because the token layer is the design system the exported app should keep. Literal values
  (`340px`, `#0f172a14`) pass through literally; `{value, unit}` objects join into CSS lengths.
- **Runtime style semantics become their CSS equivalents by table**: `clip: true` →
  `overflow: hidden`; `sizeMode: "explicit"` → emit `width`/`height`; `contentHeight` → emit
  `width`, omit `height`; `contentSize` → omit both; the four `boxShadow*` params fold into one
  `box-shadow`; per-corner radii fold when uniform (`.card`) and stay per-corner when not
  (`.photo`). Shorthands are used when all sides agree (`padding: var(--space-5)`).
- **`Text` renders `<p>` with `margin: 0`; `Group` renders `<div>` with `display: flex`.** The
  interpreted runtime's Group is a flex column by default and its Text has no margins, so the CSS
  states both explicitly rather than relying on a global reset with surprising reach (the base
  stylesheet in §3 resets only `box-sizing`). Choosing semantic tags (`<header>`, `<h1>`) is
  *deliberately not attempted* deterministically — a wrong guess is worse than a `<div>`, and this
  is exactly the authoring-intent seam EXP-006 owns. Recorded as an open question there.
- **The node's `label` becomes the component's doc comment** (`/** Card. */`). Thin here; EXP-006
  widens this channel (comments, comment boxes) without changing the mechanism.

---

## 2. `/Pages/Landing` — a page: query stub, repeater, form, navigation

The graph: 35 visual nodes, plus `puppyQuery` (`DbCollection2` on the `Puppy` collection),
`repeater` (`For Each`, template `/Components/PuppyCard`, default identity mapping script), and
`navThankYou` (`RouterNavigate` → `/Pages/Thank You`). Only two connections exist outside the
visual tree:

```
puppyQuery items → repeater items          submitButton onClick → navThankYou navigate
```

Note what is *not* wired: the four text inputs' values go nowhere. The inquiry form never persists
anything — the button just navigates. Faithful export preserves exactly that.

### The database stub

`DbCollection2` is out of deterministic scope by design ("generate typed API stubs and defer
implementation"). But the project file knows the collection's schema
(`nodegx.project.json → metadata.dbCollections`), so the stub is *typed*, and the page consumes it
through ordinary React state — no library, no magic:

```ts
// src/api/puppies.ts — generated from the project's Puppy collection schema
export interface Puppy {
  id: string;
  name?: string;
  breed?: string;
  age?: string;
  available?: boolean;
  description?: string;
  photo?: string;
}

/**
 * TODO(export): "Query available puppies" (DbCollection2 `puppyQuery` on /Pages/Landing)
 * fetched the `Puppy` collection from the project's NodeGX backend. Connect this to your
 * own data source; the export report lists every call site.
 */
export async function fetchPuppies(): Promise<Puppy[]> {
  return [];
}
```

### The page

```tsx
// src/pages/Landing.tsx — generated from /Pages/Landing
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { fetchPuppies, type Puppy } from '../api/puppies';
import { PuppyCard } from '../components/PuppyCard';
import styles from './Landing.module.css';

/** Landing page root. */
export function LandingPage() {
  const navigate = useNavigate();
  const [puppies, setPuppies] = useState<Puppy[]>([]);

  useEffect(() => {
    fetchPuppies().then(setPuppies);
  }, []);

  return (
    <div className={styles.page}>
      <title>Puppy Adoption — Landing</title>
      <meta name="description" content="Available puppies for adoption and an inquiry form." />

      <div className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.brandText}>Puppy Adoption</p>
        </div>
      </div>

      <div className={styles.hero}>
        <p className={styles.heroTitle}>Find Your New Best Friend</p>
        <p className={styles.heroLead}>
          Every puppy here is looking for somewhere warm to land. Meet the ones waiting right now,
          and tell us who caught your eye.
        </p>
      </div>

      <div className={styles.puppiesSection}>
        <div className={styles.sectionHead}>
          <p className={styles.puppiesHeading}>Available Puppies</p>
          <p className={styles.puppiesSub}>
            Six little characters, all looking for a sofa of their own.
          </p>
        </div>
        <div className={styles.grid}>
          {puppies.map((puppy) => (
            <PuppyCard
              key={puppy.id}
              photo={puppy.photo}
              name={puppy.name}
              breed={puppy.breed}
              age={puppy.age}
              description={puppy.description}
            />
          ))}
        </div>
      </div>

      <div className={styles.formSection}>
        <div className={styles.formHead}>
          <p className={styles.contactHeading}>Adoption Inquiry</p>
          <p className={styles.contactLead}>
            Tell us a little about you and we'll be in touch within a day or two.
          </p>
        </div>
        <div className={styles.contactSection}>
          <div className={styles.field}>
            <p className={styles.label}>Your name</p>
            <input className={styles.input} />
          </div>
          <div className={styles.field}>
            <p className={styles.label}>Email</p>
            <input className={styles.input} />
          </div>
          <div className={styles.field}>
            <p className={styles.label}>Phone</p>
            <input className={styles.input} />
          </div>
          <div className={styles.field}>
            <p className={styles.label}>Which puppy caught your eye?</p>
            <input className={styles.input} />
          </div>
          <button className={styles.submitButton} onClick={() => navigate('/thank-you')}>
            Send Inquiry
          </button>
        </div>
      </div>

      <div className={styles.footer}>
        <p className={styles.footerText}>Puppy Adoption — every puppy rehomed with care.</p>
      </div>
    </div>
  );
}
```

The CSS module follows the same rules as §1 (not repeated in full). The four `field*` groups and
four inputs have byte-identical style-parameter sets, so they collapse to `.field`, `.label` and
`.input`.

**What this settles.**

- **A `DbCollection2` becomes a typed stub module plus `useState` + `useEffect` at the consuming
  page.** The type comes from the project's collection schema. The stub returns an empty array so
  the export *builds and runs* before the inheritor wires a backend — a project that compiles with
  a visible seam beats one that fails at `npm run build`. Every stub is a line item in EXP-004's
  report.
- **A `For Each` whose mapping script is the default identity `map({...})` literal becomes
  `items.map()`** with per-prop spreading and `key={item.id}`. The mapping script is parsed only
  as far as "is this a static object literal of string→string"; anything else (computed mappings,
  function values) defers that repeater to EXP-003. This is the pattern for every "script-shaped
  parameter that is almost always its default" in the catalog.
- **`RouterNavigate` resolves at generation time to `navigate('/thank-you')`** — the target
  component's `Page` node holds `urlPath: "thank-you"`. The indirection (node → component path →
  page url) is the generator's to erase, and EXP-001 §2's rule holds: a signal whose downstream is
  one side effect is a handler, not a `Signal`.
- **Unwired inputs stay native and uncontrolled.** Nothing reads the inputs' values, so they emit
  as bare `<input>` — no `useState` per field, no `TextInput` wrapper, no fabricated
  onChange. A control earns a wrapper (or state) only when a wire demands it. Exporting the app's
  actual behaviour includes exporting its *gaps*: the report should note "form values are read by
  nothing", because that is true of the graph.
- **A `Page` node contributes three things**: a route entry (§3), and React 19 hoisted
  `<title>`/`<meta>` elements in place of a head-manager dependency. Its `urlPath`/`title`
  parameters never appear as props — they are routing/document concerns, not render concerns.
- **Repeated identical style sets dedupe into one class** (`.field`, `.label`, `.input`),
  named by the ids' longest common suffix when one exists (`nameLabel`/`emailLabel`… → `.label`),
  else the alphabetically first id. Determinism needs a stated tiebreak, so it is stated here.

---

## 3. Scaffolding — tokens, routes, entry point

### Design tokens

`nodegx.project.json → metadata.designTokens.customTokens` becomes the design-system stylesheet,
descriptions preserved as comments, source order preserved:

```css
/* src/styles/tokens.css — generated from the project's design tokens */
:root {
  /* Main brand and action color */
  --primary: #18181b;
  /* Primary color on hover */
  --primary-hover: #27272a;
  /* Supporting action color */
  --secondary: #71717a;
  /* … one line per token, in source order … */
}
```

plus a deliberately minimal base sheet — `box-sizing: border-box` and the app font, nothing else
(element resets live per-class, §1):

```css
/* src/styles/base.css */
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Inter', system-ui, sans-serif;
}
```

Font modules under `noodl_modules/` (this project bundles Inter) export as copied font files plus
`@font-face` rules appended to `base.css`.

### Routes and entry

The project's router (in the `App` component) lists its pages; each page's `Page` node holds its
`urlPath`. Together they are the route table:

```tsx
// src/App.tsx — generated from /App
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AdminPage } from './pages/Admin';
import { AdminLoginPage } from './pages/AdminLogin';
import { HomePage } from './pages/Home';
import { LandingPage } from './pages/Landing';
import { ThankYouPage } from './pages/ThankYou';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/thank-you" element={<ThankYouPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './styles/tokens.css';
import './styles/base.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`package.json` dependencies for this project: `react`, `react-dom`, `react-router-dom` — and
**not** `@nodegx/core`, because nothing imported it. The generator adds the library to
`package.json` only when at least one generated file imports it. Dev dependencies: `vite`,
`@vitejs/plugin-react`, `typescript`. Component file names are the PascalCased component name
(`Thank You` → `ThankYou.tsx`); page components get a `Page` suffix in the exported symbol to keep
`LandingPage` distinct from any `/Components/Landing` a project might also have.

**What this settles.**

- **The token layer survives export as the design system.** Tokens are the project's own names and
  values; exported CSS references them exactly as the graph did. A design change in the exported
  app is still a one-line token edit.
- **Routing is a table derived from two places** (router node's page list, each page's `urlPath`),
  joined at generation time. Unroutable pages — a `Page` component no router lists — export as
  components but get no route, and the report says so.
- **The dependency list is computed from the output, not declared up front.** `@nodegx/core`
  appears exactly when a store/signal/collection/derived crossing forced it to; this project's
  answer is "never".

---

## The full exported tree, for orientation

```
puppy-test-3-export/
├── package.json  vite.config.ts  tsconfig.json  index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── api/puppies.ts            ← typed stub (TODO, in the report)
    ├── components/
    │   ├── PuppyCard.tsx  PuppyCard.module.css
    │   └── …
    ├── pages/
    │   ├── Home.tsx  Landing.tsx  ThankYou.tsx  AdminLogin.tsx  Admin.tsx  (+ .module.css each)
    ├── styles/
    │   ├── tokens.css  base.css
    └── assets/fonts/…            ← from noodl_modules
```

Admin/AdminLogin also exercise the auth-shaped nodes (login, ACL-guarded queries) — all of which
are stub-with-report territory like `DbCollection2`, and none of which change the shapes above.

## What this exercise adds to EXP-001's rules

| Decision | Rule |
|---|---|
| Style extraction | One CSS-module class per visual node; catalog-driven content-vs-style split; semantic tables for `sizeMode`, `clip`, shadows, radii; shorthands when sides agree |
| Naming | Class = camelCased node id, editor dedup suffixes stripped when unambiguous; identical style sets merge (longest common suffix, else first id alphabetically) |
| Tokens | Pass through verbatim; `tokens.css` generated from project metadata, comments preserved |
| DB/cloud nodes | Typed stub modules from the project's collection schemas + plain `useState`/`useEffect` at consumers; every stub reported |
| Repeaters | Default identity `map({...})` literal → `.map()` with `key`; anything cleverer → EXP-003 |
| Navigation | Resolve node → component → `urlPath` at generation time; emit `useNavigate` handlers |
| Controls | Native elements unless a wire demands state or behaviour; no wrappers for unwired inputs |
| Pages | Route entry + React 19 hoisted `<title>`/`<meta>`; no head-manager dependency |
| Dependencies | Computed from generated imports; `@nodegx/core` only when earned |
| Semantic HTML | Not guessed deterministically; `<div>`/`<p>` with authored class names; the semantic-tag channel belongs to EXP-006 (open question recorded there) |

The inheritance test stands as EXP-001 posed it: a React developer who has never heard of NodeGX
reads `PuppyCard.tsx` and `Landing.tsx` and sees an ordinary, slightly conservative React app with
a tidy token sheet and one honest TODO where the backend was. They do.
