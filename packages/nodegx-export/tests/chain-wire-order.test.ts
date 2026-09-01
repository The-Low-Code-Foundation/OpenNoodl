import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ExportIR, ComponentIR, ConnectionIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §40 — the chain a node owns, measured as a class rather than a node at a time.
 *
 * §39.3 found that the attach pass's answer depended on wire ORDER for three nodes and named
 * four families as unmeasured. §40.1 measured six families and every one was order-dependent —
 * and a node fired only from a reactive Condition or a Value Changed reported the same false note
 * in *every* order, because that trigger wire is never the attach pass's to take.
 *
 * Behind that sat two more: the earn scan (popups, verbs, requests, Now, ids, links) ran before
 * the two effect producers existed, so a request fired only from a reactive arm was emitted as a
 * call into nothing (§40.2); and a branch arm holding a *statement* printed `if (c) <statement>`,
 * so an External Link's Done chain landed after the `if` and ran unconditionally (§40.3).
 *
 * Every row here is one of those, with the shape that used to pass beside it as the control.
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

type App = ReturnType<typeof emitApp>;
const notesFile = (app: App) => app.files[Object.keys(app.files).find((k) => k.endsWith('Notes.tsx'))!];
const notesNotes = (app: App) => app.notes.filter((n) => n.startsWith('Pages/Notes'));

const expectParses = (app: App) => {
  for (const [file, source] of Object.entries(app.files)) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
    expect(diagnostics.map((d) => `${file}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`).join('\n')).toBe('');
  }
};

const withGraph = (build: (notes: ComponentIR) => void): App => {
  const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
  build(ir.components.find((c) => c.path === 'Pages/Notes')!);
  return emitApp(ir, catalog);
};

/** A `Set Variable` the chains can fire, fed from the page's draft variable. */
const addSetter = (notes: ComponentIR, id: string, variable: string) => {
  addNode(notes, { id, type: 'Set Variable', parameters: [{ name: 'name', value: literal(variable) }] });
  connect(notes, 'noteDraftVar', 'value', id, 'value');
};

/**
 * The text of the block an `if (<cond>) {` opens — by brace counting, so a row asks "is this
 * statement INSIDE the arm" rather than pinning a column. `null` when the `if` is not a block.
 */
const armBlockOf = (source: string, cond: string): string | null => {
  const head = `if (${cond}) {`;
  const start = source.indexOf(head);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start + head.length - 1; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start + head.length, i);
    }
  }
  return null;
};

type Family = {
  name: string;
  node: Partial<NodeIR> & { id: string; type: string };
  trigger: string;
  /** The outputs the row wires chains off — every one a Done/Failure the node's compile owns. */
  chains: string[];
  /** What the idle sweep must say. */
  idle: string;
  /** A line the emitted chain prints, to prove the chain is in the effect. */
  emitted: string;
};

const FAMILIES: Family[] = [
  {
    name: 'External Link',
    node: {
      id: 'lnk',
      type: 'net.noodl.externallink',
      parameters: [
        { name: 'link', value: literal('https://example.com/docs') },
        { name: 'openInNewTab', value: literal(false) }
      ]
    },
    trigger: 'do',
    chains: ['done'],
    idle: 'its Do is never fired by a translatable trigger',
    emitted: "window.open('https://example.com/docs', '_self', '')"
  },
  {
    name: 'Now',
    node: { id: 'clock', type: 'net.noodl.Now' },
    trigger: 'read',
    chains: ['done'],
    idle: 'its done chain hangs off a node nothing fires',
    emitted: 'afterdone.set(noteDraft.get())'
  },
  {
    name: 'Unique Id',
    node: { id: 'rowKey', type: 'Unique Id' },
    trigger: 'new',
    chains: ['done'],
    idle: 'its done chain hangs off a node nothing fires',
    emitted: 'afterdone.set(noteDraft.get())'
  },
  {
    name: 'UUID',
    node: { id: 'recordId', type: 'net.noodl.UUID' },
    trigger: 'generate',
    chains: ['done', 'failure'],
    idle: 'its done chain hangs off a node nothing fires',
    emitted: 'afterfailure.set(noteDraft.get())'
  },
  {
    name: 'HTTP Request',
    node: {
      id: 'req',
      type: 'net.noodl.HTTP',
      parameters: [
        { name: 'url', value: literal('https://api.example.com/q') },
        { name: 'method', value: literal('GET') }
      ]
    },
    trigger: 'fetch',
    chains: ['done', 'failure'],
    idle: 'its Fetch is never fired by a translatable trigger',
    emitted: 'await fetchRequest()'
  },
  {
    name: 'Navigate To Path',
    node: { id: 'go', type: 'PageStackNavigateToPath', parameters: [{ name: 'path', value: literal('mood') }] },
    trigger: 'navigate',
    chains: ['done'],
    idle: 'its Navigate is never fired by a translatable trigger',
    emitted: "navigate('/mood')"
  }
];

const addChains = (notes: ComponentIR, f: Family) => {
  for (const port of f.chains) {
    addSetter(notes, `after_${port}`, `after${port}`);
    connect(notes, f.node.id, port, `after_${port}`, 'do', 'signal');
  }
};

const FALSE_NOTE = 'not a rendered element event or a receiver';

describe('EXP-011 §40 §A — the answer does not depend on wire order', () => {
  for (const f of FAMILIES) {
    it(`${f.name}: the chain wire listed before its trigger wire reads exactly as listed after`, () => {
      const triggerFirst = withGraph((notes) => {
        addNode(notes, f.node);
        connect(notes, 'addButton', 'onClick', f.node.id, f.trigger, 'signal');
        addChains(notes, f);
      });
      const chainFirst = withGraph((notes) => {
        addNode(notes, f.node);
        addChains(notes, f);
        connect(notes, 'addButton', 'onClick', f.node.id, f.trigger, 'signal');
      });
      expect(notesNotes(chainFirst)).toEqual(notesNotes(triggerFirst));
      expect(notesFile(chainFirst)).toBe(notesFile(triggerFirst));
      expect(notesNotes(chainFirst).join('\n')).not.toContain(FALSE_NOTE);
      expect(notesFile(chainFirst)).toContain(f.emitted);
    });
  }
});

describe('EXP-011 §40 §B — a node fired only from a reactive Condition is attached, earned and not called idle', () => {
  const reactiveGate = (notes: ComponentIR, toId: string, toPort: string) => {
    addNode(notes, { id: 'gate', type: 'Condition', parameters: [{ name: 'runOnChange-condition', value: literal(true) }] });
    connect(notes, 'noteDraftVar', 'value', 'gate', 'condition');
    connect(notes, 'gate', 'ontrue', toId, toPort, 'signal');
  };
  for (const f of FAMILIES) {
    it(`${f.name}: no false wire note, no "never fired", the chain inside the effect, and it typechecks`, () => {
      const app = withGraph((notes) => {
        addNode(notes, f.node);
        addChains(notes, f);
        reactiveGate(notes, f.node.id, f.trigger);
      });
      const said = notesNotes(app).join('\n');
      expect(said).not.toContain(FALSE_NOTE);
      expect(said).not.toContain('never fired');
      const page = notesFile(app);
      expect(page).toContain('useEffect(() => {');
      const arm = armBlockOf(page, 'noteDraft.get()');
      // The arm is a block whenever the action is a statement; the chain must sit INSIDE it.
      if (arm !== null) expect(arm).toContain(f.emitted);
      else expect(page).toContain(`if (noteDraft.get()) ${f.emitted}`);
      expect(typecheckEmittedApp(app)).toEqual([]);
    });
  }

  it('HTTP Request: the effect is an async IIFE and the request module is earned', () => {
    const f = FAMILIES.find((x) => x.name === 'HTTP Request')!;
    const app = withGraph((notes) => {
      addNode(notes, f.node);
      addChains(notes, f);
      reactiveGate(notes, 'req', 'fetch');
    });
    const page = notesFile(app);
    expect(page).toContain('  useEffect(() => {\n    void (async () => {\n      if (noteDraft.get()) {\n        try {\n          const requestAnswer = await fetchRequest();');
    expect(page).toContain('    })();\n  }, [draft]);');
    expect(app.files['src/api/requests.ts'] ?? Object.values(app.files).find((s) => s.includes('export async function fetchRequest'))).toBeDefined();
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('Show Popup: the slot is earned by the effect, so the setter it calls is declared', () => {
    const app = withGraph((notes) => {
      addNode(notes, { id: 'about', type: 'NavigationShowPopup', parameters: [{ name: 'target', value: literal('/Components/AboutDialog') }] });
      reactiveGate(notes, 'about', 'show');
    });
    const page = notesFile(app);
    expect(page).toContain("if (noteDraft.get()) setOpenPopup('AboutDialog');");
    expect(page).toContain('useState<');
    expect(typecheckEmittedApp(app)).toEqual([]);
    expect(notesNotes(app).join('\n')).not.toContain('never fired');
  });
});

describe('EXP-011 §40 §C — a branch arm that holds a statement is a block, so its chain stays inside the if', () => {
  const handlerGate = (notes: ComponentIR, toId: string, toPort: string) => {
    addNode(notes, { id: 'gate', type: 'Condition', parameters: [{ name: 'runOnChange-condition', value: literal(false) }] });
    connect(notes, 'noteDraftVar', 'value', 'gate', 'condition');
    connect(notes, 'addButton', 'onClick', 'gate', 'eval', 'signal');
    connect(notes, 'gate', 'ontrue', toId, toPort, 'signal');
  };

  it('External Link with a Done chain: the chain is inside the arm, once, and not after it', () => {
    const f = FAMILIES[0];
    const app = withGraph((notes) => {
      addNode(notes, f.node);
      addChains(notes, f);
      handlerGate(notes, 'lnk', 'do');
    });
    const page = notesFile(app);
    const arm = armBlockOf(page, 'noteDraft.get()');
    expect(arm).not.toBeNull();
    expect(arm).toContain(f.emitted);
    expect(arm).toContain('afterdone.set(noteDraft.get());');
    expect(page.split('afterdone.set(noteDraft.get())').length).toBe(2);
    expect(page).not.toContain(';;');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('Navigate To Path with a Done chain: the same', () => {
    const f = FAMILIES.find((x) => x.name === 'Navigate To Path')!;
    const app = withGraph((notes) => {
      addNode(notes, f.node);
      addChains(notes, f);
      handlerGate(notes, 'go', 'navigate');
    });
    const page = notesFile(app);
    const arm = armBlockOf(page, 'noteDraft.get()');
    expect(arm).not.toBeNull();
    expect(arm).toContain(f.emitted);
    expect(arm).toContain('afterdone.set(noteDraft.get());');
    expect(page).not.toContain(';;');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('HTTP Request in an arm: the handler is async, the try/catch sits in the block, and it typechecks', () => {
    const f = FAMILIES.find((x) => x.name === 'HTTP Request')!;
    const app = withGraph((notes) => {
      addNode(notes, f.node);
      addChains(notes, f);
      handlerGate(notes, 'req', 'fetch');
    });
    const page = notesFile(app);
    expect(page).toContain('onClick={async () => {');
    const arm = armBlockOf(page, 'noteDraft.get()');
    expect(arm).not.toBeNull();
    expect(arm).toContain('try {');
    expect(arm).toContain('await fetchRequest()');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('Delay Start with a Done chain in an arm: the inner if is inside the block, indented', () => {
    const app = withGraph((notes) => {
      addNode(notes, { id: 'poll', type: 'Timer', authoredLabel: 'Poll' });
      addSetter(notes, 'afterDone', 'polled');
      connect(notes, 'poll', 'done', 'afterDone', 'do', 'signal');
      handlerGate(notes, 'poll', 'start');
    });
    const page = notesFile(app);
    expect(page).toContain('if (noteDraft.get()) {\n            if (startDelay(pollTimer, 0, 0)) {\n              polled.set(noteDraft.get());\n            }\n          };');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('a block arm beside an else arm parses — the join takes no semicolon before the else', () => {
    const f = FAMILIES[0];
    const app = withGraph((notes) => {
      addNode(notes, f.node);
      addChains(notes, f);
      handlerGate(notes, 'lnk', 'do');
      addSetter(notes, 'otherwise', 'skipped');
      connect(notes, 'gate', 'onfalse', 'otherwise', 'do', 'signal');
    });
    expectParses(app);
    const page = notesFile(app);
    expect(page).toContain('} else skipped.set(noteDraft.get());');
    expect(page).not.toContain('}; else');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  /** 🔴 The controls: the expression arms keep the one-line forms every older golden pins. */
  it('an expression arm keeps `if (c) x;` and a Log with a chain keeps the one-line block', () => {
    const single = withGraph((notes) => {
      addNode(notes, { id: 'sv', type: 'Set Variable', parameters: [{ name: 'name', value: literal('ctrl') }] });
      connect(notes, 'noteDraftVar', 'value', 'sv', 'value');
      handlerGate(notes, 'sv', 'do');
    });
    expect(notesFile(single)).toContain('if (noteDraft.get()) ctrl.set(noteDraft.get());');
    const logged = withGraph((notes) => {
      addNode(notes, { id: 'lg', type: 'net.noodl.Log', parameters: [{ name: 'message', value: literal('hi') }] });
      addSetter(notes, 'after', 'after');
      connect(notes, 'lg', 'done', 'after', 'do', 'signal');
      handlerGate(notes, 'lg', 'log');
    });
    expect(notesFile(logged)).toContain("if (noteDraft.get()) { log('info', 'hi'); after.set(noteDraft.get()); };");
  });
});

describe('EXP-011 §40 §D — a node nothing fires is named, by its own sentence', () => {
  for (const f of FAMILIES) {
    it(`${f.name}: "${f.idle}"`, () => {
      const app = withGraph((notes) => {
        addNode(notes, f.node);
        addChains(notes, f);
      });
      const said = notesNotes(app).join('\n');
      expect(said).toContain(`node ${f.node.id} (${f.node.type}) deferred: ${f.idle}`);
      expect(said).not.toContain(FALSE_NOTE);
      expect(notesFile(app)).not.toContain(f.emitted);
    });
  }
});

describe('EXP-011 §40 §E — a node fired only from a Value Changed chain', () => {
  const watch = (notes: ComponentIR, toId: string, toPort: string) => {
    addNode(notes, { id: 'watch', type: 'Value Changed', authoredLabel: 'Draft watch' });
    connect(notes, 'noteDraftVar', 'value', 'watch', 'value');
    connect(notes, 'watch', 'valueChanged', toId, toPort, 'signal');
  };
  it('Now: not called idle, and its chain is in the effect', () => {
    const f = FAMILIES.find((x) => x.name === 'Now')!;
    const app = withGraph((notes) => {
      addNode(notes, f.node);
      addChains(notes, f);
      watch(notes, 'clock', 'read');
    });
    const said = notesNotes(app).join('\n');
    expect(said).not.toContain('never fired');
    expect(said).not.toContain(FALSE_NOTE);
    expect(notesFile(app)).toContain('draftWatchLast.current = arrival;\n    afterdone.set(noteDraft.get());');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
  it('HTTP Request: the effect is an async IIFE, the module is earned, and it typechecks', () => {
    const f = FAMILIES.find((x) => x.name === 'HTTP Request')!;
    const app = withGraph((notes) => {
      addNode(notes, f.node);
      addChains(notes, f);
      watch(notes, 'req', 'fetch');
    });
    const said = notesNotes(app).join('\n');
    expect(said).not.toContain('never fired');
    const page = notesFile(app);
    expect(page).toContain('    void (async () => {\n      try {\n        const requestAnswer = await fetchRequest();');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
});
