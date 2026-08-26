# SB-006 — The public site

**Status: 🟡 BUILT s7 (2026-08-26). Structurally complete and mutation-graded; behaviourally
UNMEASURED.** Five browser components authored through the real MCP door
(`noodl-mcp/tests/sb006Components.ts`), asserted by `noodl-mcp/tests/sb006PublicSite.test.ts` —
**29 specs, 12 mutants graded, 1 known-firing control**. Acceptance 1–8 met; **acceptance 9 is
SB-008's and remains unmet**, which is the point of listing it.

🔴 **Read §4 before reading that green as evidence of anything.** It says what SB-004 §7 had to
learn twice and SB-005 §4 restated: an authoring run says the graph is well-formed and nothing else.

Depends on SB-004 (✅ the classes, the ACL invariant, the four cloud functions) and on SB-005 (✅ the
panel that writes what this reads). Feeds SB-007 (ships as a template) and SB-008 (the drive).

🔴 **This task changed a file SB-005 had already graded.** Four of SB-005's page URL paths moved
under an `admin/` prefix, because §7 F14 measured that a one-segment admin path ties with the public
site's catch-all and the Router breaks the tie by *the order the components were written in*. SB-005's
21 specs still pass; the reason the paths are what they are now lives beside them, on
`ADMIN_PATH_PREFIX`.

## 1. What this is grounded in (measured s7, not assumed)

Each read from the working tree or from a live MCP server built from `src` (the dist on this machine
is stale). The probes were throwaway; the measurements are restated here because the probe is gone.

- **How the Router picks a page.** `matchPageFromUrl` splits the location and each page's pattern on
  `/`, matches segment by segment with `{name}` matching anything (`router.tsx:747-757`), and keeps
  the page with the smallest `|patternParts − pathParts|` — **first one winning a tie**
  (`:775-783`; the guard is `bestMatchLength > dist`, not `>=`). A pattern *shorter* than the path
  still matches, with the remainder handed to a nested router, which is why distance rather than
  match is what separates a catch-all from an exact hit.
- **`pageInfo.path` is the `Page` node's `urlPath` parameter, copied at export.**
  `routerIndex.pages[]` comes from `exportData` (`graphmodel.ts:157`); `render-from-disk.js:283`
  reconstructs it as `{ component, path: p.urlPath, title: p.title }`, which is the shape the
  exporter produces. A `Page` with no `urlPath` gets `path: undefined` and is skipped by URL matching
  entirely — reachable only by `RouterNavigate`.
- ✅ **`Page.title` and `Page.urlPath` are NOT an F10 case.** They are registered on demand by
  `registerInputIfNeeded` (`page.ts:193-210`), and `NodeScope` reaches that hook from the parameter
  path as well as the connection path (`nodescope.ts:203`, SB-005 §1). The editor-only `setup()`
  above them (`:213-215`) only *advertises* the ports to the canvas. Same shape as `CloudFunction2`,
  and checked rather than assumed because it looks exactly like F10 from the outside.
- 🔴 **A visual filter rule may carry a literal `value` instead of an `input`.**
  `visualQueryToNeutral` reads `query.input !== undefined ? parameters[query.input] : query.value`
  (`saved.ts:271`), and `collectFilterParameters` walks only rules that *have* an `input`
  (`queryutils.ts:204-208`) — so a literal rule mints no `qp-` port. Accepted by the write door
  (measured), and it is what makes a derived navigation possible at all. See §2's third query shape.
- **`Query Records` sorts.** `visualSort` is a real parameter (`dbcollectionnode2.ts:1099`), converted
  as `[{property, order}] → ['-name']` (`queryutils.ts:426-430`). It shares the `querySettings` box
  rather than being a value port of its own.
- 🔴 **`isEmpty` is `true` before the first fetch, by its own description**
  (`dbcollectionnode2.ts:410-419`). The output is only flagged from `setCollection`, so a panel wired
  to it is showing "nothing found" from load until the query answers.
- ✅ **A query's own `fetched` is ordering-safe with its own values.** `setCollection` (which flags
  `items`, `isEmpty`, `count`) and `sendSignalOnOutput('fetched')` run in one synchronous block
  (`:891-894`); both reach the receiver through its input queue (`outputproperty.ts:141-168`,
  `:182-210`), and `Node.update` drains one entry per input name per pass (`node.ts:626-656`). So
  SB-005 §7's rule — the hazard is a *producer emitting in two passes*, not signals in general —
  covers this shape, and this site leans on it four times.
- **A code node's globals.** Scripts compile as `new AsyncFunction('Inputs','Outputs','Noodl',
  'Component', …)` (`simplejavascript.ts:613`), so `document` and `window` are the real ones — and
  `Noodl` is `window.Noodl` **or `{}`** (`javascriptnodeparser.js:497-501`). Both need a guard on a
  server render.
- **`Noodl.SEO` has `setTitle` and `setMeta`** (`seo.ts:13`, `:66`), and `Page` forwards its metatag
  props to `setMeta` on every update (`Page.tsx:162-168`). The **title** does not go that way — see
  §7 F16.
- **The token vocabulary.** `get_style_vocabulary` reports 23 `color-semantic` tokens including
  `--primary`, `--background`, `--foreground`; there is **no font-family token** (weights and sizes
  only). SB-005's `buildTokens` writes `{ colorPrimary, colorBackground, colorText, fontFamily }`,
  which is the contract this site reads.
- 🔴 **`For Each` has no channel for a value that is constant across items.** It sets `Id`/`id` from
  the model and every *declared* input from the field of the same name, and nothing else
  (`foreach.tsx:586-597`) — the same limit SB-004 §5 recorded for `Run Tasks`, in the second half of
  the repeater family. This is why the contact form is a sibling of the section list rather than a
  section kind.

## 2. The three query shapes

SB-005 asserted two and pinned them as a pair. This site has a third, and the reason it is a third is
the measurement above about literals.

| shape | example | `runOnChange-*` | why |
|---|---|---|---|
| **port-filtered** | the page with this slug; its sections | **off** | a load-time fetch happens before any `qp-` value exists, and a rule with an undefined value is *dropped*, so the fetch returns every row (SB-004 F12) |
| **literal-filtered** | pages in the navigation | **on** | the literal is on the node from the moment it is built, so the graph-build fetch is already narrowed — and there is no parameter left for anything to trigger |
| **unfiltered** | the `SiteSettings` and `Theme` singletons | **on** | s4's `claimSite` defect: with the boxes off and no filter parameter, nothing ever triggers it |

🔴 **The precondition of SB-004's fix is a filter PORT, not a filter.** That is the sentence the
third shape adds, and it is the sentence a future author will get wrong: "this query is filtered, so
it gets the fix" is how the navigation would end up with no trigger and the site with no nav.

## 3. Surfaces

Five components, one of them a page.

| component | kind | what it owns |
|---|---|---|
| `Pages/Site` | page | the catch-all `{slug}`, the two filtered queries, the theme, the title |
| `Site/Nav` | visual | the derived navigation — the literal-filtered, sorted query |
| `Site/NavLink` | visual | one entry; navigates by **slug**, which is the product |
| `Site/SectionView` | visual | one section, of whichever kind |
| `Site/ContactForm` | visual | the one door a visitor writes through |

**The home page is the catch-all with an empty slug**, not a second page. A `Home` at `''` and a
catch-all at `{slug}` are both one segment and both match the root at distance 0 — the tie F14 is
about, in the one place an author would create it deliberately. `SiteSettings.homeSlug` decides which
record an empty slug means.

**Navigation is derived, never stored** (SB-004 §2): published pages with `showInNav`, ordered by
`navOrder`. There is deliberately **no `published` rule** on that query — `Page.find` is public and
the row-level ACL has already removed every draft, and a second, weaker copy of a permission boundary
is the copy that goes stale. ⚠️ Visible consequence, recorded rather than hidden: a signed-in admin
browsing the public site reads drafts, because that principal may. That is the invariant working.

## 4. What can and cannot be measured without a browser

- ✅ **Authorable and assertable now**: every graph lands; the routing table is unambiguous; the three
  query shapes are what they should be; nothing on the public site writes a record; the theme keys
  and the section fields match the panel's; the title goes through the API that works and not the
  port that does not; every browser global is guarded.
- 🔴 **Not evidence of behaviour.** SB-004 s2 and s3 both produced green authoring runs over graphs
  that published the wrong rows and could not answer a request; SB-005's own near-miss was caught by
  reading a control's source, not by a gate.
- **The behavioural claim belongs to SB-008**, and this task sharpens what it must check: not that
  the site renders, but that **a draft page 404s for an anonymous visitor through this site** while a
  published one renders, with `devOpen: false`.

## 5. Acceptance

1. ✅ All five components authored through the MCP door, the site landing with a `Page` root and
   registering in the panel's router rather than a second one.
2. ✅ **Every page of the template answers on its own URL with nothing tying for it**, checked by
   re-implementing the Router's own rule over the union of SB-005's and SB-006's pages. Plus the two
   URLs no pattern produces: the root and an ordinary content slug. Two mutants — an admin page back
   at one segment, and a second page at the catch-all pattern.
3. ✅ **The public site writes no record.** No `Create`/`Update`/`Delete Record` in any of the five;
   the only door out is `submitContactForm`, which is what `ContactMessage.create: 'nobody'` means.
   One mutant: the `Create Record` an author writes when the form "obviously just needs a row".
4. ✅ **The three query shapes, asserted together** (§2), for the same reason SB-005 asserted its two
   as a pair: applying the port-filtered fix to a query that has no port is a defect this phase has
   now shipped once. Four mutants.
5. ✅ **The two contracts with the panel, checked across the two files that hold them**: the theme
   keys `buildTokens` writes are exactly the keys `applyTheme` reads, and every field a section view
   reads out of `data` is a field `Admin/SectionRow` can write. Two mutants.
6. ✅ **The not-found panel is not wired from `isEmpty`** and its reader abstains until rows arrive.
   Two mutants.
7. ✅ **The document title goes through `Noodl.SEO.setTitle` and the description through the `Page`
   node's port** — and no wire enters `Page.title`. One mutant, and it is the fix that looks right.
8. ✅ **Every browser global a code node touches is guarded**, with a census so "no unguarded
   references" cannot mean "no references". One mutant.
9. ⬜ **UNMET — deferred to SB-008**: an anonymous visitor loads a published page through this site
   and gets a 404-equivalent for an unpublished one, over HTTP with enforcement on. Recorded here so
   it cannot be quietly counted as met by the structural items above. **It is not met by anything in
   this task.**

## 6. What was built (s7)

The graphs live in `noodl-mcp/tests/sb006Components.ts` — **edit them there, never in the spec**, the
same rule SB-004's and SB-005's sets carry and for the same reason: SB-008 has to drive *these*.

The suite authors **both panels into one project**, and the site **first**. Two of its checks are
about the pair and can be made on neither alone (routing, and the two contracts), and the order is
itself a measurement — see F17.

## 7. What building it measured — four findings, three of which changed a graph

**F14 — 🔴 the public site's catch-all ties with every one-segment sibling page, and the Router
breaks the tie by the order the components were written in.** The finding that changed SB-005.

A site builder's whole point is that `/about` is a record, so the public site is one page component
at `{slug}`. `{slug}` matches `/admin` at distance 0, and so does a page whose `urlPath` is `admin`.
`router.tsx:775-783` keeps the first page in the Router's `pages.routes` list on a tie, and that list
is the order the door registered them, which is the order an agent happened to write them. So
`/admin` resolving to the admin panel rather than to a content page called "Admin" was luck.

Two segments removes the tie rather than relying on it: `{slug}` still matches `/admin/pages`, but at
distance 1, and distance is read before order. SB-005's four page paths are now `admin/pages`,
`admin/setup`, `admin/theme` and `admin/page/{pageId}`; `ADMIN_PATH_PREFIX` records why. The
assertion re-implements the Router's rule over the union of both panels' pages, and the mutant that
grades it is the previous state of the file.

⚠️ **The second half is worse than the first and does not go away.** A client creating a page whose
slug is `admin` still cannot reach it — `/admin` is one segment, and now nothing else claims it, so
it works; but a client creating pages that collide with a *future* admin path would. The structural
fix is the one taken (nothing on the admin side is one segment); a slug denylist in the panel is not,
and is not needed while the prefix holds.

**F15 — 🔴 a component instance has only the ports its `Component Inputs` node declares.** Caught by
the door, and it had already changed the graph before the graph was written.

`{ id: 'contact', type: '/Site/ContactForm', parameters: { visible: false } }` was refused:
`instance-unknown-parameter`, blocking — *"A component instance has only the ports its Component
Inputs node declares — it carries no layout, style or lifecycle ports of its own … The value is
discarded."* So an instance cannot be shown or hidden, positioned or styled from outside; conditional
placement needs a wrapper `Group`. Recorded rather than filed: the door names the defect, names the
available ports, and refuses the write. This is the door working.

Two more the same run raised, both blocking, both worth carrying:

- **`inert-dimension`** — `objectFit` is read only when `sizeMode: 'explicit'`, so an `Image` that
  sizes to its content silently ignores it.
- 🔴 **`unitless-dimension`** — a bare number on a dimension port is read as a **percentage**.
  `maxWidth: 960` is `960%`. The suggestion carries both unit forms verbatim.

**F16 — 🔴 a `Page` node's `title` port is dead after export, and its `description` port is not.**
The two look identical from the outside and only one of them works, on the one template whose product
is SEO.

`Page.title` is a real input: `registerInputIfNeeded` handles it (`page.ts:201-205`) and the value
lands in `_internal.title`. Nothing reads it afterwards. The Router sets the document title from
`routerIndex.pages[].title` (`router.tsx:584`), which the exporter copies out of the **parameter** at
build time — so a records-driven site has one static title for every page. `description` and the rest
of the metatags are different: `Page` forwards them to `Noodl.SEO.setMeta` on every update
(`Page.tsx:162-168`).

The fix is a code node calling `Noodl.SEO.setTitle`, guarded because `createNoodlAPI` returns `{}`
when there is no `window.Noodl` (`javascriptnodeparser.js:497-501`). Both halves are asserted, and
the mutant is the wire into `Page.title` — the fix that looks right, that the door accepts, and that
does nothing.

**F17 — ⚠️ the door makes the first page it writes the router's start page, so a template's
authoring order decides where its app opens.** Authoring the panel before the site left
`startPage: '/Pages/PageEditor'` — `admin/page/{pageId}`, an editor for no record.

It is nearly harmless here, because a catch-all means the URL always matches and the Router only
falls back to `startPage` when nothing did (`router.tsx:466`) — but "nearly" is the wrong safety
margin for the page an app opens on. The site is authored first, and the spec asserts the **property**
rather than the order: the start page and the page the root URL resolves to are the same one.

**⚠️ Two things measured and left alone, recorded so they are not re-measured:**

- **SB-005's theme editor does not wipe the tokens an author did not touch.** It looked like it
  might: `buildTokens` reads four text inputs and writes all four keys, so editing only the primary
  colour would blank the other three — *if* those inputs never emitted. They do:
  `startValue` → `setText` → `onTextChanged` on both the mounted and unmounted paths
  (`text-input.ts:171`, `:341-355`). Checked rather than reported.
- **Rule 4 (`points to` widens instead of failing) is still UNMEASURED in the browser.** Nothing here
  filters on a Pointer either. Do not record it as answered.

**🧭 One gap that is a ruling, not a defect: `Section.kind` has five values and `data` can express
four of them.** `cta` renders as an emphasised block of copy because nothing in `data` is a
destination and no control in the panel would write one. Either the panel drops `cta` from its
dropdown (a one-line change to `kindItems` and to SB-004 §2's vocabulary) or `data` grows a
`linkSlug`/`linkLabel` pair and `Admin/SectionRow` grows two fields. Both are small; picking is
Richard's, because the second changes SB-004's class model. Until then a `cta` section is a
`richText` section in bold, which is a thin outcome rather than a broken one.

**⚠️ And one thing SB-008 and SB-007 both need to know: SSG cannot pre-render this site.**
`routesFromExport` enumerates `routerIndex.pages` and **reports and skips dynamic `{param}` routes**
(RUN-002 slice 5) — so of this template's five pages, SSG would build the three literal admin paths
and skip the two that matter, including the entire public site. The public surface falls back to
client-side rendering, which is the rendering mode an SEO-shaped template is sold against. Not
SB-006's to fix (it needs data-driven route enumeration, RUN-002's recorded residual), but it is a
claim the template must not make.

## 8. Session log

- **s7 (2026-08-26)** — **BUILT.** Five components through `create_component` plus one
  `update_component` closing SB-012's cycle a second, independent time; 29 specs, 12 mutants, one
  known-firing control. Nine mechanisms measured before anything was authored (§1); four of them
  changed a graph and one of them changed SB-005's. Acceptance 1–8 met; **9 left explicitly unmet**
  and named as SB-008's.
