/**
 * BLD-007 — `get_project_doc`'s one-value enum becomes the discovered list.
 *
 * ⚠️ The tool definition is part of the cached prefix (on Anthropic, `tools`
 * renders ahead of `system`), so these checks are as much about what must NOT
 * change as about what must. The golden below is the pre-BLD-007 definition,
 * recorded byte for byte: a project with only an ARCHITECTURE.md must still
 * produce exactly it, or every existing project pays a cache miss on the first
 * turn after this task lands.
 */

import { dispatchProjectDocTool, projectDocTools } from '@noodl-models/AiAssistant/authoring/projectDocsTool';
import type { AiToolDefinition } from '@noodl-models/AiAssistant/client/types';
import type { ProjectDocsContent } from '@noodl-models/ProjectDocs/docsText';

/** The definition as it shipped before BLD-007. Do not "tidy" this. */
const GOLDEN_ARCHITECTURE_ONLY = {
  name: 'get_project_doc',
  description:
    "This project's docs/ARCHITECTURE.md — page map, data model, backend contracts, and the reasoning " +
    'behind them. Call it when the task depends on why the project is shaped the way it is, or on what ' +
    'an external service guarantees. It is not sent by default; one call is enough.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        enum: ['ARCHITECTURE.md'],
        description: 'The document to read. Only "ARCHITECTURE.md" is available to this loop.'
      }
    },
    required: ['path']
  }
};

/** The `path` parameter's enum, past the tool definition's open value type. */
function pathEnum(tool: AiToolDefinition): string[] {
  return (tool.parameters.properties as Record<string, { enum: string[] }>).path.enum;
}

/** A context builder stand-in: the tool only ever calls back into these. */
function stubContext(bodies: Record<string, string> = {}) {
  return {
    projectArchitecture: () => bodies['docs/ARCHITECTURE.md'] ?? 'no architecture',
    projectExtraDoc: (doc: { path: string }) => bodies[doc.path] ?? `no ${doc.path}`
  } as never;
}

describe('BLD-007 — the tool list', () => {
  it('is still absent for a project with no pull-injectable docs', () => {
    expect(projectDocTools({})).toEqual([]);
    expect(projectDocTools({ conventions: 'rules', brief: 'what it is' })).toEqual([]);
  });

  it('is byte-identical to the pre-BLD-007 definition when only ARCHITECTURE.md exists', () => {
    const tools = projectDocTools({ architecture: '# Architecture' });
    expect(tools.length).toBe(1);
    expect(JSON.stringify(tools[0])).toBe(JSON.stringify(GOLDEN_ARCHITECTURE_ONLY));
  });

  it('offers a user doc that declared inject: pull, with its title and hints', () => {
    const docs: ProjectDocsContent = {
      architecture: '# Architecture',
      extra: [
        {
          path: 'docs/uk-vat.md',
          title: 'UK VAT rules',
          inject: 'pull',
          when: ['tax', 'VAT', 'pricing'],
          body: '# VAT\n\n20% standard rate.'
        }
      ]
    };

    const [tool] = projectDocTools(docs);

    expect(pathEnum(tool)).toEqual(['ARCHITECTURE.md', 'uk-vat.md']);
    expect(tool.description).toContain('UK VAT rules');
    expect(tool.description).toContain('tax, VAT, pricing');
  });

  it('offers a user doc even when the project has no ARCHITECTURE.md', () => {
    const [tool] = projectDocTools({
      extra: [{ path: 'docs/uk-vat.md', title: 'UK VAT rules', inject: 'pull', when: [], body: 'x' }]
    });

    expect(tool).toBeDefined();
    expect(pathEnum(tool)).toEqual(['uk-vat.md']);
  });

  it('never offers an always-injected doc — it is already in the prefix', () => {
    const tools = projectDocTools({
      architecture: '# Architecture',
      extra: [{ path: 'docs/uk-vat.md', title: 'UK VAT', inject: 'always', when: [], body: 'x' }]
    });

    expect(pathEnum(tools[0])).toEqual(['ARCHITECTURE.md']);
  });
});

describe('BLD-007 — dispatch', () => {
  const docs: ProjectDocsContent = {
    architecture: '# Architecture',
    extra: [{ path: 'docs/uk-vat.md', title: 'UK VAT rules', inject: 'pull', when: ['tax'], body: '# VAT' }]
  };

  it('still routes ARCHITECTURE.md to the architecture handout', () => {
    const out = dispatchProjectDocTool(
      { id: '1', name: 'get_project_doc', arguments: { path: 'ARCHITECTURE.md' } },
      stubContext({ 'docs/ARCHITECTURE.md': 'ARCH BODY' }),
      docs
    );
    expect(out).toBe('ARCH BODY');
  });

  it('routes a discovered doc, accepting the docs/ prefix or not', () => {
    for (const asked of ['uk-vat.md', 'docs/uk-vat.md', './docs/uk-vat.md']) {
      const out = dispatchProjectDocTool(
        { id: '1', name: 'get_project_doc', arguments: { path: asked } },
        stubContext({ 'docs/uk-vat.md': 'VAT BODY' }),
        docs
      );
      expect(out).toBe('VAT BODY');
    }
  });

  it('answers an unknown path by naming what it does have, not by scolding', () => {
    const out = dispatchProjectDocTool(
      { id: '1', name: 'get_project_doc', arguments: { path: 'NOPE.md' } },
      stubContext(),
      docs
    );

    expect(out).toContain('uk-vat.md');
    expect(out).toContain('ARCHITECTURE.md');
  });

  it('leaves a call for another tool alone', () => {
    expect(dispatchProjectDocTool({ id: '1', name: 'read_component', arguments: {} }, stubContext(), docs)).toBeUndefined();
  });
});
