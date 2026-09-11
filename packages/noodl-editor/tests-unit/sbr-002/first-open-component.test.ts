/**
 * SBR-002 — the first run lands somewhere: a wizard-created Site Builder
 * project opens on `Pages/Setup`, not the blank `App` shell.
 *
 * What is graded here and what is not:
 *
 *  - HERE: the decider rule (`resolveFirstOpenComponent`) honours a project's
 *    `initialOpenComponent` metadata, ignores a stale or malformed one;
 *    `install()` writes that metadata for the one template that declares it
 *    and for no other; the declared name is a component the generated
 *    artefact actually contains.
 *  - NOT HERE: that the canvas really lands there on open. 🔴 The previous
 *    attempt at this feature had a spec that asserted source text and stayed
 *    green on dead code (`launcherHandoff.ts` records it) — so the on-screen
 *    claim is AC1's drive, never a unit assertion. The rule lives in its own
 *    import-free module because `projectmodel.utils` value-imports
 *    `ProjectModel`, whose module-scope chain cannot load in this runner —
 *    the two-line delegation from `getDefaultComponent` is part of what the
 *    drive covers.
 */
import * as fs from 'fs';
import * as path from 'path';

import { EmbeddedTemplateProvider } from '@noodl-models/template/EmbeddedTemplateProvider';
import {
  INITIAL_OPEN_COMPONENT_METADATA_KEY,
  resolveFirstOpenComponent
} from '@noodl-models/template/firstOpenComponent';
import { siteBuilderTemplate } from '@noodl-models/template/templates/site-builder.template';

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

/**
 * A stub project. Components are name-carrying tokens compared by identity
 * below, so a wrong pick cannot alias a right one.
 */
function stubInstance(args: { metadata?: Record<string, unknown>; components: string[] }) {
  const byName = new Map<string, { name: string }>();
  for (const name of args.components) {
    byName.set(name, { name });
  }
  return {
    instance: {
      getMetaData: (key: string) => (args.metadata ? args.metadata[key] : undefined),
      getComponentWithName: (name: string) => byName.get(name)
    },
    byName
  };
}

describe('SBR-002 resolveFirstOpenComponent — the decider rule', () => {
  it('a project whose metadata names a component resolves to it — even with /Main present', () => {
    const { instance, byName } = stubInstance({
      metadata: { [INITIAL_OPEN_COMPONENT_METADATA_KEY]: '/Pages/Setup' },
      components: ['/Main', '/Pages/Setup']
    });
    expect(resolveFirstOpenComponent(instance)).toBe(byName.get('/Pages/Setup'));
  });

  it('no hint ⇒ undefined, so the caller falls through to yesterday’s chain — the negative control', () => {
    const { instance } = stubInstance({ components: ['/Main', '/Pages/Setup'] });
    expect(resolveFirstOpenComponent(instance)).toBeUndefined();
  });

  it('a hint naming a component that no longer exists is ignored, not an error', () => {
    const { instance } = stubInstance({
      metadata: { [INITIAL_OPEN_COMPONENT_METADATA_KEY]: '/Pages/Deleted' },
      components: ['/Main']
    });
    expect(resolveFirstOpenComponent(instance)).toBeUndefined();
  });

  it('a non-string hint is ignored', () => {
    const { instance } = stubInstance({
      metadata: { [INITIAL_OPEN_COMPONENT_METADATA_KEY]: 42 },
      components: ['/Main']
    });
    expect(resolveFirstOpenComponent(instance)).toBeUndefined();
  });
});

describe('SBR-002 install writes the hint into project metadata', () => {
  beforeEach(() => written.clear());

  const provider = new EmbeddedTemplateProvider();

  async function installedProjectJson(url: string, dest: string): Promise<Record<string, unknown>> {
    await provider.install(url, dest);
    const raw = written.get(`${dest}/project.json`);
    expect(raw).toBeDefined();
    return JSON.parse(raw);
  }

  it('site-builder’s project.json carries metadata.initialOpenComponent = /Pages/Setup', async () => {
    const project = await installedProjectJson('embedded://site-builder', '/tmp/sbr002-sb');
    const metadata = project.metadata as Record<string, unknown>;
    expect(metadata).toBeDefined();
    expect(metadata[INITIAL_OPEN_COMPONENT_METADATA_KEY]).toBe('/Pages/Setup');
  });

  it('🔴 the hint names a component the installed project actually contains — a rename in the component sets reddens here', async () => {
    const project = await installedProjectJson('embedded://site-builder', '/tmp/sbr002-sb2');
    const metadata = project.metadata as Record<string, unknown>;
    const names = (project.components as Array<{ name: string }>).map((c) => c.name);
    expect(names).toContain(metadata[INITIAL_OPEN_COMPONENT_METADATA_KEY]);
  });

  it('hello-world installs as before: no metadata key arrives — the unconditional-write control', async () => {
    const project = await installedProjectJson('embedded://hello-world', '/tmp/sbr002-hw');
    const metadata = project.metadata as Record<string, unknown> | undefined;
    expect(metadata === undefined || !(INITIAL_OPEN_COMPONENT_METADATA_KEY in metadata)).toBe(true);
  });
});

describe('SBR-002 the shipped declaration', () => {
  it('the template declares /Pages/Setup, and the generated artefact on disk contains it', () => {
    expect(siteBuilderTemplate.initialOpenComponent).toBe('/Pages/Setup');

    // The artefact read directly — not through the module that ships it — so a
    // regeneration that loses the page reddens even if the template object lies.
    const shipped = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '..', '..', 'src', 'editor', 'src', 'models', 'template', 'templates', 'site-builder.content.json'),
        'utf-8'
      )
    );
    const names = (shipped.components as Array<{ name: string }>).map((c) => c.name);
    expect(names).toContain('/Pages/Setup');
  });
});
