/**
 * The types copy, and the staleness question the handover left open.
 *
 * 🔴 **This repository's most expensive recurring failure is a stale copy that
 * reads exactly like a correct answer.** A kit carries its own
 * `types/node-kit.d.ts` because CN-005 measured that a bare specifier cannot
 * resolve without `node_modules` — so the copy is unavoidable, and the only
 * question is whether its age is *answerable*.
 *
 * These tests pin the three things that make it answerable:
 *
 * 1. the repository holds no second copy of the content — the bytes come from
 *    the installed package at scaffold time;
 * 2. the written copy is stamped with the version it came from;
 * 3. `typesCopyStatus` answers "is this copy current?" for **any** kit's copy,
 *    including ones the scaffold did not write — which is what the cashflow
 *    kit's hand-made copy needs.
 */

/* eslint-env jest */

const fs = require('fs');
const path = require('path');

const { scaffoldKitFiles, readPublishedTypes, typesCopyStatus, KIT_TYPES_RELPATH } = require('../src/index');

const plan = scaffoldKitFiles({ name: 'Weather Kit' });
const copy = plan.files.find((f) => f.path === KIT_TYPES_RELPATH).contents;
const published = readPublishedTypes();

describe('the copy', () => {
  test('the body is byte-identical to the published types', () => {
    // Everything after the stamp. If this ever fails, the scaffold has started
    // rewriting the types, which is the drift the copy exists in spite of.
    expect(copy.endsWith(published.body)).toBe(true);
  });

  test('and the published types were actually read, not defaulted to empty', () => {
    // The two-sided half: `''.endsWith('')` is true, so the assertion above
    // passes vacuously against a missing file.
    expect(published.body.length).toBeGreaterThan(5000);
    expect(published.body).toContain('ReactNodeDefinition');
  });

  test('it is stamped with the version it came from', () => {
    expect(copy).toContain(`// Copied from @nodegx/node-kit-types@${published.version}`);
    expect(plan.kit.typesVersion).toBe(published.version);
  });

  test('the stamp says the thing an author would otherwise get wrong', () => {
    // That editing it changes nothing. Without this line the obvious reading of
    // a .d.ts sitting in your kit is that it is enforcing something.
    expect(copy).toContain('Editing this file changes nothing the runtime enforces');
  });

  test('there is no second copy of the types checked into this package', () => {
    // The whole containment argument rests on this. A committed duplicate would
    // be a copy nobody stamps and nothing compares.
    const files = fs.readdirSync(path.join(__dirname, '..', 'src'));
    expect(files.sort()).toEqual(['index.d.ts', 'index.js']);
    expect(fs.readFileSync(path.join(__dirname, '..', 'src', 'index.js'), 'utf8')).not.toContain('ReactNodeDefinition {');
  });
});

describe('typesCopyStatus', () => {
  test('a freshly scaffolded copy is current', () => {
    const status = typesCopyStatus(copy);
    expect({ current: status.current, stamped: status.stampedVersion }).toEqual({
      current: true,
      stamped: published.version
    });
  });

  test('a copy whose body was edited is not current, even with an intact stamp', () => {
    const tampered = copy.replace('ReactNodeDefinition', 'ReactNodeDefinitionX');
    // The mutation has to have happened, or this test grades nothing.
    expect(tampered).not.toBe(copy);

    const status = typesCopyStatus(tampered);
    expect(status.current).toBe(false);
    expect(status.stampedVersion).toBe(published.version);
  });

  test('a lying stamp does not change the verdict, and is still reported', () => {
    // ⚠️ Written the other way round first, and the code was right: `current`
    // answers "is this body the one we publish today", which a stamp cannot
    // affect. The stamp is evidence, not the verdict — so it is *reported*
    // beside a `current: true`, and a caller that cares about the disagreement
    // can see it. Deciding staleness from the stamp would be exactly the frozen
    // figure this whole mechanism exists to avoid.
    const status = typesCopyStatus(copy.replace(/@nodegx\/node-kit-types@[\d.]+/, '@nodegx/node-kit-types@0.0.1'));
    expect({ current: status.current, stamped: status.stampedVersion }).toEqual({ current: true, stamped: '0.0.1' });
  });

  test('an unstamped hand-made copy of the current types still reads as current', () => {
    // ⚠️ Deliberate, and worth stating: the question is "are these the types we
    // publish today", not "did the scaffold write this". The cashflow kit's
    // copy is hand-made and unstamped, and answering "not current" for a file
    // that is byte-for-byte correct would make the check useless there.
    const status = typesCopyStatus(published.body);
    expect({ current: status.current, stamped: status.stampedVersion }).toEqual({ current: true, stamped: null });
  });

  test('an unstamped copy of something else is not current, and says why', () => {
    const status = typesCopyStatus('export interface Nope {}\n');
    expect(status.current).toBe(false);
    expect(status.reason).toContain('no scaffold stamp');
  });

  test('empty input is not current', () => {
    expect(typesCopyStatus('').current).toBe(false);
    expect(typesCopyStatus(undefined).current).toBe(false);
  });
});

describe('the cashflow kit — the copy this phase already owes', () => {
  const cashflowCopy = path.join(
    process.env.HOME || '',
    'vscode_projects/NodeGX test projects/cashflow-command-centre/noodl_modules/cashflow-kit/types/node-kit.d.ts'
  );

  // ⚠️ Not a repository file — it lives in a test-projects checkout beside this
  // one, so it may legitimately be absent. Reported rather than asserted, and
  // NOT silently skipped: the console line is the point, because the alternative
  // is a hole nothing ever mentions again.
  test('its status is reported when it is present', () => {
    if (!fs.existsSync(cashflowCopy)) {
      // eslint-disable-next-line no-console
      console.warn(`[cn-006] cashflow kit types copy not present at ${cashflowCopy} — not graded here.`);
      return;
    }
    const status = typesCopyStatus(fs.readFileSync(cashflowCopy, 'utf8'));
    // eslint-disable-next-line no-console
    console.warn(`[cn-006] cashflow kit types copy: current=${status.current} ${status.reason || ''}`);
    expect(typeof status.current).toBe('boolean');
  });
});
