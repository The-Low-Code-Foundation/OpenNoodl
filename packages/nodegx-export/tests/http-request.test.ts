import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ExportIR, ComponentIR, ConnectionIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 Tier 1.2 — `HTTP Request`.
 *
 * Built on the Cheer fixture's `Pages/Notes`, which already has a button to fire a request from,
 * a text input to send a value from and a variable to write an answer into. Every case adds one
 * node to that, so what is under test is the translation and never a fixture shaped to suit it.
 *
 * 🔴 **The defer cases assert the NAMED REASON.** A gate that fires for the wrong reason passes
 * the weaker test, and this slice's deferrals are the whole content of its decisions.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);

const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else {
    node.parameters.push({ name, value });
    node.parameters.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
};

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

const emit = (ir: ExportIR) => emitApp(ir, catalog);
const notesOf = (ir: ExportIR) => ir.components.find((c) => c.path === 'Pages/Notes')!;
const notesFile = (app: ReturnType<typeof emitApp>) =>
  app.files[Object.keys(app.files).find((k) => k.endsWith('Notes.tsx'))!];
const httpFile = (app: ReturnType<typeof emitApp>) => app.files['src/api/http.ts'];
const notesReport = (app: ReturnType<typeof emitApp>) =>
  app.notes.filter((n) => n.includes('Pages/Notes') || n.includes('quote')).join('\n');

/**
 * 🔴 Every emitted file is parsed. The Tier 1.1 slice shipped a `}; else` past three passing
 * `toContain` assertions, because every substring really was present; this is the floor beneath
 * that, and `tests/emitted-syntax.test.ts` runs the same check over the fixtures on disk.
 */
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
    expect(
      diagnostics.map((d) => `${file}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`).join('\n')
    ).toBe('');
  }
};

/** A plain GET on the Notes page, fired by the Add button. The base every case starts from. */
const withRequest = (
  configure: (ir: ExportIR, notes: ComponentIR, http: NodeIR) => void = () => undefined
): { ir: ExportIR; app: ReturnType<typeof emitApp> } => {
  const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
  const notes = notesOf(ir);
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
  connect(notes, 'addButton', 'onClick', http.id, 'fetch');
  configure(ir, notes, http);
  return { ir, app: emit(ir) };
};

describe('EXP-011 Tier 1.2 — HTTP Request', () => {
  describe('the request module', () => {
    it('emits one function per node, from the configuration the editor settled', () => {
      const { app } = withRequest();
      expectParses(app);
      const http = httpFile(app);
      expect(http).toContain('export async function fetchQuote()');
      expect(http).toContain('const url = "https://api.example.com/quotes";');
      expect(http).toContain('method: "GET"');
      // GET sends no body — `buildBody` returns before it reads a field.
      expect(http).toContain('const payload: BodyInit | undefined = undefined;');
      expect(http).toContain('export interface QuoteAnswer');
    });

    it('emits no module at all when the project makes no request', () => {
      // The control: without it, every assertion above is consistent with a module that is
      // always emitted and merely happens to be right here.
      const app = emit(JSON.parse(JSON.stringify(baseIr)));
      expect(app.files['src/api/http.ts']).toBeUndefined();
      expect(notesFile(app)).not.toContain('api/http');
    });

    it('folds an authored value and passes a wired one as a parameter', () => {
      const { app } = withRequest((ir, notes, http) => {
        setParam(http, 'queryParams', literal('tag,limit'));
        setParam(http, 'query-limit', literal('10'));
        setParam(http, 'headers', literal('X-Client'));
        setParam(http, 'header-X-Client', literal('cheer'));
        // The tag comes off the draft input's variable — a wire, so a parameter.
        connect(notes, 'noteDraftVar', 'value', http.id, 'query-tag', 'value');
      });
      expectParses(app);
      const http = httpFile(app);
      expect(http).toContain('export async function fetchQuote(params: { queryTag?: string })');
      expect(http).toContain('query["limit"] = "10";');
      expect(http).toContain('headers["X-Client"] = String("cheer");');
      // The wired one carries the runtime's own three-way omission for a query parameter.
      expect(http).toContain(
        "if (params.queryTag !== undefined && params.queryTag !== null && params.queryTag !== '') query[\"tag\"] = params.queryTag;"
      );
      // A handler reads a variable through its snapshot, never the render local (LOGIC §1).
      expect(notesFile(app)).toContain('fetchQuote({ queryTag: noteDraft.get() })');
    });

    it('leaves a path placeholder in the URL when its value is absent, as the interpreter does', () => {
      const { app } = withRequest((ir, notes, http) => {
        setParam(http, 'url', literal('https://api.example.com/quotes/{id}/full'));
        connect(notes, 'noteDraftVar', 'value', http.id, 'path-id', 'value');
      });
      const http = httpFile(app);
      expect(http).toContain(
        'if (params.pathId !== undefined && params.pathId !== null) url = url.split("{id}").join(encodeURIComponent(String(params.pathId)));'
      );
    });

    it('keeps null in a JSON body and omits it everywhere else', () => {
      const { app } = withRequest((ir, notes, http) => {
        setParam(http, 'method', literal('POST'));
        setParam(http, 'bodyType', literal('json'));
        setParam(http, 'bodyFields', literal('text'));
        connect(notes, 'noteDraftVar', 'value', http.id, 'body-text', 'value');
      });
      const http = httpFile(app);
      // `undefined` abstains; `null` is kept and sent as JSON null — the one site in the node
      // that tests `!== undefined` alone, and it says why in its own comment.
      expect(http).toContain('if (params.bodyText !== undefined) json["text"] = params.bodyText;');
      expect(http).toContain('const payload = Object.keys(json).length > 0 ? JSON.stringify(json) : undefined;');
      expect(http).toContain("if (payload && !headers['Content-Type']) headers['Content-Type'] = 'application/json';");
    });

    it('sends a form field only when it is neither undefined nor null', () => {
      const { app } = withRequest((ir, notes, http) => {
        setParam(http, 'method', literal('POST'));
        setParam(http, 'bodyType', literal('urlencoded'));
        setParam(http, 'bodyFields', literal('text'));
        connect(notes, 'noteDraftVar', 'value', http.id, 'body-text', 'value');
      });
      const http = httpFile(app);
      expect(http).toContain(
        'if (params.bodyText !== undefined && params.bodyText !== null) search.append("text", String(params.bodyText));'
      );
      expect(http).toContain(
        "if (payload && !headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';"
      );
    });

    it('sends no credential at all when half of one is missing', () => {
      const { app } = withRequest((ir, notes, http) => {
        setParam(http, 'authType', literal('bearer'));
        connect(notes, 'noteDraftVar', 'value', http.id, 'auth-authToken', 'value');
      });
      const http = httpFile(app);
      // `authConfigurators.bearer` is `inputs.authToken ? {…} : {}` — a truthiness test, so an
      // empty token sends no Authorization header rather than sending "Bearer ".
      expect(http).toContain("if (params.authToken) headers['Authorization'] = `Bearer ${params.authToken}`;");
    });

    it('compiles a response mapping into the accessor extractByPath would have walked', () => {
      const { app } = withRequest((ir, notes, http) => {
        setParam(http, 'responseMapping', literal('author,first,whole,broken'));
        setParam(http, 'mapping-path-author', literal('$.data.author.name'));
        setParam(http, 'mapping-path-first', literal('$.items[0].text'));
        setParam(http, 'mapping-path-whole', literal('$'));
        setParam(http, 'mapping-path-broken', literal('data.author'));
      });
      const http = httpFile(app);
      expect(http).toContain('author: source?.data?.author?.name');
      expect(http).toContain('first: source?.items?.[0]?.text');
      expect(http).toContain('whole: source');
      // A path that does not start with `$` answers undefined on every response, in the
      // interpreter and here — and the report says so rather than the code staying silent.
      expect(http).toContain('broken: undefined');
      expect(notesReport(app)).toContain('reads a path that does not start with "$"');
    });
  });

  describe('the outcomes', () => {
    it('writes the answer for any answer, and not where nothing came back', () => {
      const { app } = withRequest((ir, notes, http) => {
        setParam(http, 'responseMapping', literal('author'));
        setParam(http, 'mapping-path-author', literal('$.author'));
        const text = addNode(notes, { id: 'authorText', type: 'Text', parent: 'notesShell' });
        const shell = notes.nodes.find((n) => n.id === 'notesShell')!;
        shell.children = [...(shell.children ?? []), text.id];
        connect(notes, http.id, 'out-author', text.id, 'text', 'value');
      });
      expectParses(app);
      const notes = notesFile(app);
      // The setter runs before the arms — a 404 publishes Response and Status Code in the
      // interpreter too — and the catch does not run it, so a network error leaves the row
      // holding what it held.
      expect(notes).toContain('const quoteAnswer = await fetchQuote();');
      expect(notes).toContain('setQuoteOut(quoteAnswer);');
      expect(notes).toContain('} catch (error) {');
      expect(notes.split('catch (error)')[1]).not.toContain('setQuoteOut(');
      // The render read goes through the row, optional-chained: undefined until the first
      // request, which is what the node's outputs read before one has been made.
      // Coerced, as the runtime's Text node coerces: the body is whatever the server sent.
      expect(notes).toContain("{String(quoteOut?.fields.author ?? '')}");
      expect(notes).toContain('const [quoteOut, setQuoteOut] = useState<QuoteAnswer | undefined>();');
      expect(notes).toContain("import { fetchQuote, type QuoteAnswer } from '../api/http';");
    });

    it('reads the answer from the chain local inside the done chain, never from the row', () => {
      const { app } = withRequest((ir, notes, http) => {
        const set = addNode(notes, {
          id: 'saveQuote',
          type: 'Set Variable',
          authoredLabel: 'Save quote',
          parameters: [{ name: 'name', value: literal('lastQuote') }]
        });
        connect(notes, http.id, 'done', set.id, 'do');
        connect(notes, http.id, 'response', set.id, 'value', 'value');
      });
      expectParses(app);
      const notes = notesFile(app);
      // 🔴 `setQuoteOut(...)` has been called, and `quoteOut` does not change inside the closure
      // that called it — so a state read here would store the PREVIOUS request's body.
      expect(notes).toContain('if (quoteAnswer.ok) {');
      expect(notes).toContain('quoteAnswer.response');
      expect(notes).not.toContain('lastQuote.set(quoteOut');
    });

    it('runs the failure chain in both arms, off one message local', () => {
      const { app } = withRequest((ir, notes, http) => {
        const set = addNode(notes, {
          id: 'saveError',
          type: 'Set Variable',
          authoredLabel: 'Save error',
          parameters: [{ name: 'name', value: literal('lastError') }]
        });
        connect(notes, http.id, 'failure', set.id, 'do');
        connect(notes, http.id, 'error', set.id, 'value', 'value');
      });
      expectParses(app);
      const notes = notesFile(app);
      // A non-2xx answered; a network error did not. Both write the Error output and both run
      // the chain, and they are two copies of one thing because both bind `message` first.
      expect(notes).toContain('const quoteMessage = quoteAnswer.error;');
      expect(notes).toContain('const quoteMessage = error instanceof Error ? error.message : String(error);');
      expect(notes.match(/lastError\.set\(/g) ?? []).toHaveLength(2);
      expect(notes).toContain('setQuoteError(quoteMessage);');
    });

    it('never lets a state row take the name the catch binds', () => {
      /**
       * 🔴 Found while building the Quote Desk project (EXP-011 §8.3), and then found to be
       * somewhere else than it first looked. A *variable* is safe — a handler reads it through
       * `.get()` on the imported store, never through the render local — but a **state row is
       * the bare name in both modes**, and every emitted asynchronous action binds
       * `catch (error)`. A row minted from a node labelled "Error" therefore read as the
       * exception inside the failure arm this slice introduced.
       */
      const { app } = withRequest((ir, notes, http) => {
        const latch = addNode(notes, {
          id: 'errorLatch',
          type: 'Switch',
          authoredLabel: 'Error',
          parameters: [{ name: 'startValue', value: literal(false) }]
        });
        const set = addNode(notes, {
          id: 'echoLatch',
          type: 'Set Variable',
          authoredLabel: 'Echo latch',
          parameters: [{ name: 'name', value: literal('latchNote') }]
        });
        connect(notes, http.id, 'failure', set.id, 'do');
        connect(notes, latch.id, 'state', set.id, 'value', 'value');
      });
      const notes = notesFile(app);
      const row = notes.match(/const \[(\w+), set\w+\] = useState<boolean>\(false\)/);
      expect(row).not.toBeNull();
      expect(row![1]).not.toBe('error');
      const catchBody = notes.split('catch (error)')[1] ?? '';
      expect(catchBody).toContain(`latchNote.set(${row![1]})`);
    });

    it('drops a wire from a port only Cancel can fire, and says why', () => {
      const { app } = withRequest((ir, notes, http) => {
        const set = addNode(notes, {
          id: 'afterCancel',
          type: 'Set Variable',
          authoredLabel: 'After cancel',
          parameters: [{ name: 'name', value: literal('cancelNote') }]
        });
        connect(notes, http.id, 'canceled', set.id, 'do');
      });
      // A dead wire, not a deferral: `canceled` is sent from `cancelFetch` and nowhere else, and
      // Cancel is unwired — so it cannot fire in the interpreter either. The request still
      // translates; deferring a whole translation over a no-op would be a loss to nothing.
      expect(notesReport(app)).toContain('only ever sent by Cancel, which is not wired');
      expect(httpFile(app)).toContain('export async function fetchQuote');
    });

    it('drops a wire from the retired Success port, and names it', () => {
      const { app } = withRequest((ir, notes, http) => {
        const set = addNode(notes, {
          id: 'afterSuccess',
          type: 'Set Variable',
          authoredLabel: 'After success',
          parameters: [{ name: 'name', value: literal('successNote') }]
        });
        connect(notes, http.id, 'success', set.id, 'do');
      });
      // 🔴 The editor used to draw a Success port beside Done, because `updatePorts` published
      // the pre-ERG-001 name while the node fired `done`. §19 deleted the port — and this row
      // stays, because deleting a port does not delete the wires a project already saved. This
      // is the arm that keeps such a project's export honest rather than silently untranslated.
      expect(notesReport(app)).toContain('a port this node stopped drawing');
    });
  });

  describe('what defers, and on what', () => {
    const deferralFor = (
      configure: (ir: ExportIR, notes: ComponentIR, http: NodeIR) => void
    ): string => {
      const { app } = withRequest(configure);
      // The node's own verdict line, not a wire note — the whole point of the HTTP sweep is
      // that the node says why rather than the catch-all saying "logic node".
      const line = app.notes.find((n) => n.includes('node quoteRequest') && n.includes('deferred'));
      return line ?? app.notes.join('\n');
    };

    it('defers a wired Cancel on the lifetime its controller would need', () => {
      expect(
        deferralFor((ir, notes, http) => {
          connect(notes, 'addButton', 'onClick', http.id, 'cancel');
        })
      ).toContain('AbortController to outlive the handler');
    });

    it('defers a wired configuration input on when it would be read', () => {
      expect(
        deferralFor((ir, notes, http) => {
          connect(notes, 'noteDraftVar', 'value', http.id, 'url', 'value');
        })
      ).toContain('configures what the request is');
    });

    it('defers a consumed Completed on the join it would need', () => {
      expect(
        deferralFor((ir, notes, http) => {
          const set = addNode(notes, {
            id: 'afterEither',
            type: 'Set Variable',
            authoredLabel: 'After either',
            parameters: [{ name: 'name', value: literal('eitherNote') }]
          });
          connect(notes, http.id, 'completed', set.id, 'do');
        })
      ).toContain('fires once however the request ended');
    });

    it('defers a value read in the Failure chain on the value the interpreter holds there', () => {
      expect(
        deferralFor((ir, notes, http) => {
          const set = addNode(notes, {
            id: 'saveBody',
            type: 'Set Variable',
            authoredLabel: 'Save body',
            parameters: [{ name: 'name', value: literal('failBody') }]
          });
          connect(notes, http.id, 'failure', set.id, 'do');
          connect(notes, http.id, 'response', set.id, 'value', 'value');
        })
      ).toContain("the previous request's");
    });

    it('defers a node with no URL on the failure the interpreter would answer', () => {
      expect(
        deferralFor((ir, notes, http) => {
          http.parameters = http.parameters.filter((p) => p.name !== 'url');
        })
      ).toContain('URL is required');
    });

    it('refuses to bind a read whose Fetch never attached, and gives that reason', () => {
      const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
      const notes = notesOf(ir);
      const http = addNode(notes, {
        id: 'quoteRequest',
        type: 'net.noodl.HTTP',
        authoredLabel: 'Quote',
        parameters: [{ name: 'url', value: literal('https://api.example.com/quotes') }],
        portKnowledge: 'partial'
      });
      const text = addNode(notes, { id: 'statusText', type: 'Text', parent: 'notesShell' });
      const shell = notes.nodes.find((n) => n.id === 'notesShell')!;
      shell.children = [...(shell.children ?? []), text.id];
      connect(notes, http.id, 'statusCode', text.id, 'text', 'value');
      const app = emit(ir);
      // Nothing fires this request, so nothing writes the row — and binding a Text to a row
      // nothing writes would render a blank where the interpreter shows nothing at all.
      expect(notesReport(app)).toContain('never fired by a translatable trigger');
      expect(notesFile(app)).not.toContain('quoteOut');
      expect(app.files['src/api/http.ts']).toBeUndefined();
    });
  });
});
