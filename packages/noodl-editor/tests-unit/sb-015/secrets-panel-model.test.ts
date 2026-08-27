/**
 * SB-015 §6.4a — the Secrets panel's decisions, graded.
 *
 * ## What this file is for
 *
 * §6.4a ruled that the fix for the first five minutes is the missing renderer
 * surface over `/admin/secrets` — a door and an IPC bridge that both already
 * existed. The panel itself cannot be mounted here (`testEnvironment: 'node'`,
 * no jsdom, no `@testing-library/react`, and `SecretsPanel.tsx` calls
 * `window.require('electron')` at module scope), so its decisions were extracted
 * into `secretsPanelModel.ts` and are graded over real inputs.
 *
 * ⚠️ What this does NOT prove: that the panel is reachable from the Backend
 * Services card, that the IPC round-trips, or that a person can actually claim a
 * site with a token set this way. Those need a drive, and SB-015 §7's first ⬜
 * (nothing has opened a project made from this template in the editor) still
 * stands. Stated here so a green file is not read as more than it is.
 */

import {
  SECRET_ENV_PREFIX,
  SECRET_NAME_PATTERN,
  canSave,
  describeDeleteOutcome,
  describeNameProblem,
  envNameForSecret,
  environmentOnlyVariables,
  generateSecretValue
} from '../../src/editor/src/views/panels/secrets/secretsPanelModel';

/**
 * The backend's own copies, imported from source.
 *
 * 🔴 This is the point of the file. `secretsPanelModel.ts` duplicates two
 * constants and one transform from `nodegx-backend/src/config/SecretsStore.ts`
 * because the renderer does not depend on that package. A second copy of a
 * constant is only safe while something fails when the copies disagree, and
 * before this import nothing did.
 */
import {
  FUNCTION_SECRET_ENV_PREFIX,
  FUNCTION_SECRET_NAME_PATTERN,
  functionSecretEnvName
} from '../../../nodegx-backend/src/config/SecretsStore';

describe('SB-015 §6.4a the renderer copies do not drift from the backend', () => {
  it('uses the same env prefix the resolver reads', () => {
    expect(SECRET_ENV_PREFIX).toBe(FUNCTION_SECRET_ENV_PREFIX);
  });

  it('uses the same name pattern the door enforces', () => {
    expect(SECRET_NAME_PATTERN.source).toBe(FUNCTION_SECRET_NAME_PATTERN.source);
  });

  /**
   * A table rather than a spot check, and it deliberately contains the cases
   * where the two implementations could plausibly differ: a run of punctuation
   * (folded to ONE underscore), a leading/trailing separator, mixed case, and a
   * name already in env shape.
   */
  it.each([
    'SITE_SETUP_TOKEN',
    'stripe.key',
    'a-b',
    'a--b',
    'a.-_b',
    '.leading',
    'trailing-',
    'MiXeD.Case-Name',
    'x',
    'A'.repeat(128)
  ])('envNameForSecret agrees with functionSecretEnvName for %p', (name) => {
    expect(envNameForSecret(name)).toBe(functionSecretEnvName(name));
  });

  it('accepts exactly the names the backend pattern accepts', () => {
    const cases = ['a', 'A'.repeat(128), 'a.b-c_d', '0', 'SITE_SETUP_TOKEN'];
    const rejects = ['', 'A'.repeat(129), 'a b', 'a/b', 'a:b', 'é', 'a\nb', '{}'];
    for (const ok of cases) {
      expect(SECRET_NAME_PATTERN.test(ok)).toBe(true);
      expect(FUNCTION_SECRET_NAME_PATTERN.test(ok)).toBe(true);
    }
    for (const bad of rejects) {
      expect(SECRET_NAME_PATTERN.test(bad)).toBe(false);
      expect(FUNCTION_SECRET_NAME_PATTERN.test(bad)).toBe(false);
    }
  });
});

describe('SB-015 §6.4a a name is answered in the field, not by a round trip', () => {
  it('says nothing about an empty field', () => {
    expect(describeNameProblem('')).toBeNull();
  });

  it('accepts a usable name', () => {
    expect(describeNameProblem('SITE_SETUP_TOKEN')).toBeNull();
  });

  it('states the rule for an unusable one rather than echoing it back', () => {
    const problem = describeNameProblem('not a name');
    expect(problem).not.toBeNull();
    // Unusable input is exactly the input not to reflect — the same rule
    // `admin-secrets.ts` follows in its 400.
    expect(problem).not.toContain('not a name');
    expect(problem).toContain('1-128');
  });
});

describe('SB-015 §6.4a a delete reports whether the secret still resolves', () => {
  /**
   * 🔴 The case the whole three-way branch exists for. The resolver has two
   * doors; removing the stored copy while `NODEGX_SECRET_<NAME>` is set does not
   * stop functions resolving it.
   */
  it('is an ERROR, not a notice, when the environment still answers', () => {
    const out = describeDeleteOutcome({
      name: 'SITE_SETUP_TOKEN',
      existed: true,
      stillResolvesFromEnvironment: true,
      envName: 'NODEGX_SECRET_SITE_SETUP_TOKEN'
    });
    expect(out.severity).toBe('error');
    expect(out.message).toContain('NODEGX_SECRET_SITE_SETUP_TOKEN');
    expect(out.message).toContain('keep resolving it');
  });

  it('never claims a shadowed secret was simply removed', () => {
    const out = describeDeleteOutcome({
      name: 'K',
      existed: true,
      stillResolvesFromEnvironment: true,
      envName: 'NODEGX_SECRET_K'
    });
    // The failure this guards: a panel that says "deleted" over a credential
    // that still works.
    expect(out.message).not.toMatch(/fires its failure output/);
  });

  it('reports an ordinary removal as a dismissable notice', () => {
    const out = describeDeleteOutcome({
      name: 'K',
      existed: true,
      stillResolvesFromEnvironment: false,
      envName: 'NODEGX_SECRET_K'
    });
    expect(out.severity).toBe('notice');
    expect(out.message).toContain('was removed');
  });

  it('distinguishes "was not stored here" from "was removed"', () => {
    const out = describeDeleteOutcome({
      name: 'K',
      existed: false,
      stillResolvesFromEnvironment: false,
      envName: 'NODEGX_SECRET_K'
    });
    expect(out.severity).toBe('notice');
    expect(out.message).toContain('nothing changed');
  });

  it('gives the three outcomes three distinct messages', () => {
    const base = { name: 'K', envName: 'NODEGX_SECRET_K' };
    const messages = [
      describeDeleteOutcome({ ...base, existed: true, stillResolvesFromEnvironment: true }).message,
      describeDeleteOutcome({ ...base, existed: true, stillResolvesFromEnvironment: false }).message,
      describeDeleteOutcome({ ...base, existed: false, stillResolvesFromEnvironment: false }).message
    ];
    expect(new Set(messages).size).toBe(3);
  });
});

describe('SB-015 §6.4a the environment list excludes what the store shadows', () => {
  const secrets = [
    { name: 'SITE_SETUP_TOKEN', envName: 'NODEGX_SECRET_SITE_SETUP_TOKEN', alsoInEnvironment: true },
    { name: 'other', envName: 'NODEGX_SECRET_OTHER', alsoInEnvironment: false }
  ];

  it('drops a variable a stored secret already covers', () => {
    expect(
      environmentOnlyVariables(secrets, ['NODEGX_SECRET_SITE_SETUP_TOKEN', 'NODEGX_SECRET_STRIPE'])
    ).toEqual(['NODEGX_SECRET_STRIPE']);
  });

  it('keeps a variable nothing in the store shadows, because it resolves', () => {
    // The failure this guards: a panel that lists only the store reports
    // "not provisioned" about a function that works fine.
    expect(environmentOnlyVariables([], ['NODEGX_SECRET_STRIPE'])).toEqual(['NODEGX_SECRET_STRIPE']);
  });

  it('is empty when every variable is shadowed', () => {
    expect(environmentOnlyVariables(secrets, ['NODEGX_SECRET_SITE_SETUP_TOKEN'])).toEqual([]);
  });
});

describe('SB-015 §6.4a Save fires only on a complete, usable pair', () => {
  it('is allowed for a usable name and a value', () => {
    expect(canSave({ name: 'SITE_SETUP_TOKEN', value: 'v', busy: false })).toBe(true);
  });

  it.each([
    ['no name', { name: '', value: 'v', busy: false }],
    ['no value', { name: 'K', value: '', busy: false }],
    ['busy', { name: 'K', value: 'v', busy: true }],
    ['unusable name', { name: 'not a name', value: 'v', busy: false }]
  ])('is refused when %s', (_label, args) => {
    expect(canSave(args)).toBe(false);
  });
});

describe('SB-015 §6.4a a generated value is a usable credential', () => {
  /** Deterministic fill, so the assertions are about the encoding, not luck. */
  const fillWith = (byte: number) => (bytes: Uint8Array) => bytes.fill(byte);

  it('is base64url — no +, / or = to be mangled in a header or a URL', () => {
    for (const b of [0, 1, 62, 63, 251, 255]) {
      const value = generateSecretValue(fillWith(b));
      expect(value).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('draws 32 bytes, so it is long enough to be a real token', () => {
    let asked = 0;
    generateSecretValue((bytes) => {
      asked = bytes.length;
      bytes.fill(7);
    });
    expect(asked).toBe(32);
    // 32 bytes base64url, padding stripped.
    expect(generateSecretValue(fillWith(7))).toHaveLength(43);
  });

  it('is comfortably above the length the log scrubber will redact', () => {
    // MIN_SCRUBBABLE_LENGTH is 8; a generated value must never fall under it,
    // or it would be a credential the scrubber leaves in the logs.
    expect(generateSecretValue(fillWith(7)).length).toBeGreaterThanOrEqual(8);
  });

  it('actually varies with the bytes it is given', () => {
    expect(generateSecretValue(fillWith(1))).not.toBe(generateSecretValue(fillWith(2)));
  });
});
