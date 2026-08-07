/**
 * LIB-006 — the assessment core.
 *
 * Deliberately in `tests-unit/` rather than the jasmine suite: `assess()` is
 * pure by construction, and a runner that needs Electron to start would be
 * testing it in the one environment it does not have to work in. Same argument
 * OBS-002 made for the provenance engine.
 */

import { assess } from '../../src/editor/src/utils/import-engine/legacy/assess';
import type { LegacyCodePattern } from '../../src/editor/src/utils/import-engine/legacy/assess';
import type { CatalogTypeQuery } from '../../src/editor/src/utils/import-engine/legacy/types';
import type { ProjectData, RawNode } from '../../src/editor/src/utils/import-engine/types';

// ─── Fakes ───────────────────────────────────────────────────────────────────

function catalog(opts: {
  known?: string[];
  deprecated?: string[];
  related?: Record<string, string[]>;
}): CatalogTypeQuery {
  const known = new Set([...(opts.known ?? []), ...(opts.deprecated ?? [])]);
  const deprecated = new Set(opts.deprecated ?? []);
  return {
    hasType: (t) => known.has(t),
    isDeprecated: (t) => deprecated.has(t),
    relatedNodes: (t) => opts.related?.[t] ?? []
  };
}

function node(type: string, extra: Partial<RawNode> = {}): RawNode {
  return { id: `n-${type}-${extra.id ?? '1'}`, type, ...extra };
}

function project(roots: RawNode[], extra: Partial<ProjectData> = {}): ProjectData {
  return {
    name: 'Legacy',
    components: [{ name: '/App', graph: { roots, connections: [] } }],
    ...extra
  } as ProjectData;
}

const base = { sourceDir: '/src', modulesTravelWithImport: false };

// ─── Node types ──────────────────────────────────────────────────────────────

describe('assess — node types', () => {
  it('counts a current type without emitting an entry', () => {
    const result = assess({
      ...base,
      project: project([node('Group'), node('Text', { id: '2' })]),
      catalog: catalog({ known: ['Group', 'Text'] })
    });

    expect(result.findings).toHaveLength(0);
    expect(result.nodeCount).toBe(2);
    expect(result.constructsAssessed).toBe(2);
  });

  it('aggregates a deprecated type into ONE entry, not one per node', () => {
    const roots = [node('Label', { id: 'a' }), node('Label', { id: 'b' }), node('Label', { id: 'c' })];
    const result = assess({
      ...base,
      project: project(roots),
      catalog: catalog({ deprecated: ['Label'], related: { Label: ['Text'] } })
    });

    expect(result.findings).toHaveLength(1);
    const [finding] = result.findings;
    expect(finding.reason).toBe('type-deprecated');
    expect(finding.outcome).toBe('converted');
    expect(finding.occurrences).toBe(3);
    expect(finding.equivalents).toEqual(['Text']);
    expect(finding.sampleLocations).toHaveLength(3);
    // A deprecated node still runs. Not rewriting it is the point.
    expect(finding.converted).toBeUndefined();
  });

  it('placeholders a removed type and names the port deltas', () => {
    const result = assess({
      ...base,
      project: project([node('noodl.byob.CreateRecord')]),
      catalog: catalog({ known: ['NewDbModelProperties'] })
    });

    expect(result.findings).toHaveLength(1);
    const [finding] = result.findings;
    expect(finding.outcome).toBe('placeholder');
    expect(finding.reason).toBe('type-removed');
    expect(finding.equivalents).toEqual(['NewDbModelProperties']);
    expect(finding.portChanges?.some((p) => p.from === 'records' && p.to === 'items')).toBe(true);
    expect(finding.location?.component).toBe('/App');
  });

  it('recommends a rebuild, not a repair, when a removed type has no equivalent', () => {
    const result = assess({
      ...base,
      project: project([node('noodl.byob.SubscribeToChanges')]),
      catalog: catalog({})
    });

    const [finding] = result.findings;
    expect(finding.outcome).toBe('placeholder');
    expect(finding.equivalents).toEqual([]);
    expect(finding.recommendation).toContain('rebuild');
  });

  it('placeholders an unresolved type when nothing could provide it', () => {
    const result = assess({
      ...base,
      project: project([node('Avatar')]),
      catalog: catalog({ known: ['Group'] })
    });

    const [finding] = result.findings;
    expect(finding.outcome).toBe('placeholder');
    expect(finding.reason).toBe('type-unresolved');
  });

  it('does NOT placeholder an unresolved type when a module travels with the import', () => {
    // The decisive case. 47 working `Avatar` nodes in this repo's own corpus
    // would be marked broken if this went the other way.
    const result = assess({
      ...base,
      modulesTravelWithImport: true,
      project: project([node('Avatar')]),
      catalog: catalog({ known: ['Group'] })
    });

    const [finding] = result.findings;
    expect(finding.outcome).toBe('converted');
    expect(finding.reason).toBe('type-module-provided');
    expect(finding.kind).toBe('module');
    // The assumption is stated, not silent.
    expect(finding.message).toContain('assumed');
  });

  it('never reports a component instance — the closure already carries it', () => {
    const result = assess({
      ...base,
      project: project([node('/#Header'), node('#Sheet/Thing', { id: '2' })]),
      catalog: catalog({})
    });

    expect(result.findings).toHaveLength(0);
    expect(result.constructsAssessed).toBe(2);
  });

  it('walks nested children, not just roots', () => {
    const tree = node('Group', {
      children: [node('Label', { id: 'inner' }), node('Group', { id: 'g2', children: [node('Label', { id: 'deep' })] })]
    });
    const result = assess({
      ...base,
      project: project([tree]),
      catalog: catalog({ known: ['Group'], deprecated: ['Label'] })
    });

    expect(result.nodeCount).toBe(4);
    expect(result.findings[0].occurrences).toBe(2);
  });

  it('scopes to the requested components', () => {
    const data: ProjectData = {
      name: 'Legacy',
      components: [
        { name: '/Wanted', graph: { roots: [node('Label')], connections: [] } },
        { name: '/Ignored', graph: { roots: [node('noodl.byob.QueryData')], connections: [] } }
      ]
    } as ProjectData;

    const result = assess({
      ...base,
      project: data,
      componentNames: ['/Wanted'],
      catalog: catalog({ deprecated: ['Label'] })
    });

    expect(result.nodeCount).toBe(1);
    expect(result.findings.every((f) => f.outcome !== 'placeholder')).toBe(true);
  });
});

// ─── REST2 ───────────────────────────────────────────────────────────────────

describe('assess — the REST2 conversion gate', () => {
  const cat = catalog({ deprecated: ['REST2'], known: ['net.noodl.HTTP'], related: { REST2: ['net.noodl.HTTP'] } });

  it('converts a script-free REST node to HTTP Request', () => {
    const result = assess({
      ...base,
      project: project([node('REST2', { parameters: { resource: 'https://example.com' } })]),
      catalog: cat
    });

    const [finding] = result.findings;
    expect(finding.outcome).toBe('converted-with-changes');
    expect(finding.reason).toBe('rest-to-http');
    expect(finding.converted).toBe('net.noodl.HTTP');
    expect(finding.portChanges).toContainEqual({ from: 'resource', to: 'url' });
  });

  it('reports `method` as not carried', () => {
    const result = assess({
      ...base,
      project: project([node('REST2', { parameters: { resource: 'https://example.com', method: 'POST' } })]),
      catalog: cat
    });

    expect(result.findings[0].message).toContain('method');
  });

  it('leaves REST alone when a request script carries user code', () => {
    // NDA-011 stopped exactly here. Rewriting would discard executable code,
    // which is the one thing the compatibility policy will not permit.
    const result = assess({
      ...base,
      project: project([node('REST2', { parameters: { requestScript: 'request.headers.x = 1;' } })]),
      catalog: cat
    });

    const [finding] = result.findings;
    expect(finding.outcome).toBe('converted');
    expect(finding.reason).toBe('rest-has-scripts');
    expect(finding.converted).toBeUndefined();
  });

  it('treats a blank script as no script', () => {
    const result = assess({
      ...base,
      project: project([node('REST2', { parameters: { requestScript: '   ', responseScript: '' } })]),
      catalog: cat
    });

    expect(result.findings[0].reason).toBe('rest-to-http');
  });
});

// ─── Project-level constructs ────────────────────────────────────────────────

describe('assess — project-level constructs', () => {
  it('reports deviceSettings as dropped', () => {
    const result = assess({
      ...base,
      project: project([], { deviceSettings: { width: 375 } } as Partial<ProjectData>),
      catalog: catalog({})
    });

    const finding = result.findings.find((f) => f.original === 'deviceSettings');
    expect(finding?.outcome).toBe('dropped');
    expect(finding?.reason).toBe('field-not-carried');
  });

  it('says nothing about a field the project does not carry', () => {
    const result = assess({ ...base, project: project([]), catalog: catalog({}) });
    expect(result.findings.find((f) => f.original === 'deviceSettings')).toBeUndefined();
  });

  it('reports rootComponent → rootNodeId as a change', () => {
    const result = assess({
      ...base,
      project: project([], { rootComponent: 'App' } as Partial<ProjectData>),
      catalog: catalog({})
    });

    const finding = result.findings.find((f) => f.original === 'rootComponent');
    expect(finding?.outcome).toBe('converted-with-changes');
    expect(finding?.converted).toBe('rootNodeId');
  });

  it('reports a project-version upgrade, and stays quiet on the current version', () => {
    const old = assess({ ...base, project: project([], { version: 1 } as Partial<ProjectData>), catalog: catalog({}) });
    expect(old.findings.find((f) => f.reason === 'project-version-upgraded')).toBeDefined();

    const current = assess({
      ...base,
      project: project([], { version: 4 } as Partial<ProjectData>),
      catalog: catalog({})
    });
    expect(current.findings.find((f) => f.reason === 'project-version-upgraded')).toBeUndefined();
  });

  it('flags an external backend as unverifiable, not as broken', () => {
    const result = assess({
      ...base,
      project: project([], {
        metadata: { cloudservices: { endpoint: 'https://parse.example.com' } }
      } as Partial<ProjectData>),
      catalog: catalog({})
    });

    const finding = result.findings.find((f) => f.kind === 'backend');
    expect(finding?.outcome).toBe('converted');
    expect(finding?.reason).toBe('external-backend-unverified');
  });
});

// ─── User code ───────────────────────────────────────────────────────────────

describe('assess — user code', () => {
  const patterns: LegacyCodePattern[] = [
    { name: 'findDOMNode', description: 'use a ref', test: (c) => /findDOMNode\s*\(/.test(c) }
  ];

  it('flags a React 19 removal in a Function node without dropping the code', () => {
    const result = assess({
      ...base,
      project: project([node('JavaScriptFunction', { parameters: { functionScript: 'findDOMNode(x)' } })]),
      catalog: catalog({ known: ['JavaScriptFunction'] }),
      codePatterns: patterns
    });

    const finding = result.findings.find((f) => f.kind === 'user-code');
    expect(finding?.outcome).toBe('converted');
    expect(finding?.reason).toBe('react19-user-code');
    expect(finding?.location?.parameter).toBe('functionScript');
  });

  it('skips the pass entirely when no patterns are supplied', () => {
    const result = assess({
      ...base,
      project: project([node('JavaScriptFunction', { parameters: { functionScript: 'findDOMNode(x)' } })]),
      catalog: catalog({ known: ['JavaScriptFunction'] })
    });

    expect(result.findings.find((f) => f.kind === 'user-code')).toBeUndefined();
  });

  it('reads the right parameter per code-bearing node type', () => {
    const result = assess({
      ...base,
      project: project([
        node('Javascript2', { parameters: { code: 'findDOMNode(a)' } }),
        node('Expression', { id: '2', parameters: { expression: 'findDOMNode(b)' } }),
        node('CSS Definition', { id: '3', parameters: { style: 'findDOMNode(c)' } })
      ]),
      catalog: catalog({ known: ['Javascript2', 'Expression', 'CSS Definition'] }),
      codePatterns: patterns
    });

    expect(result.findings.filter((f) => f.kind === 'user-code')).toHaveLength(3);
  });
});

// ─── Finding ids ─────────────────────────────────────────────────────────────

describe('assess — finding ids', () => {
  it('gives a stable id that does not depend on ordering', () => {
    const roots = [node('noodl.byob.QueryData', { id: 'x' }), node('noodl.byob.CreateRecord', { id: 'y' })];
    const forward = assess({ ...base, project: project(roots), catalog: catalog({}) });
    const reversed = assess({ ...base, project: project([...roots].reverse()), catalog: catalog({}) });

    expect(forward.findings.map((f) => f.id).sort()).toEqual(reversed.findings.map((f) => f.id).sort());
  });

  it('gives distinct ids to two instances of the same removed type', () => {
    const result = assess({
      ...base,
      project: project([
        node('noodl.byob.QueryData', { id: 'first' }),
        node('noodl.byob.QueryData', { id: 'second' })
      ]),
      catalog: catalog({})
    });

    const ids = new Set(result.findings.map((f) => f.id));
    expect(ids.size).toBe(2);
  });
});
