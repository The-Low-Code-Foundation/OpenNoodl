/**
 * VFN-009 criterion 8 — *"Nothing in this section can write a definition without going through
 * `store.save`."*
 *
 * That is a claim about **source**, not about behaviour, and it cannot be held by a runtime
 * assertion: the failure mode is a click handler somebody adds next year that reaches
 * `ProjectModel.setSetting('myBlocks.library', …)` directly, and no test that does not know about
 * that handler will ever run it. So this reads the two files that own the section's writes and
 * convicts any other spelling — the same instrument `tests-unit/vfn-007` used on the JSX of the
 * shelf picker.
 *
 * 🔴 The reason the criterion exists: `MyBlocksStore.save` is where the cycle guard runs and where
 * `shape`, `params` and `requires` are recomputed from the body. A write that went round it would
 * leave a definition whose `shape` field no longer describes its own blocks — and `expandWorkspace`
 * *trusts* that field to decide whether a call site is legal, so the next generate would either
 * refuse a legal call or accept an impossible one.
 *
 * ⚠️ A source scan that finds nothing is indistinguishable from a scan of the wrong file, so every
 * check below has a negative control: the same extractor, over source that does contain the thing.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..', 'src', 'editor', 'src');

const LIBRARY_CONTROLLER = path.join(ROOT, 'views', 'BlocklyEditor', 'MyBlocksLibrary.ts');
const SECTION = path.join(ROOT, 'views', 'panels', 'SettingsPanel', 'sections', 'SavedBlocksSection.tsx');

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

/**
 * Anything that writes a shelf without going through the store.
 *
 * The two shelves are a key in the project's settings bag and a key in `EditorSettings`
 * (`MyBlocksShelves.ts`), so a bypass is a `setSetting` / `EditorSettings.set` naming one of those
 * keys, or a direct `shelf.write`.
 */
const BYPASSES = [
  /setSetting\s*\(/,
  /EditorSettings\s*\.\s*instance\s*\.\s*set\s*\(/,
  /PROJECT_LIBRARY_SETTING/,
  /USER_LIBRARY_SETTING/,
  /\.\s*write\s*\(/
];

function bypassesIn(source: string): string[] {
  return BYPASSES.filter((pattern) => pattern.test(source)).map((pattern) => pattern.source);
}

/**
 * Every store method called in a source file, deduplicated.
 *
 * Both spellings the controller uses — a held `store` and `myBlocksStore()` inline — because the
 * criterion is about which *methods* are reached, and an extractor that only knew one spelling
 * would report an empty list for half the file and read as a pass.
 */
function storeCallsIn(source: string): string[] {
  const calls = new Set<string>();
  const pattern = /(?:\bstore\s*\.|\bmyBlocksStore\(\)\s*\.)\s*([A-Za-z]+)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) calls.add(match[1]);
  return Array.from(calls).sort();
}

describe('VFN-009 criterion 8 — every write goes through the store', () => {
  it('the controller writes a definition only through save, rename and remove', () => {
    const source = read(LIBRARY_CONTROLLER);
    const calls = storeCallsIn(source);

    // Named, and by `toEqual` rather than `toContain`, so that a new kind of call has to be argued
    // for here rather than slipping in beside them. Three of these are reads (`get`, `list`,
    // `scopeOf`); the three writes are `save`, `rename` and `remove`, and `exportDefinitions`
    // produces a value and writes nothing.
    expect(calls).toEqual(['exportDefinitions', 'get', 'list', 'remove', 'rename', 'save', 'scopeOf']);
  });

  it('neither file reaches a shelf directly', () => {
    expect(bypassesIn(read(LIBRARY_CONTROLLER))).toEqual([]);
    expect(bypassesIn(read(SECTION))).toEqual([]);
  });

  it('🔴 NEGATIVE CONTROL — the same extractors convict source that does bypass the store', () => {
    // Without this, "found no bypass" is indistinguishable from "read the wrong file", from "the
    // regexes match nothing at all", and from a file that has since been renamed.
    const bypassing = `
      import { EditorSettings } from '@noodl-utils/editorsettings';
      import { PROJECT_LIBRARY_SETTING } from './MyBlocksShelves';
      export function saveQuickly(definition) {
        ProjectModel.instance.setSetting(PROJECT_LIBRARY_SETTING, { definitions: [definition] });
        EditorSettings.instance.set('myBlocks.backpack', { definitions: [definition] });
      }
    `;
    expect(bypassesIn(bypassing).length).toBeGreaterThan(0);
    expect(bypassesIn(bypassing)).toContain('setSetting\\s*\\(');

    // …and the store-call extractor really does find calls, so an empty list above would be a
    // finding rather than a silence.
    expect(storeCallsIn('store.save({}); store.rename(a, b); store.remove(a);')).toEqual(['remove', 'rename', 'save']);
  });

  it('the section itself performs no write of its own — it calls the controller', () => {
    const source = read(SECTION);

    // Every mutation the section offers, and the controller function each one goes through.
    for (const door of ['renameDefinition', 'duplicateDefinition', 'removeDefinition', 'detachAndRemove']) {
      expect(source).toContain(door);
    }

    // 🔴 And no `myBlocksStore()` anywhere in it. The section renders; it does not decide.
    expect(source).not.toContain('myBlocksStore');
    expect(source).not.toContain('MyBlocksStore');
  });

  it('the section holds no sentence of its own', () => {
    // Every sentence comes from `libraryIntent.ts`, because neither runner can render this
    // component — a sentence written inline here is a sentence only a drive can check.
    const source = read(SECTION);
    for (const sentence of [
      'describeUsageShort',
      'describePropagation',
      'describeRegeneration',
      'describeDeleteRefusal',
      'describeDetachOffer',
      'describeDetachResult',
      'usageLines',
      'SHELF_LABEL'
    ]) {
      expect(source).toContain(sentence);
    }
  });

  it('🔴 the interface change is computed BEFORE the write, not after it', () => {
    // Criterion 6 depends entirely on this order, and getting it wrong fails **silently**: after
    // the save, the definition on the shelf is the edited one, so comparing it against the body
    // that produced it compares a thing to itself and every shape change goes unreported. The
    // behaviour is graded in `library-usage.spec.ts`; this holds the order in the file.
    const source = read(LIBRARY_CONTROLLER);
    const comparison = source.indexOf('definitionChangeFor(existing, body)');
    const write = source.indexOf('const definition = store.save(');

    expect(comparison).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(-1);
    expect(comparison).toBeLessThan(write);
  });

  it('the usage the warnings and the refusal use is recomputed at the moment of the press', () => {
    // ⚠️ A node open in a tab flushes its blocks to the model 300 ms after they settle, so a count
    // taken when the panel opened can be a count of a project that has since changed. Each of the
    // three gestures that shows a number calls `usageNow` rather than reading `row.usage`.
    const source = read(SECTION);
    const usageNowCalls = source.match(/usageNow\(/g) ?? [];
    expect(usageNowCalls.length).toBeGreaterThanOrEqual(2);

    // …and the controller's own `usageNow` walks the project rather than reading a cache.
    const controller = read(LIBRARY_CONTROLLER);
    expect(controller).toContain('scanProject()');
    expect(controller).not.toMatch(/cachedUsage|usageCache|memo/i);
  });
});
