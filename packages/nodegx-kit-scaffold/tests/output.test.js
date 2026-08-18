/**
 * What the generated kit teaches — ✅ **D8** and ✅ **P2** as properties of the
 * output rather than as intentions in a task file.
 *
 * ⚠️ **Every oracle in this file is written here, not read out of the thing
 * under test.** A test that collected the tokens from the generated source and
 * then asserted they were tokens would be green on a scaffold that emitted
 * `var(--invented-token)` for everything — the local precedent is a spec that
 * read its oracle from the artefact it was grading and passed while matching
 * zero elements. So: the expected token names are literals below, and whether
 * those names *exist* is checked against the editor's token registry, which is
 * a different file owned by different work.
 */

/* eslint-env jest */

const fs = require('fs');
const path = require('path');

const { scaffoldKitFiles, EXAMPLE_PORTS, TYPES_SPECIFIER } = require('../src/index');

const plan = scaffoldKitFiles({ name: 'Weather Kit' });
const file = (p) => plan.files.find((f) => f.path === p).contents;

/**
 * The tokens this scaffold is expected to emit, written out.
 *
 * If a port's default changes, this list is where the change gets argued —
 * which is the point. A default is a decision about what every kit anybody
 * writes will start from.
 */
const EXPECTED_TOKENS = [
  '--surface-raised',
  '--foreground',
  '--border',
  '--border-1',
  '--radius-md',
  '--space-4',
  '--space-1',
  '--text-sm',
  '--text-2xl',
  '--muted-foreground',
  '--primary'
];

describe('the plan itself', () => {
  test('a kit is four files and no more', () => {
    expect(plan.ok).toBe(true);
    expect(plan.files.map((f) => f.path).sort()).toEqual([
      'README.md',
      'index.js',
      'manifest.json',
      'types/node-kit.d.ts'
    ]);
  });

  test('the manifest points at index.js and names the kit as typed', () => {
    const manifest = JSON.parse(file('manifest.json'));
    expect(manifest.main).toBe('index.js');
    expect(manifest.name).toBe('Weather Kit');
    expect(manifest.dependencies).toEqual([]);
    // The stamp that makes the types copy's age answerable from the manifest.
    expect(typeof manifest.nodeKitTypes).toBe('string');
    expect(manifest.nodeKitTypes).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('the node type is namespaced by the kit, so two kits cannot collide', () => {
    expect(plan.kit.nodeType).toBe('weather-kit.StatTile');
    expect(file('index.js')).toContain("name: 'weather-kit.StatTile'");
  });
});

describe('✅ D8 — colour and spacing default to design tokens', () => {
  test('every colour and length port defaults to a var(--token)', () => {
    const styled = EXAMPLE_PORTS.filter((p) => p.type === 'color' || p.type === 'length');

    // Two-sided: the filter must actually have selected something, or an
    // EXAMPLE_PORTS that lost its style ports would pass this vacuously.
    expect(styled.length).toBeGreaterThanOrEqual(11);

    const notTokens = styled.filter((p) => !/^var\(--[a-z0-9-]+\)$/.test(p.default));
    expect(notTokens.map((p) => `${p.name}=${p.default}`)).toEqual([]);
  });

  test('the tokens are the ones this scaffold is meant to emit', () => {
    const emitted = [...new Set([...file('index.js').matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]))];
    expect(emitted.sort()).toEqual([...EXPECTED_TOKENS].sort());
  });

  test('every emitted token is a real token in the editor’s registry', () => {
    // 🔴 The check this file exists for. CN-005's annotated fixture defaults a
    // colour port to `var(--color-surface-2)`, which is not a token in this
    // product at all — harmless in a type-annotation fixture, fatal in a
    // scaffold, and invisible to every other assertion here because
    // `var(--anything)` is well-formed CSS that simply resolves to nothing.
    const registry = path.resolve(
      __dirname,
      '../../noodl-editor/src/editor/src/models/StyleTokensModel/DefaultTokens.ts'
    );
    // Fail rather than skip if the registry moves: a probe that silently
    // exonerates is worse than no probe.
    expect(fs.existsSync(registry)).toBe(true);

    const declared = new Set([...fs.readFileSync(registry, 'utf8').matchAll(/name: '(--[a-z0-9-]+)'/g)].map((m) => m[1]));
    // The registry must have been parsed, or `declared` is empty and every
    // token below "fails to be missing".
    expect(declared.size).toBeGreaterThan(100);

    const unknown = EXPECTED_TOKENS.filter((t) => !declared.has(t));
    expect(unknown).toEqual([]);
  });

  test('no raw hex colour anywhere in the generated node', () => {
    // The failure D8 names in so many words: "a scaffold that emits a node with
    // three hardcoded hex colours teaches the opposite of this phase's second
    // principle, forever."
    const hex = file('index.js').match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    expect(hex).toEqual([]);
  });
});

describe('✅ P2 — ports are the product, and the threshold is not in the JavaScript', () => {
  test('the example node exposes the highlight decision as an input', () => {
    const src = file('index.js');
    expect(src).toContain('highlighted:');
    expect(src).toContain("displayName: 'Highlighted'");
  });

  test('no comparison against a literal decides anything', () => {
    // The precise mistake the README argues against — `props.value > 1000`.
    // Any relational operator against a number literal inside the component is
    // a buried threshold. (The README quotes that line as an example of what
    // NOT to do, which is why this is asserted on index.js only.)
    const src = file('index.js');
    expect(src).not.toMatch(/[<>]=?\s*-?\d/);
  });

  test('the README shows the rule wired to a stock node, rather than only forbidding it', () => {
    const readme = file('README.md');
    expect(readme).toContain('Expression');
    expect(readme).toContain('Highlighted');
    // And it names the anti-pattern explicitly, so a reader who skims the
    // diagram still meets the argument.
    expect(readme).toContain("DON'T");
  });

  test('the README’s port table is the same set of ports the code declares', () => {
    // A port table that drifts from its code is worse than no table.
    const readme = file('README.md');
    for (const port of EXAMPLE_PORTS) {
      expect(readme).toContain(`| \`${port.name}\` |`);
    }
    const rows = (readme.match(/^\| `[a-zA-Z]+` \|/gm) || []).length;
    expect(rows).toBe(EXAMPLE_PORTS.length);
  });

  test('every declared port really is declared in the generated source, in the home the table claims', () => {
    const src = file('index.js');
    // Slice the source into its three port homes so "declared somewhere" cannot
    // pass for "declared in inputCss".
    const section = (name) => {
      const start = src.indexOf(`    ${name}: {`);
      expect(start).toBeGreaterThan(-1);
      const rest = src.slice(start + 1);
      const end = rest.search(/\n {4}\/\/|\n {4}[a-zA-Z]+: \{|\n {2}\};/);
      return rest.slice(0, end === -1 ? rest.length : end);
    };
    const homes = {
      inputProps: section('inputProps'),
      inputCss: section('inputCss'),
      outputProps: section('outputProps')
    };

    for (const port of EXAMPLE_PORTS) {
      expect({ port: port.name, in: homes[port.where].includes(`${port.name}: {`) }).toEqual({
        port: port.name,
        in: true
      });
    }
  });
});

describe('✅ D2 — autocomplete with no build step', () => {
  test('the definition and the module are both annotated, relatively', () => {
    const src = file('index.js');
    expect(src).toContain(`/** @type {import('${TYPES_SPECIFIER}').ReactNodeDefinition} */`);
    expect(src).toContain(`/** @type {import('${TYPES_SPECIFIER}').NodeKitModule} */`);
  });

  test('the annotation is relative, never a bare specifier', () => {
    // 🔴 CN-005 measured this: a bare specifier resolves only when the package
    // is physically installed above the file, and a kit folder has no
    // node_modules. A bare import here would leave the annotation dead and the
    // completion list full of DOM globals — with nothing failing anywhere.
    expect(file('index.js')).not.toContain("import('@nodegx/node-kit-types')");
    expect(TYPES_SPECIFIER.startsWith('./')).toBe(true);
  });

  test('// @ts-check is on, or the annotation is decoration', () => {
    expect(file('index.js').startsWith('// @ts-check\n')).toBe(true);
  });

  test('the kit reads the bare React global and uses a hook', () => {
    const src = file('index.js');
    expect(src).toContain('React.createElement');
    expect(src).toMatch(/React\.use[A-Z]/);
  });

  test('✅ D19(b) — the scaffold never teaches `var React = window.React`', () => {
    // 🔴 The pattern this replaced. A kit opening with `window.React` throws at
    // import under SSR/SSG, so its nodes are missing from the server render and
    // appear only after hydration. The SSR loader shims `window` for kits that
    // already ship that line; what the scaffold *writes* must not need the shim.
    //
    // ⚠️ Asserted on the emitted file, not on the template source — the template
    // is allowed to mention `window.React` in the comment that explains why not.
    const code = file('index.js').replace(/^\s*(\/\/.*|\*.*|\/\*.*)$/gm, '');
    expect(code).not.toContain('window.React');
  });
});
