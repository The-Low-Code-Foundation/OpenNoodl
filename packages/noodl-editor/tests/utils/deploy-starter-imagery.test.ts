/**
 * VIB-012 — the bundled stock library is pruned to what a project actually references.
 *
 * VIB-011 shipped 44 CC0 photographs (~3.32 MB) into every project. `noodl_modules/` is in no
 * default ignore rule, so every one of them went into every deployed app. Richard asked whether
 * that was happening, it was, and he chose prune-on-deploy.
 *
 * 🔴 **The spec that matters most is `criterion 2`.** Image paths in this product are frequently
 * DATA: the shipped `ui-testimonial-row` keeps its three `avatar-*.webp` paths inside a
 * `Static Data` node's JSON string, and a `For Each` feeds them to `Image.src` over a connection. A
 * pruner walking node *parameters* finds no reference to any of them, deletes all three, reports a
 * clean deploy, and leaves three broken images on a stranger's website. That fixture is built from
 * the real recipe's shape for exactly that reason.
 *
 * describe/it/expect come from Jasmine globals — the editor suite runs under the Electron/Jasmine
 * runner, and importing @jest/globals throws at module load.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { copyProjectFilesToFolder, ProjectCopyReport } from '../../src/editor/src/utils/compilation/build/copy';
import { planStarterImageryPrune } from '../../src/editor/src/utils/compilation/build/starterImagery';

const IMAGERY = 'noodl_modules/starter-imagery';

/** Every photograph the library ships, near enough — enough names to tell pruning from luck. */
const LIBRARY = [
  'ground-city-dusk.webp',
  'ground-canyon.webp',
  'ground-coast.webp',
  'work-potter.webp',
  'work-welder.webp',
  'food-bread.webp',
  'avatar-1.webp',
  'avatar-2.webp',
  'avatar-3.webp',
  'avatar-5.webp'
];

type FixtureFiles = Record<string, string>;

function makeProject(files: FixtureFiles): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vib012-project-'));
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

/**
 * A v2 project carrying the whole library, including **the real `manifest.json` prose**.
 *
 * 🔴 That prose is the trap, and it is not the one you would guess. `LICENCES.json` lists bare
 * basenames and contains `starter-imagery/` nowhere, so reading it would change nothing. But
 * `manifest.json` documents the module — *"Reference any file as
 * `noodl_modules/starter-imagery/<name>`"* — and `<name>` is not a filename, so a source scan that
 * reads the imagery directory **refuses and disables pruning permanently, for every project**, with
 * a reason that reads entirely plausible. The fixture carries that exact sentence so the control
 * below is a live one rather than a trivially true assertion.
 */
function libraryProject(componentJson: string): FixtureFiles {
  const files: FixtureFiles = {
    'nodegx.project.json': '{"name":"demo","version":"2"}',
    'components/Pages/Home/nodes.json': componentJson,
    'index.html': '<html></html>',
    [`${IMAGERY}/manifest.json`]: JSON.stringify({
      name: 'Starter imagery',
      _note: `Reference any file as ${IMAGERY}/<name>. This module carries no stylesheet.`
    }),
    [`${IMAGERY}/LICENCES.json`]: JSON.stringify({ images: LIBRARY.map((file) => ({ file, licence: 'CC0' })) })
  };
  for (const name of LIBRARY) files[`${IMAGERY}/${name}`] = `WEBP:${name}`;
  return files;
}

interface DeployResult {
  files: string[];
  report: ProjectCopyReport;
}

async function deploy(projectRoot: string): Promise<DeployResult> {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'vib012-output-'));
  const report = await copyProjectFilesToFolder(projectRoot, output);
  return { files: listAll(output), report };
}

/** The photographs that reached the deploy output, basenames only. */
function shippedImages(files: string[]): string[] {
  return files
    .filter((f) => f.startsWith(`${IMAGERY}/`))
    .map((f) => f.substring(IMAGERY.length + 1))
    .sort();
}

// ─── Criterion 1 ──────────────────────────────────────────────────────────────

describe('VIB-012 criterion 1 — a deploy carries the photographs the project uses, and no others', () => {
  it('ships the two referenced files plus manifest and LICENCES, and drops the other eight', async () => {
    const root = makeProject(
      libraryProject(
        JSON.stringify({
          nodes: [
            { id: 'hero', type: 'Image', parameters: { src: `${IMAGERY}/work-potter.webp` } },
            { id: 'band', type: 'Group', parameters: { backgroundImage: `${IMAGERY}/ground-canyon.webp` } }
          ]
        })
      )
    );
    const { files } = await deploy(root);
    expect(shippedImages(files)).toEqual(['LICENCES.json', 'ground-canyon.webp', 'manifest.json', 'work-potter.webp']);
  });

  it('⚠️ CONTROL — a project that references nothing still ships the record, not the pictures', async () => {
    const root = makeProject(libraryProject(JSON.stringify({ nodes: [{ id: 'a', type: 'Group' }] })));
    const { files } = await deploy(root);
    expect(shippedImages(files)).toEqual(['LICENCES.json', 'manifest.json']);
  });

  it("⚠️ CONTROL — the module's own manifest prose must not switch the pruner off", async () => {
    // The fixture's manifest.json carries the real `<name>` placeholder. If the source scan ever
    // reads the imagery directory, that placeholder resolves to no file, the planner refuses, and
    // pruning silently stops for every project forever. This is the spec that catches it.
    const root = makeProject(libraryProject(JSON.stringify({ nodes: [] })));
    const { report } = await deploy(root);
    expect(report.imageryPruneRefused).toBeUndefined();
    expect(report.excluded.filter((e) => e.source === 'unreferenced-imagery').length).toBe(LIBRARY.length);
  });
});

// ─── Criterion 2 — the one that matters ───────────────────────────────────────

describe('VIB-012 criterion 2 — a path that exists only as DATA keeps its file', () => {
  /** The shipped `ui-testimonial-row` shape: three avatars inside a Static Data JSON string. */
  const testimonialRow = JSON.stringify({
    nodes: [
      {
        id: 'rows',
        type: 'Static Data',
        parameters: {
          type: 'json',
          json: JSON.stringify([
            { id: 'q1', name: 'Priya Raman', portrait: `${IMAGERY}/avatar-3.webp` },
            { id: 'q2', name: 'Tom Aldiss', portrait: `${IMAGERY}/avatar-1.webp` },
            { id: 'q3', name: 'Marguerite Osei', portrait: `${IMAGERY}/avatar-2.webp` }
          ])
        }
      },
      { id: 'portrait', type: 'Image', parameters: { src: `${IMAGERY}/avatar-5.webp` } }
    ]
  });

  it('keeps all three avatars named only inside the Static Data string', async () => {
    const { files } = await deploy(makeProject(libraryProject(testimonialRow)));
    const shipped = shippedImages(files);
    for (const face of ['avatar-1.webp', 'avatar-2.webp', 'avatar-3.webp', 'avatar-5.webp']) {
      expect(shipped).toContain(face);
    }
  });

  it('still drops the six the testimonial row does not use', async () => {
    const { files } = await deploy(makeProject(libraryProject(testimonialRow)));
    expect(shippedImages(files)).not.toContain('work-welder.webp');
    expect(shippedImages(files)).not.toContain('ground-coast.webp');
  });
});

// ─── Criterion 3 — refuse on ambiguity ────────────────────────────────────────

describe('VIB-012 criterion 3 — an unresolvable reference prunes nothing at all', () => {
  it('ships the whole library when a path is built at runtime', async () => {
    const root = makeProject(
      libraryProject(
        JSON.stringify({
          nodes: [{ id: 'x', type: 'Expression', parameters: { expression: `"${IMAGERY}/" + name + ".webp"` } }]
        })
      )
    );
    const { files, report } = await deploy(root);
    expect(shippedImages(files).length).toBe(LIBRARY.length + 2);
    expect(report.imageryPruneRefused).toBeTruthy();
  });

  it('ships the whole library when a name does not exist, and says which', async () => {
    const root = makeProject(
      libraryProject(
        JSON.stringify({ nodes: [{ id: 'x', type: 'Image', parameters: { src: `${IMAGERY}/renamed-away.webp` } }] })
      )
    );
    const { files, report } = await deploy(root);
    expect(shippedImages(files).length).toBe(LIBRARY.length + 2);
    expect(report.imageryPruneRefused).toContain('renamed-away.webp');
  });

  it('⚠️ CONTROL — a resolvable project does NOT refuse, so the refusal means something', async () => {
    const root = makeProject(
      libraryProject(
        JSON.stringify({ nodes: [{ id: 'x', type: 'Image', parameters: { src: `${IMAGERY}/food-bread.webp` } }] })
      )
    );
    const { report } = await deploy(root);
    expect(report.imageryPruneRefused).toBeUndefined();
  });
});

// ─── Criterion 4 — the report explains itself ─────────────────────────────────

describe('VIB-012 criterion 4 — the deploy report names the rule and the reason', () => {
  it('reports each pruned photograph with its source and a reason a person can act on', async () => {
    const root = makeProject(
      libraryProject(
        JSON.stringify({ nodes: [{ id: 'x', type: 'Image', parameters: { src: `${IMAGERY}/avatar-1.webp` } }] })
      )
    );
    const { report } = await deploy(root);
    const pruned = report.excluded.filter((e) => e.source === 'unreferenced-imagery');
    expect(pruned.length).toBe(LIBRARY.length - 1);
    expect(pruned[0].rule).toBe(`${IMAGERY}/*`);
    expect(pruned[0].reason).toContain('never references');
    expect(report.excludedByRule.some((r) => r.source === 'unreferenced-imagery')).toBe(true);
  });
});

// ─── The planner in isolation ─────────────────────────────────────────────────

describe('VIB-012 — planStarterImageryPrune, the decision on its own', () => {
  it('refuses when it was given no source text at all', () => {
    // "No evidence" and "nothing is referenced" have opposite correct actions.
    const plan = planStarterImageryPrune(LIBRARY, '   ');
    expect(plan.drop).toEqual([]);
    expect(plan.refusedReason).toBeTruthy();
  });

  it('has nothing to do when the directory holds only the record', () => {
    const plan = planStarterImageryPrune(['manifest.json', 'LICENCES.json'], '');
    expect(plan.drop).toEqual([]);
    expect(plan.refusedReason).toBeUndefined();
  });

  it('matches a bare relative reference, not only a full project path', () => {
    const plan = planStarterImageryPrune(LIBRARY, 'src="starter-imagery/avatar-2.webp"');
    expect(plan.referenced).toContain('avatar-2.webp');
    expect(plan.drop).not.toContain('avatar-2.webp');
  });
});
