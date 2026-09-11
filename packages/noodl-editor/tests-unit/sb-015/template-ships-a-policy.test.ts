/**
 * SB-015 — the editor half: does picking the template actually put the policy
 * in the project?
 *
 * The backend suite (`nodegx-backend/tests/sb015-project-policy.test.ts`) grades
 * the applier, the startup ordering, and the shipped policy against the shipped
 * graphs. All of that is downstream of one question this runner is the only
 * place that can ask: **when a person picks Site Builder in the editor, does
 * `nodegx.security.json` land in their project directory?**
 *
 * 🔴 It is worth its own file because the failure mode is silent in exactly the
 * way SB-015's original bug was. `install()` would keep writing a perfectly good
 * `project.json`, the template would keep appearing on the shelf, and every
 * backend spec would keep passing — over a file that never arrived.
 *
 * ⚠️ The known-firing control here is `hello-world`, which carries no
 * `securityPolicy`. Without it, "the policy file is present" is consistent with
 * `install()` writing one unconditionally, which would put a Site Builder policy
 * into every project made from every template.
 */
import * as fs from 'fs';
import * as path from 'path';

import { EmbeddedTemplateProvider } from '@noodl-models/template/EmbeddedTemplateProvider';

const written = new Map<string, string>();

jest.mock(
  '@noodl/platform',
  () => ({
    filesystem: {
      exists: () => false,
      join: (...parts: string[]) => parts.join('/'),
      makeDirectory: async () => undefined,
      writeFile: async (p: string, contents: string) => {
        written.set(p, contents);
      }
    }
  }),
  { virtual: true }
);

const provider = new EmbeddedTemplateProvider();
const POLICY_FILE = 'nodegx.security.json';

/** The artefact on disk, read directly — not through the module that ships it. */
const SHIPPED = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'editor', 'src', 'models', 'template', 'templates', 'site-builder.security.json'),
    'utf-8'
  )
);

describe('SB-015 — a template that ships a security policy', () => {
  beforeEach(() => written.clear());

  it('writes nodegx.security.json into the project directory', async () => {
    await provider.install('embedded://site-builder', '/tmp/sb015-install');
    expect([...written.keys()]).toContain(`/tmp/sb015-install/${POLICY_FILE}`);
  });

  it('🔴 writes the shipped policy VERBATIM — no id remapping, nothing rewritten', async () => {
    // A security policy names collections, functions and roles, and not one node
    // id. Running it anywhere near `instantiateContent`'s rewrite would be a pass
    // looking for ids in a document that has none — the near-miss SB-007 F22
    // already recorded, where a string-matching rewrite would have corrupted
    // eight parameters whose values collide with node ids.
    await provider.install('embedded://site-builder', '/tmp/sb015-verbatim');
    const raw = written.get(`/tmp/sb015-verbatim/${POLICY_FILE}`)!;
    expect(JSON.parse(raw)).toEqual(SHIPPED);
  });

  it('carries the boundary the graphs assume — public read, role:admin write, admin-only publish', async () => {
    await provider.install('embedded://site-builder', '/tmp/sb015-boundary');
    const policy = JSON.parse(written.get(`/tmp/sb015-boundary/${POLICY_FILE}`)!);
    expect(policy.devOpen).toBe(false);
    expect(policy.collections.Page.permissions.find).toBe('public');
    expect(policy.collections.Page.permissions.update).toBe('role:admin');
    expect(policy.functions.publishPage.call).toBe('role:admin');
  });

  it('🔴 does NOT write one for a template that ships none (known-firing control)', async () => {
    // Without this, every assertion above is satisfied by an `install()` that
    // writes a policy unconditionally — which would push Site Builder's posture
    // into every project made from every other template.
    await provider.install('embedded://hello-world', '/tmp/sb015-plain');
    expect([...written.keys()]).toContain('/tmp/sb015-plain/project.json');
    expect([...written.keys()]).not.toContain(`/tmp/sb015-plain/${POLICY_FILE}`);
  });

  it('two installs of the same template produce identical policies (it is not instantiated)', async () => {
    await provider.install('embedded://site-builder', '/tmp/sb015-a');
    await provider.install('embedded://site-builder', '/tmp/sb015-b');
    expect(written.get(`/tmp/sb015-a/${POLICY_FILE}`)).toBe(written.get(`/tmp/sb015-b/${POLICY_FILE}`));
    // …while the project content genuinely does differ, which is what makes the
    // sameness above a property of the policy rather than of the whole install.
    expect(written.get('/tmp/sb015-a/project.json')).not.toBe(written.get('/tmp/sb015-b/project.json'));
  });
});
