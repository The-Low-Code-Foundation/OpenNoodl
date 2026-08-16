/**
 * CN-006 — the kit scaffold.
 *
 * Two entry points in the product (`create_node_kit` in `noodl-mcp`, "New node
 * kit" in the editor) and one generator, here, so the two cannot drift into
 * teaching different things.
 *
 * ## Why the generated kit looks the way it does
 *
 * ⚠️ **The scaffold is what everyone copies.** It is this phase's largest lever
 * on whether kits are any good — larger than any doc, because a doc is read once
 * and a scaffold is edited. So the generated `index.js` is written to ✅ **P2**
 * (*ports are the product; JavaScript is the escape hatch*) as a hard rule:
 *
 * - Every visual decision is a port — colour, radius, spacing, font size.
 * - ✅ **D8**: colour and spacing ports default to `var(--token)`, not hex and px.
 * - **No buried constants.** The example node's one threshold (*when is this
 *   tile highlighted?*) is deliberately **not** in the JavaScript. It is an
 *   input, and the generated README shows it wired to a stock `Expression` node.
 *   A scaffold that decided that in code would teach the opposite of P2 forever.
 * - ✅ **D2**: the definition carries a JSDoc `@type` annotation, so autocomplete
 *   works with no build step and no `node_modules`.
 *
 * 🔴 **D8 landed on a path that was broken.** `var(--token)` on a units-typed
 * port was handled by AIB-001 only when an app builder *set* it; a port's
 * declared `default` was still unit-fitted into `var(--space-4)px` — invalid
 * CSS, dropped silently, with the parameter still reading back correctly.
 * Fixed in `react-component-node.ts` as part of this task and graded by
 * `noodl-viewer-react/tests/cn-006-token-defaults.test.ts`. Without that fix
 * every scaffolded kit would have shipped with its spacing dead, which is the
 * exact shape of failure `an-icon-host-that-sets-fill-sets-nothing` records.
 *
 * ## The types copy, and why it is a copy
 *
 * 🔴 CN-005 measured this rather than assuming it: a bare specifier
 * (`import('@nodegx/node-kit-types')`) resolves **only** when the package is
 * physically installed above the file, and a kit folder has no `node_modules`
 * and no build step to make one. So the annotation must reach the types by a
 * relative path, which means the kit carries its own copy.
 *
 * A copy is a staleness hazard, and a stale copy in this repository reads
 * exactly like a correct answer. Three things contain it, and none of them is
 * "remember to update it":
 *
 * 1. **There is no second copy in the repository.** The bytes are read from the
 *    installed `@nodegx/node-kit-types` at scaffold time ({@link readPublishedTypes}),
 *    never from a checked-in duplicate.
 * 2. **The written copy is stamped** with the version it came from, so a kit on
 *    disk can say how old its types are without anybody diffing anything.
 * 3. **{@link typesCopyStatus} makes the question answerable** — hand it the
 *    contents of any kit's `types/node-kit.d.ts` and it reports whether the body
 *    still matches what is published today. That is the check the cashflow kit's
 *    copy needs too.
 *
 * @module @nodegx/kit-scaffold
 */

'use strict';

const fs = require('fs');
const path = require('path');

/** The filename a kit's local copy of the published types is written to. */
const KIT_TYPES_FILENAME = 'node-kit.d.ts';

/** The kit-relative path of that copy — also the specifier the annotation uses. */
const KIT_TYPES_RELPATH = path.posix.join('types', KIT_TYPES_FILENAME);

/** Where the annotation points. Bare specifiers do not resolve here; see the header. */
const TYPES_SPECIFIER = './types/node-kit';

/** The marker line `typesCopyStatus` reads the stamped version out of. */
const STAMP_PREFIX = '// Copied from @nodegx/node-kit-types@';

// ─── Naming ──────────────────────────────────────────────────────────────────

/**
 * A kit's directory name, derived from whatever the caller typed.
 *
 * Lowercase, alphanumerics and dashes only. That is deliberately narrower than
 * the filesystem allows: this string becomes a directory name, part of a node
 * type name, and part of a module specifier, and the intersection of what those
 * three accept is small.
 *
 * @param {string} name
 * @returns {string} the slug, or `''` if nothing usable survived
 */
function slugify(name) {
  return String(name == null ? '' : name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/**
 * Reject a name before it becomes a path.
 *
 * ⚠️ The MCP tool takes this argument from a model, so `..`, an absolute path
 * and a separator all have to die here rather than at `path.join`, which would
 * cheerfully resolve them out of the project. Checked on the *raw* input, not
 * the slug: slugging `../../etc` produces the harmless `etc`, so validating the
 * slug alone would accept the traversal and silently write somewhere else.
 *
 * @param {string} name
 * @returns {{ ok: true, dirName: string, displayName: string } | { ok: false, code: string, message: string }}
 */
function resolveKitName(name) {
  const raw = String(name == null ? '' : name).trim();

  if (raw.length === 0) {
    return { ok: false, code: 'name-empty', message: 'A kit name is required.' };
  }
  if (raw.includes('/') || raw.includes('\\') || raw.includes('..') || path.isAbsolute(raw)) {
    return {
      ok: false,
      code: 'name-not-a-path',
      message: `"${raw}" looks like a path. A kit name is a plain name — it becomes one directory under noodl_modules/.`
    };
  }

  const dirName = slugify(raw);
  if (dirName.length === 0) {
    return {
      ok: false,
      code: 'name-unusable',
      message: `"${raw}" has no letters or digits in it, so it cannot become a directory name.`
    };
  }

  return { ok: true, dirName, displayName: raw };
}

/**
 * The example node's type name.
 *
 * Namespaced by the kit slug so two kits in one project cannot collide, which is
 * the failure CN-015 is about and the one a scaffold is best placed to prevent —
 * an author who copies this file keeps the prefix for every node they add.
 *
 * @param {string} dirName
 * @param {string} nodeId
 */
function nodeTypeName(dirName, nodeId) {
  return `${dirName}.${nodeId}`;
}

// ─── The published types ─────────────────────────────────────────────────────

/**
 * The installed `@nodegx/node-kit-types` — its `.d.ts` path and its version.
 *
 * Resolved through `require.resolve` rather than a relative `../../` walk so it
 * keeps working from a packaged build, where the two packages are laid out by
 * npm rather than by the repository.
 *
 * @returns {{ dtsPath: string, version: string }}
 */
function publishedTypes() {
  const pkgPath = require.resolve('@nodegx/node-kit-types/package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const main = typeof pkg.types === 'string' ? pkg.types : 'src/index.d.ts';
  return { dtsPath: path.join(path.dirname(pkgPath), main), version: String(pkg.version) };
}

/** The published `.d.ts` body, exactly as published. @returns {{ body: string, version: string }} */
function readPublishedTypes() {
  const { dtsPath, version } = publishedTypes();
  return { body: fs.readFileSync(dtsPath, 'utf8'), version };
}

/**
 * The header stamped onto a kit's copy.
 *
 * It says the version, and it says the one thing an author will otherwise get
 * wrong: editing this file changes nothing the runtime enforces. The types are
 * a description of the definition shape, not a validator.
 *
 * @param {string} version
 */
function typesStamp(version) {
  return [
    `${STAMP_PREFIX}${version} by the NodeGX kit scaffold.`,
    '//',
    '// This is a copy on purpose. A kit has no node_modules and no build step, so',
    '// a bare specifier would not resolve — the annotations in index.js reach these',
    "// types by relative path instead. That is the whole mechanism: no npm install,",
    '// no tsconfig, autocomplete in any editor that speaks TypeScript.',
    '//',
    '// Editing this file changes nothing the runtime enforces. It describes the',
    '// shape the runtime already expects; it does not check it.',
    ''
  ].join('\n');
}

/**
 * Is a kit's copy of the types still the published ones?
 *
 * Compares the **body** (everything after the stamp) rather than trusting the
 * stamped version — a version that was hand-edited, or a body that was, is the
 * case worth catching, and a stamp comparison alone would miss both.
 *
 * @param {string} contents the contents of a kit's `types/node-kit.d.ts`
 * @returns {{ current: boolean, stampedVersion: string | null, publishedVersion: string, reason?: string }}
 */
function typesCopyStatus(contents) {
  const published = readPublishedTypes();
  const text = String(contents == null ? '' : contents);

  const stampMatch = text.match(/^\/\/ Copied from @nodegx\/node-kit-types@([^\s]+)/m);
  const stampedVersion = stampMatch ? stampMatch[1] : null;

  const stamp = typesStamp(stampedVersion || published.version);
  const body = text.startsWith(stamp) ? text.slice(stamp.length) : text;

  if (body === published.body) {
    return { current: true, stampedVersion, publishedVersion: published.version };
  }
  return {
    current: false,
    stampedVersion,
    publishedVersion: published.version,
    reason:
      stampedVersion === null
        ? 'This copy carries no scaffold stamp, and its body differs from the published types.'
        : `This copy is stamped ${stampedVersion} and its body differs from the published ${published.version}.`
  };
}

// ─── The generated files ─────────────────────────────────────────────────────

/**
 * The example node's ports, in one table.
 *
 * Kept as data rather than inlined into the template because the generated
 * README documents the same set, and a port table that disagrees with the code
 * it documents is worse than no table. `tests/ports.test.js` asserts the two
 * agree, and — the assertion that makes that mean anything — that every colour
 * and spacing default really is a `var(--token)`, which is ✅ D8 stated as a
 * property of the output rather than as an intention.
 *
 * `where` is which of the definition's three port homes it lives in, and it is
 * a genuine distinction rather than bookkeeping:
 *
 * - `inputCss` styles **the node's own box**, and the bridge writes it to the DOM.
 * - `inputProps` hands a value to the **React component**, for child elements it
 *   draws itself. A colour for inner text has to go here; there is no other way.
 * - `outputProps` is what the node sends back out into the graph.
 */
const EXAMPLE_PORTS = Object.freeze([
  { name: 'label', where: 'inputProps', type: 'string', group: 'Content', default: "'Revenue'", doc: 'The tile’s caption.' },
  { name: 'value', where: 'inputProps', type: 'string', group: 'Content', default: "'—'", doc: 'The figure to show. Format it in the graph, not here.' },
  {
    name: 'highlighted',
    where: 'inputProps',
    type: 'boolean',
    group: 'Content',
    default: 'false',
    doc: 'Whether to draw the value in the highlight colour. **The rule that decides this belongs in the graph** — see the README.'
  },
  { name: 'backgroundColor', where: 'inputCss', type: 'color', group: 'Style', default: 'var(--surface-raised)', doc: 'The tile’s background.' },
  { name: 'color', where: 'inputCss', type: 'color', group: 'Style', default: 'var(--foreground)', doc: 'Default text colour, inherited by both lines.' },
  { name: 'borderColor', where: 'inputCss', type: 'color', group: 'Style', default: 'var(--border)', doc: 'Border colour.' },
  { name: 'borderWidth', where: 'inputCss', type: 'length', group: 'Style', default: 'var(--border-1)', doc: 'Border width.' },
  { name: 'borderRadius', where: 'inputCss', type: 'length', group: 'Style', default: 'var(--radius-md)', doc: 'Corner radius.' },
  { name: 'padding', where: 'inputCss', type: 'length', group: 'Style', default: 'var(--space-4)', doc: 'Inner padding.' },
  { name: 'gap', where: 'inputProps', type: 'length', group: 'Style', default: 'var(--space-1)', doc: 'Space between the label and the value.' },
  { name: 'labelSize', where: 'inputProps', type: 'length', group: 'Style', default: 'var(--text-sm)', doc: 'Label font size.' },
  { name: 'valueSize', where: 'inputProps', type: 'length', group: 'Style', default: 'var(--text-2xl)', doc: 'Value font size.' },
  { name: 'labelColor', where: 'inputProps', type: 'color', group: 'Style', default: 'var(--muted-foreground)', doc: 'Label colour.' },
  { name: 'highlightColor', where: 'inputProps', type: 'color', group: 'Style', default: 'var(--primary)', doc: 'Colour the value takes when `Highlighted` is true.' },
  { name: 'onClick', where: 'outputProps', type: 'signal', group: 'Events', default: '', doc: 'Sent when the tile is clicked.' }
]);

/** The example node's id and display name. One node: this is a starting point, not a library. */
const EXAMPLE_NODE = Object.freeze({ id: 'StatTile', displayName: 'Stat Tile' });

/**
 * `index.js` — the file an author opens first and edits forever.
 *
 * @param {{ dirName: string, displayName: string }} kit
 */
function indexJs(kit) {
  const type = nodeTypeName(kit.dirName, EXAMPLE_NODE.id);
  return `// @ts-check
/**
 * ${kit.displayName} — a NodeGX node kit.
 *
 * Hand-written. No SDK, no bundler, no npm install, no build step. The runtime
 * loads React as \`window.React\` before this file runs, so there is exactly one
 * React on the page and hooks are safe to use.
 *
 * ── The rule this file is written to follow ─────────────────────────────────
 *
 *   Ports are the product. JavaScript is the escape hatch.
 *
 * Every decision somebody building an app should be able to make is a PORT:
 * colour, spacing, radius, font size — and, the one people get wrong, every
 * threshold. Nothing below decides *when* a tile counts as highlighted. That
 * arrives on the \`Highlighted\` input, so the rule lives in the graph where it
 * is visible and editable without opening this file. README.md shows it wired
 * to a stock Expression node.
 *
 * Colour and spacing ports default to design tokens rather than hex and pixels,
 * so a node from this kit inherits the project's design system instead of
 * fighting it. Change a token once and every node follows.
 *
 * ── Autocomplete ────────────────────────────────────────────────────────────
 *
 * The \`@type\` annotations below point at \`types/${KIT_TYPES_FILENAME.replace(/\.d\.ts$/, '')}\`, a copy of the
 * published definition types that the scaffold wrote next to this file. No npm
 * install and no tsconfig: open this folder in any editor that speaks
 * TypeScript and the fields, port types and callback signatures are all there.
 */
(function () {
  var React = window.React;
  var h = React.createElement;

  /** @type {import('${TYPES_SPECIFIER}').ReactNodeDefinition} */
  var ${EXAMPLE_NODE.id} = {
    name: '${type}',
    displayNodeName: '${EXAMPLE_NODE.displayName}',

    getReactComponent: function () {
      return function ${EXAMPLE_NODE.id}Component(props) {
        // The DOM handoff every visual kit node needs: it is what lets the
        // editor highlight this node on the canvas, and what the shared
        // bounding-box outputs measure. A hook, on purpose — if the page ever
        // had a second React this line would throw rather than misbehave
        // quietly.
        var el = React.useRef(null);
        React.useEffect(function () {
          props.noodlNode && props.noodlNode.setDOMElement(el.current);
        }, []);

        return h(
          'div',
          { ref: el, style: props.style, onClick: props.onClick },
          h('div', { style: { fontSize: props.labelSize, color: props.labelColor } }, props.label),
          h(
            'div',
            {
              style: {
                fontSize: props.valueSize,
                marginTop: props.gap,
                // Note what is NOT here: any rule about when to highlight.
                // The graph decided that and sent the answer in.
                color: props.highlighted ? props.highlightColor : 'inherit'
              }
            },
            props.value
          )
        );
      };
    },

    noodlNodeAsProp: true,
    usePortAsLabel: 'label',

    // Structure, not decisions. These are what make the node a box at all, so
    // they are not ports. The test: if you can imagine wanting to change one
    // from the graph, it was a decision — move it into inputCss.
    defaultCss: { display: 'flex', flexDirection: 'column', borderStyle: 'solid' },

    // Values handed to the React component above, for the elements it draws
    // itself. A colour for inner text has to live here — inputCss styles only
    // this node's own outer box.
    inputProps: {
      label: { type: 'string', displayName: 'Label', group: 'Content', default: 'Revenue' },
      value: {
        type: 'string',
        displayName: 'Value',
        group: 'Content',
        default: '—',
        description: 'Format the number in the graph — a Function or Expression node — not in here.'
      },
      highlighted: {
        type: 'boolean',
        displayName: 'Highlighted',
        group: 'Content',
        default: false,
        description: 'Drive this from an Expression node. The threshold is a decision, so it belongs in the graph.'
      },

      gap: { type: { name: 'number', units: ['px'], defaultUnit: 'px' }, displayName: 'Gap', group: 'Style', default: 'var(--space-1)' },
      labelSize: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Label Size',
        group: 'Style',
        default: 'var(--text-sm)'
      },
      valueSize: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Value Size',
        group: 'Style',
        default: 'var(--text-2xl)'
      },
      labelColor: { type: 'color', displayName: 'Label Colour', group: 'Style', default: 'var(--muted-foreground)' },
      highlightColor: { type: 'color', displayName: 'Highlight Colour', group: 'Style', default: 'var(--primary)' }
    },

    // Styles written straight onto this node's own element.
    inputCss: {
      backgroundColor: { type: 'color', displayName: 'Background', group: 'Style', default: 'var(--surface-raised)' },
      color: { type: 'color', displayName: 'Text Colour', group: 'Style', default: 'var(--foreground)' },
      borderColor: { type: 'color', displayName: 'Border Colour', group: 'Style', default: 'var(--border)' },
      borderWidth: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Border Width',
        group: 'Style',
        default: 'var(--border-1)'
      },
      borderRadius: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Corner Radius',
        group: 'Style',
        default: 'var(--radius-md)'
      },
      padding: {
        type: { name: 'number', units: ['px'], defaultUnit: 'px' },
        displayName: 'Padding',
        group: 'Style',
        default: 'var(--space-4)'
      }
    },

    // What this node sends back out into the graph.
    outputProps: {
      onClick: { type: 'signal', displayName: 'Click', group: 'Events' }
    }
  };

  /** @type {import('${TYPES_SPECIFIER}').NodeKitModule} */
  var kit = {
    reactNodes: [${EXAMPLE_NODE.id}]
  };

  Noodl.defineModule(kit);
})();
`;
}

/** `manifest.json` — how the runtime finds the kit. @param {{ dirName: string, displayName: string }} kit */
function manifestJson(kit, typesVersion) {
  return (
    JSON.stringify(
      {
        name: kit.displayName,
        main: 'index.js',
        dependencies: [],
        // Not read by the runtime — the scan ignores unknown fields on purpose
        // (`@nodegx/module-inject`'s schema is open). It is here so a kit on
        // disk can say which types it was scaffolded against without anybody
        // opening the .d.ts, which is what makes the copy's staleness a
        // question with an answer.
        nodeKitTypes: typesVersion
      },
      null,
      2
    ) + '\n'
  );
}

/** `README.md` — where P2 is argued rather than asserted. */
function readmeMd(kit, typesVersion) {
  const type = nodeTypeName(kit.dirName, EXAMPLE_NODE.id);
  const row = (p) => `| \`${p.name}\` | ${p.where} | ${p.type} | ${p.default ? `\`${p.default}\`` : '—'} | ${p.doc} |`;
  const ports = EXAMPLE_PORTS.map(row).join('\n');

  return `# ${kit.displayName}

A NodeGX node kit: custom nodes written in plain JavaScript, living in this
project, usable exactly like built-in nodes.

There is no build step. No npm install, no bundler, no SDK. \`index.js\` is
loaded by the runtime as-is, and React arrives as \`window.React\` before it runs.

## Try it

1. Reload the preview (the kit is loaded when the project's runtime starts).
2. Open the node picker and search for **${EXAMPLE_NODE.displayName}**.
3. Drop it on a canvas. Every port below is already on it, already on the
   project's design tokens.

## The rule this kit is written to

> **Ports are the product. JavaScript is the escape hatch.**

Every decision an app builder should own is a port. Colour, spacing, radius,
font size — and, the one that is easy to get wrong, **every threshold**.

\`${EXAMPLE_NODE.displayName}\` has a \`Highlighted\` input and no opinion whatsoever about when
it should be true. That is deliberate. The obvious shortcut is:

\`\`\`js
// DON'T. This is the mistake this kit exists to not teach.
color: props.value > 1000 ? 'red' : 'inherit'
\`\`\`

Now the number \`1000\` and the colour \`red\` live in a JavaScript file. They are
invisible on the canvas, they cannot be changed per instance, they cannot be
driven by data, and changing either means editing code and reloading.

Wire it in the graph instead:

\`\`\`
  Static Data / Record  ──value──▶  Expression                 ${EXAMPLE_NODE.displayName}
                                    "value > threshold"  ──▶  Highlighted
                                                              Highlight Colour ← var(--destructive)
\`\`\`

Now the threshold is a port on a node anybody can see, the colour is a token,
and both are editable without opening an editor. That is the whole argument.

**The same rule applies to formatting.** \`Value\` is a string: turn 1234.5 into
"£1,234.50" in a Function or Expression node, where the format is visible and
reusable, rather than inside \`getReactComponent\`.

## Design tokens, not hex

Every colour and spacing port defaults to a \`var(--token)\` from the project's
design system, so a node from this kit matches the app it is dropped into and
follows the theme when it changes. Raw hex and px still work — brand colours
and data-viz palettes are legitimate — but the default is the system.

## Ports

| Port | Where | Type | Default | Notes |
|---|---|---|---|---|
${ports}

**\`inputProps\` vs \`inputCss\`** is a real distinction, not bookkeeping:
\`inputCss\` styles *this node's own box* and the runtime writes it to the DOM;
\`inputProps\` hands a value to the React component for the elements it draws
itself. Inner text colour has to be an \`inputProp\` — there is no other route
to it.

## Adding a node

1. Write a second definition object in \`index.js\`, annotated the same way.
2. Give it a \`name\` under this kit's prefix — \`${kit.dirName}.YourNode\` — so two
   kits in one project can never collide.
3. Add it to \`kit.reactNodes\`.
4. Reload the preview.

## Autocomplete

\`types/${KIT_TYPES_FILENAME}\` is a copy of \`@nodegx/node-kit-types\` (version
${typesVersion}), written here by the scaffold. The \`@type\` annotations in
\`index.js\` reach it by relative path, which is what makes autocomplete work with
no \`node_modules\` and no \`tsconfig.json\`.

It is a copy because it has to be: a bare package specifier does not resolve
inside a folder with no \`node_modules\`, and adding one would mean an install
step this kit is specifically designed not to need.

Editing that file changes nothing the runtime enforces — it describes the shape
the runtime already expects, it does not check it.

## Files

| File | What it is |
|---|---|
| \`manifest.json\` | How the runtime finds the kit. \`main\` points at \`index.js\`. |
| \`index.js\` | The node definitions. Loaded as-is. |
| \`types/${KIT_TYPES_FILENAME}\` | The definition types, for autocomplete only. |

The node type this kit registers is \`${type}\`.
`;
}

// ─── The two entry points ────────────────────────────────────────────────────

/**
 * The file set for a kit, as data. No filesystem writes.
 *
 * Pure so that both callers can preview, test and diff the output without a
 * temp directory — and so the property that matters (what the generated node
 * teaches) is checkable in a unit test rather than only by scaffolding.
 *
 * @param {{ name: string }} options
 * @returns {{ ok: true, kit: object, files: {path: string, contents: string}[] } | { ok: false, code: string, message: string }}
 */
function scaffoldKitFiles(options) {
  const resolved = resolveKitName((options || {}).name);
  if (!resolved.ok) return resolved;

  const kit = { dirName: resolved.dirName, displayName: resolved.displayName };
  const types = readPublishedTypes();

  return {
    ok: true,
    kit: {
      dirName: kit.dirName,
      displayName: kit.displayName,
      nodeType: nodeTypeName(kit.dirName, EXAMPLE_NODE.id),
      nodeDisplayName: EXAMPLE_NODE.displayName,
      typesVersion: types.version
    },
    files: [
      { path: 'manifest.json', contents: manifestJson(kit, types.version) },
      { path: 'index.js', contents: indexJs(kit) },
      { path: 'README.md', contents: readmeMd(kit, types.version) },
      { path: KIT_TYPES_RELPATH, contents: typesStamp(types.version) + types.body }
    ]
  };
}

/**
 * Write a kit into a project.
 *
 * ⚠️ **Refuses rather than overwrites.** A scaffold that clobbered an existing
 * kit would destroy an author's work on a name collision, and a name collision
 * is the likeliest way to call this twice. The check is on the *directory*, so
 * it fires even if the previous kit has been emptied — the same conservatism
 * `registerLibrary` uses.
 *
 * @param {string} projectDir
 * @param {{ name: string }} options
 * @returns {Promise<{ok: true, kit: object, kitDir: string, written: string[]} | {ok: false, code: string, message: string}>}
 */
async function writeKitScaffold(projectDir, options) {
  if (!projectDir || typeof projectDir !== 'string') {
    return { ok: false, code: 'no-project', message: 'A project directory is required.' };
  }

  const planned = scaffoldKitFiles(options);
  if (!planned.ok) return planned;

  const kitDir = path.join(projectDir, 'noodl_modules', planned.kit.dirName);

  if (fs.existsSync(kitDir)) {
    return {
      ok: false,
      code: 'kit-exists',
      message: `noodl_modules/${planned.kit.dirName} already exists. Pick a different name, or delete that folder first — the scaffold will not overwrite a kit.`
    };
  }

  const written = [];
  for (const file of planned.files) {
    const target = path.join(kitDir, ...file.path.split('/'));
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, file.contents, 'utf8');
    written.push(path.posix.join('noodl_modules', planned.kit.dirName, file.path));
  }

  return { ok: true, kit: planned.kit, kitDir, written };
}

module.exports = {
  KIT_TYPES_FILENAME,
  KIT_TYPES_RELPATH,
  TYPES_SPECIFIER,
  EXAMPLE_PORTS,
  EXAMPLE_NODE,
  slugify,
  resolveKitName,
  nodeTypeName,
  readPublishedTypes,
  typesCopyStatus,
  scaffoldKitFiles,
  writeKitScaffold
};
