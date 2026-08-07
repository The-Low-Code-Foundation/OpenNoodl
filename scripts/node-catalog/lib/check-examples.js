/**
 * SUB-013 criterion 3 — check documented `parameters` objects against the derived encodings.
 *
 * The criterion is about a *document*: "a reader following SCHEMA.md alone can author a valid
 * `States` node, including `value-true-bg color`". A worked example in prose rots the moment the
 * thing it describes changes, and nobody notices, so it is checked here instead — against the
 * encodings derived in the same generator run, every time the catalog is built.
 *
 * Two questions, and the gap between them is the point:
 *
 *   shape       Can this key exist on this node? It matches a derived pattern, or a static port.
 *   references  Does this key reach anything? The names interpolated into it are present in the
 *               parameters they are drawn from.
 *
 * A key that passes the first and fails the second is the defect SUB-013 was written about: it is
 * accepted by the file format, generates no port, and does nothing at all. The shipped
 * toggle-switch prefab has eight.
 */

const { patternToRegExp, variablesInOrder, mostSpecificMatch } = require('./parameter-encoding');

/**
 * Which seed parameter does a variable draw its names from?
 *
 * `variables` describes each placeholder in prose that names its parameter in backticks — that
 * text is generated from the seed, so reading the name back out of it keeps one source of truth
 * rather than adding a second field that could disagree with the sentence beside it.
 */
function sourceParameterFor(description) {
  const match = /`([^`]+)`/.exec(description || '');
  return match ? match[1] : undefined;
}

/** The names a seed parameter currently supplies, whatever shape it is stored in. */
function namesIn(value) {
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(value)) return value.map((row) => (row && typeof row === 'object' ? row.label : row)).filter(Boolean);
  return [];
}

/**
 * @param {object} example  one entry from fixtures/parameter-encoding-examples.json
 * @param {object} node     the catalog node entry for example.typeName
 * @returns {string[]} failures, empty when the example is sound
 */
function checkExample(example, node) {
  const failures = [];
  const where = `${example.name} (${example.typeName})`;

  if (!node) return [`${where}: no such node type in the catalog`];

  const encoding = node.parameterEncoding;
  if (!encoding || !encoding.known) {
    return [`${where}: node has no known parameter encoding, so the example cannot be checked`];
  }

  const staticNames = new Set([...node.inputs, ...node.outputs].map((p) => p.name));
  const seeds = encoding.seededBy || [];

  const unmatched = [];
  const orphans = [];

  for (const key of Object.keys(example.parameters)) {
    if (staticNames.has(key) || seeds.includes(key)) continue;

    // Most specific wins — a bare `<value>` pattern matches every key there is.
    const pattern = mostSpecificMatch(encoding.patterns, key);
    if (!pattern) {
      unmatched.push(key);
      continue;
    }

    // Which concrete names did this key interpolate, and are they still on offer?
    const variableNames = variablesInOrder(pattern.pattern);
    if (!variableNames.length) continue;
    const captured = patternToRegExp(pattern.pattern).exec(key).slice(1);

    variableNames.forEach((variable, i) => {
      const parameter = sourceParameterFor(pattern.variables[variable]);
      if (!parameter || !(parameter in example.parameters)) return;
      const available = namesIn(example.parameters[parameter]);
      if (!available.includes(captured[i])) orphans.push(key);
    });
  }

  if (unmatched.length) {
    failures.push(
      `${where}: ${unmatched.map((k) => `"${k}"`).join(', ')} match no pattern and no static port. ` +
        'Either the example is wrong or the encoding is incomplete.'
    );
  }

  const expected = new Set(example.expectedOrphans || []);
  const found = new Set(orphans);

  const unexpected = [...found].filter((k) => !expected.has(k));
  if (unexpected.length) {
    failures.push(
      `${where}: ${unexpected.map((k) => `"${k}"`).join(', ')} name entries that are not in their ` +
        'seed parameter, and are not listed in expectedOrphans. They would reach no port at runtime.'
    );
  }

  const noLongerOrphaned = [...expected].filter((k) => !found.has(k));
  if (noLongerOrphaned.length) {
    failures.push(
      `${where}: ${noLongerOrphaned.map((k) => `"${k}"`).join(', ')} are listed in expectedOrphans ` +
        'but now resolve. Remove them from the fixture — a stale expectation hides the next real one.'
    );
  }

  return failures;
}

/** @returns {{failures: string[], checked: number, orphansFound: number}} */
function checkExamples(fixture, nodesByName) {
  const failures = [];
  let orphansFound = 0;
  for (const example of fixture.examples) {
    const result = checkExample(example, nodesByName.get(example.typeName));
    failures.push(...result);
    orphansFound += (example.expectedOrphans || []).length;
  }
  return { failures, checked: fixture.examples.length, orphansFound };
}

module.exports = { checkExamples, checkExample, sourceParameterFor, namesIn };
