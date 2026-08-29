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
/** §17's control: the node the deferred sentence was copied from, and the one it is true of. */
const RUNTIME_EXTERNAL_LINK = path.join(
  __dirname, '..', '..', 'noodl-viewer-react', 'src', 'nodes', 'std-library', 'externallink.ts'
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
  /**
   * 🔴 **The deferral this replaces asserted a runtime behaviour that did not exist**, inherited
   * from `External Link` and false here (§17.1). The port now translates; what is left of the
   * old test is the guard below that the sentence cannot come back.
   */
  test('Open In New Tab wired defers by scope, and does not claim the activation', () => {
    const reason = deferralFor({ path: 'mood' }, (_ir, notes) => {
      addVariable(notes, 'flagVar', 'flag');
      connect(notes, 'flagVar', 'value', 'go', 'openInNewTab', 'value');
    });
    expect(reason).toContain('Open In New Tab is wired');
    expect(reason).toContain('deferred by scope rather than by mechanism');
    // The claim that was false: this node's success is NOT read from the activation.
    expect(reason).not.toContain('transient user activation');
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
 * EXP-011 §17 (session 46) — `Open In New Tab`, the arm §15.4 deferred on a sentence it had
 * inherited from `External Link`.
 *
 * 🔴 **The failure this block is built against is a suite that passes on `External Link`'s rules
 * applied to this node.** That is the same failure §15 was built against and the same one §16
 * found had already happened, so several assertions here are paired with the *opposite*
 * assertion about `External Link` — read from the two runtime files, which is where the
 * difference actually lives.
 */
describe('§17.1 the new-tab arm — window.open, and the return value is the test', () => {
  test('Open In New Tab on emits window.open, and off emits navigate', () => {
    const on = withNav({ path: 'mood', openInNewTab: true }).file;
    expect(on).toContain("window.open('/mood', '_blank')");
    expect(on).not.toContain("navigate('/mood')");
    // The control, and the reason it is worth writing: the two arms are different calls.
    const off = withNav({ path: 'mood' }).file;
    expect(off).toContain("navigate('/mood')");
    expect(off).not.toContain('window.open');
  });

  /**
   * 🔴 **No features string, which is the whole reason the return value works here.** `noopener`
   * makes `window.open` return null on success as much as on failure, by specification — that is
   * DEF-016 — so a features string emitted here would break the blocked test in the same breath
   * as it appeared.
   */
  test('the call carries no features string at all', () => {
    const file = withNav({ path: 'mood', openInNewTab: true }).file;
    expect(file).not.toContain('noopener');
    expect(file).not.toContain('noreferrer');
  });

  test('the url is built by the same builder in both arms, placeholders and query alike', () => {
    const { file } = withNav({
      path: 'note/{id}', 'p-id': '42', queryNames: 'tone', 'q-tone': 'quiet', openInNewTab: true
    });
    expect(file).toContain("window.open('/note/42?tone=quiet', '_blank')");
  });

  test('an omittable query still collects first, then opens', () => {
    const { file, app } = withNav({ path: 'note/{id}', 'p-id': '8', queryNames: 'tone', openInNewTab: true },
      (_ir, notes) => {
        addVariable(notes, 'toneVar', 'tone');
        connect(notes, 'toneVar', 'value', 'go', 'q-tone', 'value');
      });
    expect(file).toContain('const goQuery: string[] = [];');
    expect(file).toMatch(/goQuery\.join\('&'\)[^\n]*, '_blank'\)/);
    expectParses(app);
  });

  /** Nothing reads the outcome, so the result is not bound at all — the graph asked for a call. */
  test('with no chains and no Error the result is not bound to a local', () => {
    const file = withNav({ path: 'mood', openInNewTab: true }).file;
    expect(file).not.toContain('goOpened');
  });
});

describe('§17.2 the outcomes — Failure comes alive, and Completed becomes a join', () => {
  /** A Set Variable to hang on an outcome, fed by a variable so it is a translatable sink. */
  const sink = (id: string, name: string) => (_ir: ExportIR, notes: ComponentIR) => {
    addNode(notes, { id, type: 'Set Variable', parameters: [{ name: 'name', value: literal(name) }] });
    addVariable(notes, `${id}Src`, `${name}Seed`);
    connect(notes, `${id}Src`, 'value', id, 'value', 'value');
  };

  test('a Done chain runs inside the opened arm', () => {
    const { file, app } = withNav({ path: 'mood', openInNewTab: true }, (ir, notes, nav) => {
      sink('mark', 'trail')(ir, notes);
      connect(notes, nav.id, 'done', 'mark', 'do');
    });
    expect(file).toContain('const goOpened = window.open');
    expect(file).toMatch(/if \(goOpened\) \{/);
    expectParses(app);
  });

  /**
   * 🔴 **The Failure chain is dropped in tab and live in a new one, and this pair is the row.**
   * §15 dropped it unconditionally with a note; a `notes.push` that kept firing after this arm
   * opened would silently delete a chain the app runs.
   */
  test('the Failure chain is live for a new tab and dropped in tab, with the note only in tab', () => {
    const open = withNav({ path: 'mood', openInNewTab: true }, (ir, notes, nav) => {
      sink('mark', 'trail')(ir, notes);
      connect(notes, nav.id, 'failure', 'mark', 'do');
    });
    expect(open.file).toMatch(/if \(!goOpened\) \{/);
    expect(open.notes).not.toContain("Failure chain is dead");

    const tab = withNav({ path: 'mood' }, (ir, notes, nav) => {
      sink('mark', 'trail')(ir, notes);
      connect(notes, nav.id, 'failure', 'mark', 'do');
    });
    expect(tab.notes).toContain("Failure chain is dead");
    expect(tab.file).not.toContain('goOpened');
  });

  test('both chains print as one if/else, not two tests of the same local', () => {
    const { file, app } = withNav({ path: 'mood', openInNewTab: true }, (ir, notes, nav) => {
      sink('yes', 'trailA')(ir, notes);
      sink('no', 'trailB')(ir, notes);
      connect(notes, nav.id, 'done', 'yes', 'do');
      connect(notes, nav.id, 'failure', 'no', 'do');
    });
    expect(file).toMatch(/if \(goOpened\) \{[\s\S]*\} else \{/);
    expect(file).not.toMatch(/if \(!goOpened\)/);
    expectParses(app);
  });

  /**
   * 🔴 **The row this whole section exists for.** `Completed` fires after *every* outcome
   * (`node.ts:958-995`). §15.4 earned translating it on "the gates leave exactly one outcome
   * reachable", and opening this arm makes two reachable — so it has to print **after** the
   * branch. Emitted inside the Done arm it would run only on success, which is a change no
   * existing test looks at.
   */
  test('Completed prints after the branch, never inside the opened arm', () => {
    const { file, app } = withNav({ path: 'mood', openInNewTab: true }, (ir, notes, nav) => {
      sink('after', 'always')(ir, notes);
      sink('yes', 'onlyDone')(ir, notes);
      connect(notes, nav.id, 'done', 'yes', 'do');
      connect(notes, nav.id, 'completed', 'after', 'do');
    });
    const handler = file.slice(file.indexOf('const goOpened'));
    const armText = handler.slice(0, handler.indexOf('}'));
    // The Done sink is inside the arm; the Completed sink is beneath it.
    expect(armText).toContain('onlyDone.set');
    expect(armText).not.toContain('always.set');
    expect(handler).toContain('always.set');
    // 🔴 The order `reportOutcome` fires them in — the outcome's own port, then the universal one.
    expect(handler.indexOf('onlyDone.set')).toBeLessThan(handler.indexOf('always.set'));
    expectParses(app);
  });

  test('in tab, Completed still follows Done as one flat sequence', () => {
    const { file } = withNav({ path: 'mood' }, (ir, notes, nav) => {
      sink('after', 'always')(ir, notes);
      connect(notes, nav.id, 'completed', 'after', 'do');
    });
    expect(file).toContain("navigate('/mood');");
    expect(file).not.toContain('goOpened');
  });
});

describe('§17.2b the two mutants that killed nothing, which was the finding', () => {
  /**
   * 🔴 **`deepActions` blind to the new Failure chain moved no row**, exactly as §15.5's own
   * `deepActions` mutant did and for a related reason: the sweeps that walk it mostly ask
   * questions whose answer the *outer* action already supplies. `usesNavigate` is true because
   * this node is itself a navigation, whichever chains are descended into.
   *
   * A **state row** can tell the difference. An `HTTP Request` in the Failure chain owns an
   * `errorState` binding that the emitted `catch` names; without the walk the declaration filter
   * drops the row and the handler references an identifier the component never declared — which
   * is the same class of failure §17.4 measured for `collectActionUse`.
   */
  test('an HTTP Request in the Failure chain still has its Error row declared', () => {
    const { file, app } = withNav({ path: 'mood', openInNewTab: true }, (_ir, notes, nav) => {
      addNode(notes, {
        id: 'reportFail',
        type: 'net.noodl.HTTP',
        parameters: [
          { name: 'url', value: literal('/api/report') },
          { name: 'method', value: literal('GET') }
        ]
      });
      connect(notes, nav.id, 'failure', 'reportFail', 'fetch');
    });
    // The catch writes the row; the row has to be declared for the write to compile.
    const errorRow = /const \[(\w*[eE]rror\w*), set\w*[eE]rror\w*\] = useState/.exec(file);
    expect(errorRow).not.toBeNull();
    expect(file).toContain(`set${errorRow![1].charAt(0).toUpperCase()}${errorRow![1].slice(1)}(`);
    expectParses(app);
  });

  /**
   * 🔴 **`navigatePathIsStatement` blind to the new-tab arm moved no row either, and the reason
   * is a fixture habit rather than a weak assertion.** Every case above fires the node from the
   * Cheer fixture's Add button, which *already* has an action — two actions take the
   * `{ a; b; }` block form and parse fine however this predicate answers. Only a node that is
   * the **whole** handler reaches an arrow's expression body, and `() => const goOpened = …`
   * does not parse.
   *
   * ⚠️ This is the seventh instance of this file's oldest hazard and the second time the *test*
   * missed it for this exact reason — §15's `date-now-read` note says the same sentence about
   * the same fixture.
   */
  test('a new-tab navigate that is the whole handler prints as a block and parses', () => {
    const { app, file } = withNav({ path: 'mood', openInNewTab: true }, (_ir, notes, nav) => {
      const btn = addNode(notes, { id: 'soloBtn', type: 'net.noodl.controls.button', parameters: [] });
      const shell = notes.nodes.find((n) => n.id === 'notesShell')!;
      (shell.children ??= []).push(btn.id);
      addNode(notes, { id: 'mark', type: 'Set Variable', parameters: [{ name: 'name', value: literal('trail') }] });
      addVariable(notes, 'markSrc', 'trailSeed');
      connect(notes, 'markSrc', 'value', 'mark', 'value', 'value');
      connect(notes, btn.id, 'onClick', nav.id, 'navigate');
      connect(notes, nav.id, 'failure', 'mark', 'do');
    }, { fire: false });
    expect(file).toContain('const goOpened = window.open');
    // The assertion the block form exists for: an expression body here is a syntax error.
    expectParses(app);
  });
});

describe('§17.3 the Error row — one message, and only where it can be written', () => {
  const readError = (params: Record<string, string | number | boolean>) =>
    withNav(params, (_ir, notes, nav) => {
      const t = addNode(notes, { id: 'errText', type: 'Text', parameters: [] });
      connect(notes, nav.id, 'error', t.id, 'text', 'value');
      const root = notes.nodes.find((n) => (n.children ?? []).length > 0) ?? notes.nodes[0];
      (root.children ??= []).push(t.id);
    });

  test('a new-tab Error read allocates a row and writes it in the blocked arm', () => {
    const { file, app } = readError({ path: 'mood', openInNewTab: true });
    expect(file).toContain('The browser blocked opening a new tab');
    expect(file).toMatch(/if \(!goOpened\) \{/);
    expectParses(app);
  });

  /**
   * 🔴 **One message, where `External Link` needs a ternary.** The Path gate admits a literal
   * non-empty path, so the missing-path write is unreachable and the blocked tab is the only
   * failure there is — the emitted arm must not re-test anything to choose.
   */
  test('only the blocked message is emitted, and never the missing-path one', () => {
    const { file } = readError({ path: 'mood', openInNewTab: true });
    expect(file).not.toContain('No path to navigate to');
    expect(file).not.toContain(' ? ');
  });

  /**
   * ⚠️ The **node** defers, not the wire — an unwritable row is a fact about the whole
   * translation — so the sentence lands on the `Navigate` verdict line, which is where a reader
   * looking for "why did this node not translate" will be.
   */
  test('an in-tab Error read defers the node, because nothing can write the row', () => {
    const { app } = readError({ path: 'mood' });
    const reason = app.notes.find((n) => n.includes('->go:navigate')) ?? app.notes.join('\n');
    expect(reason).toContain('neither of the node’s two failures can fire');
  });
});

describe('§17.4 the walkers that did not know this action carries chains', () => {
  /**
   * 🔴 **A Variable read only by a path parameter was never counted as a reference**, so the
   * emitted component called `.get()` on an identifier it had not declared (§17.3 of the task
   * file). `collectActionUse` had no case for this action at all.
   *
   * The control is the one thing varied: whether anything **else** in the component reads it.
   */
  test('a variable read only by a path parameter is still imported and hooked', () => {
    const subject = withNav({ path: 'note/{id}' }, (_ir, notes) => {
      addVariable(notes, 'idVar', 'loneNoteId');
      connect(notes, 'idVar', 'value', 'go', 'p-id', 'value');
    }).file;
    expect(subject).toContain('loneNoteId.get()');
    // The reference the handler needs. ⚠️ A handler read earns the **import**, not the reactive
    // hook — `.get()` is called on the store directly — so the import is what was missing.
    expect(subject).toMatch(/import \{[^}]*loneNoteId[^}]*\} from '\.\.\/stores\/variables'/);
  });

  test('the same variable read from a Done chain is also counted', () => {
    const file = withNav({ path: 'mood', openInNewTab: true }, (_ir, notes, nav) => {
      addNode(notes, { id: 'mark', type: 'Set Variable', parameters: [{ name: 'name', value: literal('trail') }] });
      addVariable(notes, 'chainVar', 'loneChainValue');
      connect(notes, 'chainVar', 'value', 'mark', 'value', 'value');
      connect(notes, nav.id, 'done', 'mark', 'do');
    }).file;
    expect(file).toContain('loneChainValue');
    expect(file).toMatch(/import \{[^}]*loneChainValue[^}]*\} from '\.\.\/stores\/variables'/);
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
  const externalLinkSource = fs.readFileSync(RUNTIME_EXTERNAL_LINK, 'utf8');

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

  /**
   * 🔴 **§17's two runtime claims, pinned on §16.5's rule** — an exemption or a translation that
   * asserts a runtime behaviour must fail the day the behaviour changes. The claim §15.4 carried
   * was exactly this shape and nothing checked it, so it survived a session as prose.
   *
   * ⚠️ These grade the **source text**, which is what the emitter transcribes. The *behaviour*
   * was measured separately, in Chrome 151 under a real gesture: the bare call returns a Window
   * with one and null without one, while the `noopener` call returns null beside a tab that
   * opened. Neither check substitutes for the other.
   */
  test('this node opens with no features string, where External Link sets noopener', () => {
    expect(nodeSource).toContain("window.open(compiledUrl, '_blank')");
    expect(nodeSource).not.toContain('noopener');
    // The control, and the node the false sentence was copied from.
    expect(externalLinkSource).toContain('noopener');
  });

  test('this node reads the return value, where External Link reads the activation', () => {
    expect(nodeSource).toContain('const opened = window.open');
    expect(nodeSource).toContain('if (!opened)');
    expect(nodeSource).not.toContain('userActivation');
    // The control: the node whose test genuinely is the activation.
    expect(externalLinkSource).toContain('userActivation');
  });

  /**
   * The wired-port deferral says the runtime reads this input **once**, as `!!value`, and that
   * this is what makes it answerable where `External Link`'s is not. Both halves pinned.
   */
  test('Open In New Tab is read one way here and two ways on External Link', () => {
    expect(nodeSource).toContain('this._internal.openInNewTab = !!value');
    expect(externalLinkSource).toContain("openInNewTab ? 'noopener,noreferrer' : ''");
    expect(externalLinkSource).toContain('openInNewTab === true || openInNewTab === undefined');
  });
});
