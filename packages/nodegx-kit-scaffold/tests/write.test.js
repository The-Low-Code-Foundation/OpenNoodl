/**
 * Naming, path safety, and AC5 — scaffolding twice with the same name refuses
 * rather than overwriting.
 *
 * ⚠️ The name argument reaches this module from a **model**, through
 * `create_node_kit`. So the traversal cases below are not paranoia about a
 * typing user; they are the ordinary case for the MCP caller.
 */

/* eslint-env jest */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { slugify, resolveKitName, scaffoldKitFiles, writeKitScaffold } = require('../src/index');

function tempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cn006-'));
}

describe('naming', () => {
  test.each([
    ['Weather Kit', 'weather-kit'],
    ['weather kit', 'weather-kit'],
    ['Weather  ---  Kit', 'weather-kit'],
    ['  Charts 2  ', 'charts-2'],
    ['ACME_Widgets', 'acme-widgets']
  ])('%s becomes %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  test('a name is kept as typed for display, and slugged for the directory', () => {
    const resolved = resolveKitName('Weather Kit');
    expect(resolved).toEqual({ ok: true, dirName: 'weather-kit', displayName: 'Weather Kit' });
  });

  test.each([
    ['', 'name-empty'],
    ['   ', 'name-empty'],
    ['../escape', 'name-not-a-path'],
    ['a/b', 'name-not-a-path'],
    ['a\\b', 'name-not-a-path'],
    ['..', 'name-not-a-path'],
    ['///', 'name-not-a-path'],
    ['!!!', 'name-unusable'],
    ['---', 'name-unusable']
  ])('%p is refused as %s', (input, code) => {
    const resolved = resolveKitName(input);
    expect({ ok: resolved.ok, code: resolved.code }).toEqual({ ok: false, code });
  });

  test('🔴 traversal is caught on the raw name, not the slug', () => {
    // The reason this is a separate test: slugging `../../etc` yields `etc`, a
    // perfectly good directory name. A validator that ran after the slug would
    // accept the input and write somewhere harmless-looking — and the next
    // traversal shape it did not neutralise would land outside the project.
    expect(slugify('../../etc')).toBe('etc');
    expect(resolveKitName('../../etc').ok).toBe(false);
  });
});

describe('AC5 — a name collision refuses', () => {
  test('the second scaffold of the same name refuses and changes nothing', async () => {
    const projectDir = tempProject();

    const first = await writeKitScaffold(projectDir, { name: 'Weather Kit' });
    expect(first.ok).toBe(true);
    expect(first.written).toEqual([
      'noodl_modules/weather-kit/manifest.json',
      'noodl_modules/weather-kit/index.js',
      'noodl_modules/weather-kit/README.md',
      'noodl_modules/weather-kit/types/node-kit.d.ts'
    ]);

    // Something an author would plausibly have added since.
    const indexPath = path.join(projectDir, 'noodl_modules', 'weather-kit', 'index.js');
    fs.writeFileSync(indexPath, '// my work\n', 'utf8');

    const second = await writeKitScaffold(projectDir, { name: 'Weather Kit' });
    expect({ ok: second.ok, code: second.code }).toEqual({ ok: false, code: 'kit-exists' });
    expect(second.message).toContain('weather-kit');

    // The assertion that makes the refusal mean something: the author's file is
    // still theirs. Asserting only the error code would pass on a scaffold that
    // wrote the files and *then* reported a collision.
    expect(fs.readFileSync(indexPath, 'utf8')).toBe('// my work\n');
  });

  test('two names that slug to the same directory collide too', async () => {
    const projectDir = tempProject();
    expect((await writeKitScaffold(projectDir, { name: 'Weather Kit' })).ok).toBe(true);
    // "weather kit" and "Weather-Kit" are different names and the same folder.
    const second = await writeKitScaffold(projectDir, { name: 'weather   KIT' });
    expect(second.code).toBe('kit-exists');
  });

  test('a different name scaffolds alongside', async () => {
    const projectDir = tempProject();
    expect((await writeKitScaffold(projectDir, { name: 'Weather Kit' })).ok).toBe(true);
    const second = await writeKitScaffold(projectDir, { name: 'Charts Kit' });
    expect(second.ok).toBe(true);
    expect(fs.readdirSync(path.join(projectDir, 'noodl_modules')).sort()).toEqual(['charts-kit', 'weather-kit']);
  });
});

describe('writing', () => {
  test('a bad name never reaches the filesystem', async () => {
    const projectDir = tempProject();
    const result = await writeKitScaffold(projectDir, { name: '../escape' });
    expect(result.ok).toBe(false);
    expect(fs.existsSync(path.join(projectDir, 'noodl_modules'))).toBe(false);
  });

  test('no project directory is a refusal, not a throw', async () => {
    const result = await writeKitScaffold('', { name: 'Weather Kit' });
    expect({ ok: result.ok, code: result.code }).toEqual({ ok: false, code: 'no-project' });
  });

  test('the files on disk are byte-identical to the plan', async () => {
    const projectDir = tempProject();
    const plan = scaffoldKitFiles({ name: 'Weather Kit' });
    await writeKitScaffold(projectDir, { name: 'Weather Kit' });

    for (const planned of plan.files) {
      const onDisk = fs.readFileSync(
        path.join(projectDir, 'noodl_modules', 'weather-kit', ...planned.path.split('/')),
        'utf8'
      );
      expect({ path: planned.path, same: onDisk === planned.contents }).toEqual({ path: planned.path, same: true });
    }
  });

  test('noodl_modules is created when the project has none', async () => {
    // A fresh project has no noodl_modules directory at all, and that is the
    // commonest case for a first kit.
    const projectDir = tempProject();
    expect(fs.existsSync(path.join(projectDir, 'noodl_modules'))).toBe(false);
    expect((await writeKitScaffold(projectDir, { name: 'First Kit' })).ok).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'noodl_modules', 'first-kit', 'index.js'))).toBe(true);
  });
});
