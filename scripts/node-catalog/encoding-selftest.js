#!/usr/bin/env node
/**
 * SUB-013 — self-test for the parameter-encoding derivation.
 *
 * The encodings themselves are checked against the runtime every time the catalog is generated:
 * seed run C is held out, and a pattern that does not reproduce it fails `catalog:check` in CI.
 * That is success criterion 2 and it needs nothing from this file.
 *
 * What it does not cover is the derivation machinery, which is pure and has no runtime to
 * disagree with. Both bugs found while building it were in here rather than in the observation,
 * and both produced *plausible* output — the failure mode this whole task exists to remove. So
 * each one is pinned below with the case that caught it.
 *
 * Run: node scripts/node-catalog/encoding-selftest.js
 */
const { templatize, templatizeIndex, patternToRegExp, singularize, TOKEN_SETS } = require('./lib/parameter-encoding');

const checks = [];
const check = (name, passed) => checks.push([name, passed]);

// ─── templating ──────────────────────────────────────────────────────────────

const tokenMap = {
  Sb1: { variable: 'state', describe: () => 'a state' },
  Vb1: { variable: 'value', describe: () => 'a value' },
  'Vb sp': { variable: 'value', describe: () => 'a value' }
};

check('templates a two-variable name', templatize('value-Sb1-Vb1', tokenMap).pattern === 'value-<state>-<value>');
check('reports both variables', templatize('value-Sb1-Vb1', tokenMap).variables.join(',') === 'state,value');
check('a name with no token is left alone', templatize('currentState', tokenMap).pattern === 'currentState');

/**
 * The token pool deliberately contains a value with a space in it, because `States` interpolates
 * value names raw and `value-true-bg color` is the port nobody guesses. These two pin that such a
 * token round-trips whole rather than being chopped at the space.
 */
check(
  'a token containing a space survives templating whole',
  templatize('value-Sb1-Vb sp', tokenMap).pattern === 'value-<state>-<value>'
);
check('a spaced token templates in a one-variable name too', templatize('type-Vb sp', tokenMap).pattern === 'type-<value>');

/**
 * Longest-token-first ordering, and this is the pair that discriminates for it — a proplist row
 * seeds its `id` as the label plus a suffix, so `Sa1` is a strict prefix of `Sa1Id`. Substitute
 * the shorter one first and `pageComp-Sa1Id` becomes `pageComp-<page>Id`, which reads like a
 * formula, is wrong, and names a port that does not exist.
 *
 * Checked by temporary revert: dropping the sort reddens these two and nothing else. The spaced
 * token above survives an unordered sort by luck — a space sorts before a digit — so it is not
 * the control for this property even though it looks like one.
 */
const proplistTokens = {
  Sa1Id: { variable: 'pageId', describe: () => 'an id' },
  Sa1: { variable: 'page', describe: () => 'a label' }
};
check('a proplist id is not templated as its label', templatize('pageComp-Sa1Id', proplistTokens).pattern === 'pageComp-<pageId>');
check('a proplist label still templates as the label', templatize('title-Sa1', proplistTokens).pattern === 'title-<page>');

// ─── numbered series ─────────────────────────────────────────────────────────

check('an index run generalises to <N>', templatizeIndex('input 12') === 'input <N>');

// ─── pattern matching ────────────────────────────────────────────────────────

check('a pattern matches its own shape', patternToRegExp('value-<state>-<value>').test('value-true-bg color'));
check('a pattern rejects a different shape', !patternToRegExp('transitiondef-<state>').test('transition-a-b'));
check('<N> matches only digits', patternToRegExp('input <N>').test('input 3') && !patternToRegExp('input <N>').test('input x'));

/**
 * Trap 1, and the reason verification does not work by matching names against pattern regexes.
 *
 * `States` has a genuinely bare pattern — its value *output* is named for the value itself — and
 * `<value>` compiles to `^(.+)$`, which matches every port name there is. Under a first-match-wins
 * check that catch-all claimed all nine of the node's ports and the other eight patterns read as
 * never exercised. Verification templates run C's names and compares *pattern sets* instead;
 * the regexes are only a second, independent check that the published strings match the concrete
 * names. This pins the property that made the first approach unsound.
 */
check('a bare variable pattern matches anything', patternToRegExp('<value>').test('transitiondef-Sa1'));

// ─── seeds ───────────────────────────────────────────────────────────────────

check('singularises a plural parameter', singularize('states') === 'state' && singularize('properties') === 'property');
check('leaves a non-plural alone', singularize('payload') === 'payload' && singularize('format') === 'format');

/**
 * Trap 2. The Function node seeds from three parameters at once — two proplists and the script
 * text — and while the syntax seed shared a pool with `scriptOutputs`, ports from `Inputs.x` in
 * the script and ports from the `scriptInputs` list were built from the same tokens and could not
 * be told apart. It surfaced as a run-C reproduction failure rather than as anything legible, so
 * the pools are pinned as mutually disjoint.
 */
for (const set of TOKEN_SETS) {
  const all = [...set.primary, ...set.secondary, ...set.tertiary];
  check(`seed set ${set.label}: pools are disjoint`, new Set(all).size === all.length);
}
check(
  'seed sets differ in arity, or a one-variable formula cannot be told from a two-variable one',
  new Set(TOKEN_SETS.map((s) => `${s.primary.length}x${s.secondary.length}`)).size === TOKEN_SETS.length
);
check(
  'no token is a substring of a token in another pool of the same set',
  TOKEN_SETS.every((set) =>
    set.primary.every((p) => !set.secondary.some((s) => s.includes(p)) && !set.tertiary.some((t) => t.includes(p)))
  )
);
check(
  'at least one seed token contains a space, so verbatim interpolation is observed rather than assumed',
  TOKEN_SETS.some((set) => [...set.primary, ...set.secondary, ...set.tertiary].some((t) => /\s/.test(t)))
);

// ─── report ──────────────────────────────────────────────────────────────────

console.log('');
let failed = 0;
for (const [name, passed] of checks) {
  console.log(`  ${passed ? 'ok  ' : 'FAIL'} ${name}`);
  if (!passed) failed++;
}
console.log(`\n${checks.length - failed} passing, ${failed} failing`);
process.exit(failed === 0 ? 0 : 1);
