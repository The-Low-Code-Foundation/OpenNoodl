import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
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
   * 🔴 **This test has now been rewritten twice by the same sentence.** §15.4 deferred the arm
   * claiming the success test was `navigator.userActivation` — inherited from `External Link`
   * and false here (§17.1). §17 opened the authored arm and left the *wired* port deferred by
   * scope. §18 opens that too, so the port does not defer at all in any of its three states.
   *
   * What survives across all three versions is the guard: whatever this node says about itself,
   * it must never say the activation sentence, because that sentence is about the other node.
   */
  test('Open In New Tab translates in all three of its states, and never claims the activation', () => {
    const wired = withNav({ path: 'mood' }, (_ir, notes) => {
      addVariable(notes, 'flagVar', 'flag');
      connect(notes, 'flagVar', 'value', 'go', 'openInNewTab', 'value');
    });
    expect(wired.file).toContain('if (flag.get()) {');
    // Nothing about this node deferred, and nothing anywhere claims the activation.
    expect(wired.notes).not.toContain('Open In New Tab is wired');
    expect(wired.notes).not.toContain('transient user activation');
    expect(wired.file).not.toContain('userActivation');
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

  /**
   * 🔴 **§18's emitted shape is this `if/else`, so this is the claim that has to be pinned.**
   * The wired form prints `if (<expr>) { window.open } else { navigate }` because the runtime
   * prints `if (this._internal.openInNewTab) { window.open } else { pushState }` — one runtime
   * read, two arms, and the outcome reported after both. If the runtime ever grows a second
   * read of the flag, or the arms stop sharing `reportOutcomes(…, 'done')`, the export's single
   * hoisted success flag stops being faithful and this row is where that is noticed.
   */
  test('the runtime branches once on the stored flag, and both arms fall through to one Done', () => {
    expect(nodeSource).toContain('if (this._internal.openInNewTab) {');
    expect(nodeSource).toContain("window.history.pushState({}, '', compiledUrl)");
    expect(nodeSource).toContain("reportOutcomes(this, tokens, 'done')");
    // Exactly one read of the flag at fire time — the `set` above is the other mention.
    expect(nodeSource.split('_internal.openInNewTab').length - 1).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------
/**
 * EXP-011 §18 (session 47) — the **wired** `Open In New Tab`, which is the arm §17.4 deferred.
 *
 * §17 deferred it by **scope**: the port was answerable — the runtime reads it once, as
 * `!!value` — but a wire makes both of this node's two actions reachable in one handler, and
 * that is a branch rather than a flag. This block is that branch.
 *
 * 🔴 **The failure this block is built against is a suite that grades the two arms separately
 * and never grades the join.** Every assertion about "once" below is that failure written down:
 * one url build, one `Done` chain, one `Completed`, one success flag. A copy-per-arm emitter
 * passes every arm-shaped test there is.
 *
 * ⚠️ **The lone-button fixture is deliberate and it is §17.5's lesson.** Two of this file's
 * mutants killed nothing because every case fired the node from the Add button, which already
 * has an action — and two actions take the block form whatever the emitter decides. A node that
 * is the *whole* handler is the only shape that reaches an arrow's expression body.
 */
describe('§18.1 the wired arm — both of the node’s actions under one runtime test', () => {
  /** A variable to feed the port from, and the only thing that reads it unless a test says so. */
  const wireFlag = (notes: ComponentIR, name = 'flag') => {
    addVariable(notes, `${name}Var`, name);
    connect(notes, `${name}Var`, 'value', 'go', 'openInNewTab', 'value');
  };

  /**
   * 🔴 **The three-way control.** Off is `navigate` and no `window.open`; on is `window.open`
   * and no `navigate`; wired is **both**. Either single arm alone is consistent with an emitter
   * that ignored the wire and picked a default, which is the mistake this row exists to exclude.
   */
  test('off is one call, on is the other, and wired is both under one test', () => {
    const off = withNav({ path: 'mood' }).file;
    expect(off).toContain("navigate('/mood')");
    expect(off).not.toContain('window.open');

    const on = withNav({ path: 'mood', openInNewTab: true }).file;
    expect(on).toContain("window.open('/mood', '_blank')");
    expect(on).not.toContain("navigate('/mood')");

    const { file, app } = withNav({ path: 'mood' }, (_ir, notes) => wireFlag(notes));
    expect(file).toContain('if (flag.get()) {');
    expect(file).toContain("window.open('/mood', '_blank');");
    expect(file).toContain("navigate('/mood');");
    expectParses(app);
  });

  /**
   * ⚠️ **Read once, at the top of the handler, and that is the runtime's own shape** — the flag
   * is read before the arm is chosen and nothing between the two can change it. A second read
   * would be a second chance to disagree with itself.
   */
  test('the wire’s own read is the test, printed once and not coerced', () => {
    const { file } = withNav({ path: 'mood' }, (_ir, notes) => wireFlag(notes));
    expect(file.split('flag.get()').length - 1).toBe(1);
    // `if (x)` coerces exactly as the runtime's `!!x` does, so a wrapper would be noise that
    // reads like a decision.
    expect(file).not.toContain('Boolean(flag');
    expect(file).not.toContain('!!flag');
  });

  /**
   * 🔴 **DEF-016's guard, at the new call site.** §17 measured that a features string makes
   * `window.open` return null on success as much as on failure — so a `noopener` appearing here
   * would put "The browser blocked opening a new tab" beside a tab that opened. The guard has to
   * be repeated for this arm because this arm is a *different* emitted call.
   */
  test('the wired arm carries no features string either', () => {
    const { file } = withNav({ path: 'mood' }, (_ir, notes) => wireFlag(notes));
    expect(file).toContain("window.open('/mood', '_blank')");
    expect(file).not.toContain('noopener');
    expect(file).not.toContain('noreferrer');
  });

  /**
   * 🔴 **The url is built once, above the branch — not once per arm.** The runtime builds
   * `compiledUrl` before it looks at the flag, and an omittable query is a `for` loop with side
   * effects: run once per arm it would still be correct, but it would be the same collection
   * built twice and would read as two different urls. The `const` also cannot be declared inside
   * an arm and used in the other.
   */
  test('an omittable query collects once, before the branch', () => {
    const { file, app } = withNav(
      { path: 'note/{id}', 'p-id': '8', queryNames: 'tone' },
      (_ir, notes) => {
        wireFlag(notes);
        addVariable(notes, 'toneVar', 'tone');
        connect(notes, 'toneVar', 'value', 'go', 'q-tone', 'value');
      }
    );
    expect(file.split('const goQuery: string[] = [];').length - 1).toBe(1);
    expect(file.indexOf('const goQuery')).toBeLessThan(file.indexOf('if (flag.get())'));
    expectParses(app);
  });
});

describe('§18.2 the outcomes — one join beneath two arms', () => {
  const wireFlag = (notes: ComponentIR) => {
    addVariable(notes, 'flagVar', 'flag');
    connect(notes, 'flagVar', 'value', 'go', 'openInNewTab', 'value');
  };
  const sink = (id: string, name: string) => (_ir: ExportIR, notes: ComponentIR) => {
    addNode(notes, { id, type: 'Set Variable', parameters: [{ name: 'name', value: literal(name) }] });
    addVariable(notes, `${id}Src`, `${name}Seed`);
    connect(notes, `${id}Src`, 'value', id, 'value', 'value');
  };
  /** The Error sink has to be rendered, or the read is not a read (§14). */
  const readError = (configure: (ir: ExportIR, notes: ComponentIR, nav: NodeIR) => void) =>
    withNav({ path: 'mood' }, (ir, notes, nav) => {
      configure(ir, notes, nav);
      const t = addNode(notes, { id: 'errText', type: 'Text', parameters: [] });
      connect(notes, nav.id, 'error', t.id, 'text', 'value');
      const root = notes.nodes.find((n) => (n.children ?? []).length > 0) ?? notes.nodes[0];
      (root.children ??= []).push(t.id);
    });

  /**
   * 🔴 **`Done` runs after either call succeeds, so it is emitted once beneath the branch.** A
   * copy inside each arm passes every "is Done reachable" test there is and sends the graph's
   * one signal twice. The count is the assertion; a `toContain` cannot see this at all.
   */
  test('the Done chain is emitted once, beneath the branch, not copied into each arm', () => {
    const { file, app } = withNav({ path: 'mood' }, (ir, notes, nav) => {
      wireFlag(notes);
      sink('mark', 'trail')(ir, notes);
      connect(notes, nav.id, 'done', 'mark', 'do');
    });
    expect(file.split('trail.set(trailSeed.get())').length - 1).toBe(1);
    expect(file).toContain('if (goOpened) {');
    expect(file.indexOf('if (flag.get())')).toBeLessThan(file.indexOf('if (goOpened)'));
    expectParses(app);
  });

  /**
   * 🔴 **`let … = true` is a claim about the in-tab arm, not a placeholder.** `pushState` cannot
   * fail and the Path gate has already excluded this node's *other* failure by admitting only a
   * literal non-empty path — so in tab there is exactly one outcome and it is `Done`. That is
   * §15.4's argument, still true of that arm, now standing beside an arm it is false of.
   * Initialised `false` instead, every same-tab navigation would run the Failure chain.
   */
  test('the success flag starts true, because the same-tab arm cannot fail', () => {
    const { file } = withNav({ path: 'mood' }, (ir, notes, nav) => {
      wireFlag(notes);
      sink('mark', 'trail')(ir, notes);
      connect(notes, nav.id, 'done', 'mark', 'do');
    });
    expect(file).toContain('let goOpened = true;');
    // The same-tab arm assigns nothing — it is the initialiser that carries the answer.
    expect(file).toMatch(/\} else \{\n\s*navigate\('\/mood'\);\n\s*\}/);
  });

  /**
   * ⚠️ **A boolean in both arms, so the `let` has one type.** The unwired form binds the raw
   * `Window | null`, which it can because only one arm writes it; here the same local is
   * assigned `true` from the other arm, and `Window | null | boolean` would be a local whose
   * type is an accident of which arms exist.
   */
  test('the flag is a boolean in both arms', () => {
    const { file, app } = withNav({ path: 'mood' }, (ir, notes, nav) => {
      wireFlag(notes);
      sink('mark', 'trail')(ir, notes);
      connect(notes, nav.id, 'done', 'mark', 'do');
    });
    expect(file).toContain("goOpened = window.open('/mood', '_blank') !== null;");
    expect(file).not.toContain("const goOpened = window.open('/mood', '_blank');");
    expectParses(app);
  });

  /**
   * 🔴 **The Failure chain is live for a wired port and this pair is the row.** §15 dropped it
   * unconditionally; §17 stopped dropping it for an authored `true`. A gate written `!newTab`
   * rather than "can this open a tab" would silently delete a chain a wired app runs — which is
   * the same `notes.push` mistake, one state later.
   */
  test('a wired port keeps the Failure chain, where an unwired off still drops it with the note', () => {
    const wired = withNav({ path: 'mood' }, (ir, notes, nav) => {
      wireFlag(notes);
      sink('mark', 'trail')(ir, notes);
      connect(notes, nav.id, 'failure', 'mark', 'do');
    });
    expect(wired.file).toContain('if (!goOpened) {');
    expect(wired.notes).not.toContain('Failure chain is dead');

    const off = withNav({ path: 'mood' }, (ir, notes, nav) => {
      sink('mark', 'trail')(ir, notes);
      connect(notes, nav.id, 'failure', 'mark', 'do');
    });
    expect(off.notes).toContain('Failure chain is dead');
    expect(off.file).not.toContain('goOpened');
  });

  /**
   * The same pair for `Error`: in tab nothing can write the row, so the read defers with its
   * named reason; a wired port can be refused, so the row is earned.
   */
  test('a wired port earns the Error row, where an unwired off still defers it by name', () => {
    const wired = readError((_ir, notes) => wireFlag(notes));
    expect(wired.file).toContain("setGoError('The browser blocked opening a new tab');");
    expect(wired.file).toContain('if (!goOpened) {');
    expectParses(wired.app);

    const off = readError(() => undefined);
    expect(off.notes).toContain('its Error output is read');
    expect(off.notes).toContain('neither of the node’s two failures can fire');
    expect(off.file).not.toContain('The browser blocked opening a new tab');
  });

  /**
   * 🔴 **`Completed` fires after every outcome, so it prints after the branch and not in an
   * arm.** With two arms above it and two outcomes below it there are three wrong places to put
   * it and one right one, and §15.4's argument for translating this port at all — "the gates
   * leave exactly one outcome reachable" — is false of every wired node.
   */
  test('Completed prints after the outcome branch, beneath both arms', () => {
    const { file, app } = withNav({ path: 'mood' }, (ir, notes, nav) => {
      wireFlag(notes);
      sink('yes', 'trailA')(ir, notes);
      sink('fin', 'trailB')(ir, notes);
      connect(notes, nav.id, 'done', 'yes', 'do');
      connect(notes, nav.id, 'completed', 'fin', 'do');
    });
    expect(file.split('trailB.set(trailBSeed.get())').length - 1).toBe(1);
    expect(file.indexOf('trailA.set')).toBeLessThan(file.indexOf('trailB.set'));
    // Beneath the branch, not inside the arm that ran the Done chain.
    expect(file).toMatch(/trailA\.set\(trailASeed\.get\(\)\);\n\s*\}\n\s*trailB\.set/);
    expectParses(app);
  });
});

describe('§18.3 the walkers a new expression is owed', () => {
  /**
   * 🔴 **§17.3's measured defect, on a new field.** `collectActionUse` deciding what is
   * *referenced* is what earns a Variable its import; a read it cannot see emits a handler
   * calling `.get()` on an identifier the file never declares. `expectParses` cannot catch that
   * — an undeclared identifier is valid syntax — and neither can `tsc` on this package.
   *
   * The control varies exactly one thing: whether anything **else** in the component also reads
   * the variable. Without it the subject reads equally well as "a variable used this way needs
   * no declaration", which is a claim about variables rather than about this walker.
   */
  test('a Variable read only by the wired port still earns its import', () => {
    const subject = withNav({ path: 'mood' }, (_ir, notes) => {
      addVariable(notes, 'probeVar', 'probe');
      connect(notes, 'probeVar', 'value', 'go', 'openInNewTab', 'value');
    });
    expect(subject.file).toContain('probe.get()');
    expect(subject.file).toMatch(/import \{[^}]*\bprobe\b[^}]*\} from '\.\.\/stores\/variables'/);

    const control = withNav({ path: 'mood' }, (_ir, notes) => {
      addVariable(notes, 'probeVar', 'probe');
      connect(notes, 'probeVar', 'value', 'go', 'openInNewTab', 'value');
      const t = addNode(notes, { id: 'probeText', type: 'Text', parameters: [] });
      connect(notes, 'probeVar', 'value', t.id, 'text', 'value');
      const root = notes.nodes.find((n) => (n.children ?? []).length > 0) ?? notes.nodes[0];
      (root.children ??= []).push(t.id);
    });
    expect(control.file).toMatch(/import \{[^}]*\bprobe\b[^}]*\} from '\.\.\/stores\/variables'/);
  });

  /**
   * 🔴 **The lone-button fixture, and it exists because of what it caught.** §17.5's
   * `navigatePathIsStatement` mutant moved no row: every case in this file fires the node from
   * the Add button, which already has an action, and two actions take the block form whatever
   * the predicate answers. Only a node that is the **whole** handler reaches an arrow's
   * expression body, where `() => let goOpened = true` does not parse.
   *
   * ⚠️ §15's `date-now-read` note says the same sentence about the same fixture. This is the
   * third time and the first time the fixture was changed rather than noted.
   */
  test('a wired node that is the whole handler prints a block, where an unwired one is an expression', () => {
    const lone = (wire: boolean) =>
      withNav({ path: 'mood' }, (_ir, notes, nav) => {
        const solo = addNode(notes, {
          id: 'soloBtn', type: 'net.noodl.controls.button',
          parameters: [{ name: 'label', value: literal('Go') }]
        });
        const shell = notes.nodes.find((n) => n.id === 'notesShell')!;
        (shell.children ??= []).push(solo.id);
        connect(notes, solo.id, 'onClick', nav.id, 'navigate');
        // 🔴 The Add button's wire is removed, or this node is never the whole handler.
        notes.connections = notes.connections.filter(
          (c) => !(c.fromId === 'addButton' && c.toProperty === 'navigate')
        );
        if (wire) {
          addVariable(notes, 'flagVar', 'flag');
          connect(notes, 'flagVar', 'value', nav.id, 'openInNewTab', 'value');
        }
      }, { fire: false });

    const off = lone(false);
    expect(off.file).toContain("onClick={() => navigate('/mood')}");

    const wired = lone(true);
    expect(wired.file).not.toContain("onClick={() => navigate('/mood')}");
    expect(wired.file).not.toContain('onClick={() => window.open');
    expect(wired.file).toMatch(/onClick=\{\(\) => \{[\s\S]*if \(flag\.get\(\)\) \{/);
    expectParses(wired.app);
  });
});

describe('§18.4 the gates that remain, each with its named reason', () => {
  /**
   * 🔴 **This port is a truthiness sink, and that is why a logic truth value lands here.** The
   * runtime coerces it once with `!!`, and the emitted read is the `if` test itself, which
   * coerces identically. The `p-` control is the row that makes this a claim about *sinks*
   * rather than a hole in the standing rule: a truth value interpolated into a url would print
   * the word `true`, and still defers.
   */
  test('a logic truth value lands in Open In New Tab, and still defers in a p- value', () => {
    const { file, app } = withNav({ path: 'mood' }, (_ir, notes) => {
      connect(notes, 'draftOrVisitor', 'result', 'go', 'openInNewTab', 'value');
    });
    expect(file).toContain('if (noteDraft.get() || visitorName.get()) {');
    expect(file).toContain("window.open('/mood', '_blank');");
    expectParses(app);

    const reason = deferralFor({ path: 'note/{id}' }, (_ir, notes) => {
      connect(notes, 'draftOrVisitor', 'result', 'go', 'p-id', 'value');
    });
    expect(reason).toContain('logic truth value');
  });

  /**
   * 🔴 **A translated wire has to be *consumed*, and nothing else in the suite could see that.**
   * Pass 4f reports every connection nobody claimed, so a wire read into the branch but left
   * unconsumed emits the emitted app *and* a note saying it was not translated — a note that is
   * simply false, and the kind a reader trusts. The mutation that removed the `consumes.push`
   * killed no other row in this file.
   */
  test('the wire is consumed, so no leftover note claims it was not translated', () => {
    const { notes } = withNav({ path: 'mood' }, (_ir, notes) => {
      addVariable(notes, 'flagVar', 'flag');
      connect(notes, 'flagVar', 'value', 'go', 'openInNewTab', 'value');
    });
    expect(notes).not.toContain('flagVar:value->go:openInNewTab');
    // The control: an *unresolvable* source is genuinely untranslated and does say so.
    const untranslated = withNav({ path: 'mood' }, (_ir, notes) => {
      connect(notes, 'entryInput', 'text', 'go', 'openInNewTab', 'value');
    });
    expect(untranslated.notes).toContain('entryInput:text->go:openInNewTab');
  });

  /** A source this slice cannot read statically defers, and the sentence names the port. */
  test('a wired port with no statically known source defers, naming Open In New Tab', () => {
    const reason = deferralFor({ path: 'mood' }, (_ir, notes) => {
      connect(notes, 'entryInput', 'text', 'go', 'openInNewTab', 'value');
    });
    expect(reason).toContain('Open In New Tab');
  });

  /**
   * The Path gate is upstream of the port and stays that way: a node whose shape is unknown is
   * unknown in both arms, so wiring the flag as well must not change which refusal is reported.
   */
  test('a wired Path still defers on the Path, even with Open In New Tab wired too', () => {
    const reason = deferralFor({}, (_ir, notes) => {
      addVariable(notes, 'pathVar', 'target');
      connect(notes, 'pathVar', 'value', 'go', 'path', 'value');
      addVariable(notes, 'flagVar', 'flag');
      connect(notes, 'flagVar', 'value', 'go', 'openInNewTab', 'value');
    });
    expect(reason).toContain('its Path is wired');
  });
});


/**
 * EXP-011 §24 — the `Error` read from inside this node's own chains.
 *
 * `External Link`'s slice one node over, and the reason it is not a copy of it: this node has
 * **three** chains rather than two, and the third one still has to refuse.
 *
 * 🔴 **`Completed` is printed as a join beneath both arms**, so neither form reaches it: the
 * failure arm's `const` is out of scope there, and the row still holds the *previous* failure's
 * message because Completed runs in the same closure that has just set it. That is the arm this
 * describe exists to keep refused — a slice that translated "a read from any of the node's own
 * chains" would emit a Completed chain showing the wrong message, and every other row here
 * would still be green.
 */
describe('§24 — Error read from the node own chains', () => {
  const BLOCKED = "'The browser blocked opening a new tab'";
  const LOCAL = 'goErrorMessage';
  /** Open In New Tab on: the only configuration in which this node has a failure at all. */
  const TAB = { path: 'mood', openInNewTab: true };

  const chainReads = (port: 'done' | 'failure' | 'completed', params: Record<string, string | number | boolean> = TAB) =>
    withNav(params, (ir, notes, nav) => {
      const set = addNode(notes, {
        id: 'showErr',
        type: 'Set Variable',
        parameters: [{ name: 'name', value: literal('lastNavError') }]
      });
      connect(notes, nav.id, port, set.id, 'do');
      connect(notes, nav.id, 'error', set.id, 'value', 'value');
    });

  test('the Failure chain reads the arm own const, not the row', () => {
    const { file, app } = chainReads('failure');
    expect(file).toContain(`const ${LOCAL} = ${BLOCKED};`);
    expect(file).toContain(`lastNavError.set(${LOCAL});`);
    // 🔴 The control: the row would be the previous failure's message in this closure.
    expect(file).not.toContain('lastNavError.set(goError)');
    // And a chain read alone earns no row — the earning rule, unchanged by §24.
    expect(file).not.toContain('useState');
    expectParses(app);
  });

  /**
   * 🔴 The control pair: in the Done arm the previous failure's message *is* the right answer,
   * and the row is what holds it. The arm's `const` is declared in the `else` and is not in
   * scope here at all, so this row is also what stops the local escaping its block.
   */
  test('the Done chain reads the row, and no const is declared', () => {
    const { file, app } = chainReads('done');
    expect(file).toContain('lastNavError.set(goError);');
    expect(file).not.toContain(LOCAL);
    // 🔴 The row is declared, not merely read — `expectParses` cannot tell the two apart, and
    // the earning clause that makes the difference is invisible to every other row here.
    expect(file).toContain('const [goError, setGoError] = useState<string | undefined>();');
    expect(file).toContain(`setGoError(${BLOCKED});`);
    expectParses(app);
  });

  /**
   * 🔴 **§24.6 — the compiler, not the parser.** As in `external-link.test.ts`: no fixture project
   * contains a `Navigate To Path`, so this graph is the only population where the §24.3 shape —
   * a state row read from a chain and declared by an earning clause — can be compiled at all.
   */
  test('the emitted app typechecks, and not merely parses', () => {
    expect(typecheckEmittedApp(chainReads('done').app)).toEqual([]);
  });

  /**
   * 🔴 The arm that must still refuse, with its own named reason. Without this row the slice
   * reads as "the node's chains can read Error" and the Completed join would show a message one
   * failure out of date — the exact bug §8.2 is about, surviving in the one place it was never
   * fixed.
   */
  test('the Completed chain still defers, and says why it is different', () => {
    const line = deferralFor(TAB, (ir, notes, nav) => {
      const set = addNode(notes, {
        id: 'showErr',
        type: 'Set Variable',
        parameters: [{ name: 'name', value: literal('lastNavError') }]
      });
      connect(notes, nav.id, 'completed', set.id, 'do');
      connect(notes, nav.id, 'error', set.id, 'value', 'value');
    });
    expect(line).toContain('read from its Completed chain');
    expect(line).toContain('join printed beneath both outcome arms');
    // The control: not the generic own-chains sentence the other two arms no longer produce,
    // and not the catch-all, which would deny the port exists.
    expect(line).not.toContain('publishes only');
  });

  /**
   * In tab the refusal is older than §24 and is made on a different ground — nothing can ever
   * write the row — so the chain-local changes nothing here. The control that §24 did not
   * quietly open a door the Path gate had closed.
   */
  test('in tab the read is still refused, on the write that can never happen', () => {
    const line = deferralFor({ path: 'mood' }, (ir, notes, nav) => {
      const set = addNode(notes, {
        id: 'showErr',
        type: 'Set Variable',
        parameters: [{ name: 'name', value: literal('lastNavError') }]
      });
      connect(notes, nav.id, 'failure', set.id, 'do');
      connect(notes, nav.id, 'error', set.id, 'value', 'value');
    });
    expect(line).toContain('neither of the node');
    expect(line).toContain('string nothing ever writes');
  });
});
