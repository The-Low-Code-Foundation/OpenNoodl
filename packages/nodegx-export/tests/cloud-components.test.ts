import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';

const CHEER = path.join(__dirname, 'fixtures', 'cheer');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

/**
 * Cloud functions live under components/__cloud__ (legacyName "/#__cloud__/Name") and are
 * executed by the backend's interpreter. Before the walk excluded them, they were parsed as
 * browser components — planned, deferred node by node, and reported as frontend debris.
 */
describe('cloud function components are the backend’s, not the frontend export’s', () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-export-cloud-'));
    fs.cpSync(CHEER, projectDir, { recursive: true });
    const cloudDir = path.join(projectDir, 'components', '__cloud__', 'SendCheer');
    fs.mkdirSync(cloudDir, { recursive: true });
    fs.writeFileSync(
      path.join(cloudDir, 'component.json'),
      JSON.stringify({
        id: 'cloud-send-cheer',
        name: 'SendCheer',
        path: '/#__cloud__/SendCheer',
        type: 'component'
      })
    );
    fs.writeFileSync(
      path.join(cloudDir, 'nodes.json'),
      JSON.stringify({
        componentId: 'cloud-send-cheer',
        version: 1,
        nodes: [
          { id: 'req', type: 'noodl.cloud.request', parameters: {} },
          { id: 'res', type: 'noodl.cloud.response', parameters: {} }
        ],
        visualRoots: []
      })
    );
    fs.writeFileSync(path.join(cloudDir, 'connections.json'), JSON.stringify({ connections: [] }));
  });

  afterAll(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  test('the walk skips components/__cloud__ and records what it skipped', () => {
    const ir = parseProject(projectDir, catalog);
    expect(ir.components.map((c) => c.path)).not.toContain('__cloud__/SendCheer');
    expect(ir.project.cloudComponents).toEqual(['__cloud__/SendCheer']);
  });

  test('the emitted app carries the skip as one note, with no cloud files', () => {
    const app = emitApp(parseProject(projectDir, catalog), catalog);
    const cloudNotes = app.notes.filter((n) => n.includes('cloud function component'));
    expect(cloudNotes).toHaveLength(1);
    expect(cloudNotes[0]).toContain('__cloud__/SendCheer');
    expect(Object.keys(app.files).some((f) => f.includes('SendCheer'))).toBe(false);
  });

  test('a project with no cloud components reports none', () => {
    const ir = parseProject(CHEER, catalog);
    expect(ir.project.cloudComponents).toEqual([]);
  });
});
