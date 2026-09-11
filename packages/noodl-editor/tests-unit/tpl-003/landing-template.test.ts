/**
 * TPL-003 — the landing pages are on the embedded shelf, and install as a
 * project that opens with no backend.
 *
 * The site builder's `sb-007/site-template.test.ts`, applied to the second
 * embedded template. What it reads is the shipped provider and the compiled
 * content, through the same `install()` the wizard calls, with the platform
 * filesystem replaced by a map — so every assertion is about the bytes a
 * person's new project directory would receive.
 *
 * ⚠️ What this file does NOT grade: whether `landing-pages.content.json` is
 * what the generator writes today. That is `packages/noodl-mcp/tests/
 * tpl003Template.test.ts` §1, which regenerates through the real MCP door and
 * compares bytes; this file trusts the committed content and asks what the
 * editor does with it.
 */
import { EmbeddedTemplateProvider } from '@noodl-models/template/EmbeddedTemplateProvider';
import { templateNeedsBackend } from '@noodl-models/template/EmbeddedTemplateProvider';
import { ProjectContent } from '@noodl-models/template/ProjectTemplate';
import { landingPagesTemplate } from '@noodl-models/template/templates/landing-pages.template';

const written = new Map<string, string>();
const madeDirectories: string[] = [];

jest.mock(
  '@noodl/platform',
  () => ({
    filesystem: {
      exists: () => false,
      join: (...parts: string[]) => parts.join('/'),
      makeDirectory: async (path: string) => {
        madeDirectories.push(path);
      },
      writeFile: async (path: string, contents: string) => {
        written.set(path, contents);
      }
    }
  }),
  { virtual: true }
);

const provider = new EmbeddedTemplateProvider();
const TEMPLATE_URL = 'embedded://landing-pages';

async function installOnce(destination: string): Promise<ProjectContent> {
  await provider.install(TEMPLATE_URL, destination);
  const raw = written.get(`${destination}/project.json`);
  if (!raw) throw new Error(`install wrote nothing to ${destination}/project.json`);
  return JSON.parse(raw) as ProjectContent;
}

interface Node {
  id: string;
  type: string;
  children?: Node[];
}

function nodeIdsOf(project: ProjectContent): Set<string> {
  const ids = new Set<string>();
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      ids.add(node.id);
      if (node.children?.length) walk(node.children);
    }
  };
  for (const component of project.components ?? []) walk((component.graph?.roots ?? []) as unknown as Node[]);
  return ids;
}

describe('TPL-003 — the landing pages are OFFERED on the shipped shelf', () => {
  it('🔴 the row is the whole row: title, category, and no backend', async () => {
    const row = (await provider.list()).find((i) => i.projectURL === TEMPLATE_URL);
    expect(row).toBeDefined();
    expect(row?.title).toBe('Landing Pages');
    expect(row?.category).toBe('site');
    // No policy and no cloud component — derived, not declared. The wizard
    // attaches a backend on `true`, and this template must never get one.
    expect(row?.needsBackend).toBe(false);
    expect(templateNeedsBackend(landingPagesTemplate)).toBe(false);
    expect(await provider.canInstall(TEMPLATE_URL)).toBe(true);
  });

  it('control: the site builder beside it still needs one, so the derivation discriminates', async () => {
    const rows = await provider.list();
    expect(rows.find((i) => i.projectURL === 'embedded://site-builder')?.needsBackend).toBe(true);
  });

  it('opens on the first look', () => {
    expect(landingPagesTemplate.initialOpenComponent).toBe('/Pages/Freelancer');
    expect(landingPagesTemplate.content.components.map((c) => c.name)).toContain('/Pages/Freelancer');
  });
});

describe('TPL-003 — install writes a project that opens', () => {
  beforeEach(() => {
    written.clear();
    madeDirectories.length = 0;
  });

  it('writes a project.json and the start-here note, and NO policy', async () => {
    const project = await installOnce('/projects/a');
    expect([...written.keys()]).toEqual(['/projects/a/project.json', '/projects/a/docs/START-HERE.md']);
    expect(project.components).toHaveLength(21);
    expect(written.get('/projects/a/docs/START-HERE.md')).toContain('EDIT — the address the form sends to');
  });

  it('🔴 no component is a cloud component', async () => {
    const project = await installOnce('/projects/a');
    expect(project.components.filter((c) => c.name?.startsWith('/#__cloud__/'))).toEqual([]);
  });

  it('🔴 writes `bodyScroll: true` — a landing page is nothing but what is below the fold', async () => {
    const project = await installOnce('/projects/a');
    expect(project.settings).toMatchObject({ bodyScroll: true, navigationPathType: 'path' });
  });

  it('🔴 resolves a concrete rootNodeId, and it is the App’s root', async () => {
    const project = await installOnce('/projects/a');
    expect(project.rootNodeId).toBeDefined();
    expect(nodeIdsOf(project).has(project.rootNodeId as string)).toBe(true);
    const app = project.components?.find((c) => c.name === project.rootComponent);
    expect(app?.graph?.roots?.[0]?.id).toBe(project.rootNodeId);
  });

  it('carries the look and the first-open hint in metadata', async () => {
    const project = await installOnce('/projects/a');
    const metadata = project.metadata as { designTokens?: { customTokens?: unknown[] }; initialOpenComponent?: string };
    expect((metadata.designTokens?.customTokens ?? []).length).toBeGreaterThan(20);
    expect(metadata.initialOpenComponent).toBe('/Pages/Freelancer');
  });

  it('gives two projects from the same template disjoint node ids', async () => {
    const a = nodeIdsOf(await installOnce('/projects/a'));
    const b = nodeIdsOf(await installOnce('/projects/b'));
    expect(a.size).toBeGreaterThan(100);
    for (const id of a) expect(b.has(id)).toBe(false);
  });

  it('every connection endpoint names a node that exists', async () => {
    const project = await installOnce('/projects/a');
    for (const component of project.components) {
      const ids = new Set<string>();
      const walk = (nodes: Node[]) => {
        for (const n of nodes) {
          ids.add(n.id);
          if (n.children?.length) walk(n.children);
        }
      };
      walk((component.graph?.roots ?? []) as unknown as Node[]);
      for (const c of component.graph?.connections ?? []) {
        expect(ids.has(c.fromId as string)).toBe(true);
        expect(ids.has(c.toId as string)).toBe(true);
      }
    }
  });
});
