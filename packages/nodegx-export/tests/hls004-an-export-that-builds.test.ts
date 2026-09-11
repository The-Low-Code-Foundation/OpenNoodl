/**
 * HLS-004 — an export that builds.
 *
 * ## What was actually wrong, and what was already right
 *
 * [#24](https://github.com/The-Low-Code-Foundation/NodeGX/issues/24) reported a freshly exported
 * project failing its own `npm run build` on `TS18048: 'k' is possibly 'undefined'` — the
 * exporter's output, not the author's. The reporter read it as one expression needing a default.
 *
 * 🔴 **The gate this task was scoped to build already existed.** `tests/typecheck-emitted.test.ts`
 * has compiled every fixture under the scaffold's own `strict: true` since EXP-011 §24.6, and it
 * was green at HEAD before a line of this task was written. What it did not have was **a fixture
 * with the reported shape**: the corpus's only `Expression` was `(name || '').length > 1`, whose
 * `|| ''` guards the very read that trips. A gate with a hole exactly the shape of the defect
 * reads identically to a gate that covers it, and this one had been read that way.
 *
 * So the deliverable is in two halves and the fixture is the load-bearing one:
 *
 * - `tests/fixtures/budget-desk` — arithmetic straight onto a component input, which is #24, plus
 *   the two neighbouring input classes so the contract below is visible rather than inferred.
 * - The contract in `jsWrapperLines` (`src/emit/component.ts`), which makes it compile.
 *
 * ## The contract, and why it is not a default
 *
 * Every wrapper field used to be `?:` unconditionally. `def.inputs` already knew better, and the
 * three classes now type differently — asserted below, not described:
 *
 * | class | emitted | why |
 * |---|---|---|
 * | wire-fed | `months: number \| undefined` | the call site always passes it; the *value* may not have landed |
 * | literal-fed | `rate: number` | a constant folded in at the call — it cannot be absent |
 * | mined, unfed | `drift?: any` | no wire, no parameter: nothing ever passes it |
 *
 * 🔴 **Nothing is defaulted, and that is deliberate.** `registerInputIfNeeded` seeds a discovered
 * input to `undefined` rather than `0` (NDA-017 §2) precisely so an expression with nothing to
 * answer with produces `NaN` — visibly absent — instead of a plausible zero no downstream branch
 * can distinguish. `budget-desk`'s `withDrift` is that case on purpose, and the row below pins the
 * emitted app to the same abstention.
 *
 * ## What compiles the body, then
 *
 * The author's expression is **JavaScript preserved verbatim** (EXP-003 §4) evaluated in the
 * runtime's untyped scope. The interface above is what the *call site* is held to; the names enter
 * the body as `any`, mapped over `keyof` so an undeclared name is still an error. That is the same
 * bounded loosening `scriptFileSource` already states for its `// @ts-nocheck`, and the reason it
 * is bounded is asserted here too.
 *
 * ## What this suite cannot see
 *
 * `tsc --noEmit` is the gate; **`vite build` is not in it**. Bundling needs a real `npm install`
 * of `react@19`/`react-router-dom@7` per fixture, which is network and minutes per row, and this
 * package has 43 fixtures. What it costs to skip is named rather than waved at: tsc does not
 * resolve `react-router-dom` or `vite/client` against the real packages (`helpers/typecheckApp.ts`
 * declares both ambiently and says so), does not run PostCSS over the emitted CSS modules, and
 * does not catch a bundler-only failure such as an unresolvable asset URL. The one real
 * `npm install && npm run build` of this fixture is a person's job, recorded in
 * `HLS-004-WHAT-WAS-BUILT.md` rather than run here.
 */
import * as path from 'path';

import { Catalog, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';

const FIXTURES = path.join(__dirname, 'fixtures');
const catalog: Catalog = loadCatalog();

/** #24's shape: `months * rate` where `months` is a component input. */
const SUBJECT = 'budget-desk';

const appOf = (name: string) => emitApp(parseProject(path.join(FIXTURES, name), catalog), catalog);

const fileEnding = (app: { files: Record<string, string> }, suffix: string): string => {
  const found = Object.keys(app.files).find((f) => f.endsWith(suffix));
  if (!found) throw new Error(`no emitted file ending ${suffix} — emitted: ${Object.keys(app.files).join(', ')}`);
  return found;
};

/**
 * 🔴 **The reverted arm (AC2): the defect restored, not the repair removed.**
 *
 * This rewrites an emitted file back into what the pre-HLS-004 emitter wrote, by inverting exactly
 * the two things that changed — the field list loses its distinctions and becomes `?:` throughout,
 * and the scope binding folds back onto the parameter. It is a transform on the *output* rather
 * than a second copy of the emitter, so it cannot drift away from what it claims to reproduce; the
 * rows that use it assert it actually fired, because a mutant that changed nothing grades nothing.
 */
const revertFields = (fields: string): string =>
  fields
    .split('; ')
    .map((field) => {
      const [name, type] = field.split(/\??: /);
      return `${name}?: ${type.replace(/ \| undefined$/, '')}`;
    })
    .join('; ');

const CAST = '__inputs as { [K in keyof typeof __inputs]: any }';

function revertToPreHls004(source: string): string {
  // Expression: `function f(__inputs: {…}) {` + a destructuring bind → the params-list destructure.
  const expression = new RegExp(
    `function (\\w+)\\(__inputs: \\{ ([^}]*) \\}\\) \\{\\n  const \\{ ([^}]*) \\} = ${escapeRegExp(CAST)};\\n`,
    'g'
  );
  // Function / Visual Function: `function f(__inputs: T): O {` + `const Inputs = …` → `Inputs: T`.
  const record = new RegExp(
    `function (\\w+)\\(__inputs: \\{ ([^}]*) \\}\\)(: [^{]*)\\{\\n  const Inputs = ${escapeRegExp(CAST)};\\n`,
    'g'
  );
  return source
    .replace(record, (_m, fn, fields, returns) => `function ${fn}(Inputs: { ${revertFields(fields)} })${returns}{\n`)
    .replace(expression, (_m, fn, fields, names) => `function ${fn}({ ${names} }: { ${revertFields(fields)} }) {\n`);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('HLS-004 AC2 — the gate compiles the emitted output, and fails on the reverted arm', () => {
  const app = appOf(SUBJECT);
  const gauge = fileEnding(app, 'components/Gauge.tsx');

  test('the subject fixture emits #24 exactly: arithmetic straight onto a component input', () => {
    // Named rather than assumed. If the fixture stops carrying the shape, this row says so before
    // the green rows below start meaning nothing.
    expect(app.files[gauge]).toContain('months * rate');
    expect(app.files[gauge]).toContain('export interface GaugeProps {');
    expect(app.files[gauge]).toMatch(/months\?: number;/);
  });

  test('at HEAD the emitted app typechecks under the scaffold’s own strict settings', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  test('🔴 the reverted arm restores #24 — the same TS18048 the issue reported', () => {
    const reverted = revertToPreHls004(app.files[gauge]);
    // The mutant has to have fired. A no-op transform would make the expectation below a
    // statement about nothing, and it would still read green.
    expect(reverted).not.toBe(app.files[gauge]);
    expect(reverted).toContain('months?: number');
    expect(reverted).not.toContain(CAST);

    const diagnostics = typecheckEmittedApp(app, { [gauge]: reverted });
    expect(diagnostics).toContainEqual(expect.stringContaining("TS18048"));
    expect(diagnostics).toContainEqual(expect.stringContaining("'months' is possibly 'undefined'"));
  });

  test('⚠️ the reverted arm is still a program — its failures are the defect, not a broken edit', () => {
    const reverted = revertToPreHls004(app.files[gauge]);
    const diagnostics = typecheckEmittedApp(app, { [gauge]: reverted });

    // A reverted arm that does not parse grades nothing: every diagnostic it produces would be
    // about the transform. TS1xxx is the syntactic range.
    expect(diagnostics.filter((d) => /^TS1\d{3} /.test(d))).toEqual([]);
    // And it fails for one reason only — the possibly-undefined class this task removed.
    expect(diagnostics.every((d) => d.startsWith('TS18048'))).toBe(true);
  });

  test('the transform reverts every wrapper in the file, not the first', () => {
    const reverted = revertToPreHls004(app.files[gauge]);
    // `budget-desk` carries two Expression nodes on purpose. A transform that stopped at one would
    // leave the second repaired and still satisfy the rows above.
    expect(app.files[gauge].match(/const \{ [^}]*\} = __inputs as/g)).toHaveLength(2);
    expect(reverted.match(/__inputs/g)).toBeNull();
  });
});

describe('HLS-004 AC3 — a presence control: the gate catches a deliberately broken emission', () => {
  const app = appOf(SUBJECT);
  const gauge = fileEnding(app, 'components/Gauge.tsx');

  /**
   * `Tests: 0 total` wears the same face as a pass, and so does a checker compiling an empty
   * program. These rows are the standing proof that the instrument above can go red on this
   * fixture — not on some other one, which is what `typecheck-emitted.test.ts` already shows.
   */
  test('a name that is read and never declared is caught in this fixture', () => {
    const sabotaged = app.files[gauge].replace('\n', '\nconst unreachable = neverDeclaredAnywhere;\n');
    expect(sabotaged).not.toBe(app.files[gauge]);
    expect(typecheckEmittedApp(app, { [gauge]: sabotaged })).toContainEqual(
      expect.stringContaining("Cannot find name 'neverDeclaredAnywhere'")
    );
  });

  test('🔴 the scope cast is bounded: an input the graph never mined is still an error', () => {
    // The loosening is `{ [K in keyof typeof __inputs]: any }`, not `Record<string, any>`, and the
    // difference is exactly this. If it ever becomes the latter, this row goes green-to-red.
    const sabotaged = app.files[gauge].replace('return (months * rate);', 'return (months * rate + neverAnInput);');
    expect(sabotaged).not.toBe(app.files[gauge]);
    expect(typecheckEmittedApp(app, { [gauge]: sabotaged })).toContainEqual(
      expect.stringContaining("Cannot find name 'neverAnInput'")
    );
  });
});

describe('HLS-004 AC4 — the contract is asserted at the type level, not by the absence of an error', () => {
  const app = appOf(SUBJECT);
  const gauge = fileEnding(app, 'components/Gauge.tsx');
  const signatureOf = (fn: string): string => {
    const match = app.files[gauge].match(new RegExp(`function ${fn}\\(__inputs: (\\{[^}]*\\})\\)`));
    if (!match) throw new Error(`no emitted wrapper for ${fn} in:\n${app.files[gauge]}`);
    return match[1];
  };

  test('an input the graph guarantees and one it does not differ, in the same interface', () => {
    // `projected` carries both: `months` arrives by wire from the component input, `rate` is a
    // literal parameter on the node. One interface, two type forms, and the difference is the
    // contract rather than a formatting accident.
    const projected = signatureOf('projected');
    expect(projected).toContain('months: number | undefined');
    expect(projected).toContain('rate: number');
    expect(projected).not.toContain('rate: number | undefined');
    expect(projected).not.toContain('months?:');
  });

  test('the third class — mined but fed by nothing — is the only one still optional', () => {
    const withDrift = signatureOf('withDrift');
    expect(withDrift).toContain('drift?: any');
    expect(withDrift).toContain('months: number | undefined');
  });

  test('the call site matches the contract: what is required is passed, what is optional is omitted', () => {
    // The interface is only worth anything if the emitted caller is held to it, and this is the
    // fact that made `?:` wrong in the first place — the property is always passed.
    expect(app.files[gauge]).toContain('projected({ months, rate: 250 })');
    expect(app.files[gauge]).toContain('withDrift({ months })');
  });

  test('🔴 nothing was defaulted: the unfed input still abstains, exactly as NDA-017 §2 chose', () => {
    // The repair a reader would reach for first is `drift = 0`, and it would be the defect
    // NDA-017 removed, reinstated in generated code. `months + drift` must stay able to answer
    // NaN in the exported app, so no `?? 0`, no `= 0`, no `|| 0` may appear around the binding.
    const wrapper = app.files[gauge].match(/function withDrift[\s\S]*?\n\}/)![0];
    expect(wrapper).toContain('return (months + drift);');
    expect(wrapper).not.toMatch(/drift\s*(=|\?\?|\|\|)/);
  });
});
