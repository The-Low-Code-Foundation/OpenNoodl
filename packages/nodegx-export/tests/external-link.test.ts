import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ExportIR, ComponentIR, ConnectionIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 Tier 2.5 — `External Link`, the one Navigation node that does not route.
 *
 * Built on the Cheer fixture's `Pages/Notes`, which already has a button to fire from, a text
 * input to build a link out of and a variable to write into — so what is under test is the
 * translation and never a fixture shaped to suit it.
 *
 * 🔴 **Every assertion about emitted code is paired with a control asserting the shape that
 * should NOT appear.** The failure this file is built against is a suite that passes on an
 * emitter which prints the empty-link guard unconditionally, or which prints `_blank` for every
 * node whatever the port says. Both would satisfy an unpaired `toContain`.
 *
 * 🔴 **The defer cases assert the NAMED REASON**, on this task's standing rule: a gate that
 * fires for the wrong reason passes the weaker test, and the reasons are the slice's decisions.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

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

const notesOf = (ir: ExportIR) => ir.components.find((c) => c.path === 'Pages/Notes')!;
const notesFile = (app: ReturnType<typeof emitApp>) =>
  app.files[Object.keys(app.files).find((k) => k.endsWith('Notes.tsx'))!];

/**
 * 🔴 Every emitted file is parsed. This slice adds an `if/else` to a handler body, which is the
 * exact shape that shipped a `}; else` past three passing `toContain` assertions in Tier 1.1.
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
    expect(diagnostics.map((d) => `${file}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`).join('\n')).toBe('');
  }
};

const DOCS = 'https://docs.example.com/help';

/**
 * An `External Link` on the Notes page, fired by the Add button. Every case adds to this.
 *
 * The `link` parameter is authored rather than wired by default, and `openInNewTab` is left
 * unset — which is the node's declared default of `true`, materialised into `_inputValues` by
 * `registerInput`. That combination is what an author gets by dragging the node out and typing
 * a url into it, so it is the base the rest vary from.
 */
const withLink = (
  configure: (ir: ExportIR, notes: ComponentIR, link: NodeIR) => void = () => undefined,
  options: { link?: string | null; openInNewTab?: boolean; fire?: boolean; ownButton?: boolean } = {}
): { ir: ExportIR; app: ReturnType<typeof emitApp> } => {
  const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
  const notes = notesOf(ir);
  const link = addNode(notes, {
    id: 'helpLink',
    type: 'net.noodl.externallink',
    authoredLabel: 'Help',
    parameters: [
      ...(options.link === null ? [] : [{ name: 'link', value: literal(options.link ?? DOCS) }]),
      ...(options.openInNewTab !== undefined ? [{ name: 'openInNewTab', value: literal(options.openInNewTab) }] : [])
    ]
  });
  if (options.ownButton) {
    // A button of the page's own, with nothing else wired to it — the only way to observe the
    // shape of a handler whose *whole* content is the link. `addButton` already adds a note.
    const button = addNode(notes, {
      id: 'helpButton',
      type: 'net.noodl.controls.button',
      parent: 'notesShell',
      parameters: [{ name: 'label', value: literal('Help') }]
    });
    notes.nodes.find((n) => n.id === 'notesShell')!.children!.push(button.id);
    connect(notes, button.id, 'onClick', link.id, 'do');
  } else if (options.fire !== false) {
    connect(notes, 'addButton', 'onClick', link.id, 'do');
  }
  configure(ir, notes, link);
  return { ir, app: emitApp(ir, catalog) };
};

/** The node's own verdict line, not a wire note — the node has to say why it declined. */
const deferralFor = (
  configure: (ir: ExportIR, notes: ComponentIR, link: NodeIR) => void = () => undefined,
  options?: Parameters<typeof withLink>[1]
): string => {
  const { app } = withLink(configure, options);
  const line = app.notes.find((n) => n.includes('node helpLink') && n.includes('deferred'));
  return line ?? app.notes.join('\n');
};

describe('EXP-011 Tier 2.5 §1 — the open, and the two inputs that decide its arguments', () => {
  it('an authored link with the port unset opens a new tab, with the runtime own window features', () => {
    const { app } = withLink();
    expect(notesFile(app)).toContain(`window.open('${DOCS}', '_blank', 'noopener,noreferrer')`);
  });

  /**
   * 🔴 The control the assertion above needs. `Open In New Tab` unset reads `true` because
   * `registerInput` writes a declared default straight into `_inputValues` — so `_blank` for an
   * unset port is *correct*, and an emitter that simply hard-coded `_blank` would pass the test
   * above. This is the case that separates them.
   */
  it('Open In New Tab off replaces the page instead, and drops the window features with it', () => {
    const { app } = withLink(() => undefined, { openInNewTab: false });
    const notes = notesFile(app);
    expect(notes).toContain(`window.open('${DOCS}', '_self', '')`);
    expect(notes).not.toContain('_blank');
    expect(notes).not.toContain('noopener');
  });

  it('Open In New Tab explicitly on is the same as leaving it unset', () => {
    const { app } = withLink(() => undefined, { openInNewTab: true });
    expect(notesFile(app)).toContain(`window.open('${DOCS}', '_blank', 'noopener,noreferrer')`);
  });

  /**
   * A literal url is provably non-empty, so the guard the runtime runs is provably passed and
   * the handler is one expression. This is the commonest shape a project has.
   */
  it('a literal link emits no guard and no local, because neither can do anything', () => {
    const notes = notesFile(withLink().app);
    expect(notes).toContain(`window.open('${DOCS}', '_blank', 'noopener,noreferrer')`);
    expect(notes).not.toContain('helpHref');
    expect(notes).not.toContain('!== undefined');
  });

  /**
   * ⚠️ On its own button, because `addButton` already carries the fixture's own add-a-note
   * action — two actions take the block form whatever this slice does, which would have made the
   * assertion pass for a reason that had nothing to do with the link.
   */
  it('a literal link that is the whole handler stays an expression body', () => {
    const notes = notesFile(withLink(() => undefined, { ownButton: true }).app);
    expect(notes).toContain(`onClick={() => window.open('${DOCS}', '_blank', 'noopener,noreferrer')}`);
  });
});

describe('EXP-011 Tier 2.5 §2 — a wired link, and the guard it earns', () => {
  /** The link comes from the page's own text input, which is `string | undefined` at the sink. */
  const wired = (configure?: (ir: ExportIR, notes: ComponentIR, link: NodeIR) => void) =>
    withLink((ir, notes, link) => {
      connect(notes, 'noteDraftVar', 'value', link.id, 'link', 'value');
      configure?.(ir, notes, link);
    });

  it('binds the link to a local, so the guard and the open read one value', () => {
    const notes = notesFile(wired().app);
    expect(notes).toContain('const helpHref =');
    expect(notes).toContain("window.open(helpHref, '_blank', 'noopener,noreferrer')");
  });

  /**
   * 🔴 The guard is the runtime's, and `&&` is its short circuit. With no link the interpreter
   * reports failure and returns *before* `window.open` — and `window.open('')` opens a blank
   * tab, so a guard that ran the call anyway would open a window the app never opens.
   */
  it('guards all three of the values the runtime refuses, before the call', () => {
    const notes = notesFile(wired().app);
    expect(notes).toContain("helpHref !== undefined && helpHref !== null && helpHref !== '' && window.open(helpHref");
  });

  /** The control: a wire is what earns the guard, and the literal case above must not have one. */
  it('the guard appears only for the wired link, never for the literal one', () => {
    expect(notesFile(wired().app)).toContain("helpHref !== ''");
    expect(notesFile(withLink().app)).not.toContain("!== ''");
  });
});

describe('EXP-011 Tier 2.5 §3 — the outcome chains', () => {
  /** A Set Variable the chains can drive, so a chain that runs is visible in the emitted file. */
  const withChain = (ports: string[]) =>
    withLink((ir, notes, link) => {
      ports.forEach((port, index) => {
        // ⚠️ A `Set Variable` takes its value from a **wire**, never from a parameter, and the
        // wire's source has to be one this slice resolves — the page's own draft Variable is.
        // Each arm writes a differently *named* variable, which is what makes the two arms
        // distinguishable in the emitted file.
        const set = addNode(notes, {
          id: `after${port}`,
          type: 'Set Variable',
          parameters: [{ name: 'name', value: literal(`link${index}${port}`) }]
        });
        connect(notes, link.id, port, set.id, 'do');
        connect(notes, 'noteDraftVar', 'value', set.id, 'value', 'value');
      });
    });

  it('a Done chain runs only where the open succeeded', () => {
    const notes = notesFile(withChain(['done']).app);
    expect(notes).toContain(`if ((window.open('${DOCS}', '_blank', 'noopener,noreferrer'), !helpBlocked)) {`);
    expect(notes).toContain('link0done.set(');
  });

  /**
   * 🔴 **The row that says the read happens BEFORE the call, which is the whole of §14's fix.**
   *
   * `window.open` **consumes** the transient activation. Measured in Chrome 151 with one control
   * arm varying only whether the call sits between two reads of the getter: without it both
   * reads are `true`; with it the second is `false` while the tab count rises. So the emitted
   * test read *after* the call — which is what shipped with DEF-016's export follow-up — is
   * `false` on every tab the app successfully opens, and the app runs its Failure chain on
   * success. DEF-016's exact symptom, on the export side, introduced by DEF-016's own fix.
   *
   * Ordering is the assertion, not the presence of either line: an emitter that reads the
   * activation into a local *after* the call satisfies every other row in this file.
   */
  it('reads the activation before the call, because the call consumes it', () => {
    const notes = notesFile(withChain(['done']).app);
    const read = notes.indexOf('const helpBlocked = navigator.userActivation?.isActive === false;');
    const call = notes.indexOf(`window.open('${DOCS}'`);
    expect(read).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(-1);
    expect(read).toBeLessThan(call);
    // The control: the test the `if` reads must be the local, not a second inline read — a
    // second read after the call is exactly the value that is wrong.
    expect(notes).not.toContain('), navigator.userActivation');
  });

  /**
   * 🔴 DEF-016. **The return value is not the test, and must not be.** `noopener` — which the
   * features string above always carries — makes `window.open` return null by specification, on
   * success as much as on failure, so an emitted `if (window.open(…))` runs the Failure chain on
   * every tab it opens. That is the defect this row fixed in the runtime, and the export
   * reproduces the runtime's control flow deliberately (EXP-011 §11.3), so it had to move too.
   *
   * The comma is load-bearing: the call still has to happen, still only after the link guard,
   * while the value the `if` reads comes from the activation instead.
   */
  it('the new-tab success test reads the activation, never the return value', () => {
    const notes = notesFile(withChain(['done']).app);
    expect(notes).toContain('navigator.userActivation?.isActive === false');
    expect(notes).not.toContain(`if (window.open('${DOCS}'`);
  });

  /**
   * 🔴 `!== false` rather than `=== true`, and it is the whole degradation story. On a host with
   * no `navigator.userActivation` (Safari before 16.4, Firefox before 120) the read is
   * `undefined`, which `!== false` treats as done — the runtime's own rule, that no claim is
   * made where nothing can be read. `=== true` would report Failure on every link in those
   * browsers, which is the original defect with a different cause.
   */
  it('the emitted test degrades to Done where the activation API is absent', () => {
    const notes = notesFile(withChain(['done', 'failure']).app);
    expect(notes).toContain('?.isActive === false');
    expect(notes).not.toContain('isActive === true');

    // Read the emitted lines the way a browser would, in both arms and with the API gone. The
    // emitted form binds `blocked` and tests `!blocked`, so this evaluates the pair.
    const evaluate = (userActivation: unknown): boolean => {
      const navigator = { userActivation } as { userActivation?: { isActive?: boolean } };
      const helpBlocked = navigator.userActivation?.isActive === false;
      return !helpBlocked;
    };
    expect(evaluate(undefined)).toBe(true);
    expect(evaluate({ isActive: true })).toBe(true);
    expect(evaluate({ isActive: false })).toBe(false);
  });

  /**
   * 🔴 The control that matters most here. Without it, "the Done chain is inside the if" would
   * pass on an emitter that put *every* chain inside it — including the failure one, which must
   * run in the opposite case.
   */
  it('a Failure chain runs in the opposite case, not beside the Done one', () => {
    const notes = notesFile(withChain(['done', 'failure']).app);
    expect(notes).toContain('} else {');
    const ifIndex = notes.indexOf('if ((window.open(');
    const elseIndex = notes.indexOf('} else {', ifIndex);
    expect(elseIndex).toBeGreaterThan(-1);
    expect(notes.indexOf('link0done.set(', ifIndex)).toBeLessThan(elseIndex);
    expect(notes.indexOf('link1failure.set(', ifIndex)).toBeGreaterThan(elseIndex);
  });

  it('a Failure chain alone inverts the test rather than emitting an empty success block', () => {
    const notes = notesFile(withChain(['failure']).app);
    expect(notes).toContain(`if (!((window.open('${DOCS}', '_blank', 'noopener,noreferrer'), !helpBlocked))) {`);
    expect(notes).not.toContain('{\n      }');
  });

  /**
   * ⚠️ With Open In New Tab off there is no blocked case at all: `_self` legitimately returns
   * null in some browsers, so the runtime reads the return value **only** for `_blank`. The call
   * is a statement of its own here, and the Done chain follows it unconditionally.
   */
  it('with Open In New Tab off the Done chain does not test the return value', () => {
    const notes = notesFile(
      withLink(
        (ir, comp, link) => {
          const set = addNode(comp, {
            id: 'afterSelf',
            type: 'Set Variable',
            parameters: [{ name: 'name', value: literal('linkWent') }]
          });
          connect(comp, link.id, 'done', set.id, 'do');
          connect(comp, 'noteDraftVar', 'value', set.id, 'value', 'value');
        },
        { openInNewTab: false }
      ).app
    );
    expect(notes).toContain(`window.open('${DOCS}', '_self', '')`);
    expect(notes).not.toContain('if (window.open(');
    // ⚠️ And no activation test either: `_self` has no blocked case for it to describe.
    expect(notes).not.toContain('userActivation');
  });
});

describe('EXP-011 Tier 2.5 §4 — what is dropped, and what defers', () => {
  /**
   * ⚠️ `Unchanged` fires only when there is no `window` — a server-side render. The scaffold
   * mounts with `createRoot` and never renders on a server, so the wire is dead in the exported
   * app exactly as it is in the app running in a browser. Dropped with a note, on `Clear Array`'s
   * rule: a wire already dead in the interpreter must not cost a translation.
   */
  it('an Unchanged wire is dropped with its reason, and the node still translates', () => {
    const { app } = withLink((ir, notes, link) => {
      const set = addNode(notes, {
        id: 'afterUnchanged',
        type: 'Set Variable',
        parameters: [{ name: 'name', value: literal('linkSsrOnly') }]
      });
      connect(notes, link.id, 'unchanged', set.id, 'do');
      connect(notes, 'noteDraftVar', 'value', set.id, 'value', 'value');
    });
    expect(app.notes.join('\n')).toContain('server-side render');
    // The translation survives the drop — that is the whole point of dropping rather than deferring.
    expect(notesFile(app)).toContain(`window.open('${DOCS}'`);
    // ...and the dead chain is not emitted anywhere.
    expect(notesFile(app)).not.toContain('linkSsrOnly');
  });

  /**
   * 🔴 The port the node's own source does not show. The definition spreads
   * `...outcomeOutputs({ … })`, which adds `Completed` to every node that uses it — so a list
   * built by reading the literal `outputs:` object is one port short, and its refusal sentence
   * then tells an author that a port they are looking at in the editor does not exist. Caught by
   * asking the catalog through `get_node_type`, not by reading the runtime file again.
   */
  it('defers a consumed Completed on the join it would need, and knows the port exists', () => {
    const line = deferralFor((ir, notes, link) => {
      const set = addNode(notes, {
        id: 'afterCompleted',
        type: 'Set Variable',
        parameters: [{ name: 'name', value: literal('linkCompleted') }]
      });
      connect(notes, link.id, 'completed', set.id, 'do');
      connect(notes, 'noteDraftVar', 'value', set.id, 'value', 'value');
    });
    expect(line).toContain('fires after every outcome');
    // The control: it must NOT fall into the catch-all, which would deny the port exists.
    expect(line).not.toContain('publishes only');
  });

  it('no longer defers a consumed Error — it is a state row (§14)', () => {
    const { app } = withLink((ir, notes, link) => {
      connect(notes, link.id, 'error', 'notesHeading', 'text', 'value');
    });
    expect(app.notes.find((n) => n.includes('node helpLink') && n.includes('deferred'))).toBeUndefined();
    // The control: the wire must be *consumed*, not merely un-deferred. A read this file resolves
    // in a function nothing calls falls through to Pass 6 and reads as untranslated.
    expect(app.notes.join('\n')).not.toContain('helpLink:error');
  });

  /**
   * 🔴 The refusal this slice thought hardest about. The runtime reads `openInNewTab` two ways
   * in two adjacent lines — truthiness for the window features, strict equality for the target —
   * and they disagree for every truthy value that is not `true`, which only a wire can deliver.
   */
  it('defers a wired Open In New Tab on the two readings the runtime gives that one port', () => {
    expect(
      deferralFor((ir, notes, link) => {
        connect(notes, 'noteDraftVar', 'value', link.id, 'openInNewTab', 'value');
      })
    ).toContain('two ways in two adjacent lines');
  });

  it('defers a node with no Link at all, rather than emitting a guard that always fails', () => {
    expect(deferralFor(() => undefined, { link: null })).toContain('no Link is set');
  });

  /** The same reason covers an authored-but-empty url, which is the shape a half-set node has. */
  it('defers an empty Link on the same reason', () => {
    expect(deferralFor(() => undefined, { link: '' })).toContain('no Link is set');
  });

  /**
   * 🔴 `window.open` is typed `string | URL`, so a number reaching it is a TS2345 in the emitted
   * app — the same class as §11's `encodeURIComponent`, and equally invisible to a test that
   * does not build what it emitted.
   */
  it('defers a non-string Link on the call signature, not on the guard', () => {
    const line = deferralFor((ir, notes, link) => {
      // ⚠️ A `Now`'s Timestamp, not a Counter or a Number Variable: those two do not resolve
      // into this port at all, so they defer one gate earlier and never reach the type question.
      // Proving a gate fires needs an input that reaches it.
      const clock = addNode(notes, { id: 'linkClock', type: 'net.noodl.Now' });
      connect(notes, clock.id, 'timestamp', link.id, 'link', 'value');
    });
    expect(line).toContain('window.open takes a string');
  });
});

describe('EXP-011 Tier 2.5 §5 — the floor beneath every assertion above', () => {
  it('every emitted file parses, for a literal link', () => {
    expectParses(withLink().app);
  });

  it('every emitted file parses, for a guarded link with both chains', () => {
    expectParses(
      withLink((ir, notes, link) => {
        connect(notes, 'noteDraftVar', 'value', link.id, 'link', 'value');
        for (const port of ['done', 'failure']) {
          const set = addNode(notes, {
            id: `parse${port}`,
            type: 'Set Variable',
            parameters: [
              { name: 'name', value: literal(`Parse ${port}`) },
              { name: 'value', value: literal(port) }
            ]
          });
          connect(notes, link.id, port, set.id, 'do');
        }
      }).app
    );
  });

  /**
   * 🔴 The `const` in a guarded link is a statement, and `() => const x = …` does not parse.
   * This is the fifth instance of that hazard in this file's history, and every previous one
   * survived the suite because the fixture happened to give the handler a second action. This
   * asserts the shape directly: the link is the *whole* handler.
   */
  it('a guarded link that is the whole handler emits a block body, not an expression one', () => {
    const notes = notesFile(
      withLink((ir, comp, link) => {
        connect(comp, 'noteDraftVar', 'value', link.id, 'link', 'value');
      }).app
    );
    expect(notes).toContain('onClick={() => {');
    expect(notes).not.toContain('onClick={() => const');
  });
});

/**
 * EXP-011 §14 — the `Error` output as a state row.
 *
 * `HTTP Request`'s `errorState`, one node over, with the hard part absent: both messages are
 * static, so nothing has to be carried out of a service's answer. What is *not* absent is the
 * discrimination — this is the only port that can tell the node's two failures apart, and the
 * emitted failure arm is one arm, so the message has to re-derive which failure it was.
 */
describe('EXP-011 §14 — the Error output', () => {
  const NO_LINK = "'No link to open'";
  const BLOCKED = "'The browser blocked opening a new tab'";
  const readError = (
    options: Parameters<typeof withLink>[1] = {},
    extra: (ir: ExportIR, notes: ComponentIR, link: NodeIR) => void = () => undefined
  ) =>
    withLink((ir, notes, link) => {
      connect(notes, link.id, 'error', 'notesHeading', 'text', 'value');
      extra(ir, notes, link);
    }, options);

  it('allocates a maybe-undefined row and binds the sink to it', () => {
    const { app } = readError();
    const notes = notesFile(app);
    expect(notes).toContain('const [helpError, setHelpError] = useState<string | undefined>();');
    // Undefined until the first failure is what the runtime's unwritten getter returns, and the
    // sink folds it exactly as every other maybe-undefined read in this package does.
    expect(notes).toContain('{helpError ?? \'\'}');
    expectParses(app);
  });

  /**
   * 🔴 The row nothing reads must not exist. This is why the allocator hangs off the *read*
   * rather than off the node, unlike `HTTP Request`'s: a button opening a literal url is the
   * commonest shape there is, and it emits one expression and no state at all.
   */
  it('emits no row at all where nothing reads the port', () => {
    const notes = notesFile(withLink().app);
    expect(notes).not.toContain('useState');
    expect(notes).not.toContain('setHelpError');
  });

  /**
   * 🔴 The message is `_internal.lastError`, which is the SHORT string — not the sentence
   * `reportOutcome` sends. There are two strings for one failure and only one of them is this
   * port's; the longer one goes to the outcome channel, where nothing in the export reads it.
   */
  it('writes the port own message, not the outcome channel longer sentence', () => {
    const notes = notesFile(readError().app);
    expect(notes).toContain(`setHelpError(${BLOCKED});`);
    expect(notes).not.toContain('this usually means the link was not opened directly from a user action');
  });

  /**
   * The discrimination, and the only place the two failures are told apart. A guarded link into
   * a new tab is the one configuration where both can fire.
   */
  it('re-tests the link to pick between the two messages, where both can fire', () => {
    const { app } = readError({}, (ir, notes, link) => {
      connect(notes, 'noteDraftVar', 'value', link.id, 'link', 'value');
    });
    const notes = notesFile(app);
    expect(notes).toContain(
      `setHelpError(helpHref === undefined || helpHref === null || helpHref === '' ? ${NO_LINK} : ${BLOCKED});`
    );
    expectParses(app);
  });

  /**
   * 🔴 The control pair for the row above: where only ONE failure can fire the message is a
   * literal, and it must be the RIGHT one. Without both arms, an emitter that always wrote the
   * blocked message would pass the `_self` row on the word "setHelpError" alone.
   */
  it('writes only the reachable message where only one failure can fire', () => {
    // `_self` makes no blocked claim at all — the empty link is the only failure left.
    const selfArm = notesFile(readError({ openInNewTab: false }, (ir, notes, link) => {
      connect(notes, 'noteDraftVar', 'value', link.id, 'link', 'value');
    }).app);
    expect(selfArm).toContain(`setHelpError(${NO_LINK});`);
    expect(selfArm).not.toContain(BLOCKED);

    // A literal link is provably non-empty — the blocked tab is the only failure left.
    const literalArm = notesFile(readError().app);
    expect(literalArm).toContain(`setHelpError(${BLOCKED});`);
    expect(literalArm).not.toContain(NO_LINK);
  });

  /**
   * The configuration that already drops its Failure chain drops the write too, and owes the
   * reader a sentence rather than a silent blank: a literal link cannot be empty and `_self`
   * makes no blocked claim, so neither failure can fire and the row stays undefined for the life
   * of the app — which is exactly what the interpreter's unwritten getter gives.
   */
  it('names the configuration where the row can never be written', () => {
    const { app } = readError({ openInNewTab: false });
    expect(notesFile(app)).not.toContain('setHelpError(');
    expect(app.notes.join('\n')).toContain('Error output is read but can never be written');
  });

  /**
   * 🔴 §8.2's rule, third construct — **which §24 stopped refusing**. `setHelpError(...)` does
   * not change `helpError` inside the closure that called it, so the chain cannot take the row;
   * it takes the failure arm's own `const` instead, which is what `HTTP Request` has always
   * done. The rows that grade it are in the §24 describe at the foot of this file, and this
   * one stays only to pin that the refusal is gone rather than merely unasserted.
   */
  it('no longer defers a read from inside the Failure chain', () => {
    const line = deferralFor((ir, notes, link) => {
      const set = addNode(notes, {
        id: 'showErr',
        type: 'Set Variable',
        parameters: [{ name: 'name', value: literal('lastLinkError') }]
      });
      connect(notes, link.id, 'failure', set.id, 'do');
      connect(notes, link.id, 'error', set.id, 'value', 'value');
    });
    expect(line).not.toContain('one of its own outcome chains');
    // The control: it must not have fallen into the catch-all either, which would be the same
    // refusal wearing a worse reason. `deferralFor` returns every note when none is a deferral.
    expect(line).not.toContain('helpLink');
  });

  /**
   * Earning, the record verbs' rule (§4a): a `Do` no translatable trigger fires never writes the
   * row, so binding a sink to it would render a blank where the interpreted app shows a message.
   * The read is refused and no row is left behind.
   */
  it('refuses the read and leaves no row where the Do never fires', () => {
    const { app } = readError({ fire: false });
    expect(notesFile(app)).not.toContain('useState');
    expect(app.notes.join('\n')).toContain('helpLink:error');
  });
});

/**
 * EXP-011 §24 — the `Error` read from inside the node's own outcome chains.
 *
 * §14.4 refused this read and named the increment it was leaving: `HTTP Request` mints a
 * chain-local for exactly this shape, and this node did not. It does now.
 *
 * 🔴 **The three arms of this file are the point, and they get three different answers.** The
 * Failure arm reads a `const` it declares; the Done arm reads the *row*, because there the
 * previous failure's message is the right answer and the row is what holds it; and the node's
 * `Completed` is refused upstream of all this, for a reason of its own (§12.7). A suite that
 * only tested the Failure arm would pass on an emitter that returned the local everywhere —
 * including where the local is not in scope, which does not compile.
 */
describe('EXP-011 §24 — Error read from the node own chains', () => {
  const NO_LINK = "'No link to open'";
  const BLOCKED = "'The browser blocked opening a new tab'";
  const LOCAL = 'helpErrorMessage';

  /** A `Set Variable` in one of the node's chains, fed by the node's own `Error`. */
  const chainReads = (port: 'done' | 'failure', options: Parameters<typeof withLink>[1] = {}) =>
    withLink((ir, notes, link) => {
      const set = addNode(notes, {
        id: 'showErr',
        type: 'Set Variable',
        parameters: [{ name: 'name', value: literal('lastLinkError') }]
      });
      connect(notes, link.id, port, set.id, 'do');
      connect(notes, link.id, 'error', set.id, 'value', 'value');
    }, options);

  /**
   * 🔴 The row this slice exists for: the failure arm binds its message, and the chain beneath
   * reads that binding rather than the row the same closure has just set.
   */
  it('binds the message to a const in the failure arm, and the chain reads it', () => {
    const { app } = chainReads('failure');
    const notes = notesFile(app);
    expect(notes).toContain(`const ${LOCAL} = `);
    expect(notes).toContain(`lastLinkError.set(${LOCAL});`);
    // 🔴 The control: it must NOT read the state row, which is the bug §8.2 names — the row
    // still holds the previous failure's message inside the closure that just set it.
    expect(notes).not.toContain('lastLinkError.set(helpError)');
    expectParses(app);
  });

  /**
   * 🔴 The control pair for the row above, and the one that proves the arms are told apart
   * rather than the local being returned for any read inside any chain. In the Done arm the
   * `const` is not even in scope — it is declared in the `else` — so an emitter that answered
   * the local everywhere would emit a file that does not compile.
   */
  it('the Done arm reads the row instead, and declares no const', () => {
    const { app } = chainReads('done');
    const notes = notesFile(app);
    expect(notes).toContain('lastLinkError.set(helpError);');
    expect(notes).not.toContain(LOCAL);
    /**
     * 🔴 **The row is DECLARED, and this assertion is not decoration.** A read from a handler
     * earns the row through `referencedStateNames`, and a mutation run found that clause is the
     * only thing standing between this file and `lastLinkError.set(helpError)` with no
     * `useState` above it — which every other row here passes on, because `expectParses` parses
     * and an undeclared identifier is perfectly good syntax. The read was already asserted; that
     * it resolves to something was not.
     */
    expect(notes).toContain('const [helpError, setHelpError] = useState<string | undefined>();');
    // The row is still written by the failure arm — directly, since nothing reads a local.
    expect(notes).toContain(`setHelpError(${BLOCKED});`);
    expectParses(app);
  });

  /**
   * 🔴 **§24.6 — the same emission put through a compiler rather than a parser.**
   *
   * The row above asserts the `useState` line is present, which is what killed the §24.3 mutant.
   * This asserts the stronger and more general thing: every name the file reads *resolves*. It is
   * here rather than only over the fixtures because **no fixture project contains an
   * `External Link` at all** — the population that carried the defect is this hand-built graph,
   * so a fixture-only typecheck suite would have compiled seven apps and never met it.
   */
  it('the emitted app typechecks, and not merely parses', () => {
    expect(typecheckEmittedApp(chainReads('done').app)).toEqual([]);
  });

  /**
   * 🔴 Both forms in one file, which is the case that proves they agree. The arm computes the
   * message once, hands it to the row for the render sink, and hands the same binding to the
   * chain — so the two readers cannot disagree about which failure it was.
   */
  it('a render sink and a chain read share one binding, not two copies of the ternary', () => {
    const { app } = withLink((ir, notes, link) => {
      connect(notes, link.id, 'error', 'notesHeading', 'text', 'value');
      const set = addNode(notes, {
        id: 'showErr',
        type: 'Set Variable',
        parameters: [{ name: 'name', value: literal('lastLinkError') }]
      });
      connect(notes, link.id, 'failure', set.id, 'do');
      connect(notes, link.id, 'error', set.id, 'value', 'value');
    });
    const notes = notesFile(app);
    expect(notes).toContain(`const ${LOCAL} = ${BLOCKED};`);
    expect(notes).toContain(`setHelpError(${LOCAL});`);
    expect(notes).toContain(`lastLinkError.set(${LOCAL});`);
    // The render sink still folds the row, which is maybe-undefined until the first failure.
    expect(notes).toContain("{helpError ?? ''}");
    // 🔴 The control: the message is written ONCE. Two copies is the drift this binding exists
    // to prevent, and `toContain` alone cannot see a second one.
    expect(notes.split(BLOCKED).length - 1).toBe(1);
    expectParses(app);
  });

  /**
   * 🔴 The earning rule survives: a chain read alone earns **no state row**. Before §24 this
   * shape deferred outright; it must not now emit a `useState` nobody reads instead.
   */
  it('a chain read alone emits the const and no state row at all', () => {
    const { app } = chainReads('failure');
    const notes = notesFile(app);
    expect(notes).toContain(`const ${LOCAL} = `);
    expect(notes).not.toContain('useState');
    expect(notes).not.toContain('setHelpError');
    expectParses(app);
  });

  /**
   * 🔴 The control pair a mutation run asked for, and the only sink in this file that can see
   * the difference. `maybeUndefined` decides whether a read is interpolated with `?? ''`, and
   * the two forms disagree about it: the row can be read before any failure has written it, the
   * arm's `const` was assigned one line above. Every other assertion here would pass on an
   * emitter that called both maybe-undefined — this is the one that separates them.
   *
   * The shape is also an ordinary thing to author: on failure, go to an error page carrying the
   * message.
   */
  it('the arm const interpolates bare, and the row it earns interpolates with the fold', () => {
    const navChain = (port: 'done' | 'failure') =>
      notesFile(
        withLink((ir, notes, link) => {
          addNode(notes, {
            id: 'goOops',
            type: 'PageStackNavigateToPath',
            authoredLabel: 'Oops',
            parameters: [{ name: 'path', value: literal('oops/{msg}') }]
          });
          connect(notes, link.id, port, 'goOops', 'navigate');
          connect(notes, link.id, 'error', 'goOops', 'p-msg', 'value');
        }).app
      );
    // The arm's own const cannot be absent, so the url takes it raw.
    expect(navChain('failure')).toContain('navigate(`/oops/${' + LOCAL + '}`)');
    expect(navChain('failure')).not.toContain(LOCAL + " ?? ''");
    // The row can be read before the first failure, so the same sink folds it — the runtime's
    // own `v !== undefined ? String(v) : ''`.
    expect(navChain('done')).toContain("navigate(`/oops/${helpError ?? ''}`)");
  });

  /**
   * The ternary form, where the link is wired so both failures are live. The control for the
   * literal-link row above: an emitter that always bound the blocked string would pass that one.
   */
  it('binds the ternary where both failures can fire, and the single string where one can', () => {
    const both = notesFile(
      withLink((ir, notes, link) => {
        connect(notes, 'noteDraftVar', 'value', link.id, 'link', 'value');
        const set = addNode(notes, {
          id: 'showErr',
          type: 'Set Variable',
          parameters: [{ name: 'name', value: literal('lastLinkError') }]
        });
        connect(notes, link.id, 'failure', set.id, 'do');
        connect(notes, link.id, 'error', set.id, 'value', 'value');
      }).app
    );
    expect(both).toContain(`const ${LOCAL} = helpHref === undefined || helpHref === null || helpHref === '' ? ${NO_LINK} : ${BLOCKED};`);

    const one = notesFile(chainReads('failure').app);
    expect(one).toContain(`const ${LOCAL} = ${BLOCKED};`);
    expect(one).not.toContain(NO_LINK);
  });
});
