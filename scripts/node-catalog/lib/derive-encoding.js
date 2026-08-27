/**
 * SUB-013 §1–§3 — turn observed port emissions into a `parameterEncoding` block.
 *
 * Derivation is from seed runs A and B; run C is held out and every pattern must reproduce it.
 * That verification is not a nicety — a pattern nobody checked is the same prose problem one
 * abstraction up, and this phase has repeatedly found that "a fix reported as done is a
 * hypothesis too". A pattern that fails against C fails generation, loudly, in CI.
 *
 * Nodes that cannot be observed get `{ known: false, reason }` rather than an invented pattern
 * (§3). That mirrors SUB-006's `DynamicPortSkipped`: surfacing that something was deliberately
 * not determined beats silent absence, and it gives the coverage number an honest denominator.
 */

const {
  TOKEN_SETS,
  seedRunFor,
  numberedSeedRunFor,
  templatize,
  templatizeIndex,
  patternToRegExp,
  mostSpecificMatch,
  isTypeSelector,
  plugOf,
  typeNameOf,
  driveSetup
} = require('./parameter-encoding');

/** Why a given node type has no observable encoding. Keyed by type name, then by fallback rule. */
const RESIDUE_REASONS = {
  'Component Inputs':
    'Ports mirror the component input declarations the author makes on this node; the names are whatever they typed, with no prefix or transformation.',
  'Component Outputs':
    'Ports mirror the component output declarations the author makes on this node; the names are whatever they typed, with no prefix or transformation.',
  'For Each':
    'Input ports mirror the input ports of the template component chosen by the `template` parameter, name for name. They cannot be derived from this node\'s own parameters.',
  'Logic Builder': 'Ports follow the visual logic program stored in the node parameters.',
  'Event Receiver':
    'Output ports mirror the payload of whatever `Event Sender` nodes publish on the channel named by the `channelName` parameter — they are derived from another node, not from this one.',
  REST2: 'Ports are parsed from the request and response scripts in the node parameters.',
  'net.noodl.HTTP': 'Ports are parsed from the configured headers, query parameters and response mappings in the node parameters.',
  Globals: 'Ports follow the global variables the project defines at runtime.',
  'Script Downloader': 'Ports follow the script loaded at runtime.',
  'Filter Collection': 'Ports follow the filter script in the node parameters.',
  'Set Variable':
    'The `name` parameter selects which variable is written; it does not appear in any port name. The single dynamic port is `value`, whose *type* follows the `setWith` parameter.',
  Router: 'Ports are computed by the editor from the project\'s page components (RouterAdapter).',
  RouterNavigate: 'Ports are computed by the editor from the target page component\'s parameters (RouterNavigateAdapter).',
  PageInputs: 'Ports are computed by the editor from the route that reaches the containing page component (PageInputsAdapter).',
  CloudFunction2: 'Ports are computed by the editor from the selected cloud function component\'s inputs and outputs (CloudFunctionAdapter).',
  PageStackNavigate: 'Ports mirror the input ports of the target page component.',
  NavigationShowPopup: 'Ports mirror the input ports of the target popup component, and the results and close actions its `Close Popup` nodes declare.',
  Page: 'Ports follow the component the page renders.'
};

const DECLARED_ONLY_REASON =
  'This node computes no port names. Its dynamic behaviour is visibility only: every port it can ever have is listed in `inputs`/`outputs` above, and `dynamicPorts.declaredPortGroups` says which parameter values reveal which of them.';

/**
 * FB-026 — node types that push dynamic ports **over their own statically declared ones**, to
 * narrow a type, and mint no new names.
 *
 * `runtime-discovered` otherwise carries the sentence *"the static port list below is incomplete
 * for such instances"*, and `residueFor` otherwise falls through to *"no parameter on this node
 * carries the list its ports are generated from"*. Both are false for a node like this, and the
 * second is the more expensive: `known: false` tells an AI reading the catalog that it cannot
 * trust the port list, when the port list is exactly right and only a `type` moves.
 *
 * Text Input is the first. Its `Value` ports are declared `'*'` — the only true answer where
 * nothing is running to narrow them — and `updatePorts` republishes those same two names as
 * `string` or `number` from the `Type` parameter once an editor is connected.
 *
 * ⚠️ **The entry is a claim, and `parameter-encoding`'s headless drive is what checks it**: the
 * generator runs the node's `setup` and refuses an entry here whose published port names are not
 * already in the static list. A node added here that really does mint a name fails the build
 * rather than publishing a reassuring lie.
 *
 * 🔴 **Near neighbour that reads like this shape and is not: `Set Variable`. Measured
 * 2026-08-27, and the answer is that it must stay `known: false`.** Its `RESIDUE_REASONS`
 * sentence — *"the single dynamic port is `value`, whose type follows the `setWith`
 * parameter"* — invites exactly this table, and the invitation is wrong on the one fact
 * that matters here: **`value` is not a declared port.** `setvariablenode.ts` declares
 * `name`, `setWith` and `do`; `value` is minted at runtime by `registerInputIfNeeded` and
 * published by the `setup` hook. Two differences from Text Input follow, and either one is
 * disqualifying on its own:
 *
 *   1. Text Input declares both value ports as `'*'` and only ever **narrows** them. Set
 *      Variable's port has no static existence to narrow.
 *   2. With `setWith === 'emptyString'` the hook publishes **no ports at all** — the port
 *      does not change type, it **disappears**. A reader told the static list is complete
 *      would be wrong in both directions.
 *
 * ✅ **The measurement is the guard below, run over the real corpus rather than reasoned
 * about**: the entry was added, `catalog:generate` was run, and `retypesEncoding` threw —
 * *"its setup published value — not in its static port list"*. So `runtime-discovered` and
 * `known: false` are both telling the truth for this node, the explicit `RESIDUE_REASONS`
 * text already says precisely which port and which parameter, and the expensive failure this
 * table exists to prevent (an AI told the port list cannot be trusted when it is exactly
 * right) does not apply — here the list really is incomplete.
 */
const RETYPES_DECLARED_PORTS = {
  'net.noodl.controls.textinput':
    'This node mints no port names. Its two value ports are declared `\'*\'` above and are ' +
    'republished per instance with a narrowed type — `number` when the `type` parameter is ' +
    '`number`, `string` otherwise — so the port list above is complete and only the `type` field ' +
    'moves.'
};

/**
 * @param {string} typeName
 * @param {object} metadata     live register metadata
 * @param {object} rawDef       the definition passed to registerNode
 * @param {object} dynamicPorts the catalog's own dynamicPorts block (already built)
 * @returns {object|null} a parameterEncoding block, or null when the node has no dynamic ports
 */
function deriveEncoding(typeName, metadata, rawDef, dynamicPorts) {
  if (!dynamicPorts) return null;

  // FB-026 — a node that only re-types ports it already declares. Checked, not asserted; see
  // `retypesEncoding`, which throws rather than publishing an unverified `known: true`.
  if (RETYPES_DECLARED_PORTS[typeName]) {
    return retypesEncoding(typeName, metadata, rawDef, RETYPES_DECLARED_PORTS[typeName]);
  }

  const rawNode = rawDef && rawDef.node ? rawDef.node : undefined;
  const numberedInputs = rawNode && rawNode.numberedInputs;

  const runs = [];
  for (let i = 0; i < TOKEN_SETS.length; i++) {
    const seed = numberedInputs ? numberedSeedRunFor(numberedInputs, i) : seedRunFor(typeName, metadata, i);
    if (!seed) break;
    let observed;
    try {
      observed = driveSetup(typeName, rawDef, seed.parameters, seed.projectMetadata);
    } catch (err) {
      // A hook that throws against this fake graph is telling us it needs project context we
      // cannot supply — the same answer as emitting nothing, so it lands in the residue. Only
      // *verification* failures are allowed to fail generation; an observation that does not
      // happen is a fact about coverage, not a broken catalog.
      return residueFor(typeName, dynamicPorts, runs, err);
    }
    runs.push({ seed, ports: observed.ports || [] });
  }

  const emitted = runs.filter((r) => r.ports.length);
  if (runs.length < TOKEN_SETS.length || emitted.length < TOKEN_SETS.length) {
    return residueFor(typeName, dynamicPorts, runs);
  }

  const entries = numberedInputs ? deriveNumbered(runs) : deriveNamed(runs);
  if (!entries.length) return residueFor(typeName, dynamicPorts, runs);

  verify(typeName, entries, runs[2], numberedInputs);

  // The type-selector pass: does any pattern's value type follow another parameter?
  applyTypeDependencies(typeName, rawDef, runs[0], entries);

  const encoding = {
    known: true,
    seededBy: numberedInputs ? [] : runs[0].seed.seededBy || []
  };
  const seededByMetadata = runs[0].seed.seededByMetadata || [];
  if (seededByMetadata.length) encoding.seededByProjectMetadata = seededByMetadata;

  encoding.patterns = entries.map((entry) => toCatalogPattern(entry, runs[0].seed.tokenMap));

  const notes = noteFor(entries, numberedInputs);
  if (notes) encoding.notes = notes;

  return encoding;
}

/** Derive patterns from runs A and B by templating out the seed tokens. */
function deriveNamed(runs) {
  /** pattern -> { plug, types:Set, variables, examples:[], seenIn:Set } */
  const byPattern = new Map();

  runs.slice(0, 2).forEach((run, runIndex) => {
    for (const port of run.ports) {
      const { pattern, variables } = templatize(port.name, run.seed.tokenMap);
      if (!byPattern.has(pattern)) {
        byPattern.set(pattern, {
          pattern,
          plug: plugOf(port),
          types: new Set(),
          groups: new Set(),
          variables,
          examples: [],
          seenIn: new Set()
        });
      }
      const entry = byPattern.get(pattern);
      entry.types.add(typeNameOf(port));
      entry.seenIn.add(runIndex);
      entry.examples.push(port.name);
      // The editor group, templated the same way. It is where the author will find the port in
      // the property panel, and for several nodes the group name is itself interpolated
      // (`Sa1 Transitions`), which says more about the layout than a sentence would.
      if (port.group) entry.groups.add(templatize(port.group, run.seed.tokenMap).pattern);
    }
  });

  const result = [];
  for (const entry of byPattern.values()) {
    // A pattern with no variable is a fixed port name that happens to be delivered dynamically
    // (`States`' `currentState`). Keep it — an author authoring against this node needs to know
    // it exists and that it is not derived from anything — but only when both runs agree, or a
    // one-run-only constant is just an artefact of that run's arity.
    if (!entry.variables.length && entry.seenIn.size < 2) continue;
    result.push(entry);
  }
  return result.sort((a, b) => (a.pattern < b.pattern ? -1 : a.pattern > b.pattern ? 1 : 0));
}

/** Derive the `<base> <N>` series, generalising the integer only once two values are observed. */
function deriveNumbered(runs) {
  const byShape = new Map();
  runs.slice(0, 2).forEach((run) => {
    for (const port of run.ports) {
      const shape = templatizeIndex(port.name);
      if (!byShape.has(shape)) {
        byShape.set(shape, {
          pattern: shape,
          plug: plugOf(port),
          types: new Set(),
          groups: new Set(),
          variables: ['N'],
          examples: [],
          indices: new Set()
        });
      }
      const entry = byShape.get(shape);
      entry.types.add(typeNameOf(port));
      entry.indices.add(port.name);
      entry.examples.push(port.name);
    }
  });
  return [...byShape.values()]
    .filter((e) => e.indices.size >= 2)
    .sort((a, b) => (a.pattern < b.pattern ? -1 : 1));
}

/**
 * Success criterion 2 — every pattern reproduces the held-out run, and the held-out run produces
 * nothing the patterns miss. Both halves matter: the first catches a pattern that over-fits the
 * seeds it came from, the second catches a formula the derivation never saw because run A and B
 * happened not to reach it.
 */
function verify(typeName, entries, runC, numberedInputs) {
  const derived = new Set(entries.map((e) => e.pattern));

  // (1) Templating run C's names with run C's own tokens must land on exactly the same set of
  //     patterns. This is the strong half. Matching names against pattern *regexes* is not
  //     enough on its own: a bare `<value>` pattern — which `States` genuinely has, its value
  //     output being named for the value itself — compiles to `^(.+)$` and matches every name
  //     there is, so a regex-only check reports total coverage while learning nothing.
  const fromC = new Set();
  for (const port of runC.ports) {
    const { pattern } = numberedInputs ? { pattern: templatizeIndex(port.name) } : templatize(port.name, runC.seed.tokenMap);
    fromC.add(pattern);
  }

  const missing = [...fromC].filter((p) => !derived.has(p));
  if (missing.length) {
    throw new Error(
      `parameterEncoding for "${typeName}" does not reproduce the runtime: seed run C emitted ports matching ` +
        `${missing.map((p) => `"${p}"`).join(', ')}, which the patterns derived from runs A and B do not contain. ` +
        'Either the seeds miss a branch of the port helper, or the derivation is wrong.'
    );
  }

  const extra = [...derived].filter((p) => !fromC.has(p));
  if (extra.length) {
    throw new Error(
      `parameterEncoding for "${typeName}" carries ${extra.map((p) => `"${p}"`).join(', ')}, which seed run C ` +
        'never produced. A pattern the runtime does not emit is worse than no pattern.'
    );
  }

  // (2) And the published pattern strings must actually match the concrete names, so a
  //     templating bug cannot agree with itself in both directions and pass.
  for (const port of runC.ports) {
    if (!entries.some((e) => patternToRegExp(e.pattern).test(port.name))) {
      throw new Error(
        `parameterEncoding for "${typeName}": no published pattern matches the emitted port "${port.name}".`
      );
    }
  }
}

/**
 * Re-run seed A with every type-selector port flipped to `boolean`, and record which patterns
 * followed. `States` types `value-<state>-<value>` from the matching `type-<value>` parameter,
 * and an author who does not know that writes a number into a colour.
 */
function applyTypeDependencies(typeName, rawDef, runA, patterns) {
  const selectors = runA.ports.filter(isTypeSelector);
  if (!selectors.length) return;

  const flipped = { ...runA.seed.parameters };
  for (const port of selectors) flipped[port.name] = 'boolean';

  const observed = driveSetup(typeName, rawDef, flipped, runA.seed.projectMetadata);
  const typeAfter = new Map(observed.ports.map((p) => [p.name, typeNameOf(p)]));
  const typeBefore = new Map(runA.ports.map((p) => [p.name, typeNameOf(p)]));

  // Which pattern do the selector ports themselves belong to? Most specific wins, by literal
  // content: `States` has a bare `<value>` pattern for the value output, which compiles to
  // `^(.+)$` and matches `type-Va1` as readily as `type-<value>` does. Taking the first match
  // pointed the author at the wrong parameter — a plausible sentence naming a real port, which
  // is the hardest kind of wrong to notice.
  const selectorPattern = selectors
    .map((s) => mostSpecificMatch(patterns, s.name))
    .find(Boolean);

  for (const entry of patterns) {
    const re = patternToRegExp(entry.pattern);
    const members = [...typeBefore.keys()].filter((name) => re.test(name));
    if (!members.length) continue;
    const followed = members.every((name) => typeBefore.get(name) !== 'boolean' && typeAfter.get(name) === 'boolean');
    if (followed && selectorPattern && selectorPattern !== entry) {
      entry.valueTypeFollows = selectorPattern.pattern;
    }
  }
}

function noteFor(entries, numberedInputs) {
  const notes = [];
  if (numberedInputs) {
    notes.push(
      'The series is dense and zero-based, and the editor always offers one more port than the highest index in use. ' +
        'Write the indices you need contiguously from 0.'
    );
  }
  // A seed token carrying a space came back inside a port name, so the value is interpolated
  // raw. This is observed, not asserted: `Vb sp` is in the seed set precisely to test it, and
  // the note appears only for the nodes where it survived the round trip.
  if (entries.some((entry) => entry.variables.length && entry.examples.some((example) => /\s/.test(example)))) {
    notes.push(
      'Names are interpolated verbatim, including spaces — a value called `bg color` produces a port called ' +
        '`value-true-bg color`, not `value-true-bgColor`.'
    );
  }
  return notes.join(' ') || undefined;
}

/**
 * FB-026 — the check behind a `RETYPES_DECLARED_PORTS` entry.
 *
 * The entry claims two things: that the node's `setup` mints no port name that is not already
 * declared, and that it publishes ports at all. Both are driven here rather than believed, and a
 * failure **throws**, per this file's rule that a verification failure fails generation while a
 * missing observation only lands in the residue. A node added to that table that really does mint
 * a name therefore breaks the build instead of publishing a reassuring lie into the catalog.
 *
 * ⚠️ The emptiness guard is not decoration. Without it the name check passes vacuously the day
 * the hook stops emitting — an absence asserted with no known-firing signal beside it — and the
 * catalog would keep saying `known: true` about a narrowing that no longer happens.
 *
 * Driven twice, because the narrowing is a *branch*: `type: 'number'` and the default have to be
 * exercised or half the rule is unmeasured.
 */
function retypesEncoding(typeName, metadata, rawDef, notes) {
  const declared = new Set([
    ...Object.keys((metadata && metadata.inputs) || {}),
    ...Object.keys((metadata && metadata.outputs) || {})
  ]);

  const observedNames = new Set();

  for (const parameters of [{}, { type: 'number' }]) {
    const observed = driveSetup(typeName, rawDef, parameters, {});
    for (const port of observed.ports || []) observedNames.add(port.name);
  }

  if (!observedNames.size) {
    throw new Error(
      `${typeName} is listed in RETYPES_DECLARED_PORTS but its setup published no ports at all. ` +
        'Either the narrowing was removed — in which case remove the entry — or the hook no longer runs.'
    );
  }

  const minted = [...observedNames].filter((name) => !declared.has(name));
  if (minted.length) {
    throw new Error(
      `${typeName} is listed in RETYPES_DECLARED_PORTS, which claims it mints no port names, but ` +
        `its setup published ${minted.join(', ')} — not in its static port list. Remove the entry: ` +
        'the static port list really is incomplete for this node.'
    );
  }

  return { known: true, patterns: [], seededBy: [], notes };
}

function residueFor(typeName, dynamicPorts, runs, error) {
  const explicit = RESIDUE_REASONS[typeName];
  if (explicit) return { known: false, reason: explicit };

  if (error) {
    return {
      known: false,
      reason:
        'The port helper could not be run headlessly — it needs project context this generator does not have ' +
        `(${String(error.message || error).split('\n')[0]}).`
    };
  }

  const mechanisms = dynamicPorts.mechanisms || [];
  if (mechanisms.length === 1 && mechanisms[0] === 'declared-port-groups') {
    return { known: true, patterns: [], seededBy: [], notes: DECLARED_ONLY_REASON };
  }
  // FB-026. Ahead of every `known: false` rule below, because this node's port list *is* known —
  // see RETYPES_DECLARED_PORTS.
  if (RETYPES_DECLARED_PORTS[typeName]) {
    return { known: true, patterns: [], seededBy: [], notes: RETYPES_DECLARED_PORTS[typeName] };
  }
  if (mechanisms.includes('editor-adapter')) {
    return {
      known: false,
      reason: `Ports are computed by the editor from project context (${dynamicPorts.editorAdapter}), not from this node's parameters.`
    };
  }
  if (mechanisms.includes('component-ports')) {
    return { known: false, reason: 'Ports are declared per instance by the author and are not derived from a parameter.' };
  }
  if (!runs.length) {
    return {
      known: false,
      reason:
        'No parameter on this node carries the list its ports are generated from, so the port set could not be observed headlessly.'
    };
  }
  return {
    known: false,
    reason:
      'The port helper needs project context this generator cannot supply headlessly — a live component, a connected node, or a backend schema.'
  };
}

/** Shape the derived entry into its catalog form. */
function toCatalogPattern(entry, tokenMap) {
  const pattern = { pattern: entry.pattern, plug: entry.plug };

  if (entry.variables.length) {
    pattern.variables = {};
    for (const variable of entry.variables) {
      if (variable === 'N') {
        pattern.variables.N = 'a zero-based index into the series';
        continue;
      }
      const source = Object.values(tokenMap).find((t) => t.variable === variable);
      pattern.variables[variable] = source ? source.describe() : 'derived from this node\'s parameters';
    }
  }

  const groups = [...(entry.groups || [])].filter(Boolean);
  if (groups.length === 1) pattern.group = groups[0];

  const types = [...entry.types].filter(Boolean);
  if (entry.valueTypeFollows) pattern.valueType = `follows the matching \`${entry.valueTypeFollows}\` parameter`;
  else if (types.length === 1) pattern.valueType = types[0];
  else if (types.length > 1) pattern.valueType = 'varies';

  // Prefer an example that carries a space. Every example here is a real observed emission, but
  // `value-Sb1-Vb sp` teaches something `value-Sa1-Va1` does not: that the interpolation is raw.
  // That is the one case naive guessing gets wrong, so it is the one worth printing.
  pattern.example = entry.examples.find((e) => /\s/.test(e)) || entry.examples[0];
  return pattern;
}

module.exports = { deriveEncoding, toCatalogPattern, RESIDUE_REASONS, DECLARED_ONLY_REASON, RETYPES_DECLARED_PORTS };
