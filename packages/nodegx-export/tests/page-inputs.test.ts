import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 Tier 2.5 — `Page Inputs`, and the three things that had to be true for it to mean
 * anything.
 *
 * A detail page is `/product/{id}`: a route that carries a value, a node that reads it, and a
 * Navigate that fills it in. All three were broken, and only the middle one was *reported* as
 * missing — the route emitted `<Route path="/product/{id}">`, which react-router matches against
 * the literal text `{id}` and nothing else, and the Navigate emitted `navigate('/product/{id}')`
 * to go with it. So the two ends looked translated in the ledger and could not work.
 *
 * 🔴 **Every assertion about a value that arrives is paired with a control asserting the shape
 * that should *not*.** The failure mode this file is built against is a suite that passes on an
 * emitter which prints `useParams()` unconditionally, or one which refuses every sink rather
 * than the two it should.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');

const catalog: Catalog = loadCatalog();
const baseIr = parseProject(FIXTURE, catalog);

const literal = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });

const connect = (
  component: ComponentIR,
  from: string,
  fromProperty: string,
  to: string,
  toProperty: string,
  kind: ConnectionIR['kind'] = 'value'
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
  const full = {
    catalogRef: node.type,
    parameters: [],
    declaredPorts: [],
    portKnowledge: 'complete',
    ...node
  } as NodeIR;
  component.nodes.push(full);
  return full;
};

const componentOf = (ir: ExportIR, componentPath: string): ComponentIR =>
  ir.components.find((c) => c.path === componentPath)!;

const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else node.parameters.push({ name, value });
};

/** Every emitted file parses — the floor beneath every `toContain` in this file. */
const expectParses = (app: ReturnType<typeof emitApp>) => {
  for (const [file, source] of Object.entries(app.files)) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    const sf = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.ESNext,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
    expect(diagnostics.map((d) => `${file}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`).join('\n')).toBe('');
  }
};

const NOTES = 'Pages/Notes';
const MOOD = 'Pages/Mood';
/** A component the fixture's Router does not route — the no-URL arm. */
const DIALOG = 'Components/AboutDialog';

/**
 * The Notes page, given a parameterised route and a `Page Inputs` reading it.
 *
 * `pathParams` and `queryParams` are `allowEditOnly` stringlists on the real node, so they are
 * authored parameters here exactly as the editor writes them: comma-separated names.
 */
const withPageInputs = (
  configure: (ir: ExportIR, page: ComponentIR, inputs: NodeIR) => void,
  options: { urlPath?: string; on?: string; pathParams?: string; queryParams?: string } = {}
): { ir: ExportIR; app: ReturnType<typeof emitApp> } => {
  const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
  const notes = componentOf(ir, NOTES);
  setParam(notes.nodes.find((n) => n.type === 'Page')!, 'urlPath', literal(options.urlPath ?? 'notes/{id}'));
  const host = componentOf(ir, options.on ?? NOTES);
  const inputs = addNode(host, {
    id: 'pageInputs',
    type: 'PageInputs',
    authoredLabel: 'URL',
    parameters: [
      ...(options.pathParams !== undefined || options.queryParams === undefined
        ? [{ name: 'pathParams', value: literal(options.pathParams ?? 'id') }]
        : []),
      ...(options.queryParams !== undefined ? [{ name: 'queryParams', value: literal(options.queryParams) }] : [])
    ],
    portKnowledge: 'partial'
  });
  configure(ir, host, inputs);
  return { ir, app: emitApp(ir, catalog) };
};

const fileFor = (app: ReturnType<typeof emitApp>, suffix: string) =>
  app.files[Object.keys(app.files).find((k) => k.endsWith(suffix))!];
const notesFile = (app: ReturnType<typeof emitApp>) => fileFor(app, 'Notes.tsx');
const appTsx = (app: ReturnType<typeof emitApp>) => app.files['src/App.tsx'];

/** The note the export leaves when it refuses a wire, for the wire into `nodeId.port`. */
const dropNoteFor = (app: ReturnType<typeof emitApp>, fragment: string): string =>
  app.notes.filter((n) => n.includes(fragment)).join('\n');

describe('EXP-011 Tier 2.5 §1 — the route has to be able to carry the parameter', () => {
  it('a braced segment becomes a react-router pattern', () => {
    const { app } = withPageInputs(() => undefined);
    expect(appTsx(app)).toContain('<Route path="/notes/:id" element={<NotesPage />} />');
  });

  /**
   * The control the assertion above needs. Without it, "braces become colons" would pass on an
   * emitter that put a colon in front of every segment — `/:mood`, which matches everything.
   */
  it('a page with no braces in its path is untouched', () => {
    const { app } = withPageInputs(() => undefined);
    expect(appTsx(app)).toContain('<Route path="/mood" element={<MoodPage />} />');
    expect(appTsx(app)).not.toContain(':mood');
  });

  it('two braced segments both convert, and the literal text between them survives', () => {
    const { app } = withPageInputs(() => undefined, { urlPath: 'notes/{id}/tab/{tab}' });
    expect(appTsx(app)).toContain('<Route path="/notes/:id/tab/:tab" element={<NotesPage />} />');
  });

  /**
   * 🔴 The regression this whole section exists for. `{id}` in a react-router path is not a
   * capture — it is four literal characters — so the emitted route matched `/notes/%7Bid%7D` and
   * nothing a user would ever type.
   */
  it('no emitted route still carries a brace', () => {
    const { app } = withPageInputs(() => undefined, { urlPath: 'notes/{id}' });
    expect(appTsx(app)).not.toContain('{id}');
  });
});

describe('EXP-011 Tier 2.5 §2 — the read, and the merge order it has to agree with', () => {
  const readIntoHeading = (options?: Parameters<typeof withPageInputs>[1]) =>
    withPageInputs(
      (ir, page, inputs) => {
        connect(page, inputs.id, 'pm-id', 'notesHeading', 'text');
      },
      options
    );

  it('a pm-* read reaches the sink it was wired to', () => {
    const { app } = readIntoHeading();
    expectParses(app);
    expect(notesFile(app)).toContain('{pageQuery.get("id") ?? pageParams.id}');
  });

  /**
   * 🔴 **The query is read first, and that is the runtime's merge rather than a preference.**
   * The Router hands `Page Inputs` one flat map built as `Object.assign({}, match.params,
   * urlQuery)` (`router.tsx:456`), so a query parameter of the same name overrides the matched
   * path segment: on `/notes/42?id=99` the node reports `99`. The obvious code — path first,
   * query as the fallback — is a different function, and differs on exactly the urls a user can
   * type by hand.
   */
  it('the query overrides the path segment, not the other way round', () => {
    const { app } = readIntoHeading();
    const notes = notesFile(app);
    expect(notes).toContain('pageQuery.get("id") ?? pageParams.id');
    expect(notes).not.toContain('pageParams.id ?? pageQuery.get("id")');
  });

  it('both hooks are declared, from one import line', () => {
    const { app } = readIntoHeading();
    const notes = notesFile(app);
    expect(notes).toContain("import { useParams, useSearchParams } from 'react-router-dom';");
    expect(notes).toContain('const pageParams = useParams();');
    expect(notes).toContain('const [pageQuery] = useSearchParams();');
  });

  /**
   * The control for the hooks: they are earned by a surviving read, exactly as `useValue` and
   * `useSession` are. A page carrying a `Page Inputs` nothing reads must not declare them —
   * otherwise "the hooks are there" says nothing about whether the read worked.
   */
  it('a page with a Page Inputs nothing reads declares neither hook', () => {
    const { app } = withPageInputs(() => undefined);
    const notes = notesFile(app);
    expect(notes).not.toContain('useParams');
    expect(notes).not.toContain('useSearchParams');
  });

  it('a name declared only as a query parameter reads through the same expression', () => {
    const { app } = withPageInputs(
      (ir, page, inputs) => connect(page, inputs.id, 'pm-sort', 'notesHeading', 'text'),
      { queryParams: 'sort', urlPath: 'notes' }
    );
    expect(notesFile(app)).toContain('{pageQuery.get("sort") ?? pageParams.sort}');
  });

  it('a parameter name that is not an identifier is read with a bracket', () => {
    const { app } = withPageInputs(
      (ir, page, inputs) => connect(page, inputs.id, 'pm-order-by', 'notesHeading', 'text'),
      { queryParams: 'order-by', urlPath: 'notes' }
    );
    expectParses(app);
    expect(notesFile(app)).toContain('{pageQuery.get("order-by") ?? pageParams["order-by"]}');
  });

  /**
   * 🔴 **§25 — the same emission put through a compiler rather than a parser.**
   *
   * This is the slice where compiling grades the most, because the value under test is the only
   * one in the package whose type comes from a *hook signature* rather than from the emitter:
   * `useParams()` answers `string | undefined` per segment and `useSearchParams()[0].get()`
   * answers `string | null`. The rows above assert the merge expression as text; this asserts
   * that the expression's type is one the sink it lands in can actually accept.
   *
   * It is this hand-built graph rather than a fixture because **no fixture page has a braced
   * segment in its `urlPath`, and none carries a `Page Inputs` node at all** — every fixture route
   * is a bare literal, so `tests/typecheck-emitted.test.ts` emits neither hook in any of its seven
   * apps and could not meet this shape.
   *
   * ⚠️ **Graded against the helper's ambient declaration of `react-router-dom`, not against the
   * real v7 package** — the repo has v5 (`tests/helpers/typecheckApp.ts` says why). The hook
   * return types there are written to match v7 deliberately, but a drift between them and the
   * real library is this row's blind spot, and building an exported app remains what closes it.
   */
  it('the emitted app typechecks, and not merely parses', () => {
    const { app } = readIntoHeading();
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
});

describe('EXP-011 Tier 2.5 §3 — the routing gate, which is the one that stops it lying', () => {
  /**
   * 🔴 The divergence this gate exists for, and the reason it cannot be found by driving the
   * export. The Router feeds a `Page Inputs` by walking the **page's own** node scope
   * (`router.tsx:602`), and a nested component has its own scope — so a `Page Inputs` one
   * component below the page is never called and reads undefined forever. `useParams()` has no
   * such boundary and would read the enclosing route's parameters quite happily.
   *
   * An export that read the value there would *work better than the app it came from*, which
   * looks like a success from every angle except correctness.
   */
  it('a Page Inputs on a component no Router routes refuses the read, and names the route', () => {
    const { app } = withPageInputs(
      (ir, dialog, inputs) => connect(dialog, inputs.id, 'pm-id', 'aboutDialog', 'visible'),
      { on: DIALOG }
    );
    expect(dropNoteFor(app, 'pageInputs:pm-id')).toContain(
      'it reads the page parameters "id", but no Router routes this component, so there is no URL to read them from'
    );
    expect(fileFor(app, 'AboutDialog.tsx')).not.toContain('useParams');
  });

  /**
   * The control: the same node, the same wire, on a component the Router *does* route. Without
   * this row the refusal above would pass on an emitter that refused every `Page Inputs`.
   */
  it('the same wire on a routed page resolves', () => {
    const { app } = withPageInputs((ir, page, inputs) => connect(page, inputs.id, 'pm-id', 'notesHeading', 'text'));
    expect(dropNoteFor(app, 'pageInputs:pm-id')).toBe('');
    expect(notesFile(app)).toContain('useParams()');
  });
});

describe('EXP-011 Tier 2.5 §4 — the sink table', () => {
  const intoSink = (nodeId: string, port: string) =>
    withPageInputs((ir, page, inputs) => connect(page, inputs.id, 'pm-id', nodeId, port));

  /**
   * 🔴 **Four of the six sinks are handed the value uncoerced, and that is a decision.** §10
   * wraps an untyped Variable in `String(x ?? '')` because it is `unknown` and could be an
   * object. A url parameter is `string | undefined` — already printable, already absent-able —
   * and every emitted sink is optional: a component prop prints as `Name?: string`, a DOM string
   * attribute omits itself for `undefined`, and React renders `undefined` in a child position as
   * nothing, which is exactly what the runtime's Text node does with it.
   */
  it('a text child takes the value bare — no String() wrapper', () => {
    const { app } = intoSink('notesHeading', 'text');
    const notes = notesFile(app);
    expect(notes).toContain('{pageQuery.get("id") ?? pageParams.id}');
    expect(notes).not.toContain('String(pageQuery');
  });

  it('a string attribute takes it bare too', () => {
    const { app } = intoSink('entryInput', 'placeholder');
    expect(notesFile(app)).toContain('placeholder={pageQuery.get("id") ?? pageParams.id}');
    expect(notesFile(app)).not.toContain('String(pageQuery');
  });

  /**
   * The truthiness sinks, asserted as the **whole** emitted fold rather than as "the expression
   * appears somewhere in the file" — an unanchored `toContain` over generated JSX is a test of
   * the attribute alphabet, not of the attribute (the s39 lesson).
   *
   * `visible` and `mounted` fold differently on purpose and the pair is the proof: `visible`
   * keeps the element and adds the hiding class, `mounted` removes it from the tree entirely.
   */
  it('visible folds to the negated class, keeping the element in the DOM', () => {
    const { app } = intoSink('notesHeading', 'visible');
    expect(notesFile(app)).toContain(
      'joinClasses(styles.notesHeading, !(pageQuery.get("id") ?? pageParams.id) && styles.hiddenKeepSpace)'
    );
  });

  it('mounted folds to a guard that removes the element, and casts it as the runtime does', () => {
    const { app } = intoSink('notesHeading', 'mounted');
    expect(notesFile(app)).toContain('{!!(pageQuery.get("id") ?? pageParams.id) && (');
  });

  /**
   * 🔴 The refusal, and it is graded **on its reason** rather than on the attribute's absence.
   * "Refused because a url parameter has no cast to a number" and "had no statically known
   * source" are the two readings §10.4 insists stay apart: they have opposite fixes, and an
   * assertion that merely checks `maxLength` is missing passes on either.
   */
  it('a number attribute is refused, and says why', () => {
    const { app } = intoSink('entryInput', 'maxLength');
    expect(notesFile(app)).not.toContain('maxLength=');
    expect(dropNoteFor(app, 'entryInput.maxLength')).toContain(
      'reads page parameter "id", which the url delivers as text or not at all, into a sink this slice will not invent a cast for'
    );
  });

  /**
   * 🔴 The control for the refusal above, and it has to run down the **same** code path to be
   * one. An untyped Variable (§10) is refused at this very sink, by this very function, with a
   * different sentence — so the pair discriminates *which source was refused* rather than merely
   * "something was". A source that is untranslatable at the *plan* stage would not do: its wire
   * never becomes a binding at all, so the sink is never consulted and the note it leaves is
   * about a different mechanism.
   */
  it('the same sink, same refusal path, different source: the reason names the other one', () => {
    const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
    const notes = componentOf(ir, NOTES);
    const http = addNode(notes, {
      id: 'quoteRequest',
      type: 'net.noodl.HTTP',
      authoredLabel: 'Quote',
      parameters: [
        { name: 'url', value: literal('https://api.example.com/quotes') },
        { name: 'method', value: literal('GET') }
      ],
      portKnowledge: 'partial'
    });
    connect(notes, 'addButton', 'onClick', http.id, 'fetch', 'signal');
    const set = addNode(notes, {
      id: 'saveQuote',
      type: 'Set Variable',
      parameters: [{ name: 'name', value: literal('lastQuote') }]
    });
    connect(notes, http.id, 'done', set.id, 'do', 'signal');
    connect(notes, http.id, 'response', set.id, 'value');
    const read = addNode(notes, {
      id: 'quoteRead',
      type: 'Variable2',
      parameters: [{ name: 'name', value: literal('lastQuote') }]
    });
    connect(notes, read.id, 'value', 'entryInput', 'maxLength');
    const app = emitApp(ir, catalog);
    const note = dropNoteFor(app, 'entryInput.maxLength');
    expect(note).toContain('reads variable "lastQuote", which has no statically-typed writer');
    expect(note).not.toContain('page parameter');
  });
});

describe('EXP-011 Tier 2.5 §5 — Navigate, the other end of the same url', () => {
  /** A Mood-page button that navigates to the parameterised Notes page. */
  const withNavigate = (
    configure: (page: ComponentIR, navigate: NodeIR) => void,
    urlPath = 'notes/{id}'
  ): ReturnType<typeof emitApp> => {
    const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
    setParam(componentOf(ir, NOTES).nodes.find((n) => n.type === 'Page')!, 'urlPath', literal(urlPath));
    const mood = componentOf(ir, MOOD);
    const navigate = addNode(mood, {
      id: 'goToNote',
      type: 'RouterNavigate',
      authoredLabel: 'Open note',
      parameters: [{ name: 'target', value: literal('/Pages/Notes') }],
      portKnowledge: 'partial'
    });
    const button = mood.nodes.find((n) => n.type === 'net.noodl.controls.button')!;
    connect(mood, button.id, 'onClick', navigate.id, 'navigate', 'signal');
    configure(mood, navigate);
    return emitApp(ir, catalog);
  };

  it('an authored page parameter is substituted into the path', () => {
    const app = withNavigate((page, navigate) => setParam(navigate, 'pm-id', literal('42')));
    expectParses(app);
    expect(fileFor(app, 'Mood.tsx')).toContain("navigate(`/notes/${encodeURIComponent('42')}`)");
  });

  /**
   * The control that matters most here: an *unparameterised* target still emits the plain
   * literal it always did. A template with no holes would be legal and would churn every
   * existing navigation in the corpus for nothing.
   */
  it('a target with no parameters is still a plain string', () => {
    const app = withNavigate(() => undefined, 'notes');
    expect(fileFor(app, 'Mood.tsx')).toContain("navigate('/notes')");
  });

  /**
   * The runtime's *leftover* rule: `getRelativeURL` substitutes every `pm-` whose name is in the
   * path and appends whatever is left as a query string (`router.tsx:625-633`). It is how a page
   * takes an optional parameter without putting it in the route.
   */
  it('a parameter the path does not declare becomes a query parameter', () => {
    const app = withNavigate((page, navigate) => {
      setParam(navigate, 'pm-id', literal('42'));
      setParam(navigate, 'pm-sort', literal('newest'));
    });
    expect(fileFor(app, 'Mood.tsx')).toContain(
      "navigate(`/notes/${encodeURIComponent('42')}?sort=${encodeURIComponent('newest')}`)"
    );
  });

  /**
   * 🔴 The one place this slice deliberately does **not** agree with the runtime, and the reason
   * is that the runtime is incoherent here rather than merely surprising: the substitution loop
   * skips a key it has no value for, leaving the literal `{id}` in the path, and the leftover
   * loop then finds that same key still in the map and appends `?id=undefined` beside it. That
   * is not a navigation anybody means. Naming it costs nothing that worked before — the old
   * translation emitted `navigate('/notes/{id}')`, a url react-router never matched.
   */
  it('a braced segment with nothing set on its port defers, by name', () => {
    const app = withNavigate(() => undefined);
    expect(fileFor(app, 'Mood.tsx')).not.toContain('navigate(');
    expect(dropNoteFor(app, 'goToNote')).toContain(
      "the target page's path declares {id} and nothing is set on its Page Param port"
    );
  });

  /** A wire into a page parameter beats the authored value — §10.3's rule, one node over. */
  it('a wire into a page parameter replaces the authored value rather than joining it', () => {
    const app = withNavigate((page, navigate) => {
      setParam(navigate, 'pm-id', literal('42'));
      // A Variable read — valid in a handler anywhere, which is what this row is about. The
      // *invalid* wire has a row of its own below.
      const read = addNode(page, {
        id: 'lastNoteRead',
        type: 'Variable2',
        parameters: [{ name: 'name', value: literal('visitorName') }]
      });
      connect(page, read.id, 'value', navigate.id, 'pm-id');
    });
    const mood = fileFor(app, 'Mood.tsx');
    // Both halves, because either alone passes for the wrong reason: the negative alone passes
    // on a Navigate that deferred entirely, and the positive alone passes on one that printed
    // the authored value *and* the wire — which is the duplicate §10.3 found, one node over.
    // `?? ''` because a Variable boots undefined and `encodeURIComponent` does not take one —
    // the guard `npm run build` asked for, asserted here so it cannot quietly come off again.
    expect(mood).toContain("navigate(`/notes/${encodeURIComponent(visitorName.get() ?? '')}`)");
    expect(mood).not.toContain("encodeURIComponent('42')");
  });

  /**
   * The control for that guard: a literal is not maybe-undefined, so it must **not** collect a
   * `?? ''`. Without this row the fix above would pass on an emitter that appended the fallback
   * to everything, which is noise in every url the corpus already emits.
   */
  it('a literal page parameter gets no undefined-guard', () => {
    const app = withNavigate((page, navigate) => setParam(navigate, 'pm-id', literal('42')));
    expect(fileFor(app, 'Mood.tsx')).toContain("encodeURIComponent('42')");
    expect(fileFor(app, 'Mood.tsx')).not.toContain("'42' ?? ''");
  });

  /**
   * 🔴 The regression test for what `npm run build` found and 748 unit tests did not.
   *
   * A text input's value is `event.target.value`, and that identifier exists **only inside that
   * input's own onChange**. Wiring it into a Navigate that a *button* fires emitted
   * `navigate(`/notes/${encodeURIComponent(event.target.value)}`)` into the button's handler,
   * where `event` is the click — and the exported app did not compile (TS18048/TS18047/TS2339).
   *
   * The hole was `actionsValidIn`'s `case 'navigate': return true`, which was correct while a
   * navigation carried no expressions and became a lie the moment it did. It is a switch
   * TypeScript does not hold, so adding the fields produced no error anywhere.
   */
  it('a page parameter fed by a value that only exists in another handler defers, by name', () => {
    const app = withNavigate((page, navigate) => {
      const input = page.nodes.find((n) => n.type === 'net.noodl.controls.textinput')!;
      connect(page, input.id, 'onTextChanged', navigate.id, 'pm-id');
    });
    const mood = fileFor(app, 'Mood.tsx');
    // No navigation was emitted at all — the whole action deferred rather than half-filling.
    expect(mood).not.toContain('navigate(');
    // ⚠️ Anchored, because a bare `not.toContain('event.target.value')` would be a test of the
    // file's alphabet: this page's own text input writes a variable from its onChange, and that
    // line legitimately contains the identifier. What must not exist is the *navigate* reading it.
    expect(mood).not.toContain('encodeURIComponent(event.target.value)');
    expect(mood).toContain('onChange={(event) => mood.set({ note: event.target.value })}');
  });
});

describe('EXP-011 Tier 2.5 §6 — what the node itself reports', () => {
  it('a Page Inputs whose read landed collapses into the page file', () => {
    const { ir, app } = withPageInputs((i, page, inputs) => connect(page, inputs.id, 'pm-id', 'notesHeading', 'text'));
    void ir;
    expect(dropNoteFor(app, 'pageInputs')).toBe('');
    expect(notesFile(app)).toContain('useParams()');
  });

  /**
   * The control: a routed `Page Inputs` nothing reads is inert in the running app too, and the
   * reason it gives says that about *this node* rather than about the slice. "A page path
   * parameter is not translated in this slice" was true before Tier 2.5 and is now a lie.
   */
  it('a routed Page Inputs nothing reads says it contributes nothing, not that the slice is missing', () => {
    const { app } = withPageInputs(() => undefined);
    expect(dropNoteFor(app, 'pageInputs')).not.toContain('not translated in this slice');
  });
});
