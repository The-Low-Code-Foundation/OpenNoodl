import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ExportIR, NodeIR, ParamValue } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const PUPPY_FIXTURE = path.join(__dirname, 'fixtures', 'puppy-test-3');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const ir = parseProject(FIXTURE, catalog);
const app = emitApp(ir, catalog);

const cloneIr = (): ExportIR => structuredClone(ir);
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR =>
  source.components.find((c) => c.path === componentPath)!.nodes.find((n) => n.id === id)!;
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else {
    node.parameters.push({ name, value });
    node.parameters.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
};

// ---------------------------------------------------------------------------------------------
// The golden tests (EXP-002 step 5's acceptance): the Cheer fixture vs the hand-written targets
// in EXP-002-STEP5-TARGET-OUTPUT.md. Any diff here is a design conversation, on purpose.
// ---------------------------------------------------------------------------------------------

const GOLDEN_STORES = `// @nodegx:generated (stores — provenance markers complete in EXP-007)
import { value } from '@nodegx/core';

/** Written by "Write lastCheer" (Set Variable \`storeCheer\` on /Components/CheerBanner). */
export const lastCheer = value<string | undefined>(undefined);

/** Written by "Visitor name" (net.noodl.controls.textinput \`nameInput\` on /Pages/Home). */
export const visitorName = value<string | undefined>(undefined);

/** Written by "Copy draft" (Set Variable \`copyDraft\` on /Components/CheerMeter). */
export const draftCopy = value<string | undefined>(undefined);

/** Written by "Draft" (net.noodl.controls.textinput \`entryInput\` on /Pages/Notes). */
export const noteDraft = value<string | undefined>(undefined);
`;

const GOLDEN_EVENTS = `// @nodegx:generated (events — provenance markers complete in EXP-007)
import { channel } from '@nodegx/core';

export interface CelebratePayload {
  message?: string;
}

/** Sent by "Broadcast celebrate" (Event Sender \`cheerSend\` on /Pages/Home). */
export const celebrate = channel<CelebratePayload>('celebrate');
`;

const GOLDEN_GREETING_BADGE = `// @nodegx:generated (visual — provenance markers complete in EXP-007)
import { useValue } from '@nodegx/core/react';

import { visitorName } from '../stores/variables';
import styles from './GreetingBadge.module.css';

/** Badge. */
export function GreetingBadge() {
  const name = useValue(visitorName);

  return (
    <div className={styles.badge}>
      <p className={styles.greetText}>{name}</p>
    </div>
  );
}
`;

const GOLDEN_CHEER_BANNER = `// @nodegx:generated (visual — provenance markers complete in EXP-007)
import { useSignal, useValue } from '@nodegx/core/react';

import { celebrate } from '../events';
import { lastCheer } from '../stores/variables';
import styles from './CheerBanner.module.css';

/** Banner. */
export function CheerBanner() {
  const cheer = useValue(lastCheer);

  useSignal(celebrate, (payload) => {
    lastCheer.set(payload.message);
  });

  return (
    <div className={styles.banner}>
      <p className={styles.cheerText}>{cheer}</p>
    </div>
  );
}
`;

const GOLDEN_HOME = `// @nodegx:generated (visual — provenance markers complete in EXP-007)
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useValue } from '@nodegx/core/react';

import { AboutDialog } from '../components/AboutDialog';
import { CheerBanner } from '../components/CheerBanner';
import { CheerMeter } from '../components/CheerMeter';
import { FarewellCard } from '../components/FarewellCard';
import { GreetingBadge } from '../components/GreetingBadge';
import { GreetingCard } from '../components/GreetingCard';
import { celebrate } from '../events';
import { visitorName } from '../stores/variables';
import styles from './Home.module.css';

// From the Function node "formatShout" — the body is preserved verbatim (EXP-003 §4).
function formatShout(Inputs: { name?: string }): { text?: any } {
  const Outputs: { text?: any } = {};
  try {
    (() => {
const name = Inputs.name || 'friend';
Outputs.text = name.toUpperCase() + '!';
    })();
  } catch (e) {
    console.error('Function node formatShout threw:', e);
  }
  return Outputs;
}

// From the Expression node "hasLongName" — the expression is preserved verbatim (EXP-003 §4).
function hasLongName({ name, length }: { name?: string; length?: any }) {
  try {
    return ((name || '').length > 1);
  } catch (e) {
    console.error('Expression node hasLongName threw:', e);
    return 0;
  }
}

/** Home. */
export function HomePage() {
  const navigate = useNavigate();
  const name = useValue(visitorName);
  const [openPopup, setOpenPopup] = useState<'AboutDialog' | null>(null);
  // Lifted from /Components/CheerMeter's value output "draft" — undefined until the child's mount push (CONTROLLED-STATE-TARGET §4d).
  const [draft, setDraft] = useState<string | undefined>();
  const hasLongNameOut = hasLongName({ name });
  const formatShoutOut = formatShout({ name });

  return (
    <div className={styles.page}>
      <title>Cheer</title>

      <p className={styles.headline}>Cheer for a visitor</p>

      <input
        className={styles.nameInput}
        placeholder="Type a visitor name"
        onChange={(event) => visitorName.set(event.target.value)}
      />

      <p className={styles.cheerPreview}>{\`Cheering for \${name ?? ''}!\`}</p>

      <GreetingBadge />

      <button
        className={styles.cheerButton}
        disabled={!name}
        onClick={() => celebrate.emit({ message: visitorName.get() })}
      >
        Cheer
      </button>

      <CheerBanner />

      <FarewellCard onWaved={() => navigate('/mood')} />

      <button
        className={styles.aboutButton}
        disabled={!hasLongNameOut}
        onClick={() => setOpenPopup('AboutDialog')}
      >
        About
      </button>

      <GreetingCard Name="Ada" />

      <p className={styles.shoutText}>{formatShoutOut.text ?? ''}</p>

      <CheerMeter onDraftChanged={setDraft} />

      <p className={styles.echoText}>{draft ?? ''}</p>

      {openPopup === 'AboutDialog' &&
        createPortal(
          <div className={styles.popupLayer}>
            <AboutDialog onClose={() => setOpenPopup(null)} />
          </div>,
          document.body
        )}
    </div>
  );
}
`;

describe('the stores module (STEP5-TARGET §1)', () => {
  test('variables.ts matches the hand-written target', () => {
    expect(app.files['src/stores/variables.ts']).toBe(GOLDEN_STORES);
  });

  test('the puppy export has no stores or events modules', () => {
    const puppy = emitApp(parseProject(PUPPY_FIXTURE, catalog), catalog);
    expect(puppy.files['src/stores/variables.ts']).toBeUndefined();
    expect(puppy.files['src/events.ts']).toBeUndefined();
  });
});

describe('the events module (STEP5-TARGET §2)', () => {
  test('events.ts matches the hand-written target', () => {
    expect(app.files['src/events.ts']).toBe(GOLDEN_EVENTS);
  });

  test('non-global propagation defers the sender with a note', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Pages/Home', 'cheerSend'), 'propagation', { kind: 'literal', value: 'parent' });
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('propagation "parent" scopes the event to the component tree');
    expect(result.files['src/pages/Home.tsx']).not.toContain('.emit(');
  });
});

describe('a variable read is a useValue hook (STEP5-TARGET §3)', () => {
  test('GreetingBadge.tsx matches the hand-written target', () => {
    expect(app.files['src/components/GreetingBadge.tsx']).toBe(GOLDEN_GREETING_BADGE);
  });

  test('a non-literal variable name defers the binding', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Components/GreetingBadge', 'readVisitor'), 'name', {
      kind: 'expression',
      source: 'someDynamicName'
    } as unknown as ParamValue);
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('variable name is not a literal');
    expect(result.files['src/components/GreetingBadge.tsx']).not.toContain('useValue');
  });

  test('a variable with an untypable writer defers its render binding', () => {
    const mutated = cloneIr();
    const home = mutated.components.find((c) => c.path === 'Pages/Home')!;
    const write = home.connections.find((c) => c.toId === 'visitorVar' && c.toProperty === 'value')!;
    write.fromId = 'cheerButton';
    write.fromProperty = 'pointerUp';
    write.kind = 'signal';
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('variable "visitorName" has no statically-typed writer');
    expect(result.files['src/components/GreetingBadge.tsx']).not.toContain('useValue');
    expect(result.files['src/stores/variables.ts']).toContain('export const visitorName = value<unknown>(undefined);');
  });
});

describe('a receiver is useSignal; a Set Variable is a statement (STEP5-TARGET §4)', () => {
  test('CheerBanner.tsx matches the hand-written target', () => {
    expect(app.files['src/components/CheerBanner.tsx']).toBe(GOLDEN_CHEER_BANNER);
  });

  test('a non-string setWith conversion defers the Set Variable', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Components/CheerBanner', 'storeCheer'), 'setWith', { kind: 'literal', value: 'number' });
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('setWith "number" conversion is not translated in step 5');
    expect(result.files['src/components/CheerBanner.tsx']).not.toContain('useSignal');
  });

  test('an authored enabled input gates the receiver and defers it', () => {
    const mutated = cloneIr();
    setParam(nodeOf(mutated, 'Components/CheerBanner', 'onCheer'), 'enabled', { kind: 'literal', value: false });
    const result = emitApp(mutated, catalog);
    expect(result.notes.join('\n')).toContain('an authored enabled input gates this receiver');
    expect(result.files['src/components/CheerBanner.tsx']).not.toContain('useSignal');
  });
});

describe('writes without subscriptions (STEP5-TARGET §5)', () => {
  test('Home.tsx matches the hand-written target', () => {
    expect(app.files['src/pages/Home.tsx']).toBe(GOLDEN_HOME);
  });

  test('the wired input stays uncontrolled: onChange only, no value, no state of its own', () => {
    const home = app.files['src/pages/Home.tsx'];
    // The page's useState rows are the popup slot (POPUPS-TARGET §2) and the lifted draft
    // (CONTROLLED-STATE §4d) — the wired input itself still earns none.
    expect(home.match(/useState/g)).toHaveLength(3); // the import specifier + slot + lifted draft
    expect(home).toContain("useState<'AboutDialog' | null>");
    expect(home).not.toContain('value={');
    expect(home).toContain('onChange={(event) => visitorName.set(event.target.value)}');
  });

  test('handler reads stay .get() snapshots; only the render read earns the hook', () => {
    const home = app.files['src/pages/Home.tsx'];
    // One useValue, earned by the preview's render binding — the click handler's read of the
    // same variable stays a snapshot and earns nothing.
    expect(home.match(/useValue\(/g)).toHaveLength(1);
    expect(home).toContain('visitorName.get()');
  });
});

describe('dependencies stay computed from the output (STEP5-TARGET §6)', () => {
  test('@nodegx/core joins Cheer package.json, alphabetically first', () => {
    const pkg = JSON.parse(app.files['package.json']);
    expect(Object.keys(pkg.dependencies)).toEqual(['@nodegx/core', 'react', 'react-dom', 'react-router-dom']);
    expect(pkg.dependencies['@nodegx/core']).toBe('^0.1.0');
  });

  test('the puppy export remains byte-for-byte free of @nodegx/core', () => {
    const puppy = emitApp(parseProject(PUPPY_FIXTURE, catalog), catalog);
    for (const content of Object.values(puppy.files)) {
      expect(content).not.toContain('@nodegx/core');
    }
  });
});

describe('the whole fixture translates', () => {
  test('nothing is dropped: the only note is the router shell', () => {
    expect(app.notes).toEqual([
      'App: router shell — emitted as src/App.tsx by the scaffold',
      'Components/GreetingCard: wire greet-state:value-Draft->greet-draft:startValue: property "Draft" reads its boot value — no wire writes it (a runtime script would) — rendered as the empty/omitted form'
    ]);
  });

  test('emission is deterministic: two runs are byte-identical (D6)', () => {
    const again = emitApp(parseProject(FIXTURE, catalog), catalog);
    expect(again.files).toEqual(app.files);
  });
});

describe('tokens.css carries the effective set (STEP5-TARGET §6, the scaffold correction)', () => {
  test('a project with no overrides gets the shipped defaults', () => {
    const tokens = app.files['src/styles/tokens.css'];
    expect(tokens).toContain('--primary: #3b82f6;');
    expect(tokens).toContain('--space-4:');
    expect(tokens).toContain('--radius-xl:');
  });

  test('overrides replace defaults in place; the rest of the defaults survive', () => {
    const puppy = emitApp(parseProject(PUPPY_FIXTURE, catalog), catalog);
    const tokens = puppy.files['src/styles/tokens.css'];
    expect(tokens).toContain('--primary: #18181b;');
    expect(tokens).not.toContain('--primary: #3b82f6;');
    expect(tokens).toContain('--space-4:');
  });
});
