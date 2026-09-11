/**
 * SUB-006 — Semantic Validator: Diagnostic model
 *
 * Diagnostics are *data*, not strings. Every rule emits `Diagnostic` objects;
 * formatting (human-readable text, JSON) happens at the edge so the same objects
 * drive the CLI, the MCP server, and the editor's problems panel.
 *
 * The message contract matters as much as the location: a diagnostic must be
 * actionable by an AI with no other context. Where a fix is knowable we attach a
 * `suggestion` (e.g. "did you mean `Group`?") and, for port/type problems, the
 * list of valid alternatives — so the model's next attempt is informed by the
 * error alone (see SUB-006 success criteria).
 *
 * @module noodl-editor/validation/diagnostics
 */

// ─── Severity ───────────────────────────────────────────────────────────────

/**
 * Diagnostic severity.
 *
 * - `error`   — the project is definitely wrong: a static port that does not
 *               exist, a connection to a missing node, a broken parent link.
 *               CI fails on these; the CLI exits non-zero.
 * - `warning` — probably wrong, but not provably so from the catalog alone. An
 *               unknown node type is a warning by default because real projects
 *               legitimately use module-provided or version-specific nodes the
 *               catalog cannot enumerate; erroring on those would "cry wolf".
 *               `--strict` promotes warnings to errors for greenfield projects.
 * - `info`    — a note, never a failure: e.g. a port skipped because the node
 *               creates it at runtime. Surfaced so the user knows a check was
 *               deliberately *not* performed, rather than silently passing.
 */
export type Severity = 'error' | 'warning' | 'info';

export const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warning: 1,
  info: 2
};

// ─── Diagnostic codes ─────────────────────────────────────────────────────────

/**
 * Stable machine-readable codes, one per rule. Consumers (CI, MCP, editor)
 * should switch on these rather than parsing messages.
 */
export enum DiagnosticCode {
  /** Two nodes share one id — the substrate's primary key is not unique. */
  DuplicateNodeId = 'duplicate-node-id',
  /**
   * FIX-023: a node object in the graph is missing a field the format requires
   * of every node — currently `type`.
   *
   * This is not "we don't recognise the type" (that is `unknown-node-type`, a
   * warning, and correctly so). It is that the field is *absent*, so there is
   * nothing to recognise. Before this code existed such a node reached
   * `isComponentRef(node.type)` as `undefined` and threw
   * `Cannot read properties of undefined (reading 'startsWith')` out of the
   * walk — which the MCP server surfaced as `io-error: Unexpected failure: …`,
   * naming neither the node nor the component. One malformed node in one
   * component took down every write and every validation for the whole project,
   * with nothing in the message to search for.
   *
   * `error` severity: unlike an unknown type, there is no benign reading. A node
   * with no type cannot mount, render, or be checked, and no module can supply
   * one later.
   */
  MalformedNode = 'malformed-node',
  UnknownNodeType = 'unknown-node-type',
  NonexistentPort = 'nonexistent-port',
  DanglingConnection = 'dangling-connection',
  UnresolvedComponentRef = 'unresolved-component-ref',
  OrphanedNode = 'orphaned-node',
  /**
   * A page component's content is parented to a second visual root beside the
   * `Page` node rather than inside it, so the page renders blank.
   */
  DetachedPageContent = 'detached-page-content',
  TypeIncompatibleConnection = 'type-incompatible-connection',
  /**
   * NDA-017: a control signal fires without waiting for the asynchronous producer of a value
   * it reads, so the node evaluates against whatever arrived last.
   */
  SignalDrivenStaleInput = 'signal-driven-stale-input',
  /**
   * ERG-001: an action that is invoked, and whose chain visibly continues from some other
   * signal, reports its `Done`/`Unchanged`/`Failure`/`Completed` outcome nowhere — so the
   * chain runs on some paths through the node and stops dead on others.
   */
  UnwiredOutcome = 'unwired-outcome',
  /** Info-level: a port check was skipped because the node determines the port at runtime. */
  DynamicPortSkipped = 'dynamic-port-skipped',
  /**
   * CN-002. Info-level: a check did **not run** on a node because the node's
   * type could not be resolved against the catalog.
   *
   * `unknown-node-type` reports that we do not recognise the type, and that is
   * correctly a warning — real projects legitimately use module-provided nodes
   * the catalog cannot enumerate (see `Severity` above). What it does not say,
   * and what this code exists to say, is that **every downstream check was then
   * skipped**: `checkParameterValues` returns on its first line for such a
   * node, and `nonexistentPort` / `typeIncompatibleConnection` skip its
   * connection endpoints. Measured on `cashflow-command-centre`: five kit nodes
   * carrying 26 parameters verified by nothing, and 10 of the project's 28
   * connection endpoints never reached — reported as
   * `0 error(s), 5 warning(s), 0 info`.
   *
   * A skip reported as a pass is the failure mode this repo tracks as *a probe
   * that silently exonerates*. `info` is the severity the model already
   * reserves for it — "surfaced so the user knows a check was deliberately
   * *not* performed, rather than silently passing" — and nobody had wired this
   * case to it.
   *
   * One diagnostic per **(node, check)** pair, deliberately not per project and
   * not per endpoint: the point is that a reader can see *which* nodes are
   * unverified and *what* went unchecked on each.
   *
   * ⚠️ These are an instrument as much as a message. When CN-003's project
   * catalog overlay lands, the count of these for a kit project should go to
   * **zero**, and that is a far better acceptance signal than "validation seems
   * to work now" — it is a number, taken before and after, of something that
   * was previously invisible. Do not collapse or suppress them without
   * replacing that measurement.
   */
  UnknownTypeCheckSkipped = 'unknown-type-check-skipped',
  /**
   * AIB-001: a parameter carries a value of a shape the port's type cannot
   * consume — an array where the wire format is a comma-separated string, a
   * number where the port wants `{ value, unit }`, an enum value that is not
   * one of the declared options.
   */
  InvalidParameterValue = 'invalid-parameter-value',
  /**
   * AIB-001: a parameter names a port the node type does not declare. A
   * warning, never an error — a node whose ports are runtime-determined
   * legitimately carries parameters for ports the catalog cannot see, and this
   * rule skips those entirely (see `checkParameterValues`).
   */
  UnknownParameter = 'unknown-parameter',
  /**
   * A parameter sets a port that *exists* but is currently switched off by a
   * sibling parameter's value — the port's `condition` in `declaredPortGroups`
   * is not satisfied, so the runtime never reads it.
   *
   * Its own code because, like `ConnectionOnlyParameter`, it is invisible to
   * every neighbouring check: the port is genuinely declared, so
   * `UnknownParameter` cannot see it, and the value is perfectly well-formed for
   * its type, so `InvalidParameterValue` cannot either. The canonical case is
   * `Image`: `defaultSizeMode` is `contentSize`, and `objectFit` is declared
   * `condition: 'sizeMode = explicit'`. An agent writes `width`, `height` and
   * `objectFit: 'cover'` — the three things that crop a photo — and gets none of
   * them, rendering the image at its natural size. That produced the 800px-tall
   * photos that wrecked an authored page while validation reported zero problems.
   *
   * A warning, not an error: the dependency is real but the repair is a
   * *sibling* edit (set `sizeMode`), and the condition language admits forms
   * this rule deliberately declines to judge (see `conditionIsUnsatisfied`).
   * Only an unambiguously unsatisfied condition is reported.
   */
  InactiveConditionalParameter = 'inactive-conditional-parameter',
  /**
   * A parameter sets a port the catalog marks `allowConnectionsOnly` — a port
   * that only ever takes a wired connection and silently discards a statically
   * authored value.
   *
   * Always an **error**, and the reason it needs a code of its own is that it is
   * invisible to every check around it: the port genuinely exists, so
   * `UnknownParameter` cannot see it, and the value is a perfectly well-formed
   * string, so `InvalidParameterValue` cannot either. The canonical case is
   * `variant` on Text/Group/Button. An agent told to style "on-system" writes
   * `variant: "heading-1"` and nothing else — no `fontSize`, no `color` — and
   * every word on the page then renders at browser default with no diagnostic
   * anywhere. A statically-set variant must be expanded into the concrete token
   * parameters it implies.
   */
  ConnectionOnlyParameter = 'connection-only-parameter',
  /**
   * Three or more structurally identical sibling subtrees — a component that
   * was written out by hand instead of being made once and instantiated.
   *
   * The decomposition doctrine has said this in prose to both clients since
   * AAQ-008, and prose alone did not hold: the reference build that produced
   * this rule reached a 66-node page carrying three hand-duplicated trust items,
   * three section heads and three category cards. A doctrine with no check
   * behind it is advice, and advice is what gets skipped under pressure.
   *
   * Matched on STRUCTURE (types and arrangement), never on parameter values —
   * instances are supposed to differ in their values, so comparing them would
   * fire only on literal copy-paste and miss the case worth reporting. A
   * warning, always: the graph renders correctly and the repair is a refactor.
   */
  RepeatedSiblingSubtree = 'repeated-sibling-subtree',
  /**
   * DEF-025 (P78 D37) — the words beside a toggle control are a `Text` node,
   * so tapping them does nothing.
   *
   * `Checkbox` and `Radio Button` render a `<label for>` — a real click
   * target — only from their own `label` port, and `useLabel` defaults
   * **off**. So the obvious way to build a labelled checkbox, a `Text` beside
   * it in a row, produces a control whose sentence is inert and whose only hit
   * area is the box itself: 24×24 px, exactly WCAG 2.2 SC 2.5.8's minimum and
   * no more. Measured on the members-area account page (D37): the page's
   * entire product was one decision, and on a phone the whole of it was a
   * 24 px square. It fails silently — the graph looks right, the screen looks
   * right, and no spec that asserts the text is on the page can see it.
   *
   * Deliberately the TOGGLE pair only, never `Text Input` or `Options`: their
   * doctrinal shape is a separate `fieldLabel` Text above the control (the
   * `field` composition), label-click there is a focus nicety rather than the
   * primary interaction, and a rule that fires on the design system's own
   * recommended pattern teaches an agent to distrust the whole diagnostic set.
   *
   * A warning, not authored-blocking: promotion is a decision that gets made
   * against corpus evidence, per the `unsized-absolute-box` precedent.
   */
  LabelNotAClickTarget = 'label-not-a-click-target',
  /**
   * LAS-003/F7 — a `position: absolute` box with neither `width` nor `height`,
   * carrying decoration (background, border, radius, shadow).
   *
   * `width` and `height` are `dimension` ports whose default is **`100` with a
   * `defaultUnit` of `%`**, so an unsized absolute box is 100% × 100% of its
   * parent. Sonnet's cold replay authored a badge pill this way: a
   * `--primary`-filled ellipse stretched over four of six product photos, and
   * the basket count spread across the full navbar. The graph was perfect.
   *
   * ⚠️ **The decoration half of the predicate is not incidental** — it is the
   * whole calibration. Unsized-absolute alone hits 151 nodes across the corpus,
   * because a full-bleed absolute box IS the overlay/scrim pattern and 122 of
   * those are legitimate. Requiring decoration narrows it to 29, of which 21
   * are editor test fixtures: what is left is sonnet's badge, the
   * ecommerce-example card, and a handful of prefabs. A rule is only as good as
   * its false-positive rate.
   *
   * A warning, not authored-blocking, and deliberately so: `popup-modal` in the
   * shipped prefab library is a decorated full-bleed scrim, which is exactly
   * this shape authored on purpose. Promotion is LAS-004's kind of decision and
   * gets made with its own evidence, not folded in here.
   */
  UnsizedAbsoluteBox = 'unsized-absolute-box',
  /**
   * LAS-003 — a raw colour literal on a colour-typed port where the project's
   * design tokens are what the system expects.
   *
   * The MCP server instructions have said "set colour params as `var(--token)`,
   * never raw hex" since AAQ-005, and until now nothing checked it — prose with
   * no gate behind it, which the phase-54 audit showed is prose that gets
   * dropped. A page whose colours are literals cannot be re-themed, and drifts
   * from the identity the project decided once.
   *
   * A warning everywhere rather than an error, because the corpus carries 553
   * of them: legacy and imported projects are full of hex by construction and
   * are not wrong, they are just not tokenised. Warnings do not block
   * `validate:project`, so this reports the truth about that content without
   * failing it.
   */
  RawColorLiteral = 'raw-color-literal',
  /**
   * VIB-007 / register V28 — a spacing port written as a raw pixel value where a `--space` token
   * carries exactly that number. The other half of the doctrine's *"never emit a raw hex or px when
   * a token fits"*, which until now was enforced only for colour.
   *
   * 🔴 **Narrowed twice, and both narrowings came from a measurement rather than from taste.**
   * `Columns`' `marginX`/`marginY` are excluded because the runtime's own note says autofold needs a
   * number and a tokenised gutter folds as though it were 0 — the 15 corpus values that look most
   * like this defect are all correct. And the rule fires only when a token matches the value
   * exactly, so its advice is always a token that exists; `paddingTop: 13` is a different finding.
   *
   * A warning, like its colour twin and for the same reason: imported and legacy content is
   * untokenised rather than wrong.
   */
  RawSpacingLiteral = 'raw-spacing-literal',
  /**
   * VIB-007 / register V33 — an image-typed input set to the empty string with no connection
   * feeding it: a picture with no source, which draws nothing.
   *
   * 🔴 **The connection list is the predicate.** `ui-card-grid-repeater` ships `"src": ""` on a
   * repeater's card and is *correct* — `card_inputs.image` is wired into it and fills it per row.
   * `ui-image-scrim-band` shipped `"backgroundImage": ""` with nothing wired and was the recipe
   * named for its image. Two identical empty strings, opposite verdicts.
   *
   * A warning rather than an error, and deliberately: an agent that places an Image in one call
   * and wires it in the next is momentarily in this state and should not be refused. It is
   * nonetheless fatal in `catalog:examples`, which runs warnings-as-errors — and that is the gate
   * V33 actually walked through. ⚠️ Whether the poverty family should ever refuse is register V42
   * and is not decided here.
   */
  UnsourcedImage = 'unsourced-image',
  /**
   * VIB-007 / register V29 — a shell declaring a `maxWidth` that none of its children can draw to,
   * because every one of them carries a narrower cap of its own.
   *
   * 🔴 **The row this comes from names a shape with 13 corpus instances, of which ONE is the
   * defect.** Richard ruled against white space landing on one side (*"to the left and right
   * equally… not just on one side, that's weird"*), and `vib007-v29.look.ts` rendered all 13: twelve
   * sit in a band measuring 374 left / 374 right, and three of those twelve are on the page he
   * ruled *"fucking pro"*. Only `ui-image-scrim-band` renders 374 / 766. A cap on body copy is
   * correct typography; a shell whose measure nothing realises is the finding.
   *
   * A warning, like the rest of the poverty family: content narrower than its shell is a judgement
   * an author may have made deliberately, and `alignItems: center` is the one-word answer when they
   * have. ⚠️ Whether this family should ever refuse is register V42.
   */
  UnrealisedMeasure = 'unrealised-measure',
  /**
   * REL-002a (phase 82; carried from P81's register) — a routed page in a project that has **not
   * decided about `bodyScroll`**, which means the app cannot scroll and everything below the fold
   * is out of reach.
   *
   * 🔴 **This is a reachability defect, not a look one.** When `settings.bodyScroll` is falsy the
   * viewer wraps the whole app in a `width/height: 100%` div at `overflow: clip`
   * (`noodl-viewer-react/src/viewer.jsx`, the else-branch of `render`; its own comment reads
   * *"this div is pinned to the viewport and routinely holds taller content"*). `clip` creates no
   * scroll container at all — by design, NDA-008 — so neither the user nor the browser can reach
   * what is below it.
   *
   * Measured on `templates/members-area` at HEAD, varying the setting and nothing else. The
   * numbers are controls a user can actually click, counted by walking the page and hit-testing:
   *
   * ```
   *                988x313   1280x900   390x844
   *   /setup        0 / 7      4 / 7      3 / 7     unset  — the submit button unreachable at all three
   *   /join         0 / 6      5 / 6      6 / 6     unset
   *   /setup        7 / 7      7 / 7      7 / 7     bodyScroll: true
   *   /join         6 / 6      6 / 6      6 / 6     bodyScroll: true
   * ```
   *
   * 🔴 **No node parameter substitutes for the setting.** Measured one at a time on the product's
   * own host CSS, on a 20-row page: `scrollEnabled: true` on the page's root Group leaves the last
   * row unreachable (the Group grows to its content, so it has nothing to scroll, and the clip is
   * two ancestors above it); so does `sizeMode: contentHeight`; so does `clip: true` or its
   * absence. Only the project setting changes the answer.
   *
   * ✅ **Firing on "unset" rather than on "false" is the whole point, and the corpus says so.**
   * Over 187 projects (both corpora, 143 of them carrying a `Page`): **76 set `bodyScroll: true`,
   * 67 leave it unset, and NOT ONE sets it to `false`.** Nobody has ever chosen a fixed viewport;
   * the unset state is an author who never met the setting, which is why it is worth a sentence at
   * the door. A project that has genuinely decided — either way — is silent.
   *
   * A warning rather than an error, on this file's standing convention: promotion into
   * `AUTHORED_BLOCKING_WARNINGS` is earned on evidence of firing correctly against authored
   * output, and 67 hand-authored corpus projects would go red the day it refused.
   */
  PageCannotScroll = 'page-cannot-scroll',
  /**
   * A bare number on a units-typed port that is read as a **percentage** —
   * `width`, `height`, `maxWidth`, `minWidth`. `{ value, unit }` is the form
   * real content uses: across the whole repository these ports are written in
   * object form 3,589 times and as a bare number **zero** times, while bare
   * numbers on `px`-defaulting ports (`borderRadius`, `fontSize`) are common and
   * harmless. So the rule keys on the unit the port defaults to, not on the
   * value's shape.
   *
   * A warning rather than an error, because a bare number is genuinely legal —
   * `setInputValue` merges it into the port's current unit. It is nonetheless
   * blocking for *authored* output, where `width: 228` meaning 228px produced an
   * image 228% wide.
   *
   * ⚠️ FLD-004 (#26) checked that justification rather than inheriting it, and it
   * holds — but for a narrower reason than it reads. The merge is gated on
   * `_inputValues[name].unit`, and only `nodedefinition.ts`'s
   * `initializeDefaultValues` ever wrote that key: `Node.registerInput` seeded a
   * units port under `type` instead, so the merge was dead for every
   * DYNAMICALLY registered units port from the initial commit until FLD-004 (c)
   * corrected the key. The reason nobody ever hit it is that there are no such
   * ports — **272 distinct dynamic registrations measured across the runtime
   * suite, the viewer suite and a 20-project render corpus, and not one carries
   * a units type**; all 110 `units:` declarations in the shipped library sit in
   * static `inputs`/`inputCss` blocks, which never reach `registerInput` at all.
   * So this sentence was true of everything that exists, and is now true by
   * construction.
   *
   * 🔴 What it does NOT cover is the axis. A bare number on a dimension port
   * that lies along the parent's main axis merges correctly into `%` and is
   * then turned into `flexGrow` by `layout.ts` — arriving, and moving nothing.
   * That is {@link WiredDimensionBecomesGrow}, which is a different sentence
   * about the same value.
   */
  UnitlessDimension = 'unitless-dimension',
  /**
   * LIB-006: a legacy import could not convert this construct and left it in
   * place, marked. Always an error — see `rules/legacyImportPlaceholder.ts` for
   * why this is not folded into `unknown-node-type`.
   */
  LegacyImportPlaceholder = 'legacy-import-placeholder',
  /**
   * AIB-007: a node reads or writes on the project's backend, and the project
   * has none. Error when the scope explicitly agreed there is no backend,
   * warning otherwise — see `backendRequirement.ts`, which also explains why
   * this is a precondition check rather than a catalog fact.
   */
  MissingBackend = 'missing-backend',
  /**
   * AAQ-001: a navigation that lands nowhere — a Navigate node with no target,
   * or one naming a component this project does not have.
   *
   * A warning project-wide (a component library can legitimately carry a
   * Navigate aimed at a page the *host* project supplies) and blocking for
   * authored output, where every name the agent used came from an overview it
   * was given moments earlier. The mechanism it closes: the AI stack had never
   * heard of the Router, so it aimed navigation at URL paths it invented —
   * *"'navigate to path' /puppies but there is no such page"* — and nothing
   * anywhere checked that a navigation target resolved.
   */
  UnresolvedNavigation = 'unresolved-navigation',

  /**
   * A component the project will route as a page, with no `Page` node in it.
   *
   * Found by driving the launcher end to end, and it is the reason AAQ-001's
   * criterion 5 could not pass: registration worked perfectly and the app still
   * rendered **nothing**. Listing a component in a Router's `pages.routes` does
   * not make it a page. The runtime's page index is built exclusively from
   * `Page` nodes (`exporter/router.ts::_getPageInfo`), `getPagesForRouter`
   * drops every route it cannot resolve to one, and the Router then has no start
   * page to mount. Blank screen, no error, and a panel that truthfully reports
   * "The app opens on Puppies".
   *
   * Nothing said this: the authoring prompt mentioned the `Page` node only as
   * where `urlPath` lives, and `stagedComponentIsPage` treats a `/Pages/…` name
   * as sufficient — which is right for deciding what to *register* and was never
   * a statement about what renders.
   *
   * Blocking for authored output. Over the 96-project corpus it fires 6 times,
   * all inside two synthetic node-id fixtures and none in a real project.
   */
  PageWithoutPageNode = 'page-without-page-node',

  /**
   * A declared instance port with no `plug`, which makes it **inert**.
   *
   * `NodeGraphNode.getPorts(filter)` selects on `p.plug && p.plug.indexOf(filter)
   * !== -1`, and a component's interface is derived from `getPorts('input')` /
   * `getPorts('output')` on the nodes with `haveComponentPorts` (`componentmodel`).
   * So a `Component Inputs` node carrying `ports: [{ name: 'Title' }]` lands in
   * neither map: the port is written, the file validates, the canvas shows
   * nothing, and the component silently has no such input. The agent believes it
   * built a component interface and built nothing.
   *
   * Found by converging the two authoring vocabularies (AAQ-005). MCP's port
   * schema was `{ name }` with `.passthrough()`, so an external agent was never
   * told `plug` existed; the editor's schema declared it required, but that schema
   * is instruction only — `toSubmitPayload` casts unchecked — and no rule checked
   * it on either door.
   *
   * Error severity, and safe at that: across all three populations this gate sees
   * — the 96-project corpus (1483 declared instance ports, **1483 with a plug**),
   * the 15 AI spec files, and `noodl-mcp`'s fixtures — it fires zero times. A
   * plug-less instance port is not a thing anyone has ever meant to write.
   */
  PortWithoutPlug = 'port-without-plug',

  /**
   * LAS-001 — a parameter set on a component-instance node that names no input
   * of the target component.
   *
   * A component instance carries **only** the ports its `Component Inputs` node
   * declares. It has no layout, style or lifecycle ports of its own —
   * `ComponentInstanceNode` extends `Node`, not a visual node, and
   * `componentmodel.getPorts()` is the whole of its port list — so `width` on a
   * card instance is discarded exactly as a misspelled input name is. Sonnet's
   * cold replay set `width`/`minWidth` on three category-card instances and got
   * neither.
   *
   * `checkParameterValues` cannot see any of this: its first line returns for a
   * node whose type is not in the catalog, and a component reference never is.
   *
   * A warning, on the `UnknownParameter` precedent and for the same reason —
   * the corpus carries 58 of them in one real merge fixture, an app whose
   * components were renamed out from under their instances. Blocking for
   * *authored* output, where every name the agent used came from a component it
   * wrote minutes earlier.
   */
  InstanceUnknownParameter = 'instance-unknown-parameter',
  /**
   * LAS-001 — instances of a component that declares no inputs at all, carrying
   * parameters. The whole audit finding F2, and the single gap between "haiku
   * got the architecture right" and "the page renders".
   *
   * Haiku's replay instantiated `ProductCard` four times with `image`, `name`,
   * `description`, `price`, `originalPrice`, `badge` per instance, and
   * `ProductCard` exposed no `Component Inputs` — it had declared those six
   * ports on the card's root `Group`, where they are ordinary instance ports and
   * never become an interface. Four identical cards of the literal word "Text",
   * under a clean validation report.
   *
   * One diagnostic per target component rather than one per parameter per
   * instance: the repair is a single edit to a single component, and 30
   * rejections for it is a repair round spent reading. The message carries the
   * parameter names — which are exactly the interface the component should have
   * had — plus, where it can tell, *why* the interface looks empty: the ports
   * were declared on the wrong node, or with the wrong plug.
   *
   * Warning severity, and blocking for authored output. Across both corpora it
   * fires **twice**, both in haiku's replay: cleaner than `PageWithoutPageNode`
   * was when it was promoted.
   */
  InterfacelessInstance = 'interfaceless-instance',
  /**
   * LAS-001 — a component-interface port declared in the wrong direction.
   *
   * `componentmodel.getPorts()` reads `getPorts('output')` on the nodes carrying
   * `haveComponentPorts` and republishes those as the component's **inputs**, so
   * a port on a `Component Inputs` node must be plugged `"output"`. Plugged
   * `"input"` it becomes a component output instead: no instance can set it, and
   * every connection drawn out of it names an endpoint `getPorts('output')` does
   * not return, which the exporter drops as unhealthy.
   *
   * Found while calibrating {@link InterfacelessInstance}, in the last place
   * anyone would look for it: `ecommerce-example`, phase 54's reference build
   * and the prettiest page this project has produced, declares all eleven of
   * `ProductCard`'s inputs `plug: "input"`. It renders in
   * `scripts/devtools/render-from-disk.js` only because that harness rewrites
   * every Component Inputs port before handing the project to the viewer.
   *
   * Nothing reported it. `PortWithoutPlug` asks whether a port has a direction;
   * nothing asked whether it has the right one, and `nonexistentPort` accepts
   * any name present in `instancePorts`, which are collected plug-blind.
   *
   * Warning severity, blocking for authored output. 22 corpus hits, all of them
   * that one component and its copy.
   */
  ComponentPortDirection = 'component-port-direction',
  /**
   * VIB-007 / register V22 — a component-interface port that is WIRED but never
   * DECLARED.
   *
   * The third member of the family, and the one that had 15 corpus hits while
   * the other two had none left. `PortWithoutPlug` asks whether a port has a
   * direction; {@link ComponentPortDirection} asks whether it has the right one;
   * this asks whether the port **exists at all**. A `Component Inputs` node with
   * no `ports` array and a connection drawn out of `row_inputs.title` names an
   * endpoint that `componentmodel.getPorts()` cannot return, so the component
   * has no input called `title` and nothing can ever set it.
   *
   * 🔴 **Ruled by a render, 2026-08-31, not by reading the source**
   * (`packages/nodegx-backend/tests/vib007-v22.look.ts`). Two components
   * identical but for the `ports` array, each drawn by a `For Each` over three
   * records, on one page: the declared arm rendered its three records' values,
   * the undeclared arm rendered its own placeholder three times. The repeater
   * still creates the right NUMBER of instances, which is what makes this
   * survivable-looking — the page keeps its shape and loses its content.
   *
   * That mattered because all 15 hits are repeater item components, and the open
   * question was whether a `For Each` feeds item properties in by another route.
   * It does not: `foreach.tsx:595` iterates `itemNode._inputs`, the *declared*
   * inputs, so an undeclared port is never even offered the value.
   *
   * Error severity: unlike the other two this has no reading under which the
   * graph works, and `catalog:examples` ran all 15 of them 67/67 strict.
   */
  UndeclaredComponentPort = 'undeclared-component-port',
  /**
   * LAS-004 — a page component whose own graph is large enough that it has
   * almost certainly inlined sections that wanted to be components.
   *
   * **Info, and it never blocks.** `repeated-sibling-subtree` catches a page
   * that duplicated a subtree; this catches the more common shape of the same
   * mistake — a page written top to bottom, which is the order a model naturally
   * works in. The audit showed cold models already decompose once the doctrine
   * reaches them (both replay Homes: 7 and 8 nodes), so this is a backstop
   * against the 66-node regression, not pressure toward over-factoring.
   *
   * The threshold is the corpus's, not the doctrine's ~25 — see
   * `rules/oversizedPage.ts` for the census and why 25 would have nagged a
   * legitimately dense login form.
   */
  OversizedPage = 'oversized-page',
  /**
   * LAS-012 — a `For Each` that names no template component, so it instantiates
   * nothing and the list is simply absent from the page.
   *
   * `template` is a `component`-typed input, active whenever `templateType` is
   * `explicit` or unset (`foreach.tsx`'s `dynamicports` condition, and
   * `getTemplateForModel` reads `internal.template` on exactly that branch).
   * Without it the node raises `repeater/no-template` at runtime — *"The
   * Repeater has no Template, so there is nothing to build each item from"* —
   * and nothing before runtime says so.
   *
   * **Error.** Not a style opinion and not a near-miss: the node cannot render,
   * measured. Haiku's session-6 replay is architecturally correct on every axis
   * the phase measures and its page draws a header, a hero, an info strip and
   * then nothing — `render:report` counts **0 images** on a page whose three
   * repeaters all carry product photography. `validate:project` said
   * `0 error(s)`, `render_report` said `0 errors`, and a node census said
   * `For Each: 3`.
   *
   * Corpus (`measurements/scan-repeaters.js`, 2026-08-08): 89 repeaters across
   * 122 projects, **8** without a template — 3 haiku's, 5 in hand-built QA
   * fixtures — and **0** of the 12 in the recipe library. No legitimate
   * population, so no `UnknownParameter`-shaped argument for a warning.
   */
  RepeaterWithoutTemplate = 'repeater-without-template',
  /**
   * LAS-012 — a `For Each` whose `template` names no component in the project.
   *
   * The same class as {@link UnresolvedComponentRef} and the same fix shape,
   * but that rule reads node *types* and a template is a parameter value, which
   * is why it needs its own code and its own check. At runtime this settles
   * `repeater/template-component-not-found` per item; before runtime, nothing.
   *
   * Warning, blocking for authored output — 2 corpus hits, both in one legacy
   * merge fixture whose components were moved under `/Old/`, which is a real
   * population of the `InstanceUnknownParameter` shape. `./` and `../` prefixes
   * are resolved against the owning component at runtime and are not checked.
   */
  RepeaterTemplateUnresolved = 'repeater-template-unresolved',
  /**
   * LAS-012 — item content nested **under** a `For Each` instead of named on its
   * `template` port.
   *
   * A Repeater is not a container. `addItem` calls
   * `internal.target.addChild(itemNode, index)` where `target` is the node's
   * *parent*, so item nodes are inserted as the repeater's later siblings and
   * the repeater itself renders nothing of its own. Children authored under it
   * never reach the DOM.
   *
   * Both mid-tier models in session 6 failed this joint, from opposite sides.
   * Qwen nested a template that did not exist as a node and was rejected with
   * `Node "products-repeater" lists unknown child "product-card"` — an
   * `invalid-argument` hierarchy error carrying no recipe and teaching nothing.
   * Haiku nested one that *did* exist, and shipped: three repeaters, three
   * nested children, three sections that never drew.
   *
   * **Error when the repeater also has no template** — that is the whole
   * mistake, and one diagnostic naming the child it should have promoted is a
   * better repair instruction than two. **Warning** when `template` is set, the
   * list renders and the children are merely inert.
   *
   * Corpus: 3 hits in 89 repeaters, all three haiku's. Zero legitimate use.
   */
  RepeaterWithVisualChildren = 'repeater-with-visual-children',

  /**
   * DSG-004 §2.1 (register F17) — a multi-column arrangement built out of a
   * `Group`, which is an arrangement that can never collapse.
   *
   * Doctrine `§7` is the only mechanical statement in the design doctrine about
   * the runtime's *one* responsive mechanism: **a `Group` never responds to
   * width. There are no media queries and no breakpoints anywhere in the runtime
   * except on `net.noodl.visual.columns`.** A row of Groups is frozen at
   * whatever proportions it was authored with, so a three-up card band stays
   * three-up at 390px and a 32%-wide card becomes 120px wide.
   *
   * Until this rule the line had **nothing behind it**, and the measured
   * consequence is the phase's own argument: the author of the doctrine broke it
   * three commits after shipping it (the reference build's header, footer, trust
   * strip and category row are all frozen rows), and every cold replay
   * reproduced the same shape.
   *
   * Matched on structure and on the node's own size parameters — never on the
   * children's values. See `rules`-vs-precondition in
   * `responsiveArrangement.ts`. ⚠️ That header's reason — `NormNode` carries no
   * parameters — **expired on 2026-08-18 (D13)**, which removes the hard
   * blocker; it does not by itself make this a rule, since the calibration
   * argument in that header is separate and still stands.
   *
   * A **warning**, not an error: the graph renders, and at desktop width it
   * renders correctly. Not authored-blocking on first ship — the promotion
   * argument and the one measurement it still needs are in
   * `responsiveArrangement.ts`'s header.
   */
  UncollapsibleMultiColumn = 'uncollapsible-multi-column',

  /**
   * DSG-004 §2.2 (register F18) — a `width`, `height` or `objectFit` that the
   * node's `sizeMode` switches off.
   *
   * The narrow, named half of {@link InactiveConditionalParameter}, and it needs
   * its own code for one reason: severity policy is per *code*, and this is the
   * subset whose authored population is a defect every time. Doctrine `§8` names
   * it — *"On `Image`, `net.noodl.controls.button` and `textinput`,
   * `width`/`height`/`objectFit` are INERT unless `sizeMode: "explicit"`. A
   * `width: 100%` input that renders 170px wide is this, every time."*
   *
   * The general code stays a warning for the other 308 corpus hits (a
   * `borderWidth` with no `borderStyle`, a `showScrollbar` with scrolling off);
   * this one is **blocking for authored output**, on the `UnitlessDimension`
   * argument exactly: for a graph an agent just wrote, a `width` that does
   * nothing is a value it believes it set and did not.
   *
   * Corpus (both corpora, 107 projects, 2026-08-11): **58 hits in 10 projects** —
   * `Group.height` 19, `textinput.width` 8, `textinput.height` 7, `Group.width`
   * 7, `button.height` 6, `Text.height` 5, `options.width` 3, `Text.width` 2,
   * `button.width` 1. Every hit outside this repository is a real one, and the
   * canonical case is `Puppy test 3`'s admin form: six Text Inputs at
   * `width: 100%`, rendering at 170px. **Zero `Image` hits in 204 Images** —
   * the doctrine's `sizeMode: "explicit"` line is the one part of §5 that
   * already landed.
   */
  InertDimension = 'inert-dimension',

  /**
   * DEF-018 (P78 D28) — a `Columns` child sized to its own content, which keeps
   * its intrinsic width, ignores the box the column hands it, and draws across
   * its neighbour whenever its content is wider.
   *
   * The combination half of {@link InertDimension}: there the node's own
   * `sizeMode` switches a `width` off; here the child's `sizeMode` switches off
   * the one thing its *parent* exists to provide. Both button compositions ship
   * `sizeMode: 'contentSize'` and `net.noodl.controls.button`'s type default is
   * the same value, so following the design system verbatim inside the one node
   * in the runtime that reflows produces overlapping controls — measured on the
   * members band's own five buttons, 14px of overlap at 1280×900, appearing at
   * *wide* viewports where auto-fit makes the columns narrow
   * (`def018-def020-layout-drive.test.ts`).
   *
   * A **warning**, per child (the repair is per child), resolved against the
   * catalog defaults the runtime itself falls back to. See
   * `layoutInertCombination.ts` for the calibration and the honest limits.
   */
  ColumnsChildKeepsOwnWidth = 'columns-child-keeps-own-width',

  /**
   * DEF-020 (P78 D32) — a row `Group` whose `justifyContent` distributes free
   * space, with two or more children that grow: the free space never exists,
   * the children split the row evenly, and the parameter is silently inert.
   *
   * Every visual node's `width` defaults to `100%`, and `layout.ts` turns a
   * percentage width inside a `row` parent into `flexGrow` — so growing is what
   * a child of a row does unless something stops it. Measured: two default
   * Texts under `space-between` split a 1280px row 640/640 with a 0px gap; the
   * content-sized control shows a 1108px gap
   * (`def018-def020-layout-drive.test.ts`).
   *
   * Fires only when at least **two** children grow: with exactly one, the row
   * usually renders what the author meant (one side fills, the other sits at
   * the edge) and the parameter is merely redundant. A **warning**, one per
   * Group — the repair is a decision about the row, not about one child.
   */
  JustifyContentDistributesNothing = 'justify-content-distributes-nothing',

  /**
   * FLD-004 (P84 #26) — a number **wired** into the `width`/`height` that lies
   * along the parent's own main axis. It arrives as a *percentage*, and
   * `layout.ts` turns a percentage on the main axis into `flexGrow` — so the
   * value is a **ratio against growing siblings, not a length**, and with fewer
   * than two growers it changes nothing at all.
   *
   * 🔴 The reporter's sentence is the reason this code exists: *"the third
   * state — accepted, then silently discarded — is the worst of the three."*
   * The wire validates, the connection is live, the value arrives, and the box
   * does not move. `width` on the same node in the same graph works, because a
   * percentage on the CROSS axis stays a real CSS length
   * (`layout.ts` `getSizeWithMargins`) — which is exactly why the discriminator
   * here is the axis and not the port.
   *
   * The percentage is not the author's choice: dimension ports declare
   * `defaultUnit: '%'` (`node-shared-port-definitions.ts`), and a bare number
   * arriving over a connection is merged into the port's *current* unit
   * (`noodl-runtime/src/node.ts` `setInputValue`). So `400` means `400%` unless
   * the port already holds a `px` value — which is also the exit.
   *
   * Fires only on a **connected** port. The same percentage written as a
   * parameter is the shipped idiom — every visual node's `width` and `height`
   * default to `100%`, and on the main axis that default IS how a child fills
   * its parent — so keying on the value alone would report the whole corpus.
   *
   * Corpus (202 projects, both corpora plus `templates` and `project-examples`,
   * 2026-09-11): **78,162 connections, 413 landing on a `width`/`height`, of
   * which 108 are on the parent's main axis**, 55 on the cross axis and 250 on
   * a node with no parent inside its own component (unknowable, and skipped).
   * The `maxWidth`/`minWidth`/`maxHeight`/`minHeight` family — 183 more
   * connections — is **not** in the population: `layout.ts` converts neither.
   *
   * A **warning**, deliberately not in `AUTHORED_BLOCKING_WARNINGS` on first
   * ship, on this file's standing convention: promotion is earned on evidence
   * of firing correctly against authored output. See `layoutInertCombination.ts`
   * for the abstentions, and `node-shared-port-definitions.ts` for the runtime
   * half, which says the same sentence from inside a running graph where the
   * unit is a fact rather than a default.
   */
  WiredDimensionBecomesGrow = 'wired-dimension-becomes-grow',

  /**
   * DEF-024 (P78 D36) — a `mounted`/`visible` input whose every writer is a
   * constant-condition `Condition`, and the only value those writers can push
   * is `true`: the element can be shown but never put away again within a page
   * life, so a screen whose answer has more than one form accumulates
   * contradictory answers. Driven in real Chrome at HEAD
   * (`def024-gate-drive.test.ts`): tick then untick leaves BOTH notices in the
   * document, while the same transitions through a `Switch` per answer —
   * `state → mounted` — leave exactly one.
   *
   * A **warning**, per gate port. The template workaround (a constant-`false`
   * Condition on the same port) and the Switch shape are both silent by
   * construction. See `oneWayGate.ts` for the abstentions and the calibration.
   */
  GateOnlyTurnsOn = 'gate-only-turns-on',

  /**
   * DEF-012 §2 (P76 SB-011 §2) — a cloud Query Records node that filters on
   * connected parameters while its run-on-change boxes sit at the default, so
   * it fetches the moment the graph is built — before any value can have
   * reached a `qp-` port. An unsupplied connected rule is dropped rather than
   * failed (the optional-filter contract), so the first fetch returns every
   * row in the class and `fetched` fires on the unfiltered result; the
   * narrowed re-query arrives a pass later. Measured on a real backend
   * (SB-004 §7): publishing one page flipped the access rules on every
   * Section in the site, with the correct filter in the file.
   *
   * A **warning**, per query node. The repair is SB-004's own pinned
   * workaround — both boxes `false`, leaving the parameter's arrival as the
   * only trigger. See `queryBeforeFilter.ts` for the abstentions and why the
   * runtime cannot fix this itself.
   */
  QueryFetchesBeforeItsFilter = 'query-fetches-before-its-filter',

  /**
   * DSG-004 §2.3 — a page whose text is all one weight, so nothing on it is
   * emphasised over anything else.
   *
   * Doctrine `§3`: *"A page rendering at one font weight is not designed. Aim for
   * three or more distinct weights. Set `fontWeight` explicitly — it is a real
   * port and nothing infers it."* The line exists because before 0.1.4 there was
   * **no `fontWeight` port on any node** (`no-font-weight-port-existed`), so
   * every word in every authored page rendered at 400.
   *
   * **Info, and it never blocks.** It is taste, a deliberately monotone page
   * exists, and the corpus says the doctrine is already winning: across 429
   * components carrying text, every `fontWeight` ever authored is
   * `var(--font-semibold)` (88), `var(--font-bold)` (43), `var(--font-medium)`
   * (21) or `var(--font-normal)` (13), and **no measured model replay is
   * monotone**. This is the `oversized-page` shape of rule — a backstop against
   * a regression, not pressure — and it is deliberately shipped at that
   * severity for the same reason.
   *
   * Its render-time twin is `flat-type-scale` in `@nodegx/render-measure`, which
   * sees what this cannot: the *computed* weight, including a token that resolves
   * to 400. This one sees what that cannot: a page that has not been rendered
   * yet, which is every page at the moment it is authored.
   */
  MonotoneTypography = 'monotone-typography',

  /**
   * LEG-002 — a run of three or more same-type sibling nodes, none of them
   * named, each of which is something the reader has to go *through*.
   *
   * **Info, advisory in both directions, and that polarity is the finding.**
   * Phase 50's README specced this the other way round: blocking for *authored*
   * output on the `AUTHORED_BLOCKING_WARNINGS` precedent, advisory for
   * hand-built. The corpus inverts it. Label coverage, measured 2026-08-11 over
   * every graph in reach (`scripts/legibility/scan-labels.js`):
   *
   *     agent-authored, 12 phase-55/58 model runs   1,126 nodes   89.3% labelled
   *     hand-authored, 58 library/ prefabs+modules  1,333 nodes   20.3% labelled
   *     every project.json in this repo             5,509 nodes   19.7% labelled
   *
   * A rule that blocks authored output and merely advises hand-built output
   * would be a gate aimed at the one population that already complies at 89%,
   * silent on the one at 20%. And the honest reading of those two columns is
   * that there is no compliance problem to gate at all: agents label, humans
   * mostly do not and always have not, and an unlabelled node **renders
   * correctly**. Every other code in `AUTHORED_BLOCKING_WARNINGS` describes
   * output that is *broken* — a value the runtime discards, a page that renders
   * blank, an instance parameter naming no port. Admitting this one would
   * redefine that set.
   *
   * ⚠️ The audit finding that usually argues *for* gating argues against it
   * here: hard rejections carrying a suggestion were self-corrected at a 100%
   * rate, and **a rejection whose repair is "write a better sentence" invites
   * the model to satisfy it with `Group 3`**. So: `severity: 'info'`, which
   * `isBlockingForAuthoredOutput` (`severity === 'error' || AUTHORED_BLOCKING_WARNINGS.has`)
   * correctly ignores in both clients with no further work. **That is the
   * desired outcome, not an omission** — `unlabelledNode.test.ts` asserts it, so
   * a later edit to the blocking set cannot silently promote it.
   *
   * ## Why the predicate is a *run of siblings* and not "unlabelled"
   *
   * 4,426 of the corpus's 5,509 nodes carry no label. A rule reporting those is
   * not a diagnostic, it is a second copy of the node list, and it would make
   * the ProblemsPanel useless for the diagnostics that describe real breakage.
   * The task file's own candidate — children, or ≥3 authored parameters, or >1
   * outgoing connection — measures **2,232** repo nodes and **37.7%** of
   * `library/`, so it was measured and rejected rather than shipped. The census
   * behind the shipped predicate, and the eight other candidates it beat, are in
   * `scripts/legibility/scan-labels.js` and this phase's lane notes.
   *
   * Shipped counts: **214** repo (3.9%, 24 of 91 projects) · **25** in
   * `library/` (1.9%, and **53 of 58 prefabs are untouched**) · **9** across the
   * model runs — 6 on `phase55-replay-haiku` (1% labelled), 3 on
   * `phase55-s6-qwen35-27b` (16%), and **zero on all ten runs that already
   * label**. 166 of the 214 are `Group`, which is the shape it is named for.
   */
  UnlabelledNode = 'unlabelled-node',
  /**
   * DEF-002 §3 — a **signal** output wired into a **value** input.
   *
   * The runtime writes `true` then `false` on the target input. The input queue
   * holds **one entry per input name**, so the two writes coalesce and the
   * consumer runs **once, with `false`** — the opposite of what the graph looks
   * like it says.
   *
   * 🔴 **It bit an instrument built to measure a different defect.** Phase 78
   * D4's first twin wired a query's `failure` into `unknownNotice.visible`, and
   * the notice painted for the person whose query **succeeded** and not for the
   * one who was refused. Exactly inverted, on a graph built by someone reading
   * carefully. *An instrument built out of a seam you already know is broken
   * measures the seam.*
   *
   * ⚠️ Nothing covered it. `typeIncompatibleConnection` treats *"a signal is
   * involved"* as **compatible** — correctly, for a signal into a signal —
   * and `signalDrivenStaleInput` is `defaultEnabled: false` and asks about
   * asynchrony. The direction is what makes this one decidable: a signal into a
   * *value* port is never the graph anyone drew.
   *
   * Error severity, and it can afford to be: it fires only when **both** ports
   * are statically known in the catalog, so a runtime-created port on either end
   * takes the same skip every other rule here takes.
   */
  SignalIntoValuePort = 'signal-into-value-port',
  /**
   * DEF-002 — a connection naming a port that does not exist on a **component
   * instance**.
   *
   * The sibling of {@link InstanceUnknownParameter}, and the half that was
   * missing. That one checks the ports a *parameter* names; this one the ports
   * a *wire* names, and until now nothing did: `nonexistentPort` skips
   * component refs outright (`isComponentRef`), which is correct for it —
   * a component's ports are not in the catalog — and left the question
   * unasked rather than answered.
   *
   * 🔴 **Measured by sabotage, phase 78 D1.** Renaming `standing.isMember` to
   * `standing.isMemberXX` in the members-area template produced a run
   * *identical* to the clean one: 46 `dynamic-port-skipped` infos and nothing
   * else. The door's silence about connections read as "checked and fine".
   *
   * It fails **shut**: an instance output that resolves to nothing never fires,
   * so the gate it controls never opens and the screen stays empty. Every
   * access gate in the members' area is an instance port.
   *
   * Error severity. The target component's interface is derived from files the
   * door has already read — this is not a guess about a runtime-created port,
   * it is a lookup in an index built from the same declaration the runtime
   * reads.
   */
  ConnectionUnknownInstancePort = 'connection-unknown-instance-port',
  /**
   * FIX-007: a connection names a Function node's port by the label the panel
   * shows instead of the name the port has. `Inputs.amount` creates a port
   * *named* `in-amount` and *displayed* as `amount`; a wire to `amount`
   * connects to nothing and the canvas reports "Target port doesn't exist".
   *
   * Its own code because it is invisible to every check around it, and
   * deliberately so: `NonexistentPort` skips `runtime-discovered` types (it
   * cannot see ports the runtime mints, and reporting them would flood real
   * projects), while the structural schema and MCP's zod see four well-formed
   * strings. This check does not guess where that one declines to — it mines
   * the node's own `functionScript` with the runtime's own regexes and speaks
   * only when the bare name is a port that very script creates and is not also
   * one of the node's declared ports (`done` beside `Outputs.done()`).
   *
   * Error severity: a wire to a port that provably does not exist, on a node
   * that provably has the prefixed one, is not something anyone means to write.
   */
  UnprefixedFunctionPort = 'unprefixed-function-port',
  /**
   * DEF-002 §1(b)/§1(c) — a connection naming an `in-…`, `out-…` or `pm-…` port
   * that **no adapter would mint**.
   *
   * The other two of phase 78 D1's three sabotages, and the siblings of
   * {@link ConnectionUnknownInstancePort}. That one resolves an instance's ports
   * from a component *interface*; these two are not an interface at all — they
   * are minted by an editor adapter out of parameters on nodes inside the
   * *target* component: `CloudFunctionAdapter` reads the `params` of a
   * `noodl.cloud.request`/`response`, `RouterNavigateAdapter` the `pathParams`
   * and `queryParams` of a `PageInputs`.
   *
   * 🔴 **Read from the adapters, and the task file's description was wrong.**
   * DEF-002 §1(c) sourced the `pm-` names from *"`PageInputs.pathParams` and the
   * `{braces}` in `Page.urlPath`"*. At HEAD the adapter reads `pathParams` **and
   * `queryParams`**, and `urlPath` not at all — so that sentence would have
   * built a check that refused every legitimate query-parameter wire and
   * accepted names that mint no port.
   *
   * Error severity, and it fires only on a **prefixed** name whose target
   * resolves and whose declaration exists: `success`, `failure` and `error` are
   * static catalog ports and are never this code's business.
   */
  ConnectionUnknownDerivedPort = 'connection-unknown-derived-port',
  /**
   * DEF-002 §2 — in a cloud function, a `Failure` edge that reaches no response.
   *
   * Not a degraded result: the request ends only when something **sends**, so an
   * unreached `Failure` is a **thirty-second hang**. `publishPage` and
   * `duplicatePage` shipped in a real template with zero failure wires between
   * them, and a zero-section publish returned nothing after 30,004 ms.
   *
   * 🔴 **The edge is graded, not the node**, and that distinction is the whole
   * rule: SBR-015's first version asked *"does this node reach a Response?"* —
   * true of every node on a happy path — and would have passed the very graph it
   * was written for.
   *
   * Warning severity with an `AUTHORED_BLOCKING_WARNINGS` entry: advisory over
   * hand-authored templates, blocking for a graph an agent just wrote.
   */
  FailureReachesNothing = 'failure-reaches-nothing',
  /**
   * DEF-004 §4c — in a cloud function, a `completed` edge that commits a result
   * nothing checked.
   *
   * `completed` *"fires after every invocation, whatever the outcome"*, so wired
   * into a record write's `store` or a response's `send` it writes a fact, or
   * answers a caller, on a run that may have failed. Measured in a shipped
   * template: `publishPage` marked a page `published` after a `Run Tasks` that
   * set no section's access rules.
   *
   * 🔴 **The predicate is not the one the task asked for.** DEF-004's AC4 named
   * the target — a record write *or a `response.send`* — and over the shipped
   * corpus that refuses `submitContactForm`, the one graph written to honour the
   * task's own trap. What separates the two is whether a **Failure route reaches
   * the same commit**: where one does, the author enumerated the bad outcomes and
   * `completed` is the "carry on regardless" leg it is for; where none does, it
   * is the only exit, used as if it meant success.
   *
   * Not a duplicate of `FailureReachesNothing`, measured on the real graphs: that
   * rule fires on the `JavaScriptFunction`s in the same components and never on
   * the node carrying the `completed` wire, because a value wire answers the
   * caller without passing through it. It asks *is the caller answered at all*;
   * this defect answers fine, with a lie.
   *
   * Warning severity with an `AUTHORED_BLOCKING_WARNINGS` entry, matching its
   * sibling: advisory over hand-authored projects, blocking for a graph an agent
   * just wrote.
   */
  CompletedCommitsUnchecked = 'completed-commits-unchecked',
  /**
   * FIX-006 §3: a `Javascript2` (Script) node whose body declares nothing the
   * runtime can call again. Its code runs **once**, at parse time, and never
   * again — while still minting ports from `Inputs.`/`Outputs.` mentions, which
   * is precisely what makes the graph look correctly wired.
   *
   * This is the reported defect: the AI wrote Function-shaped code into a Script
   * node, and the user's note — *"it also didn't add any input or output signals,
   * which means the Script can't be run"* — understates it. There is no `run`
   * signal to add: `Javascript2` has none, and only a declared surface brings one.
   *
   * ## The predicate is "declares no surface", not "has no define("
   *
   * ⚠️ The task file proposed `define(`/`script(`. **Measured against the repo's
   * 88 Script nodes, that fires on 13 of them — every one a working library
   * prefab or module.** The parser injects four parameters
   * (`javascriptnodeparser.js:22`) and aliases a fifth
   * (`getCodePrefix`: `const Script = Node`), so there are three generations of
   * declaration API, not one, and the third is the one the library actually uses:
   *
   *  - 1st gen `define({…})` — `:44`
   *  - 2nd gen `script({…})` — `:57`
   *  - 3rd gen `Node.*` / `Script.*` — `Inputs` and `Outputs` at `:165-166`,
   *    `OnInit` `:178`, `OnDestroy` `:181`, `Setters` `:184`,
   *    `OnInputsChanged` `:189`, `Signals` `:203`
   *
   * With all three counted the rule fires on **0 of 88** — and the four known-bad
   * shapes (the reported node, a bare expression, a console-only body, an IIFE)
   * all still fire, so the silence is discrimination rather than a dead predicate.
   *
   * ## What it deliberately does not do
   *
   * `useExternalFile: "yes"` is skipped: the body lives in a downloaded file this
   * check cannot read, so its `code` says nothing about what the node declares.
   * An absent or blank `code` is skipped too — an empty node is unfinished, not
   * wrong, and the report is about a node that looks complete.
   *
   * A commented-out `define(` suppresses the warning. That is a false *negative*,
   * the safe direction, and it matches the parser's own decision not to strip
   * comments before mining ports (see this module's note).
   *
   * Warning, not error, and **not** in `AUTHORED_BLOCKING_WARNINGS`: a one-shot
   * setup script with no declared surface is unusual but legal, so this advises
   * and never rejects a write.
   */
  UnrunnableScriptNode = 'unrunnable-script-node',
  /**
   * SB-001: a node authored into a component whose runtime cannot register it —
   * a browser-only node (`Text`, `Group`, `Page`…) in a `/#__cloud__/` graph, a
   * cloud-only node (`noodl.cloud.request`…) in a browser graph, or a component
   * instance placed across the `/#__cloud__/` boundary.
   *
   * The editor's interactive surfaces enforce this everywhere a human authors —
   * the node picker (`createnodeindex.ts`), paste (`EditorClipboard.ts`),
   * extraction (`ExtractToComponent.ts`) — and the write gates enforced it
   * nowhere, so an agent could put `noodl.cloud.request` on a page and get a
   * clean report. The consequence is never a diagnostic at run time: the wrong
   * runtime simply has no such node ("Can't find component model"), so the graph
   * silently does nothing where that node should act.
   *
   * Warning severity with an `AUTHORED_BLOCKING_WARNINGS` entry — the
   * `UnresolvedNavigation` shape: blocking for a graph an agent just wrote,
   * while `validate:project` over a hand-authored corpus stays advisory.
   */
  WrongRuntimeNode = 'wrong-runtime-node',
  /**
   * DEF-010 (SB-009): a component named as the VALUE of a `component`-typed
   * parameter — `Run Tasks`' `taskTemplate`, `Show Popup`'s `target`, the seven
   * `repeaterComponent` ports — resolves to nothing in this project.
   *
   * The node-type spelling of the same reference has been gated since SB-001
   * (`unresolved-component-ref`, blocking), and `For Each.template` has its own
   * owner (`repeater-template-unresolved`). This code covers the other twelve of
   * the catalog's thirteen component-typed ports, generically over the catalog,
   * so port fourteen is covered on the day it is added.
   *
   * The runtime consequence is the silent kind (SB-009 s2, measured): a cloud
   * `Run Tasks` naming a helper that does not exist validates clean, deploys,
   * iterates over nothing and reports success having done no work.
   *
   * Warning severity; whether it joins `AUTHORED_BLOCKING_WARNINGS` is a corpus
   * measurement, not an argument (SB-009 §"Open decision") — the cross-runtime
   * half of the same check needs no such decision because it reuses
   * `wrong-runtime-node`, which is already blocking.
   */
  ComponentParameterUnresolved = 'component-parameter-unresolved',
  /**
   * DEF-009 (P76 F3): a cloud function whose Request node ticks
   * `allowNoAuth`, whose graph writes records, and for which no per-function
   * `rateLimit` is configured — a public write door with no limit, shipped
   * silently.
   *
   * The limiter exists and is per-function (`nodegx-backend/src/ops/rate-limit.ts`;
   * `functions.<name>.rateLimit` in `nodegx.security.json`, or
   * `PUT /admin/permissions/functions/<name>`), and the backend's boot warnings
   * fire only on service-wide configuration — so before this code, the one
   * person who could set a limit was never told there was one to set.
   *
   * Warning, never blocking: the limit may be configured later or live only on
   * the running backend, and whether a public function's `rateLimit` should
   * default to something is Richard's ruling (DEF-009 §3.2). Fires only when the
   * caller can see the project's security policy — `security` omitted means "do
   * not check", so a door that cannot read the project root stays honest about
   * the limited functions it cannot see.
   */
  PublicWriteDoorUnlimited = 'public-write-door-unlimited'
}

// ─── Location ─────────────────────────────────────────────────────────────────

/**
 * Where a diagnostic applies. Every field beyond `component` is optional because
 * different rules localise to different granularities (a whole component, a
 * node, a single port, or one connection). The editor uses `nodeId` to navigate;
 * the CLI renders the whole path.
 */
export interface DiagnosticLocation {
  /** Component identifier — the legacy path/name, e.g. "/#Home". */
  component: string;
  /** Node id within the component, when the diagnostic is about a node. */
  nodeId?: string;
  /** The node's type, included for readability in messages/UI. */
  nodeType?: string;
  /** A user-facing label for the node, when available. */
  nodeLabel?: string;
  /** Port name, when the diagnostic is about a specific port. */
  port?: string;
  /** 'input' | 'output', when the diagnostic is about a specific port. */
  plug?: 'input' | 'output';
  /** The offending connection, when the diagnostic is about a wire. */
  connection?: {
    fromId: string;
    fromProperty: string;
    toId: string;
    toProperty: string;
  };
}

// ─── Diagnostic ───────────────────────────────────────────────────────────────

export interface Diagnostic {
  code: DiagnosticCode;
  severity: Severity;
  /** Primary human/AI-readable message. Actionable on its own. */
  message: string;
  location: DiagnosticLocation;
  /**
   * A single best-guess replacement, when one is knowable (e.g. the nearest
   * catalog type by edit distance). Present ⇒ high-confidence fix.
   */
  suggestion?: string;
  /**
   * A bounded list of valid alternatives (e.g. the signal inputs a Text node
   * actually has). Lets an AI pick the right one without another round-trip.
   */
  alternatives?: string[];
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface ValidationSummary {
  errors: number;
  warnings: number;
  infos: number;
  /** Total nodes examined, for context in CLI output. */
  nodesChecked: number;
  /** Connection endpoints examined. */
  endpointsChecked: number;
}

export interface ValidationReport {
  diagnostics: Diagnostic[];
  summary: ValidationSummary;
}

// ─── Construction helpers ──────────────────────────────────────────────────────

export function summarize(diagnostics: Diagnostic[], counters: { nodesChecked: number; endpointsChecked: number }): ValidationSummary {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const d of diagnostics) {
    if (d.severity === 'error') errors++;
    else if (d.severity === 'warning') warnings++;
    else infos++;
  }
  return { errors, warnings, infos, ...counters };
}

/** Order diagnostics for stable display: by component, then severity, then node id. */
export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((a, b) => {
    if (a.location.component !== b.location.component) {
      return a.location.component < b.location.component ? -1 : 1;
    }
    if (a.severity !== b.severity) {
      return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    }
    const an = a.location.nodeId ?? '';
    const bn = b.location.nodeId ?? '';
    if (an !== bn) return an < bn ? -1 : 1;
    return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  });
}

// ─── Formatting (the edge) ──────────────────────────────────────────────────────

const SEVERITY_TAG: Record<Severity, string> = {
  error: 'ERROR',
  warning: 'WARN',
  info: 'INFO'
};

/** One diagnostic as a single human-readable line (no color codes). */
export function formatDiagnosticLine(d: Diagnostic): string {
  const loc = d.location;
  const where: string[] = [loc.component];
  if (loc.nodeId) {
    const label = loc.nodeLabel ? ` "${loc.nodeLabel}"` : '';
    const type = loc.nodeType ? ` (${loc.nodeType})` : '';
    where.push(`node ${loc.nodeId}${label}${type}`);
  }
  if (loc.port) where.push(`${loc.plug ?? 'port'} "${loc.port}"`);
  let line = `${SEVERITY_TAG[d.severity]} [${d.code}] ${where.join(' › ')}: ${d.message}`;
  if (d.suggestion) line += `\n    → did you mean \`${d.suggestion}\`?`;
  if (d.alternatives && d.alternatives.length > 0) {
    line += `\n    → available: ${d.alternatives.join(', ')}`;
  }
  return line;
}

/** Full report as human-readable text, grouped by severity summary at the end. */
export function formatReport(report: ValidationReport, target?: string): string {
  const lines: string[] = [];
  if (target) lines.push(`# ${target}`);
  for (const d of sortDiagnostics(report.diagnostics)) {
    lines.push(formatDiagnosticLine(d));
  }
  const s = report.summary;
  lines.push('');
  lines.push(
    `${s.errors} error(s), ${s.warnings} warning(s), ${s.infos} info — ` +
      `${s.nodesChecked} nodes, ${s.endpointsChecked} endpoints checked`
  );
  return lines.join('\n');
}

/** The machine-readable form used by the CLI's --json mode and the MCP server. */
export function toJSON(report: ValidationReport, target?: string): Record<string, unknown> {
  return {
    target,
    summary: report.summary,
    diagnostics: sortDiagnostics(report.diagnostics)
  };
}
