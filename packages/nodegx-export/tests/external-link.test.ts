import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
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
    expect(notes).toContain(
      `if ((window.open('${DOCS}', '_blank', 'noopener,noreferrer'), navigator.userActivation?.isActive !== false)) {`
    );
    expect(notes).toContain('link0done.set(');
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
    expect(notes).toContain('navigator.userActivation?.isActive !== false');
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
    expect(notes).toContain('?.isActive !== false');
    expect(notes).not.toContain('isActive === true');

    // Read the emitted condition the way a browser would, in both arms and with the API gone.
    const evaluate = (userActivation: unknown): boolean => {
      const navigator = { userActivation } as { userActivation?: { isActive?: boolean } };
      return navigator.userActivation?.isActive !== false;
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
    expect(notes).toContain(
      `if (!((window.open('${DOCS}', '_blank', 'noopener,noreferrer'), navigator.userActivation?.isActive !== false))) {`
    );
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

  it('defers a consumed Error on the state row it would need', () => {
    expect(
      deferralFor((ir, notes, link) => {
        connect(notes, link.id, 'error', 'notesHeading', 'text', 'value');
      })
    ).toContain('needs a state row of its own');
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
