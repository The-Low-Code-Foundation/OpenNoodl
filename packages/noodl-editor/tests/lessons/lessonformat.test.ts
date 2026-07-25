/**
 * LEARN-001 Slice 2 — unit tests for the declarative lesson-format compiler.
 *
 * Beyond checking each transform, the "round-trip" block below feeds compiled
 * step HTML through the SAME DOM extraction the runtime's loadSteps performs
 * (innerHTML → getAttribute('data-conditions') → JSON.parse) and then through
 * the Slice-1 evaluator — proving the new authoring format produces conditions
 * the completion detector actually accepts.
 */

import {
  compileConditions,
  compileLessonManifest,
  compileLessonSource,
  compileStep,
  isManifestUrl,
  looksLikeManifest,
  renderMarkdown
} from '../../src/editor/src/models/lessonformat';
import { evalConditionsWithContext, LessonComponent } from '../../src/editor/src/views/lessons/lessonevalconditions';

// ─── Format detection ────────────────────────────────────────────────────────

describe('lesson format detection', () => {
  it('isManifestUrl recognises .json URLs (with query/hash)', () => {
    expect(isManifestUrl('lesson.json')).toBe(true);
    expect(isManifestUrl('https://host/lessons/x/lesson.json?v=2')).toBe(true);
    expect(isManifestUrl('lesson.html')).toBe(false);
  });

  it('looksLikeManifest sniffs a JSON object with a steps array', () => {
    expect(looksLikeManifest('{ "steps": [] }')).toBe(true);
    expect(looksLikeManifest('<div data-template="popup"></div>')).toBe(false);
    expect(looksLikeManifest('{ "notsteps": 1 }')).toBe(false);
  });
});

// ─── Condition compilation ───────────────────────────────────────────────────

describe('compileConditions', () => {
  it('maps every friendly verb onto the internal vocabulary', () => {
    expect(compileConditions([{ node: 'App:#N', hasType: 'Group' }], 'x')).toEqual([
      { path: 'App:#N', hastype: 'Group' }
    ]);
    expect(compileConditions([{ node: 'App:#N', hasLabel: 'Header' }], 'x')).toEqual([
      { path: 'App:#N', haslabel: 'Header' }
    ]);
    expect(compileConditions([{ node: 'App:#N', hasPort: 'width' }], 'x')).toEqual([
      { path: 'App:#N', hasport: 'width' }
    ]);
    expect(compileConditions([{ node: 'App:#N', exists: false }], 'x')).toEqual([{ path: 'App:#N', exists: false }]);
    expect(compileConditions([{ node: 'App:#N', isVisualRoot: true }], 'x')).toEqual([
      { path: 'App:#N', isvisualroot: true }
    ]);
    expect(compileConditions([{ node: 'App:#N', hasParams: ['width', 'height'] }], 'x')).toEqual([
      { path: 'App:#N', hasparams: 'width,height' }
    ]);
    expect(compileConditions([{ node: 'App:#N', paramsEqual: { align: 'center' } }], 'x')).toEqual([
      { path: 'App:#N', paramseq: { align: 'center' } }
    ]);
    expect(
      compileConditions(
        [{ connection: { from: 'App:#A', to: 'App:#B', fromPort: 'out', toPort: 'in' } }],
        'x'
      )
    ).toEqual([{ from: 'App:#A', to: 'App:#B', hasconnection: 'out,in' }]);
    expect(compileConditions([{ metadata: 'styles:theme', equals: 'dark' }], 'x')).toEqual([
      { metadata: 'styles:theme', equals: 'dark' }
    ]);
    expect(compileConditions([{ previewRouteEquals: '/Home' }], 'x')).toEqual([{ viewerpatheq: '/Home' }]);
    expect(compileConditions([{ activeComponentEquals: '/Start' }], 'x')).toEqual([
      { activecomponentnameeq: '/Start' }
    ]);
  });

  it('throws a helpful error on an unrecognised condition', () => {
    expect(() => compileConditions([{ bogus: 1 } as never], 'Step 3')).toThrowError(/Step 3.*unrecognised condition/);
  });

  it('throws when a required field is missing or wrong-typed', () => {
    expect(() => compileConditions([{ node: 'App:#N', hasParams: 'nope' } as never], 'x')).toThrowError(
      /"hasParams" must be an array/
    );
    expect(() => compileConditions([{ hasType: 'Group' } as never], 'x')).toThrowError(/"node" must be a non-empty/);
  });
});

// ─── Markdown ────────────────────────────────────────────────────────────────

describe('renderMarkdown', () => {
  it('renders inline bold, italic, code and links', () => {
    expect(renderMarkdown('Drag a **Group** node')).toBe('<p>Drag a <strong>Group</strong> node</p>');
    expect(renderMarkdown('press `Ctrl`')).toBe('<p>press <code>Ctrl</code></p>');
    expect(renderMarkdown('see [docs](https://x)')).toBe('<p>see <a href="https://x">docs</a></p>');
  });

  it('renders headings and lists', () => {
    expect(renderMarkdown('## Title')).toBe('<h2>Title</h2>');
    expect(renderMarkdown('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>');
    expect(renderMarkdown('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>');
  });

  it('escapes HTML in prose so structure cannot break', () => {
    expect(renderMarkdown('a < b & c')).toBe('<p>a &lt; b &amp; c</p>');
  });

  it('separates paragraphs on blank lines and keeps single newlines as breaks', () => {
    expect(renderMarkdown('one\ntwo\n\nthree')).toBe('<p>one<br>two</p>\n<p>three</p>');
  });
});

// ─── Step compilation ────────────────────────────────────────────────────────

describe('compileStep', () => {
  it('compiles a popup-only step (no timeline card)', () => {
    const html = compileStep({ kind: 'popup', body: 'Welcome!', media: { type: 'video', src: 'intro.mp4' } }, 0);
    expect(html).toContain('data-template="popup"');
    expect(html).not.toContain('data-template="item"');
    expect(html).toContain('<video src="intro.mp4"></video>');
    expect(html).toContain('<p>Welcome!</p>');
  });

  it('compiles a task card with a checkmark header and conditions attribute', () => {
    const html = compileStep(
      { title: 'Create a Group', completeWhen: [{ node: 'App:#Card', hasType: 'Group' }], width: '320px' },
      1
    );
    expect(html).toContain('data-template="item"');
    expect(html).toContain('lesson-checkmark');
    expect(html).toContain('style="width: 320px"');
    expect(html).toContain('data-conditions=');
  });

  it('uses a blank header when the step has no conditions', () => {
    const html = compileStep({ title: 'The node graph', body: 'info' }, 0);
    expect(html).toContain('<header>&nbsp;</header>');
    expect(html).not.toContain('data-conditions=');
  });

  it('emits suggested-nodes / disable-icons / actions annotations', () => {
    const html = compileStep(
      {
        title: 'Add a node',
        completeWhen: [{ node: 'App:#N', exists: true }],
        suggestedNodes: ['Group', 'Text'],
        disableIcons: ['deploy'],
        actions: [{ selectComponent: '/Home' }]
      },
      0
    );
    expect(html).toContain('data-suggested-nodes="Group,Text"');
    expect(html).toContain('data-disable-icons="deploy"');
    expect(html).toContain('data-actions=');
  });

  it('renders an image via <img> so loadSteps _loadImages picks it up', () => {
    const html = compileStep({ kind: 'popup', media: { type: 'image', src: 'diagram.png' } }, 0);
    expect(html).toContain('<img src="diagram.png">');
  });
});

// ─── Manifest compilation ────────────────────────────────────────────────────

describe('compileLessonManifest', () => {
  it('compiles a full manifest into per-step HTML', () => {
    const compiled = compileLessonManifest({
      title: 'Basics',
      steps: [
        { kind: 'popup', body: 'Intro' },
        { title: 'Create a Group', completeWhen: [{ node: 'App:#Card', hasType: 'Group' }] }
      ]
    });
    expect(compiled.title).toBe('Basics');
    expect(compiled.steps.length).toBe(2);
  });

  it('rejects a manifest with no steps', () => {
    expect(() => compileLessonManifest({ steps: [] })).toThrowError(/no steps/);
    expect(() => compileLessonSource('{ "title": "x" }')).toThrowError(/missing a "steps" array/);
  });

  it('reports invalid JSON with a clear message', () => {
    expect(() => compileLessonSource('{ not json')).toThrowError(/not valid JSON/);
  });
});

// ─── Round-trip: compiled conditions survive DOM extraction + evaluation ─────

describe('compiled conditions round-trip through the runtime path', () => {
  // Mirror loadSteps: put the compiled HTML in the DOM and read the attribute back.
  function extractConditions(stepHtml: string): unknown {
    const el = document.createElement('div');
    el.innerHTML = stepHtml;
    const attr = (el.firstElementChild as HTMLElement).getAttribute('data-conditions');
    return attr ? JSON.parse(attr) : undefined;
  }

  function componentWith(node: { label: string; type: string }): LessonComponent {
    return {
      name: 'App',
      graph: {
        roots: [
          {
            id: 'n1',
            label: node.label,
            type: { name: node.type },
            ports: [],
            parameters: {},
            children: [],
            getPort: () => undefined,
            forAllConnectionsOnThisNode: () => undefined
          }
        ]
      }
    };
  }

  it('a compiled hasType step evaluates true against a matching graph', () => {
    const html = compileStep({ title: 'Make a Group', completeWhen: [{ node: 'App:#Card', hasType: 'Group' }] }, 0);
    const conditions = extractConditions(html) as never;

    const ctx = {
      components: [componentWith({ label: 'Card', type: 'Group' })],
      rootNode: undefined,
      getMetaData: () => undefined,
      viewerPath: undefined,
      activeComponentName: undefined
    };
    expect(evalConditionsWithContext(conditions, ctx)).toBe(true);

    const wrongCtx = { ...ctx, components: [componentWith({ label: 'Card', type: 'Text' })] };
    expect(evalConditionsWithContext(conditions, wrongCtx)).toBe(false);
  });
});
