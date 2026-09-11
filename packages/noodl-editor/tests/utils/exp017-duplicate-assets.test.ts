/**
 * EXP-017 AC4 — the copy step, over a project that really does hold the same file twice.
 *
 * ## The measurement this is built from
 *
 * A deploy of the CMP-002 landing page published `fonts/Inter/Inter-Medium.ttf` **and**
 * `noodl_modules/inter/Inter-Medium.ttf`: 314,712 bytes each, byte for byte the same face. One
 * arrives with the Inter module `STARTER_ASSETS` installs into every project; the other arrives
 * inside an imported prefab, which carries its own copy. Nothing chose to publish both and nothing
 * in the run said it had.
 *
 * ## 🔴 What separates this from the planner's own spec
 *
 * `tests-unit/exp017/duplicate-assets.test.ts` grades the decision. This grades the **reading it
 * is made from**, which is the half that can be wrong in ways a pure function cannot see: that
 * identity is bytes rather than names, that a same-sized file with different content is not a
 * duplicate, and that the exclusion reaches `ProjectCopyReport` in the shape every other exclusion
 * arrives in — because a rule nobody is told about is how the duplicate got there in the first
 * place.
 *
 * describe/it/expect come from Jasmine globals — the editor suite runs under the Electron/Jasmine
 * runner, and importing @jest/globals throws at module load.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { copyProjectFilesToFolder, ProjectCopyReport } from '../../src/editor/src/utils/compilation/build/copy';

const FACE = 'noodl_modules/inter/Inter-Medium.ttf';
const PREFAB_FACE = 'fonts/Inter/Inter-Medium.ttf';

/** Something long enough that two copies are worth finding, and deterministic. */
const TYPEFACE = Buffer.from('\0\0\0'.repeat(4) + 'INTER-MEDIUM-GLYPH-DATA-'.repeat(400));
/** Same length, different bytes — the control that makes "identical" mean identical. */
const OTHER_TYPEFACE = Buffer.from(
  '\0\0\0'.repeat(4) + 'INTER-MEDIUM-GLYPH-DATB-'.repeat(400)
);

type FixtureFiles = Record<string, string | Buffer>;

function makeProject(files: FixtureFiles): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exp017-project-'));
  for (const relativePath of Object.keys(files)) {
    const full = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, files[relativePath]);
  }
  return root;
}

function listAll(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listAll(path.join(dir, entry.name), relativePath));
    else out.push(relativePath);
  }
  return out;
}

/** A v2 project with the Inter module installed and a prefab's `fonts/` folder beside it. */
function twoProducers(componentJson: string, prefabBytes: Buffer = TYPEFACE): FixtureFiles {
  return {
    'nodegx.project.json': '{"name":"demo","version":"2"}',
    'components/Pages/Home/nodes.json': componentJson,
    'index.html': '<html></html>',
    'noodl_modules/inter/manifest.json': JSON.stringify({
      name: 'Inter',
      browser: { stylesheets: ['noodl_modules/inter/styles.css'] }
    }),
    'noodl_modules/inter/styles.css': "@font-face{font-family:'Inter';src:url('./Inter-Medium.ttf')}",
    [FACE]: TYPEFACE,
    [PREFAB_FACE]: prefabBytes
  };
}

async function deploy(projectRoot: string): Promise<{ files: string[]; report: ProjectCopyReport }> {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'exp017-output-'));
  const report = await copyProjectFilesToFolder(projectRoot, output);
  return { files: listAll(output), report };
}

describe('EXP-017 AC4 — a file published twice is published once', () => {
  it('ships the module copy, leaves out the prefab copy, and names the rule that did it', async () => {
    const root = makeProject(twoProducers(JSON.stringify({ nodes: [{ id: 'a', type: 'Group' }] })));

    const { files, report } = await deploy(root);

    expect(files).toContain(FACE);
    expect(files).not.toContain(PREFAB_FACE);

    const excluded = report.excluded.filter((entry) => entry.source === 'duplicate-asset');
    expect(excluded.length).toBe(1);
    expect(excluded[0].path).toBe(PREFAB_FACE);
    // 🔴 The reason names the survivor. "One file was excluded" sends a person looking; "it is the
    // same bytes as this other one, which shipped" ends the question.
    expect(excluded[0].reason).toContain(FACE);
    expect(report.excludedByRule.some((rule) => rule.source === 'duplicate-asset')).toBe(true);
    expect(report.duplicatesKept).toEqual([]);
  });

  it('⚠️ CONTROL — same size, different bytes, and both ship', async () => {
    // The row that makes "identical" mean identical. Deduplicating on name or size would delete a
    // typeface and replace it with a different one, and the deploy would report a clean run.
    const root = makeProject(
      twoProducers(JSON.stringify({ nodes: [{ id: 'a', type: 'Group' }] }), OTHER_TYPEFACE)
    );
    expect(OTHER_TYPEFACE.length).toBe(TYPEFACE.length);

    const { files, report } = await deploy(root);

    expect(files).toContain(FACE);
    expect(files).toContain(PREFAB_FACE);
    expect(report.excluded.filter((entry) => entry.source === 'duplicate-asset')).toEqual([]);
  });

  it('⚠️ CONTROL — a duplicate the project REFERS to ships, and the run says so', async () => {
    // What an imported prefab actually writes: the path as a font family. The viewer derives the
    // family `Inter-Medium` from that URL, so dropping the file leaves the text unstyled — and a
    // silent 307 KB is a smaller failure than a stranger's website rendering in Times.
    const root = makeProject(
      twoProducers(
        JSON.stringify({
          nodes: [{ id: 'title', type: 'Text', parameters: { fontFamily: PREFAB_FACE } }]
        })
      )
    );

    const { files, report } = await deploy(root);

    expect(files).toContain(PREFAB_FACE);
    expect(report.excluded.filter((entry) => entry.source === 'duplicate-asset')).toEqual([]);
    expect(report.duplicatesKept.length).toBe(1);
    expect(report.duplicatesKept[0].path).toBe(PREFAB_FACE);
    expect(report.duplicatesKept[0].keep).toBe(FACE);
    expect(report.duplicatesKept[0].bytes).toBe(TYPEFACE.length);
  });

  it('🔴 CONTROL — two copies of the USER\'s own file are none of this rule\'s business', async () => {
    // Measured, by breaking DEP-008 `criterion 4`. Its fixture holds `assets/logo.png` and
    // `pre.gitlab-assets/logo.png` with the same three bytes, and the first version of this rule
    // dropped one. `nodegx deploy`'s contract is *everything ships unless a named rule excludes
    // it*, and somebody with two copies of their logo has two URLs this deploy cannot read.
    const root = makeProject({
      'nodegx.project.json': '{"name":"demo","version":"2"}',
      'components/Pages/Home/nodes.json': '{"nodes":[]}',
      'index.html': '<html></html>',
      'assets/logo.png': Buffer.from('PNG'),
      'pre.gitlab-assets/logo.png': Buffer.from('PNG')
    });

    const { files, report } = await deploy(root);

    expect(files).toContain('assets/logo.png');
    expect(files).toContain('pre.gitlab-assets/logo.png');
    expect(report.excluded.filter((entry) => entry.source === 'duplicate-asset')).toEqual([]);
    expect(report.duplicatesKept).toEqual([]);
  });

  it('⚠️ CONTROL — a project with no duplicates reports none, and loses nothing', async () => {
    // Arming every row above: without this, a copy step that excluded everything would pass the
    // first spec and fail nothing.
    const root = makeProject({
      'nodegx.project.json': '{"name":"demo","version":"2"}',
      'components/Pages/Home/nodes.json': '{"nodes":[]}',
      'index.html': '<html></html>',
      [FACE]: TYPEFACE,
      'images/logo.png': Buffer.from('PNG-LOGO')
    });

    const { files, report } = await deploy(root);

    expect(files).toContain(FACE);
    expect(files).toContain('images/logo.png');
    expect(report.excluded.filter((entry) => entry.source === 'duplicate-asset')).toEqual([]);
    expect(report.duplicatesKept).toEqual([]);
  });
});
