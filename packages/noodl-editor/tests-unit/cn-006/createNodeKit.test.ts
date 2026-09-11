/**
 * CN-006 — the editor's entry point onto the shared kit generator.
 *
 * ✅ **D1's "New node kit" command.** `createNodeKit` is deliberately thin: the
 * file set is `@nodegx/kit-scaffold`'s, which is the *same* generator
 * `create_node_kit` calls on the MCP side. What is graded here is only what the
 * editor adds — the wrapper's shape, its refusals, and the one field the UI
 * depends on to honour D1's second clause.
 *
 * 🔴 **The `indexPath` assertion is the load-bearing one.** The section opens
 * that path in `CodeFileDocument`. A wrapper that reported success with a path
 * that does not exist would produce D1's exact failure — a kit is written, and
 * the editor opens an empty buffer over nothing — with an accurate-looking
 * success message, which is the shape of hole 2 in this task's MCP half.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { installTestFileSystem } from './testFileSystem';

installTestFileSystem();

import { createNodeKit } from '../../src/shared/utils/projectmodules';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn006-kit-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('creating a kit', () => {
  test('writes a kit and reports where its index.js is', async () => {
    const result = await createNodeKit(dir, 'Weather Kit');

    expect(result.ok).toBe(true);
    expect(result.moduleName).toBe('weather-kit');
    expect(result.indexPath).toBe('noodl_modules/weather-kit/index.js');
    expect(result.nodeType).toMatch(/^weather-kit\./);
  });

  test('🔴 and that path actually exists — it is what the editor opens', async () => {
    const result = await createNodeKit(dir, 'Weather Kit');
    expect(fs.existsSync(path.join(dir, ...result.indexPath!.split('/')))).toBe(true);
  });

  test('the whole file set lands, types copy included', async () => {
    await createNodeKit(dir, 'Weather Kit');
    const kitDir = path.join(dir, 'noodl_modules', 'weather-kit');

    expect(fs.existsSync(path.join(kitDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(kitDir, 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(kitDir, 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(kitDir, 'types', 'node-kit.d.ts'))).toBe(true);
  });

  test('the generated node defaults its spacing to a token, not a number', async () => {
    // ✅ D8, at the one place the editor path could quietly diverge from the MCP
    // path. Asserted here as well as in the generator's own suite because "the
    // editor writes the same bytes" is the claim this wrapper makes.
    await createNodeKit(dir, 'Weather Kit');
    const source = fs.readFileSync(path.join(dir, 'noodl_modules', 'weather-kit', 'index.js'), 'utf8');
    expect(source).toMatch(/var\(--/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});

describe('refusing', () => {
  test('with no project open', async () => {
    const result = await createNodeKit(undefined, 'Weather Kit');
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/No project is open/);
  });

  test('with an empty name', async () => {
    const result = await createNodeKit(dir, '   ');
    expect(result.ok).toBe(false);
  });

  test('🔴 a second kit of the same name is refused, and the first survives it', async () => {
    // AC5. It matters more in the editor than through the tool: a mistyped name
    // in a text field is a far easier way to land on an existing kit.
    await createNodeKit(dir, 'Weather Kit');
    const indexPath = path.join(dir, 'noodl_modules', 'weather-kit', 'index.js');
    fs.writeFileSync(indexPath, '// the author has been working in here\n', 'utf8');

    const second = await createNodeKit(dir, 'Weather Kit');

    expect(second.ok).toBe(false);
    // The refusal must be total: the author's edits are still there.
    expect(fs.readFileSync(indexPath, 'utf8')).toBe('// the author has been working in here\n');
  });

  test('and a name that slugs onto an existing kit is refused too', async () => {
    await createNodeKit(dir, 'Weather Kit');
    const second = await createNodeKit(dir, 'weather   kit');
    expect(second.ok).toBe(false);
  });

  test('a name that escapes the project is refused', async () => {
    const result = await createNodeKit(dir, '../../etc');
    expect(result.ok).toBe(false);
    expect(fs.existsSync(path.join(dir, 'noodl_modules', 'etc'))).toBe(false);
  });
});
