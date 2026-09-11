/**
 * DSG-007 / F2 — the project id a backend is bound to.
 *
 * The register's whole table — three backends with `projectIds: []`, two more
 * carrying an id no project file claims — reduces to one absent field. These
 * pin the field, and pin the two properties that make writing it on open
 * defensible rather than damage: it adds `id` and **nothing else**, and it does
 * not write at all when there is already one.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ensureProjectId, mintProjectId, readProjectId, PROJECT_FILE } from '../src/backend/projectIdentity';
import { writeProjectSkeleton } from '../src/tools/createProject';

function tempProject(contents: unknown | string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsg007-identity-'));
  fs.writeFileSync(
    path.join(dir, PROJECT_FILE),
    typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2),
    'utf-8'
  );
  return dir;
}

function raw(dir: string): string {
  return fs.readFileSync(path.join(dir, PROJECT_FILE), 'utf-8');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('DSG-007 — a project acquires an id it can own a backend with', () => {
  it('mints the same shape create_project does, so a backfilled project is indistinguishable', () => {
    expect(mintProjectId()).toMatch(UUID);
    expect(mintProjectId()).not.toBe(mintProjectId());
  });

  it('backfills a project that has none, and the id is what lands on disk', () => {
    const dir = tempProject({ $schema: 'x', name: 'Shop', version: '4', nodegxVersion: '1.1.0' });
    expect(readProjectId(dir)).toBeUndefined();

    const result = ensureProjectId(dir);
    expect(result.outcome).toBe('minted');
    expect(result.id).toMatch(UUID);
    // The consequence, not the return value: the next reader sees it.
    expect(readProjectId(dir)).toBe(result.id);
  });

  it('⭐ adds `id` and NOTHING else — no bumped `modified`, no reordered keys, no lost fields', () => {
    const before = {
      $schema: 'https://opennoodl.dev/schemas/project-v2.json',
      name: 'Shop',
      version: '4',
      nodegxVersion: '1.1.0',
      modified: '2026-01-01T00:00:00.000Z',
      runtimeVersion: 'react19',
      settings: { htmlTitle: 'Shop', bodyScroll: true },
      structure: { componentsDir: 'components', assetsDir: 'assets' },
      metadata: { cloudservices: { endpoint: 'http://127.0.0.1:8578' }, designTokens: { a: 1 } }
    };
    const dir = tempProject(before);
    const { id } = ensureProjectId(dir);

    const after = JSON.parse(raw(dir));
    // A write to a user's project file on open is the kind of damage noticed a
    // week later, so this compares the WHOLE object, not a field list.
    expect({ ...after, id: undefined }).toEqual({ ...before, id: undefined });
    expect(after.id).toBe(id);
    // `modified` is untouched on purpose: acquiring an identity is not a change
    // to the design, and a bumped timestamp is a spurious diff in every version
    // control panel that shows one.
    expect(after.modified).toBe(before.modified);
    // Position matches create_project's skeleton, so the two diff to nothing
    // but the value.
    expect(Object.keys(after)).toEqual(['$schema', 'name', 'id', ...Object.keys(before).slice(2)]);
  });

  it('⭐ is idempotent — a second call does not write the file at all', () => {
    const dir = tempProject({ $schema: 'x', name: 'Shop', version: '4' });
    const first = ensureProjectId(dir);
    const bytesAfterMint = raw(dir);
    const mtime = fs.statSync(path.join(dir, PROJECT_FILE)).mtimeMs;

    const second = ensureProjectId(dir);
    expect(second.outcome).toBe('present');
    expect(second.id).toBe(first.id);
    expect(raw(dir)).toBe(bytesAfterMint);
    expect(fs.statSync(path.join(dir, PROJECT_FILE)).mtimeMs).toBe(mtime);
  });

  it('leaves an id that is already there alone, whatever shape it is', () => {
    // `Shop backend` on the machine that prompted DSG-007 carries
    // `projectIds: ["ecommerce-example"]` — a hand-written id that reads like a
    // name. It is still that project's identity, and rewriting it would strand
    // the backend that already points at it.
    const dir = tempProject({ name: 'Shop', id: 'ecommerce-example' });
    expect(ensureProjectId(dir)).toEqual({ id: 'ecommerce-example', outcome: 'present' });
    expect(readProjectId(dir)).toBe('ecommerce-example');
  });

  it('an id that is not a usable string is treated as absent, and replaced', () => {
    for (const bad of [null, '', '   ', 42, {}]) {
      const dir = tempProject({ name: 'Shop', id: bad });
      const result = ensureProjectId(dir);
      expect(result.outcome).toBe('minted');
      expect(result.id).toMatch(UUID);
    }
  });

  it('inserts at the front when there is no `name` to follow', () => {
    const dir = tempProject({ version: '4' });
    const { id } = ensureProjectId(dir);
    expect(Object.keys(JSON.parse(raw(dir)))).toEqual(['version', 'id']);
    expect(readProjectId(dir)).toBe(id);
  });

  it('says why rather than throwing when there is no readable project file', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'dsg007-empty-'));
    const missing = ensureProjectId(empty);
    expect(missing.outcome).toBe('unavailable');
    expect(missing.id).toBeUndefined();
    expect(missing.reason).toContain('no readable');

    const broken = tempProject('{ not json');
    const result = ensureProjectId(broken);
    expect(result.outcome).toBe('unavailable');
    expect(result.reason).toContain('not valid JSON');
    // Unparseable in, unparseable out — a repair here would hide the real fault.
    expect(raw(broken)).toBe('{ not json');
  });

  it('a JSON file that is not an object is refused, not coerced', () => {
    const dir = tempProject('[1,2,3]');
    expect(ensureProjectId(dir).outcome).toBe('unavailable');
    expect(raw(dir)).toBe('[1,2,3]');
  });
});

describe('DSG-007 §4.1 — the creation path this server owns writes an id', () => {
  /**
   * ⚠️ DSG-007 §4.1 says "the creation path does not populate it" and asks for
   * **both** creation paths to be checked. Re-verified 2026-08-11: this one
   * already does — `writeProjectSkeleton` has minted `id: crypto.randomUUID()`
   * since AIX-012, and every project this server created carries one. Nothing
   * pinned it, though, so it could have been dropped as silently as the editor
   * drops it. This is the pin.
   *
   * The **editor's** new-project flow is the half that is genuinely broken, and
   * differently from how §4.1 describes: it is not that creation omits `id`, it
   * is that `ProjectModel` neither reads it on load nor emits it on save, so
   * every save DELETES it. That is in `packages/noodl-editor` and outside this
   * task's territory — see NOTES-DSG-007.md.
   */
  it('⭐ create_project mints a project id, and it is the shape the matcher expects', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsg007-skeleton-'));
    writeProjectSkeleton(dir, 'Reading List');

    const project = JSON.parse(raw(dir));
    expect(project.id).toMatch(UUID);
    // The same value `ensureProjectId` would read back — the backfill and the
    // creation path must be indistinguishable to `findReusableBackend`, or half
    // the projects on a machine keep the defect.
    expect(readProjectId(dir)).toBe(project.id);
    // And a provision against it does not rewrite the file.
    expect(ensureProjectId(dir)).toEqual({ id: project.id, outcome: 'present' });
  });

  it('two projects created from the same name get different ids', () => {
    const a = fs.mkdtempSync(path.join(os.tmpdir(), 'dsg007-skel-a-'));
    const b = fs.mkdtempSync(path.join(os.tmpdir(), 'dsg007-skel-b-'));
    writeProjectSkeleton(a, 'Shop');
    writeProjectSkeleton(b, 'Shop');
    // The last acceptance criterion of DSG-007, at its source: two projects both
    // named "Shop" must never be able to share a backend.
    expect(readProjectId(a)).not.toBe(readProjectId(b));
  });
});
