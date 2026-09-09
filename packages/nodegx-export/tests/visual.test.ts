import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { parseIdentityMapping, planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { assignClassNames, partitionMergeGroup } from '../src/emit/naming';
import { computeNodeStyle } from '../src/emit/style';
import { parseProject } from '../src/parse/parseProject';

const FIXTURE = path.join(__dirname, 'fixtures', 'puppy-test-3');

const catalog: Catalog = loadCatalog();
const index = new CatalogIndex(catalog);
const ir = parseProject(FIXTURE, catalog);
const app = emitApp(ir, catalog);
const project = planProject(ir, index);

// ---------------------------------------------------------------------------------------------
// The golden test (EXP-002 step 4's acceptance): generated PuppyCard vs the hand-written target
// in EXP-002-TARGET-OUTPUT.md §1. Any diff here is a design conversation, on purpose.
// ---------------------------------------------------------------------------------------------

const GOLDEN_PUPPY_CARD_TSX = `// @nodegx:generated (visual — provenance markers complete in EXP-007)
import styles from './PuppyCard.module.css';

export interface PuppyCardProps {
  photo?: string;
  name?: string;
  breed?: string;
  age?: string;
  description?: string;
}

/** Card. */
export function PuppyCard({ photo, name, breed, age, description }: PuppyCardProps) {
  return (
    <div className={styles.card}>
      <img className={styles.photo} src={photo} alt={name} />
      <div className={styles.body}>
        <div className={styles.nameRow}>
          <p className={styles.nameText}>{name}</p>
          <div className={styles.agePill}>
            <p className={styles.ageText}>{age}</p>
          </div>
        </div>
        <p className={styles.breedText}>{breed}</p>
        <p className={styles.descText}>{description}</p>
      </div>
    </div>
  );
}
`;

const GOLDEN_PUPPY_CARD_CSS = `/* @nodegx:generated (visual) */

.card {
  display: flex;
  flex-direction: column;
  width: 340px;
  background-color: var(--surface-raised);
  border: var(--border-1) solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: 0 1px 3px 0 #0f172a14;
  overflow: hidden;
}

.photo {
  width: 100%;
  height: 230px;
  object-fit: cover;
  border-top-left-radius: var(--radius-xl);
  border-top-right-radius: var(--radius-xl);
}

.body {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: var(--space-5);
  row-gap: var(--space-2);
}

.nameRow {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  column-gap: var(--space-3);
}

.nameText {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
  letter-spacing: var(--tracking-tight);
  color: var(--foreground);
}

.agePill {
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: var(--muted);
  border-radius: var(--radius-full);
  padding: var(--space-1) var(--space-3);
}

.ageText {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  letter-spacing: var(--tracking-wide);
  color: var(--muted-foreground);
}

.breedText {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  letter-spacing: var(--tracking-wide);
  color: var(--primary);
}

.descText {
  margin: 0;
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--muted-foreground);
}
`;

describe('the PuppyCard golden (TARGET-OUTPUT §1)', () => {
  test('PuppyCard.tsx matches the hand-written target', () => {
    expect(app.files['src/components/PuppyCard.tsx']).toBe(GOLDEN_PUPPY_CARD_TSX);
  });

  test('PuppyCard.module.css matches the hand-written target', () => {
    expect(app.files['src/components/PuppyCard.module.css']).toBe(GOLDEN_PUPPY_CARD_CSS);
  });
});

// ---------------------------------------------------------------------------------------------
// Landing (TARGET-OUTPUT §2): stub + state, repeater, navigation, unwired inputs, merges.
// ---------------------------------------------------------------------------------------------

describe('the Landing page (TARGET-OUTPUT §2)', () => {
  const tsx = app.files['src/pages/Landing.tsx'];
  const css = app.files['src/pages/Landing.module.css'];

  test('a consumed DbCollection2 becomes useState + useEffect over the typed stub', () => {
    expect(tsx).toContain(`import { fetchPuppies, type Puppy } from '../api/puppies';`);
    expect(tsx).toContain('const [puppies, setPuppies] = useState<Puppy[]>([]);');
    expect(tsx).toContain('fetchPuppies().then(setPuppies);');
  });

  test('the identity-mapped For Each becomes items.map with key and per-prop spreading', () => {
    expect(tsx).toContain('{puppies.map((puppy) => (');
    expect(tsx).toContain('key={puppy.id}');
    expect(tsx).toContain('photo={puppy.photo}');
    expect(tsx).toContain('description={puppy.description}');
    expect(tsx).toContain(`import { PuppyCard } from '../components/PuppyCard';`);
  });

  test('RouterNavigate resolves at generation time to a navigate handler on the wired element', () => {
    expect(tsx).toContain(`onClick={() => navigate('/thank-you')}`);
    expect(tsx).toContain('const navigate = useNavigate();');
  });

  test('unwired inputs stay native and uncontrolled — no state, no onChange, no wrapper', () => {
    expect(tsx).toContain('<input className={styles.input} />');
    expect(tsx).not.toContain('onChange');
    // One state hook exists (the query); the four form fields add none.
    expect(tsx.match(/useState/g)).toHaveLength(2); // the import and the one call
  });

  test('the Page node contributes hoisted title/meta and no wrapper of its own beyond the page div', () => {
    expect(tsx).toContain('<title>Puppy Adoption — Landing</title>');
    expect(tsx).toContain('<meta name="description" content="Available puppies for adoption and an inquiry form." />');
    // The sole root Group merged into the page div: .page carries its style, no .root class.
    expect(css).toContain('.page {');
    expect(css).not.toContain('.root');
    expect(css).toContain('background-color: var(--surface);');
  });

  test('identical style sets merge into .field/.label/.input, named by shared vocabulary', () => {
    expect(tsx.match(/className=\{styles\.field\}/g)).toHaveLength(4);
    expect(tsx.match(/className=\{styles\.label\}/g)).toHaveLength(4);
    expect(tsx.match(/className=\{styles\.input\}/g)).toHaveLength(4);
    expect(css.match(/^\.field \{/gm)).toHaveLength(1);
  });

  test('accidental byte-identity without shared vocabulary does NOT merge', () => {
    // sectionHead's declarations equal the field wrappers'; it keeps its own class.
    expect(tsx).toContain('className={styles.sectionHead}');
    expect(css).toContain('.sectionHead {');
  });
});

// ---------------------------------------------------------------------------------------------
// Analysis: dispositions, the router shell, logic-only components, the identity-mapping parser.
// ---------------------------------------------------------------------------------------------

describe('planProject', () => {
  test('the router-bearing component is the app shell: nothing emitted, Router collapsed into App.tsx', () => {
    const appPlan = project.plans.find((p) => p.path === 'App')!;
    expect(appPlan.file).toBeNull();
    const router = Object.entries(appPlan.dispositions).find(([, d]) => d.kind === 'collapsed');
    expect(router?.[1]).toEqual({ kind: 'collapsed', into: 'src/App.tsx' });
    expect(app.files['src/components/App.tsx']).toBeUndefined();
  });

  test('a routed component is a page whatever component.json says (the editor home page)', () => {
    const home = project.plans.find((p) => p.path === '#__page__/Home')!;
    expect(home.file).toEqual({ dir: 'pages', fileBase: 'Home', symbol: 'HomePage' });
    expect(app.files['src/pages/Home.tsx']).toContain('Hello World!');
    expect(app.files['src/components/Home.tsx']).toBeUndefined();
  });

  test('a logic-only component emits nothing and defers to EXP-003', () => {
    const probe = project.plans.find((p) => p.path === 'Components/BenchLogicProbe')!;
    expect(probe.file).toBeNull();
    expect(probe.skipReason).toContain('no visual root');
  });

  test('the editor-debris ghost node dispositions as unknown-type, and parsing never failed on it', () => {
    const adminLogin = project.plans.find((p) => p.path === 'Pages/Admin Login')!;
    const ghost = Object.values(adminLogin.dispositions).find((d) => d.kind === 'unknown-type');
    expect(ghost).toBeDefined();
  });

  test("a page's sole Group child collapses into the page div", () => {
    const landing = project.plans.find((p) => p.path === 'Pages/Landing')!;
    expect(landing.collapsedGroupId).toBe('root');
    expect(landing.dispositions['root']).toEqual({ kind: 'collapsed', into: 'page' });
  });

  test('a consumed query is stubbed; logic nodes defer with their type named', () => {
    const landing = project.plans.find((p) => p.path === 'Pages/Landing')!;
    expect(landing.dispositions['puppyQuery'].kind).toBe('stubbed');
    expect(landing.dispositions['navThankYou']).toEqual({ kind: 'collapsed', into: 'submitButton' });
  });

  test('Component Inputs ports (under the `ports` key) become typed props', () => {
    const card = project.plans.find((p) => p.path === 'Components/PuppyCard')!;
    expect(card.props.map((p) => p.name)).toEqual(['photo', 'name', 'breed', 'age', 'description']);
    expect(card.props.every((p) => p.tsType === 'string')).toBe(true);
  });
});

describe('parseIdentityMapping', () => {
  test('the default identity script parses to its entries, comments stripped', () => {
    const script = `// comment with a decoy: 'a': 'b',\nmap({\n\t'photo': 'photo',\n\t'name': 'name',\n})\n`;
    expect(parseIdentityMapping(script)).toEqual([
      { input: 'photo', field: 'photo' },
      { input: 'name', field: 'name' }
    ]);
  });

  test('anything beyond a static string→string literal defers (returns null)', () => {
    expect(parseIdentityMapping(`map({ 'a': function () { return 1; } })`)).toBeNull();
    expect(parseIdentityMapping(`const x = 1; map({ 'a': 'b' })`)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// Style extraction semantics that the goldens do not already pin down.
// ---------------------------------------------------------------------------------------------

describe('computeNodeStyle', () => {
  const thankYou = ir.components.find((c) => c.path === 'Pages/Thank You')!;

  test('a partial boxShadow folds using the catalog port defaults for the missing pieces', () => {
    // The Thank You card sets only boxShadowEnabled + boxShadowColor; the catalog's defaults
    // (offsets 0, blur 5, spread 2) fill the rest, because the interpreter does the same.
    const card = thankYou.nodes.find((n) => n.id === 'card')!;
    const style = computeNodeStyle(card, 'group', index);
    const shadow = style.decls.find((d) => d.prop === 'box-shadow');
    expect(shadow).toBeDefined();
    expect(shadow!.value).toBe('0 0 5px 2px var(--shadow-md)');
  });

  test('sizeMode gates width and height as TARGET-OUTPUT §1 settles', () => {
    const landing = ir.components.find((c) => c.path === 'Pages/Landing')!;
    const brand = landing.nodes.find((n) => n.id === 'brandText')!; // sizeMode contentSize
    const style = computeNodeStyle(brand, 'text', index);
    expect(style.decls.find((d) => d.prop === 'width')).toBeUndefined();
    expect(style.decls.find((d) => d.prop === 'height')).toBeUndefined();
  });

  test('fontVariantNumeric passes through as font-variant-numeric (DEF-019 / P78 D30)', () => {
    const node = {
      id: 'x',
      type: 'Text',
      catalogRef: 'Text',
      parameters: [{ name: 'fontVariantNumeric', value: { kind: 'literal', value: 'tabular-nums' } as const }],
      declaredPorts: [],
      portKnowledge: 'partial' as const
    };
    const style = computeNodeStyle(node, 'text', index);
    const decl = style.decls.find((d) => d.prop === 'font-variant-numeric');
    expect(decl?.value).toBe('tabular-nums');
    expect(style.unhandled).toEqual([]);
  });

  test('unknown parameters are reported as unhandled, never guessed into CSS', () => {
    const node = {
      id: 'x',
      type: 'Group',
      catalogRef: 'Group',
      parameters: [{ name: 'variant', value: { kind: 'literal', value: 'Card' } as const }],
      declaredPorts: [],
      portKnowledge: 'partial' as const
    };
    const style = computeNodeStyle(node, 'group', index);
    expect(style.unhandled).toEqual(['variant']);
    expect(style.decls.map((d) => d.prop)).toEqual(['display', 'flex-direction']);
  });
});

// ---------------------------------------------------------------------------------------------
// Naming: partitions and collision handling.
// ---------------------------------------------------------------------------------------------

describe('naming', () => {
  test('shared-suffix groups merge; shared-prefix groups merge; strangers stay out', () => {
    expect(partitionMergeGroup(['nameLabel', 'emailLabel', 'phoneLabel'])).toEqual([
      ['nameLabel', 'emailLabel', 'phoneLabel']
    ]);
    expect(partitionMergeGroup(['fieldName', 'fieldEmail', 'sectionHead']).sort()).toEqual([
      ['fieldName', 'fieldEmail'],
      ['sectionHead']
    ]);
  });

  test('dedup suffixes strip only while unambiguous', () => {
    // card-3 → card (nothing else claims it); two claimants keep their full ids.
    expect(assignClassNames([{ nodeIds: ['card-3'], role: 'group' }])).toEqual(['card']);
    expect(
      assignClassNames([
        { nodeIds: ['card'], role: 'group' },
        { nodeIds: ['card-3'], role: 'group' }
      ])
    ).toEqual(['card', 'card3']);
  });

  test('machine ids fall back to label, then role', () => {
    expect(assignClassNames([{ nodeIds: ['e82d69fb-927d-45e7-af21-ccf6bc4b5e84'], role: 'page' }])).toEqual(['page']);
    expect(
      assignClassNames([
        { nodeIds: ['e82d69fb-927d-45e7-af21-ccf6bc4b5e84'], label: 'Hero title', role: 'text' }
      ])
    ).toEqual(['heroTitle']);
  });
});

// ---------------------------------------------------------------------------------------------
// Whole-app properties.
// ---------------------------------------------------------------------------------------------

describe('emitApp', () => {
  test('page files replace their scaffold placeholders — no TODO placeholder survives for real pages', () => {
    for (const page of ['Landing', 'ThankYou', 'Home', 'Admin', 'AdminLogin']) {
      expect(app.files[`src/pages/${page}.tsx`]).not.toContain('placeholder for the');
    }
  });

  test('the api stub is typed from the collection schema and returns empty (builds before a backend)', () => {
    // EXP-009: the fixture declares its backend, so the stub form under test here is the
    // no-backend export (AC7) — metadata.cloudservices stripped from the parsed IR.
    const stripped = structuredClone(ir);
    delete stripped.project.cloudservices;
    const stub = emitApp(stripped, catalog).files['src/api/puppies.ts'];
    expect(stub).toContain('export interface Puppy {');
    expect(stub).toContain('id: string;');
    expect(stub).toContain('available?: boolean;');
    expect(stub).toContain('export async function fetchPuppies(): Promise<Puppy[]> {');
    expect(stub).toContain('TODO(export): "Query available puppies" (DbCollection2 `puppyQuery` on /Pages/Landing)');
  });

  test('dependencies stay computed from the output: no @nodegx/core anywhere', () => {
    for (const content of Object.values(app.files)) {
      expect(content).not.toContain('@nodegx/core');
    }
  });

  test('nothing is silently dropped: every deferred wire and node is a note', () => {
    expect(app.notes.length).toBeGreaterThan(0);
    expect(app.notes.some((n) => n.includes('Components/BenchLogicProbe'))).toBe(true);
    expect(app.notes.some((n) => n.includes('deferred to EXP-003'))).toBe(true);
  });

  test('emission is deterministic: two runs are byte-identical (D6)', () => {
    const again = emitApp(parseProject(FIXTURE, catalog), catalog);
    expect(JSON.stringify(again)).toBe(JSON.stringify(app));
  });
});
