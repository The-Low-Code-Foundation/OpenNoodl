/**
 * SUB-013 — derive each node's `parameters` key formulas by observation.
 *
 * `docs/node-catalog/SCHEMA.md` promises a reader with no other context enough to author a
 * project file. For static ports it delivers. For dynamic ports it delivered prose — *"each value
 * gets per-state value inputs"* — which tells an author that ports exist without telling them what
 * they are called. Nobody derives `value-true-bg color` from that sentence, and ~80 of the 89
 * dynamic-port node types had nothing better.
 *
 * The formulas are not hidden: they are built literally, in the port-generation helpers
 * (`'value-' + state + '-' + value`). But reading them out of source would put the catalog back in
 * the business of parsing node files, which SUB-004 spent its whole design avoiding. So they are
 * *observed* instead — `observe-ports.js` drives each module's real `setup` hook and records what
 * `sendDynamicPorts` receives. This module supplies the seeds, turns emissions into patterns, and
 * verifies the patterns reproduce what the runtime actually emits.
 *
 * Four runs per node, and each has a job:
 *
 *   A, B  differ in arity, so a name that interpolates one variable can be told apart from a name
 *         that interpolates two and from a name that interpolates none. The formula falls out of
 *         the diff; one run alone cannot distinguish "constant" from "coincidence".
 *   C     is held out. Every pattern derived from A and B must reproduce C's port names exactly,
 *         and every one must be exercised by C, or generation fails. That is success criterion 2,
 *         and it runs in CI through `catalog:check` rather than being a thing a reviewer is asked
 *         to take on trust.
 *   T     repeats A with every type-selector port flipped, which is how `valueType` gets to say
 *         "follows the `type-<value>` parameter" as an observation rather than a guess.
 */

const { driveSetup } = require('./observe-ports');

/**
 * Seed tokens. Deliberately alien, so a token cannot collide with fixed text in a port name and
 * be templated away by accident — `value-Sa1-Va1` is unambiguous in a way `value-a-b` is not.
 *
 * `Vb sp` earns its place: `States` interpolates value names raw, spaces and all, which is how a
 * real project ends up with a port called `value-true-bg color`. A seed set of tidy identifiers
 * would document a format that nobody can actually get wrong.
 */
const TOKEN_SETS = [
  { label: 'A', primary: ['Sa1', 'Sa2'], secondary: ['Va1'], tertiary: ['Ta1'] },
  { label: 'B', primary: ['Sb1'], secondary: ['Vb1', 'Vb sp'], tertiary: ['Tb1', 'Tb2'] },
  { label: 'C', primary: ['Sc1', 'Sc2', 'Sc3'], secondary: ['Vc1', 'Vc2'], tertiary: ['Tc1'] }
];

/**
 * Static input port types whose value *is* a list of author-chosen names, and how to write one.
 *
 * This is the mechanical half of seed discovery, and it is a type-driven rule rather than a table
 * of node names: a node whose ports are generated from what the author typed almost always takes
 * that list through a `stringlist` or `proplist` input. `States` seeds from `states`/`values`, the
 * Function node from `scriptInputs`/`scriptOutputs`, `Event Sender` from `payload`, `Page Stack`
 * from `pages` — none of which had to be known in advance.
 */
const LIST_PORT_SEEDS = {
  stringlist: {
    write: (tokens) => tokens.join(','),
    tokensOf: (tokens) => tokens.map((t) => ({ token: t, role: 'entry' })),
    describe: (parameter) => `one of the comma-separated entries in the \`${parameter}\` parameter`
  },
  // A proplist row has both a `label` the author types and an `id` the editor generates, and
  // which of the two a port name interpolates is not something an author can guess — `Page Stack`
  // keys its ports off the *id*. Seeding them with distinguishable tokens is what lets the
  // derivation tell them apart instead of reporting a plausible wrong answer.
  proplist: {
    write: (tokens) => tokens.map((label) => ({ id: `${label}Id`, label })),
    tokensOf: (tokens) => tokens.flatMap((t) => [
      { token: `${t}Id`, role: 'id' },
      { token: t, role: 'label' }
    ]),
    describe: (parameter, role) =>
      role === 'id'
        ? `the \`id\` of a row in the \`${parameter}\` parameter — an editor-generated identifier, not a name you choose`
        : `the \`label\` of a row in the \`${parameter}\` parameter`
  }
};

/**
 * The curated half: parameters that carry a small language rather than a list, where the seed has
 * to be written in that language. There is no port type to key off — these are all plain `string`
 * inputs — so they are named here, and the variable description says what the syntax is. Only the
 * way *in* is curated; the patterns that come out are still observed.
 */
const SYNTAX_SEEDS = {
  Expression: {
    expression: {
      write: (tokens) => tokens.join(' + '),
      describe: () => 'a free variable referenced in the `expression` parameter'
    }
  },
  'String Format': {
    format: {
      write: (tokens) => tokens.map((n) => `{${n}}`).join(' '),
      describe: () => 'a `{placeholder}` appearing in the `format` parameter'
    }
  },
  JavaScriptFunction: {
    functionScript: {
      write: (tokens) => tokens.map((n) => `const ${n.replace(/\W/g, '_')} = Inputs['${n}'];`).join('\n'),
      describe: () => 'a name read as `Inputs.<name>` or assigned as `Outputs.<name>` in the `functionScript` parameter'
    }
  }
};

/**
 * Project metadata some nodes read their port set out of instead of a parameter. This is the fact
 * an author most needs about them and the one prose never said: the keys are not derived from
 * anything on the node — they come from a cloud database class schema, and the node's own
 * `collectionName` parameter only *selects* which one.
 */
const METADATA_SEEDS = {
  dbCollections: (tokens) => [
    {
      name: 'SeedClass',
      schema: { properties: Object.fromEntries(tokens.map((t) => [t, { type: 'String' }])) }
    }
  ],
  systemCollections: () => []
};

/** Nodes whose port hook reads a class schema; the parameter that selects the class. */
const METADATA_DRIVEN = {
  DbModel2: 'collectionName',
  SetDbModelProperties: 'collectionName',
  NewDbModelProperties: 'collectionName',
  DeleteDbModelProperties: 'collectionName',
  DbCollection2: 'collectionName',
  FilterDBModels: 'collectionName',
  AddDbModelRelation: 'collectionName',
  RemoveDbModelRelation: 'collectionName',
  DbModel: 'collectionName',
  DbCollection: 'collectionName'
};

/** Parameters that must be present for a hook to do anything, but that contribute no names. */
const ENABLING_PARAMETERS = {
  States: { useTransitions: true },
  'For Each': { templateType: 'explicit' }
};

/** `states` → `state`, `properties` → `property`, `payload` → `payload`. */
function singularize(name) {
  if (/ies$/.test(name)) return name.replace(/ies$/, 'y');
  if (/[^s]s$/.test(name)) return name.replace(/s$/, '');
  return name;
}

/**
 * Build one seed run for a node: the parameters to set, the project metadata to expose, and a map
 * from every token used to the variable it stands for and how to describe that variable.
 */
function seedRunFor(typeName, metadata, seedIndex) {
  const tokens = TOKEN_SETS[seedIndex];
  if (!tokens) throw new Error(`No seed set ${seedIndex}`);

  const parameters = { ...(ENABLING_PARAMETERS[typeName] || {}) };
  const projectMetadata = {};
  const seededBy = [];
  const seededByMetadata = [];
  /** token -> { variable, describe } */
  const tokenMap = {};

  const claim = (pool, parameter, variable, describe, tokensOf) => {
    for (const { token, role } of tokensOf(pool)) {
      tokenMap[token] = { variable: role === 'id' ? `${variable}Id` : variable, describe: () => describe(parameter, role) };
    }
  };

  const inputs = metadata.inputs || {};
  const listInputs = Object.keys(inputs)
    .sort()
    .filter((name) => {
      const type = inputs[name].type;
      const typeName2 = typeof type === 'string' ? type : type && type.name;
      return Object.prototype.hasOwnProperty.call(LIST_PORT_SEEDS, typeName2);
    });

  // The first list input takes the primary tokens, the rest the secondary ones. Two distinct
  // pools is what makes a two-variable formula like `value-<state>-<value>` separable at all.
  listInputs.forEach((name, i) => {
    const type = inputs[name].type;
    const spec = LIST_PORT_SEEDS[typeof type === 'string' ? type : type.name];
    const pool = i === 0 ? tokens.primary : tokens.secondary;
    parameters[name] = spec.write(pool);
    seededBy.push(name);
    claim(pool, name, singularize(name), spec.describe, spec.tokensOf);
  });

  // Syntax seeds take the tertiary pool, never one a list input already claimed. The Function
  // node has both kinds at once — `scriptInputs`/`scriptOutputs` proplists *and* names mined out
  // of `functionScript` — and sharing a pool made the two families indistinguishable, which
  // showed up as a pattern that run C could not reproduce rather than as anything obvious.
  for (const [name, spec] of Object.entries(SYNTAX_SEEDS[typeName] || {})) {
    const pool = seededBy.length ? tokens.tertiary : tokens.primary;
    parameters[name] = spec.write(pool);
    seededBy.push(name);
    claim(pool, name, singularize(name), spec.describe, (p) => p.map((t) => ({ token: t, role: 'entry' })));
  }

  const selector = METADATA_DRIVEN[typeName];
  if (selector) {
    const pool = tokens.primary;
    for (const [key, write] of Object.entries(METADATA_SEEDS)) projectMetadata[key] = write(pool);
    parameters[selector] = 'SeedClass';
    seededByMetadata.push('dbCollections');
    claim(
      pool,
      'dbCollections',
      'property',
      () =>
        'a property of the cloud database class selected by the `' +
        selector +
        '` parameter. The names come from the class schema, not from anything on this node — a project without that class has no way to know them.',
      (p) => p.map((t) => ({ token: t, role: 'entry' }))
    );
  }

  if (!seededBy.length && !seededByMetadata.length) return null;
  return { label: tokens.label, parameters, projectMetadata, seededBy, seededByMetadata, tokenMap };
}

/**
 * Seed a run for a node whose ports are an unbounded numbered series.
 *
 * These declare `numberedInputs` and get their hook from `nodedefinition.ts` rather than writing
 * one, so the seed is a parameter at an index rather than a name: set `input 0` and `input 3`,
 * and the emission shows both how the name is built and that the series is dense and always one
 * longer than the highest index in use.
 */
function numberedSeedRunFor(numberedInputs, seedIndex) {
  const highest = [1, 3, 5][seedIndex];
  const parameters = {};
  for (const base of Object.keys(numberedInputs)) {
    parameters[`${base} 0`] = true;
    parameters[`${base} ${highest}`] = true;
  }
  return { label: TOKEN_SETS[seedIndex].label, parameters, projectMetadata: {}, tokenMap: {}, highest };
}

/**
 * Replace every seed token in a port name with its variable placeholder.
 *
 * Longest token first: with `Vb1` and `Vb sp` in play — and with proplist ids being their label
 * plus a suffix — substituting a shorter token first would corrupt the longer match.
 */
function templatize(name, tokenMap) {
  const tokens = Object.keys(tokenMap).sort((a, b) => b.length - a.length);
  let pattern = String(name);
  const variables = [];
  for (const token of tokens) {
    if (!pattern.includes(token)) continue;
    const { variable } = tokenMap[token];
    pattern = pattern.split(token).join(`<${variable}>`);
    if (!variables.includes(variable)) variables.push(variable);
  }
  return { pattern, variables };
}

/** Generalise a numeric run to `<N>`, for the numbered-input series. */
function templatizeIndex(name) {
  return String(name).replace(/\d+/g, '<N>');
}

/** A pattern string becomes a matcher; `<var>` matches anything, `<N>` an integer. */
function patternToRegExp(pattern) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = escaped.replace(/<N>/g, '(\\d+)').replace(/<[A-Za-z0-9_]+>/g, '(.+)');
  return new RegExp(`^${body}$`);
}

/**
 * The variables of a pattern, in the order they appear in it — which is the order their captures
 * come back in. Reading them off the `variables` object instead gives insertion order, and for
 * `value-<state>-<value>` that silently pairs `state`'s capture with `value`'s parameter: every
 * correct key then reads as naming something that does not exist.
 */
function variablesInOrder(pattern) {
  return [...String(pattern).matchAll(/<([A-Za-z0-9_]+)>/g)].map((m) => m[1]);
}

/**
 * Literal (non-placeholder) characters in a pattern — how specific it is.
 *
 * Some nodes have a genuinely bare pattern: `States` names its value *output* for the value
 * itself, so `<value>` is a real formula that compiles to `^(.+)$` and matches every port name
 * there is. Any "which pattern does this name belong to?" question therefore has to rank matches
 * rather than take the first, or the catch-all claims the whole node. Two separate parts of this
 * task got that wrong before it was made shared.
 */
function specificity(pattern) {
  return String(pattern).replace(/<[A-Za-z0-9_]+>/g, '').length;
}

/** The most specific pattern matching `name`, or undefined. */
function mostSpecificMatch(patterns, name) {
  return patterns
    .filter((p) => patternToRegExp(p.pattern).test(name))
    .sort((a, b) => specificity(b.pattern) - specificity(a.pattern))[0];
}

const plugOf = (port) => (port.plug === 'input/output' ? 'input/output' : port.plug || 'input');
const typeNameOf = (port) => {
  const type = port.type;
  if (!type) return undefined;
  return typeof type === 'string' ? type : type.name;
};

/** Is this an emitted port that lets the author choose another port's value type? */
function isTypeSelector(port) {
  const type = port.type;
  if (!type || typeof type === 'string' || type.name !== 'enum') return false;
  const values = (type.enums || []).map((e) => (typeof e === 'string' ? e : e.value));
  return values.includes('boolean') && values.includes('string');
}

module.exports = {
  TOKEN_SETS,
  LIST_PORT_SEEDS,
  SYNTAX_SEEDS,
  METADATA_SEEDS,
  METADATA_DRIVEN,
  ENABLING_PARAMETERS,
  singularize,
  seedRunFor,
  numberedSeedRunFor,
  templatize,
  templatizeIndex,
  patternToRegExp,
  variablesInOrder,
  specificity,
  mostSpecificMatch,
  isTypeSelector,
  plugOf,
  typeNameOf,
  driveSetup
};
