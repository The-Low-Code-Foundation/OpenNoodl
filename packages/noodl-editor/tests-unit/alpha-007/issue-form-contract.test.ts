/**
 * ALPHA-007 acceptance criterion 3 — "a renamed `id` on either side is caught
 * by a test, not by a reporter filing an issue with an empty version field".
 *
 * GitHub issue forms are prefilled by query parameters named after the field
 * `id`s in the YAML, and dropdowns are matched on the **option text, verbatim**.
 * Neither side of that contract looks like code, so nothing else would notice a
 * rename: GitHub silently ignores a parameter it cannot place, the reporter
 * sees a half-filled form, and we get an issue with no version in it.
 *
 * So this asserts the editor's constants against the real
 * `.github/ISSUE_TEMPLATE/bug_report.yml` — the file that ships — rather than
 * against a fixture.
 */

import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

import {
  FIELD,
  FRESH_PROJECT_OPTIONS,
  OS_OPTIONS,
  SEVERITY_OPTIONS,
  SURFACE_OPTIONS,
  osOptionFor
} from '../../src/editor/src/utils/report/issueForm';

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..');
const FORM_PATH = path.join(REPO_ROOT, '.github', 'ISSUE_TEMPLATE', 'bug_report.yml');

type FormField = {
  type: string;
  id?: string;
  attributes?: { options?: string[]; label?: string; render?: string };
  validations?: { required?: boolean };
};

const form = yaml.load(fs.readFileSync(FORM_PATH, 'utf8')) as { body: FormField[]; labels?: string[] };
const fields = form.body.filter((entry) => Boolean(entry.id));
const byId = new Map(fields.map((entry) => [entry.id as string, entry]));

describe('bug_report.yml is where the editor thinks it is', () => {
  it('exists and parses', () => {
    expect(fields.length).toBeGreaterThan(5);
  });

  it.each(Object.entries(FIELD))('declares the `%s` field the editor prefills (%s)', (_name, id) => {
    expect(byId.has(id)).toBe(true);
  });
});

describe('dropdown values the editor emits exist verbatim in the form', () => {
  const optionsFor = (id: string) => {
    const field = byId.get(id);
    expect(field).toBeDefined();
    expect(field?.type).toBe('dropdown');
    return field?.attributes?.options || [];
  };

  it('surface', () => {
    expect(optionsFor(FIELD.surface)).toEqual(SURFACE_OPTIONS.slice());
  });

  it('os', () => {
    expect(optionsFor(FIELD.os)).toEqual(OS_OPTIONS.slice());
  });

  it('fresh-project', () => {
    expect(optionsFor(FIELD.freshProject)).toEqual(FRESH_PROJECT_OPTIONS.slice());
  });

  it('severity', () => {
    expect(optionsFor(FIELD.severity)).toEqual(SEVERITY_OPTIONS.map((option) => option.label));
  });
});

describe('the os mapping covers every platform Electron can report', () => {
  const options = OS_OPTIONS.slice();

  it.each([
    ['darwin', 'arm64', 'macOS (Apple Silicon)'],
    ['darwin', 'x64', 'macOS (Intel)'],
    ['win32', 'x64', 'Windows'],
    ['win32', 'arm64', 'Windows'],
    ['linux', 'x64', 'Linux'],
    // Electron does not ship for these, but a source build might run there and a
    // report from one should still be filable rather than blocked by a required
    // dropdown with no matching value.
    ['freebsd', 'x64', 'Linux']
  ])('%s/%s -> %s', (platform, arch, expected) => {
    const value = osOptionFor(platform, arch);
    expect(value).toBe(expected);
    expect(options).toContain(value);
  });
});

describe('the fields the app fills are the ones the form requires', () => {
  it('every required field is one the composer supplies a value for', () => {
    const required = fields
      .filter((field) => field.validations && field.validations.required)
      .map((field) => field.id as string);

    // `anything-else` and `steps` are optional; everything required must be
    // either typed in the dialog or captured. If a new required field appears
    // in the YAML and the dialog does not fill it, the reporter is blocked at
    // GitHub with no way to know why — so this fails here instead.
    const supplied = Object.values(FIELD) as string[];
    for (const id of required) expect(supplied).toContain(id);
  });

  it('diagnostics is a json-fenced textarea and is not required', () => {
    const field = byId.get(FIELD.diagnostics);
    expect(field?.type).toBe('textarea');
    expect(field?.attributes?.render).toBe('json');
    expect(field?.validations?.required).toBeFalsy();
  });

  it('errors is a text-fenced textarea', () => {
    expect(byId.get(FIELD.errors)?.attributes?.render).toBe('text');
  });
});

describe('the labels the form declares', () => {
  it('still names needs-triage, which F72 says does not exist on the repo yet', () => {
    // Not a check of GitHub — that needs the network. It pins the *claim*, so
    // that if someone removes the declaration the script in
    // `scripts/alpha-007/create-labels.sh` stops being the fix for F72 and
    // somebody has to think about it.
    expect(form.labels).toContain('needs-triage');
  });
});
