/**
 * SB-015 — does the flag actually arrive?
 *
 * The mechanism has two halves in two packages, and each is measured on its own
 * side: `nodegx-backend/tests/sb015-project-policy.test.ts` proves the service
 * installs `nodegx.security.json` before `SecurityState` reads one, and
 * `noodl-editor/tests-unit/sb-015/` proves the template puts the file in the
 * project. Between them sits a **spawner**, and "the spawner passes the flag" is
 * exactly the kind of claim that is true of the source and false of the process.
 *
 * 🔴 So this drives the real thing: `provisionBackend` against the built
 * `dist/cli.js`, on a project directory carrying a policy, and then reads the
 * backend's own `security.json` off disk. A source-shape assertion ("the code
 * pushes `--project-dir`") would pass over a flag the service ignores, over a
 * dist that predates the flag, and over an argv the spawn never reaches.
 *
 * ⚠️ Skips loudly if the bundle is not built, like its neighbours — and that
 * skip is worth knowing about, because a stale `dist` is a live hazard on this
 * machine (SB-004 §6 F4). A dist without `--project-dir` writes one line to
 * stderr and starts anyway, so the *only* thing that catches it is reading the
 * consequence, which is what the last spec here does.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { provisionBackend, stopOwnedBackends } from '../src/backend/provision';

const BACKEND_CLI = path.join(__dirname, '..', '..', 'nodegx-backend', 'dist', 'cli.js');
const describeOrSkip = fs.existsSync(BACKEND_CLI) ? describe : describe.skip;

jest.setTimeout(120000);

/** SB-004 §4's policy, from the artefact the template ships. */
const SHIPPED = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      '..',
      '..',
      'noodl-editor',
      'src',
      'editor',
      'src',
      'models',
      'template',
      'templates',
      'site-builder.security.json'
    ),
    'utf-8'
  )
);

const temps: string[] = [];
function tmp(label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `sb015-mcp-${label}-`));
  temps.push(dir);
  return dir;
}

function makeProject(policy: unknown | null, label: string): string {
  const dir = tmp(label);
  fs.writeFileSync(
    path.join(dir, 'nodegx.project.json'),
    JSON.stringify({ name: label, components: [] }, null, 2)
  );
  if (policy) fs.writeFileSync(path.join(dir, 'nodegx.security.json'), JSON.stringify(policy, null, 2));
  return dir;
}

describeOrSkip('SB-015 — provisioning carries a project’s policy to the backend it starts', () => {
  afterEach(async () => {
    await stopOwnedBackends();
  });

  afterAll(() => {
    for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('🔴 a project that ships a policy gets a backend running THAT policy', async () => {
    const projectDir = makeProject(SHIPPED, 'withpolicy');
    const root = tmp('withpolicy-root');
    const result = await provisionBackend({
      name: 'SB-015 with policy',
      projectDir,
      projectId: 'sb015-with',
      collections: [],
      root
    });

    // Read the consequence off disk, not the response. The whole of SB-015 is
    // that a policy can exist, be correct, and not be the one being enforced.
    const onDisk = JSON.parse(fs.readFileSync(path.join(root, result.backendId, 'security.json'), 'utf-8'));
    expect(onDisk).toEqual(SHIPPED);
    expect(onDisk.devOpen).toBe(false);
    expect(onDisk.functions.publishPage.call).toBe('role:admin');
  });

  it('a project with no policy still gets the defaults (the control this is measured against)', async () => {
    // Without this arm, "the backend is running the shipped policy" is
    // consistent with a backend that runs it for every project — which would be
    // Site Builder's posture leaking into every app anybody provisions.
    const projectDir = makeProject(null, 'nopolicy');
    const root = tmp('nopolicy-root');
    const result = await provisionBackend({
      name: 'SB-015 no policy',
      projectDir,
      projectId: 'sb015-none',
      collections: [],
      root
    });

    const onDisk = JSON.parse(fs.readFileSync(path.join(root, result.backendId, 'security.json'), 'utf-8'));
    expect(onDisk.devOpen).toBe(true);
    expect(onDisk.collections).toEqual({});
    expect(onDisk.functions).toEqual({});
  });

  it('🔴 warns when the project’s policy is NOT the one the backend is running', async () => {
    // The path where the mechanism cannot act: a backend that already has a
    // policy is never overwritten, so a project provisioned onto one is in
    // SB-015's original state — a correct policy that is not being enforced. The
    // only defence is saying so, and a provision that returned success in
    // silence here would have reproduced the bug inside its own fix.
    const projectDir = makeProject(SHIPPED, 'mismatch');
    const root = tmp('mismatch-root');
    const first = await provisionBackend({
      name: 'SB-015 mismatch',
      projectDir: makeProject(null, 'mismatch-other'),
      projectId: 'sb015-mismatch',
      collections: [],
      root
    });
    // The backend now has the DEFAULT policy. Re-provision it for the project
    // that ships one — same name, same project id, so it is reused.
    const second = await provisionBackend({
      name: 'SB-015 mismatch',
      projectDir,
      projectId: 'sb015-mismatch',
      collections: [],
      root
    });

    expect(second.backendId).toBe(first.backendId);
    expect(second.warnings.join('\n')).toContain('nodegx.security.json');
    expect(second.warnings.join('\n')).toContain('never overwritten');
    // …and the policy on disk really is still the backend's, not the project's.
    const onDisk = JSON.parse(fs.readFileSync(path.join(root, second.backendId, 'security.json'), 'utf-8'));
    expect(onDisk.devOpen).toBe(true);
  });
});
