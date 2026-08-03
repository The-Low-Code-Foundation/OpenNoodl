/**
 * POL-001 — a project whose `project.json` carries no `settings` block must
 * still load with `settings` as an object.
 *
 * The constructor used to do `this.settings = args.settings` unconditionally,
 * so `undefined` won the assignment and every direct `.settings[...]` read
 * threw. `SitemapSection` was the one in the crash trace; `DeploySection` and
 * the sitemap build pass would each have thrown next.
 */

import { buildProjectV2File, LegacyProject } from '../../src/editor/src/io/ProjectExporter';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';

describe('ProjectModel settings', () => {
  it('is an object when constructed with no args at all', () => {
    const project = new ProjectModel();
    expect(typeof project.settings).toBe('object');
    expect(project.settings).not.toBe(null);
    expect(project.getSettings()).toEqual({});
  });

  it('is an object when args carry no settings block', () => {
    const project = new ProjectModel({ name: 'no-settings-key' });
    expect(project.settings).toEqual({});
    expect(project.getSettings()).toEqual({});
  });

  it('survives an explicit undefined settings key', () => {
    const project = new ProjectModel({ name: 'explicit-undefined', settings: undefined });
    expect(project.settings).toEqual({});
  });

  it('keeps the settings it was given', () => {
    const project = new ProjectModel({ name: 'has-settings', settings: { 'sitemap.enabled': true } });
    expect(project.getSettings()['sitemap.enabled']).toBe(true);
  });

  it('reads the way the settings panel reads, without throwing', () => {
    // The exact shape of the four read sites fixed in POL-001.
    const project = new ProjectModel({ name: 'panel-read' });
    expect(() => {
      const s = project.getSettings();
      return [s['sitemap.enabled'], s['deployEnvDate'], s['deployEnvGitStats'], s['baseUrl']];
    }).not.toThrow();
  });

  it('setSettings(undefined) leaves an object rather than clearing the field', () => {
    const project = new ProjectModel({ name: 'cleared', settings: { a: 1 } });
    project.setSettings(undefined);
    expect(project.settings).toEqual({});
    expect(() => project.setSetting('a', 2)).not.toThrow();
    expect(project.getSettings()['a']).toBe(2);
  });
});

/**
 * POL-001 slice 2 — where the key goes.
 *
 * It is not lost. The v2 format deliberately elides empty collections on BOTH
 * sides (see roundtrip-fidelity.test.ts's normalisation note), so the
 * `settings: {}` the hello-world template writes does not survive v2 adoption —
 * by design, and losing nothing. The defect was entirely in the constructor
 * reading absent-as-undefined instead of absent-as-empty.
 *
 * These pin the contract, so that "settings went missing" is never re-diagnosed
 * as an export bug.
 */
describe('ProjectModel settings — the v2 elision that exposed the crash', () => {
  const NOW = '2026-08-03T00:00:00.000Z';

  function legacy(settings: Record<string, unknown> | undefined): LegacyProject {
    return { name: 'p', version: '4', components: [], settings } as unknown as LegacyProject;
  }

  it('omits an empty settings object from nodegx.project.json', () => {
    expect(buildProjectV2File(legacy({}), NOW).settings).toBeUndefined();
  });

  it('keeps a settings block that has anything in it', () => {
    expect(buildProjectV2File(legacy({ 'sitemap.enabled': true }), NOW).settings).toEqual({
      'sitemap.enabled': true
    } as never);
  });

  it('a project loaded from that elided file still has an object', () => {
    const file = buildProjectV2File(legacy({}), NOW);
    const project = new ProjectModel({ name: file.name, settings: file.settings });
    expect(project.settings).toEqual({});
  });
});
