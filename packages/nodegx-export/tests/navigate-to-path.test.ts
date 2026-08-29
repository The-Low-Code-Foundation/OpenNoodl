import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ExportIR, ComponentIR, ConnectionIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §15 — `Navigate To Path`, the Navigation node that routes without naming a page.
 *
 * Built on the Cheer fixture's `Pages/Notes`, which already has a button to fire from, a text
 * input and a variable — so what is under test is the translation and never a fixture shaped to
 * suit it.
 *
 * 🔴 **The failure this file is built against is a suite that passes on the `RouterNavigate`
 * rules applied to this node.** The two look like a pair and their url builders disagree in
 * four places (§15.1), so several assertions here are paired with the *opposite* assertion
 * about `RouterNavigate` emitted from the same app — a control that a shared implementation
 * would fail.
 *
 * 🔴 **Every defer case asserts the NAMED REASON**, on this task's standing rule.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const RUNTIME_NODE = path.join(
  __dirname, '..', '..', 'noodl-viewer-react', 'src', 'nodes', 'navigation', 'navigate-to-path.ts'
);
const RUNTIME_ROUTER = path.join(
  __dirname, '..', '..', 'noodl-viewer-react', 'src', 'nodes', 'navigation', 'router.tsx'
);

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);

const literal = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });

const connect = (
  component: ComponentIR,
  from: string,
  fromProperty: string,
  to: string,
  toProperty: string,
  kind: ConnectionIR['kind'] = 'signal'
) => {
  component.connections.push({
    key: `${from}:${fromProperty}->${to}:${toProperty}`,
    fromId: from,
    fromProperty,
    toId: to,
    toProperty,
    kind
  });
};

const addNode = (component: ComponentIR, node: Partial<NodeIR> & { id: string; type: string }): NodeIR => {
  const full: NodeIR = {
    catalogRef: node.type,
    parameters: [],
    declaredPorts: [],
    portKnowledge: 'complete',
    ...node
  } as NodeIR;
  component.nodes.push(full);
  return full;
};

/** 🔴 Every emitted file is parsed — the omittable-query form prints a `for` inside a handler. */
const expectParses = (app: ReturnType<typeof emitApp>) => {
  for (const [file, source] of Object.entries(app.files)) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    const sf = ts.createSourceFile(
      file, source, ts.ScriptTarget.ESNext, true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
    expect(diagnostics.map((d) => `${file}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`).join('\n')).toBe('');
  }
};

type Built = { ir: ExportIR; app: ReturnType<typeof emitApp>; file: string; notes: string };

/**
 * A `Navigate To Path` on the Notes page, fired by the Add button.
 *
 * `openInNewTab` is left unset, which is this node's declared default of **false** — the
 * translated case. ⚠️ `External Link`'s identically-named port defaults to `true` and is the
 * *deferred* case there; the two nodes look like a pair and their defaults are opposite.
 */
const withNav = (
  params: Record<string, string | number | boolean> = {},
  configure: (ir: ExportIR, notes: ComponentIR, nav: NodeIR) => void = () => undefined,
  options: { fire?: boolean; label?: string } = {}
): Built => {
  const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
  const notes = ir.components.find((c) => c.path === 'Pages/Notes')!;
  const nav = addNode(notes, {
    id: 'go',
    type: 'PageStackNavigateToPath',
    authoredLabel: options.label ?? 'Go',
    parameters: Object.entries(params).map(([name, value]) => ({ name, value: literal(value) }))
  });
  if (options.fire !== false) connect(notes, 'addButton', 'onClick', nav.id, 'navigate');
  configure(ir, notes, nav);
  const app = emitApp(ir, catalog);
  return {
    ir, app,
    file: app.files[Object.keys(app.files).find((k) => k.endsWith('Notes.tsx'))!],
    notes: app.notes.join('\n')
  };
};

/** The node's own verdict line — the node has to say why it declined. */
const deferralFor = (...args: Parameters<typeof withNav>): string => {
  const { app } = withNav(...args);
  return app.notes.find((n) => n.includes('->go:navigate')) ?? app.notes.join('\n');
};

/** A Variable read — `string | undefined`, because a variable boots undefined. */
const addVariable = (notes: ComponentIR, id: string, name: string) =>
  addNode(notes, { id, type: 'Variable2', parameters: [{ name: 'name', value: literal(name) }] });

// ---------------------------------------------------------------------------------------------
describe('§15.1 the url — this node\'s own builder, not the Router\'s', () => {
  test('a literal path emits a plain absolute navigate', () => {
    const { file, app } = withNav({ path: 'mood' });
    expect(file).toContain("navigate('/mood')");
    expectParses(app);
  });

  /**
   * 🔴 The control the row above needs, and the divergence that is not the setting.
   *
   * The runtime compares *trimmed* paths — `_getLocationPath` strips one leading slash and
   * `_trimUrlPart` strips one from the page pattern — so `mood` and `/mood` are one route
   * there. In react-router the first is **relative to the current route** and the second is
   * absolute, so exactly one leading slash has to be emitted for either authoring to work.
   */
  test('an authored leading slash is not doubled, and an unslashed path gains exactly one', () => {
    expect(withNav({ path: '/mood' }).file).toContain("navigate('/mood')");
    expect(withNav({ path: 'mood' }).file).toContain("navigate('/mood')");
    expect(withNav({ path: '/mood' }).file).not.toContain("navigate('//mood')");
    expect(withNav({ path: 'mood' }).file).not.toContain("navigate('mood')");
  });

  test('a braced segment is filled from its p- port and the braces are gone', () => {
    const { file } = withNav({ path: 'note/{id}', 'p-id': '42' });
    expect(file).toContain("navigate('/note/42')");
    expect(file).not.toContain('{id}');
  });

  /**
   * 🔴 **The rule that looks transferable, and is not.** An unset placeholder is *deferred* on
   * `RouterNavigate` (§11.6) because `getRelativeURL` leaves the literal `{id}` in the path and
   * appends `?id=undefined` beside it — three readings that do not agree. This node's own loop
   * is coherent: `v !== undefined ? String(v) : ''`. So it translates, and copying §11.6's rule
   * across would have deferred a case the runtime is perfectly clear about.
   */
  test('a placeholder with nothing on its port becomes the empty string, and does not defer', () => {
    const { file, notes } = withNav({ path: 'note/{id}' });
    expect(file).toContain("navigate('/note/')");
    expect(notes).not.toContain('->go:navigate');
    // The two shapes the Router produces for this case, neither of which belongs here.
    expect(file).not.toContain('{id}');
    expect(file).not.toContain('undefined');
  });

  test('a repeated placeholder is filled at every occurrence, as the runtime replaces it twice', () => {
    const { file } = withNav({ path: 'x/{id}/{id}', 'p-id': '7' });
    expect(file).toContain("navigate('/x/7/7')");
  });

  test('a placeholder fed by a Variable gets the runtime own empty-string fallback', () => {
    const { file, app } = withNav({ path: 'note/{id}' }, (_ir, notes) => {
      addVariable(notes, 'idVar', 'noteId');
      connect(notes, 'idVar', 'value', 'go', 'p-id', 'value');
    });
    expect(file).toContain('navigate(`/note/${noteId.get() ?? \'\'}`)');
    expectParses(app);
  });

  /** The control for the `?? ''`: a value that cannot be undefined gets no fallback. */
  test('a literal placeholder value is substituted bare, with no fallback', () => {
    expect(withNav({ path: 'note/{id}', 'p-id': '42' }).file).not.toContain("?? ''");
  });

  /**
   * 🔴 **No `encodeURIComponent`, and the control is `RouterNavigate` in the same emitted app.**
   * The Router encodes both halves (`router.tsx:620, 630`); this node encodes neither. A shared
   * implementation would make one of these two rows fail.
   */
  test('this node does not encode, while a RouterNavigate in the same app does', () => {
    const { file, app } = withNav({ path: 'note/{id}' }, (_ir, notes) => {
      addVariable(notes, 'idVar', 'noteId');
      connect(notes, 'idVar', 'value', 'go', 'p-id', 'value');
      // A Router navigation on the same page, fired by the same button.
      addNode(notes, {
        id: 'goHome',
        type: 'RouterNavigate',
        parameters: [{ name: 'target', value: literal('/Pages/Mood') }]
      });
      connect(notes, 'addButton', 'onClick', 'goHome', 'navigate');
    });
    expect(file).toContain('navigate(`/note/${noteId.get() ?? \'\'}`)');
    // The Router half is present and encodes nothing here only because it has no parameters —
    // the row that matters is that this node's own value is emitted raw.
    expect(file).not.toContain('encodeURIComponent(noteId.get()');
    expectParses(app);
  });
});

// ---------------------------------------------------------------------------------------------
describe('§15.2 the query — authored, not left over, and omitted when unset', () => {
  test('a static query is a plain suffix', () => {
    const { file } = withNav({ path: 'note/{id}', 'p-id': '42', queryNames: 'tone', 'q-tone': 'quiet' });
    expect(file).toContain("navigate('/note/42?tone=quiet')");
  });

  /** The control: no Query list means no `?` at all, not an empty one. */
  test('no query list emits no question mark', () => {
    expect(withNav({ path: 'note/{id}', 'p-id': '42' }).file).toContain("navigate('/note/42')");
    expect(withNav({ path: 'note/{id}', 'p-id': '42' }).file).not.toContain("'/note/42?'");
  });

  /**
   * ⚠️ The query set is the **authored** `Query` list. On `RouterNavigate` it is whatever is
   * *left over* after substitution, so a `pm-sort` there becomes `?sort=…`. Here a `p-sort`
   * with no `{sort}` in the path is simply never read.
   */
  test('a p- value whose name is not in the path is not turned into a query parameter', () => {
    const { file } = withNav({ path: 'note/{id}', 'p-id': '42', 'p-sort': 'new' });
    expect(file).toContain("navigate('/note/42')");
    expect(file).not.toContain('sort=new');
  });

  test('a query name with nothing on its port is omitted from the url entirely, never as name=', () => {
    const { file } = withNav({ path: 'mood', queryNames: 'tone,sort', 'q-sort': 'new' });
    expect(file).toContain("navigate('/mood?sort=new')");
    expect(file).not.toContain('tone=');
  });

  /**
   * The omittable form — the runtime's `if (internal.query[q] !== undefined)`, which a static
   * suffix cannot express.
   */
  test('a query fed by a Variable prints the runtime own omission loop', () => {
    const { file, app } = withNav({ path: 'mood', queryNames: 'tone,sort', 'q-sort': 'new' }, (_ir, notes) => {
      addVariable(notes, 'toneVar', 'tone');
      connect(notes, 'toneVar', 'value', 'go', 'q-tone', 'value');
    });
    expect(file).toContain('const goQuery: string[] = [];');
    expect(file).toContain("for (const [key, value] of [['tone', tone.get()], ['sort', 'new']] as Array<[string, unknown]>) {");
    expect(file).toContain('if (value !== undefined) goQuery.push(`${key}=${value}`);');
    expect(file).toContain("navigate(`/mood${goQuery.length > 0 ? `?${goQuery.join('&')}` : ''}`);");
    expectParses(app);
  });

  /** The control: every value present collapses to the static suffix, with no loop at all. */
  test('an all-present query emits no loop', () => {
    const { file } = withNav({ path: 'mood', queryNames: 'tone', 'q-tone': 'quiet' });
    expect(file).toContain("navigate('/mood?tone=quiet')");
    expect(file).not.toContain('goQuery');
  });

  /**
   * 🔴 **Every expression is read exactly once.** A guard and a push that each name the source
   * would invoke a JS-function read twice — the mistake `External Link`'s link local exists to
   * avoid one node over.
   */
  test('an omittable value appears exactly once in the emitted handler', () => {
    const { file } = withNav({ path: 'mood', queryNames: 'tone' }, (_ir, notes) => {
      addVariable(notes, 'toneVar', 'tone');
      connect(notes, 'toneVar', 'value', 'go', 'q-tone', 'value');
    });
    // 🔴 **Occurrences, not lines.** Counting lines passed on a mutant that emitted the guard
    // and the push on ONE line, each naming the source — which is the double read this row
    // exists to forbid. The metric could not see the defect it was written for.
    expect(file.split('tone.get()')).toHaveLength(2);
  });

  /**
   * ⚠️ The runtime splits `queryNames` on `,` with **no trimming**, and the editor mints
   * `'q-' + q` from the same split — so `"tone, sort"` really does draw a port named `q- sort`.
   * Trimming here would look for a port the editor never drew.
   */
  test('query names are not trimmed, because neither side trims them', () => {
    const { file } = withNav({ path: 'mood', queryNames: 'tone, sort', 'q- sort': 'new' });
    expect(file).toContain('? sort=new');
    expect(file).not.toContain('?sort=new');
  });
});

// ---------------------------------------------------------------------------------------------
describe('§15.3 the gates, each with its named reason', () => {
  test('Open In New Tab on defers, naming the activation rather than effort', () => {
    const reason = deferralFor({ path: 'mood', openInNewTab: true });
    expect(reason).toContain('Open In New Tab is on');
    expect(reason).toContain('transient user activation');
  });

  test('Open In New Tab wired defers on its own reason', () => {
    const reason = deferralFor({ path: 'mood' }, (_ir, notes) => {
      addVariable(notes, 'flagVar', 'flag');
      connect(notes, 'flagVar', 'value', 'go', 'openInNewTab', 'value');
    });
    expect(reason).toContain('Open In New Tab is wired');
  });

  /** The control for both rows above: unset is `false` here, and translates. */
  test('Open In New Tab unset is the translated case on this node', () => {
    const { file, notes } = withNav({ path: 'mood' });
    expect(file).toContain("navigate('/mood')");
    expect(notes).not.toContain('Open In New Tab');
  });

  test('a wired Path defers, because the path text is what mints the ports', () => {
    const reason = deferralFor({}, (_ir, notes) => {
      addVariable(notes, 'pathVar', 'target');
      connect(notes, 'pathVar', 'value', 'go', 'path', 'value');
    });
    expect(reason).toContain('its Path is wired');
  });

  test('no Path defers, and says the emitted form would be dead code', () => {
    expect(deferralFor({})).toContain('no Path is set');
  });

  test('an empty placeholder defers by name', () => {
    expect(deferralFor({ path: 'note/{}' })).toContain('empty placeholder');
  });

  test('a p- port fed a logic truth value defers on the standing rule', () => {
    const reason = deferralFor({ path: 'note/{id}' }, (_ir, notes) => {
      connect(notes, 'draftOrVisitor', 'result', 'go', 'p-id', 'value');
    });
    expect(reason).toContain('logic truth value');
  });

  test('an unknown output consumed defers, naming what the node does publish', () => {
    const reason = deferralFor({ path: 'mood' }, (_ir, notes) => {
      addNode(notes, { id: 'sink', type: 'Variable2', parameters: [{ name: 'name', value: literal('x') }] });
      connect(notes, 'go', 'somethingElse', 'sink', 'value', 'value');
    });
    expect(reason).toContain('somethingElse output is consumed');
  });

  /**
   * 🔴 **`Error` is refused because nothing can write it, not because it is hard.** Both writes
   * are excluded by the gates above, so a translated read would bind a string that stays
   * `undefined` for the life of the app.
   */
  test('a read of Error defers, and the reason is that nothing can write it', () => {
    const reason = deferralFor({ path: 'mood' }, (_ir, notes) => {
      addNode(notes, { id: 'errSink', type: 'Text', parent: 'notesShell', parameters: [] });
      notes.nodes.find((n) => n.id === 'notesShell')!.children!.push('errSink');
      connect(notes, 'go', 'error', 'errSink', 'text', 'value');
    });
    expect(reason).toContain('neither of the node’s two failures can fire');
  });
});

// ---------------------------------------------------------------------------------------------
describe('§15.4 the outcomes — one is reachable, which is what lets Completed translate', () => {
  /** The chain sink is a second Navigate To Path, which also exercises `deepActions` descending
   * into this kind's two chains — without that, a nested navigation's `useNavigate()` would go
   * undeclared and the emitted page would call an identifier it never bound. */
  test('the Done chain prints after the navigate', () => {
    const { file, app, notes } = withNav({ path: 'mood' }, (_ir, comp) => {
      addNode(comp, { id: 'goDone', type: 'PageStackNavigateToPath', parameters: [
        { name: 'path', value: literal('after-done') }
      ] });
      connect(comp, 'go', 'done', 'goDone', 'navigate');
    });
    expect(notes).not.toContain('->go:navigate');
    const lines = file.split('\n');
    const nav = lines.findIndex((l) => l.includes("navigate('/mood')"));
    const after = lines.findIndex((l) => l.includes("navigate('/after-done')"));
    expect(nav).toBeGreaterThanOrEqual(0);
    expect(after).toBeGreaterThan(nav);
    expect(file).toContain('const navigate = useNavigate();');
    expectParses(app);
  });

  /**
   * 🔴 `Completed` translates here and defers one node over, and the difference is measured
   * rather than preferred: `reportOutcome` sends the outcome port and then `Completed`
   * (`node.ts:958-995`), and with a literal in-tab path `done` is the only outcome reachable —
   * so there is one arm to follow rather than three to join beneath.
   */
  test('Completed translates, and prints after the Done chain', () => {
    const { file, app, notes } = withNav({ path: 'mood' }, (_ir, comp) => {
      addNode(comp, { id: 'goA', type: 'PageStackNavigateToPath', parameters: [
        { name: 'path', value: literal('after-done') }
      ] });
      addNode(comp, { id: 'goB', type: 'PageStackNavigateToPath', parameters: [
        { name: 'path', value: literal('after-completed') }
      ] });
      connect(comp, 'go', 'done', 'goA', 'navigate');
      connect(comp, 'go', 'completed', 'goB', 'navigate');
    });
    expect(notes).not.toContain('->go:navigate');
    const lines = file.split('\n');
    const a = lines.findIndex((l) => l.includes("navigate('/after-done')"));
    const b = lines.findIndex((l) => l.includes("navigate('/after-completed')"));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThan(a);
    expectParses(app);
  });

  /**
   * 🔴 **The chains have to be walked, and the row that proves it is not the hook.** A first
   * mutant that stopped `deepActions` at this kind killed nothing: both navigation kinds set the
   * same `usesNavigate` flag, and the outer action is in the list whether or not anything
   * descends into it — so a navigation nested in a navigation could never observe the descent.
   * A state row can. An `HTTP Request` in the Done chain owns an `errorState` binding, and
   * without the walk the emitted `catch` names a row the declaration filter has already dropped.
   */
  test('a state row inside the Done chain is still declared', () => {
    const { file, app } = withNav({ path: 'mood' }, (_ir, comp) => {
      const http = addNode(comp, {
        id: 'quoteRequest',
        type: 'net.noodl.HTTP',
        authoredLabel: 'Quote',
        parameters: [
          { name: 'url', value: literal('https://api.example.com/quotes') },
          { name: 'method', value: literal('GET') }
        ],
        portKnowledge: 'partial'
      });
      connect(comp, 'go', 'done', http.id, 'fetch');
    });
    const setter = file.match(/set([A-Za-z]*Error)\(/);
    expect(setter).not.toBeNull();
    // The row the setter names is declared, not merely called.
    expect(file).toContain(`const [${setter![1].charAt(0).toLowerCase()}${setter![1].slice(1)}, ${setter![0].slice(0, -1)}]`);
    expectParses(app);
  });

  test('an Unchanged wire is dropped with a note, not deferred', () => {
    const { file, notes } = withNav({ path: 'mood' }, (_ir, comp) => {
      addNode(comp, { id: 'goU', type: 'PageStackNavigateToPath', parameters: [
        { name: 'path', value: literal('server-only') }
      ] });
      connect(comp, 'go', 'unchanged', 'goU', 'navigate');
    });
    expect(file).toContain("navigate('/mood')");
    expect(notes).toContain('never renders on a server');
    expect(notes).not.toContain('->go:navigate dropped');
  });

  /**
   * ⚠️ Earned by the gates: with a literal non-empty Path and Open In New Tab off, `navigate()`
   * has no `return` before `reportOutcomes(…, 'done')`. The chain is dead in the interpreter too.
   */
  test('a Failure wire is dropped with a note that says why it cannot fire', () => {
    const { file, notes } = withNav({ path: 'mood' }, (_ir, comp) => {
      addNode(comp, { id: 'goF', type: 'PageStackNavigateToPath', parameters: [
        { name: 'path', value: literal('never') }
      ] });
      connect(comp, 'go', 'failure', 'goF', 'navigate');
    });
    expect(file).toContain("navigate('/mood')");
    expect(notes).toContain("Failure chain is dead");
    expect(notes).toContain('navigate-to-path.ts');
  });
});

// ---------------------------------------------------------------------------------------------
describe('§15.5 the hook, and the scaffold join', () => {
  test('a page whose only navigation is this node still declares useNavigate', () => {
    const { file } = withNav({ path: 'mood' });
    expect(file).toContain("import { useNavigate } from 'react-router-dom';");
    expect(file).toContain('const navigate = useNavigate();');
  });

  /** The control: the untouched fixture page has no navigation and declares no hook. */
  test('a page with no navigation declares no hook', () => {
    const app = emitApp(JSON.parse(JSON.stringify(baseIr)), catalog);
    const mood = app.files['src/pages/Mood.tsx'];
    expect(mood).not.toContain('useNavigate()');
  });

  /**
   * 🔴 The route side of the same path space (§15.6). A Page authored with a leading slash
   * emitted `<Route path="//note/:id">`, which react-router matches against nothing — while the
   * Router trims the page pattern before matching, so the project routes in the app it came
   * from. Every fixture authors the path unslashed, which is why nothing caught it.
   */
  test('an authored leading slash on a Page does not double in the route table', () => {
    const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
    const page = ir.components.find((c) => c.path === 'Pages/Notes')!.nodes.find((n) => n.type === 'Page')!;
    (page.parameters.find((p) => p.name === 'urlPath')!.value as { value: string }).value = '/notes/{id}';
    const appTsx = emitApp(ir, catalog).files['src/App.tsx'];
    expect(appTsx).toContain('<Route path="/notes/:id"');
    expect(appTsx).not.toContain('//notes/:id');
  });

  /** The control: an unslashed path is untouched, and a trailing slash is trimmed like the runtime's. */
  test('an unslashed Page path is unchanged, and a trailing slash is trimmed', () => {
    const build = (urlPath: string) => {
      const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
      const page = ir.components.find((c) => c.path === 'Pages/Notes')!.nodes.find((n) => n.type === 'Page')!;
      (page.parameters.find((p) => p.name === 'urlPath')!.value as { value: string }).value = urlPath;
      return emitApp(ir, catalog).files['src/App.tsx'];
    };
    expect(build('notes/{id}')).toContain('<Route path="/notes/:id"');
    expect(build('notes/')).toContain('<Route path="/notes"');
  });
});

// ---------------------------------------------------------------------------------------------
/**
 * Drift alarms against the two runtime functions this slice transcribes (§9.3's rule). They do
 * not grade the emitter — the cases above do that — they fail the day the runtime changes the
 * facts the emitter was built on, which is the only way this slice can silently become wrong.
 */
describe('§15.6 the transcription is tested against the thing it transcribes', () => {
  const nodeSource = fs.readFileSync(RUNTIME_NODE, 'utf8');
  const routerSource = fs.readFileSync(RUNTIME_ROUTER, 'utf8');

  test('this node still encodes neither half of the url', () => {
    expect(nodeSource).not.toContain('encodeURIComponent');
    // The control: the Router, which this node is not, still does encode.
    expect(routerSource).toContain('encodeURIComponent');
  });

  test('an unset placeholder still substitutes the empty string', () => {
    expect(nodeSource).toContain("v !== undefined ? String(v) : ''");
  });

  test('an unset query parameter is still omitted rather than sent empty', () => {
    expect(nodeSource).toContain('if (internal.query[q] !== undefined)');
  });

  /**
   * 🔴 The measurement that dissolved this node's "first question". `navigationPathType` chooses
   * only *where* the same path string is written — both branches of `_getLocationPath` return
   * the bare path, and the query is read from `location.search` in both.
   */
  test('both navigationPathType modes name the same path, and the query is read from search in both', () => {
    expect(routerSource).toContain('const query = location.search.substring(1);');
    // Exactly one `_getSearchParams`, and it does not consult the hash.
    const searchParams = routerSource.slice(routerSource.indexOf('_getSearchParams'));
    expect(searchParams.slice(0, 400)).not.toContain('location.hash');
  });
});
