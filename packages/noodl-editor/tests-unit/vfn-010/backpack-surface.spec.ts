/**
 * VFN-010 criteria 4 and 6 — *"because they call the same store"*, and the 1000 ms window.
 *
 * 🔴 **The single most important claim this task makes is that the launcher's manager is a SECOND
 * INSTANCE of VFN-009's, not a second implementation** — and that is a claim about *source*, which
 * no runtime assertion can hold. The failure mode is a second `LauncherSavedBlocksSection.tsx`
 * added next year with its own rename handler and its own `EditorSettings.set`, and no test that
 * does not know about that file will ever run it. So this reads the files and convicts the shapes,
 * with the same instrument VFN-009's `write-path.spec.ts` uses on the section's writes.
 *
 * ⚠️ A source scan that finds nothing is indistinguishable from a scan of the wrong file, from a
 * regex that matches nothing, and from a file that has since been renamed. Every check below has a
 * negative control: the same extractor over source that *does* contain the thing.
 *
 * ## What is deliberately NOT graded here
 *
 * The quit-survival check itself. VFN-010 says it in as many words: *"write a rename, quit within a
 * second, reopen, and read the shelf. That is the only way that trap has ever been visible."* What
 * is held here is that the flush exists, that it is on every backpack mutation, and that the
 * launcher's own way out awaits one. Whether the bytes reach the disk is owed to the drive.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..', 'src', 'editor', 'src');

const SECTION = path.join(ROOT, 'views', 'panels', 'SettingsPanel', 'sections', 'SavedBlocksSection.tsx');
const CONTROLLER = path.join(ROOT, 'views', 'BlocklyEditor', 'MyBlocksLibrary.ts');
const SHELVES = path.join(ROOT, 'views', 'BlocklyEditor', 'MyBlocksShelves.ts');
const LAUNCHER = path.join(ROOT, 'pages', 'ProjectsPage', 'LauncherSettingsDialog.tsx');
const PROJECT_TAB = path.join(ROOT, 'views', 'panels', 'SettingsPanel', 'ProjectSettingsTab.tsx');
const SECTIONS_DIR = path.join(ROOT, 'views', 'panels', 'SettingsPanel', 'sections');
const LAUNCHER_DIR = path.join(ROOT, 'pages', 'ProjectsPage');

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

/** Every React component *declared* in a source file. The extractor the reuse claim rests on. */
function componentsDeclaredIn(source: string): string[] {
  const names = new Set<string>();
  const pattern = /export\s+function\s+([A-Z][A-Za-z0-9]*)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) names.add(match[1]);
  return Array.from(names).sort();
}

/** Anything that writes a shelf without going through the store. VFN-009's list, unchanged. */
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

describe('🔴 VFN-010 — one manager, two instances', () => {
  it('the launcher mounts VFN-009’s own section against the user shelf', () => {
    const source = read(LAUNCHER);

    expect(source).toContain("import { SavedBlocksSection }");
    expect(source).toContain('<SavedBlocksSection shelf="user" />');

    // …and the project surface mounts the same component with no shelf, which is both shelves.
    expect(read(PROJECT_TAB)).toContain('SavedBlocksSection');
  });

  it('🔴 there is no SECOND saved-blocks component anywhere', () => {
    // The whole point. A parallel implementation would be a second writer to one shelf, in front
    // of a 1000 ms debounce, and this register already carries a finding that parallel agents
    // solve the same problem twice.
    const files = [
      ...fs.readdirSync(SECTIONS_DIR).map((name) => path.join(SECTIONS_DIR, name)),
      ...fs.readdirSync(LAUNCHER_DIR).map((name) => path.join(LAUNCHER_DIR, name))
    ].filter((file) => /\.tsx?$/.test(file));

    const declaring = files.filter((file) => componentsDeclaredIn(read(file)).indexOf('SavedBlocksSection') !== -1);
    expect(declaring.map((file) => path.basename(file))).toEqual(['SavedBlocksSection.tsx']);

    // And no launcher-local twin under any other name.
    for (const file of files.filter((f) => f.startsWith(LAUNCHER_DIR))) {
      const declared = componentsDeclaredIn(read(file)).join(' ');
      expect(declared).not.toMatch(/Backpack.*Section|SavedBlocks/);
    }
  });

  it('🔴 NEGATIVE CONTROL — the same extractor finds a component when there is one', () => {
    // Without this, "no second component" is indistinguishable from a regex that matches nothing.
    expect(componentsDeclaredIn(read(SECTION))).toContain('SavedBlocksSection');
    expect(
      componentsDeclaredIn('export function LauncherSavedBlocksSection({ x }: P) { return null; }')
    ).toEqual(['LauncherSavedBlocksSection']);
  });

  it('the one section keeps holding no sentence and no store call of its own', () => {
    const source = read(SECTION);

    // VFN-009's rule, extended over the sentences this task added: neither runner can render this
    // component, so a sentence written inline here is a sentence only a drive can check.
    for (const sentence of [
      'describeCrossProjectUsage',
      'describeCrossProjectRefusal',
      'describeUncheckedUsage',
      'describeCheckedAt',
      'describeImportResult',
      'crossProjectLines',
      'BACKPACK_EDIT_NOTE',
      'BACKPACK_INTRO',
      'BACKPACK_EMPTY'
    ]) {
      expect(source).toContain(sentence);
    }

    expect(source).not.toContain('myBlocksStore');
    expect(bypassesIn(source)).toEqual([]);
  });

  it('the launcher’s delete and the project’s delete refuse through the same store method', () => {
    const controller = read(CONTROLLER);

    // Both doors end at `store.remove` with a list of referencing node ids. The only difference is
    // where the list came from — the open project, or a scan of the recent ones.
    expect(controller).toContain('store.remove(definitionId, { referencingNodeIds: referencingNodeIds(usage) })');
    expect(controller).toContain('store.remove(definitionId, { referencingNodeIds: crossProjectNodeIds(usage) })');

    // 🔴 And rename is literally one function for both surfaces: safe by construction, because a
    // call block stores the id and never the name.
    expect(controller.match(/export function renameDefinition/g) ?? []).toHaveLength(1);
    expect(controller.match(/store\.rename\(/g) ?? []).toHaveLength(1);
  });
});

describe('🔴 VFN-010 criterion 6 — the 1000 ms window is flushed, not inherited', () => {
  it('the flush exists, and is the shelf module’s own disk write', () => {
    const shelves = read(SHELVES);

    expect(shelves).toContain('export async function flushShelves()');
    // `EditorSettings.instance.store()` is the debounced write, called directly. `set` is what
    // schedules it a second later, and `set` is what the bypass list forbids everywhere else.
    expect(shelves).toContain('EditorSettings.instance.store()');
  });

  it('every mutating door in the controller starts the flush', () => {
    const controller = read(CONTROLLER);

    // ⚠️ Counted rather than merely present. VFN-009 shipped five backpack-touching mutations with
    // no flush behind any of them; a fix that covered four of five would look identical to one that
    // covered all five, from a `toContain`.
    const flushes = controller.match(/flushIfBackpack\(|void flushShelves\(\)/g) ?? [];
    expect(flushes.length).toBeGreaterThanOrEqual(7);

    // The helper itself only fires for the backpack: the project shelf is `ProjectModel`, which has
    // its own save path, and forcing an editor-settings write for it would write an unrelated file.
    expect(controller).toContain("if (scope === 'user') void flushShelves()");
  });

  it('the launcher cannot be dismissed with a backpack write still only in memory', () => {
    const launcher = read(LAUNCHER);

    expect(launcher).toContain('flushShelves()');
    // Both ways out — the Done button and the backdrop/escape close — go through the same handler.
    expect(launcher).toContain('onClick={handleClose}');
    expect(launcher).toContain('onClose={handleClose}');
  });

  it('🔴 NEGATIVE CONTROL — the same extractors convict source that inherits the window', () => {
    // This is VFN-009's controller as it was merged: a rename that returns straight out of the
    // store, with nothing behind it. If the extractor above could not tell the two apart, "the
    // flush is on every door" would be a sentence about a file nobody read.
    const preFix = `
      export function renameDefinition(definitionId: string, name: string) {
        return myBlocksStore().rename(definitionId, name);
      }
      export function removeDefinition(definitionId: string): void {
        myBlocksStore().remove(definitionId, {});
      }
    `;
    expect(preFix.match(/flushIfBackpack\(|void flushShelves\(\)/g) ?? []).toHaveLength(0);

    // …and a launcher that closes without one.
    const preFixLauncher = '<PrimaryButton label="Done" onClick={onClose} />';
    expect(preFixLauncher).not.toContain('handleClose');
  });
});
