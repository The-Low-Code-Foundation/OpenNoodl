/**
 * BCN orchestrator driver — the two checks only the primary checkout can run.
 *
 *  1. **An export/deploy of a converged project.** BCN-009's criterion is "a *deployed*
 *     app resolves its backend from the unified metadata", and every check so far has
 *     been in-process. This runs the editor's *real* exporter (`Exporter.exportToJSON`
 *     with a real `environment`, exactly as `deployToFolder` does), serves the result
 *     with the deployed runtime, and loads it in a real browser.
 *
 *  2. **The Repeater's actual React rendering with a numeric `objectId`.** The data path
 *     is proven (Model store, `Collection.set` diff, `Record Id` round-trip); the render
 *     is not, and it needs a rendered React tree. Directus hands back integer ids, so a
 *     Query Records → Repeater over `bcnorch` renders rows whose ids are numbers.
 *
 * Bootstrapping is noodl-preview's — see `headless.ts`. What is deliberately NOT reused
 * is `loadPreview`, because it passes `environment: null` to blank the cloud-services
 * metadata (a local preview must not inherit a deployed backend). That is the opposite
 * of what check 1 needs, so the export call here is made directly.
 */

import * as fs from 'fs';
import * as path from 'path';

// Must be first — binds @noodl/platform and populates NodeLibrary before any editor
// module is touched. See noodl-preview/src/headless.ts.
import { bootstrapNodeLibrary } from '@preview/headless';

import { ProjectModel } from '@noodl-models/projectmodel';
import * as Exporter from '@noodl-utils/exporter';
import { PreviewServer } from '@preview/server';
import { HtmlProcessor } from '@noodl-utils/compilation/build/processors/html-processor';
const DEPLOY_DIR = '/Users/richardosborne/vscode_projects/OpenNoodl/packages/noodl-editor/src/external/deploy';
const deployAssetPath = (f: string) => require('path').join(DEPLOY_DIR, f);

type Any = any;

// The CORS proxy in front of the rig's Directus. Deliberately NOT the same URL as
// the baked `cloudservices` endpoint below -- see DEAD_ENDPOINT.
const DIRECTUS = process.env.DIRECTUS_URL || 'http://127.0.0.1:8578';

// The endpoint the exporter bakes into `cloudservices`. It points at nothing, on
// purpose: if the deployed app reads its backend from the CONVERGED selection, it
// never touches this. If it falls back to the endpoint -- which is what an ungated
// `defaultBackendId` would do, and what a pre-BCN-009 runtime did -- the app reaches
// a dead port and renders no rows. Same-URL would have made this check vacuous in
// exactly the way BCN-004 step 6's routing check was: 95 per-backend checks stayed
// green with `backendId` disabled entirely.
const DEAD_ENDPOINT = 'http://127.0.0.1:9111';
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || '';
const NS = 'bcnorch';

/** A sentinel that must NOT reach a deployed bundle, per `types.ts`'s own promise. */
const ADMIN_TOKEN_SENTINEL = 'ADMIN-TOKEN-MUST-NOT-SHIP-c0ffee';

let pass = 0;
let fail = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` + (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`));
}
function note(label: string, value: unknown) {
  console.log(`      · ${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
}

// ── The project ───────────────────────────────────────────────────────────────
//
// A converged project: `backendServices.version = 2` with an `activeBackendId`
// naming a Directus backend, and NO `cloudservices` endpoint. Under BCN-009 step 2
// + its three runtime follow-ups (gated on `version >= 2`), a deployed app must
// resolve the record nodes from that selection.

const BACKEND_ID = 'backend_bcnorch_directus';

function projectJSON() {
  return {
    name: 'BCN Orchestrator Export Check',
    id: 'bcn-orch-export',
    version: '4',
    rootNodeId: 'root_group',
    settings: { htmlTitle: 'BCN Export Check' },
    components: [
      {
        name: '/App',
        id: 'c_app',
        graph: {
          roots: [
            {
              id: 'root_group',
              type: 'Group',
              label: 'Root',
              x: 0,
              y: 0,
              parameters: {},
              ports: [],
              children: [
                {
                  id: 'repeater',
                  type: 'For Each',
                  label: 'Repeater',
                  x: 0,
                  y: 200,
                  parameters: { template: '/RecordRow', templateType: 'explicit' },
                  ports: [],
                  children: []
                }
              ]
            },
            {
              id: 'query',
              type: 'DbCollection2',
              label: 'Query',
              x: 500,
              y: 0,
              // WARNING: leaving `backendId` UNSET is the whole point, and setting it was
              // the first version's vacuity. `resolveBackendTarget` short-circuits on an
              // explicit id -- `wanted = backendId` -- so `defaultBackendId`, where the
              // `version >= 2` converged-selection gate lives, is never consulted. With an
              // explicit id the version-marker mutation changed nothing, which is how the
              // vacuity was caught. Unset means `_active_`, which is the criterion:
              // "a deployed app resolves its backend from the unified metadata".
              parameters:
                process.env.BCN_EXPLICIT_BACKEND === '1'
                  ? { collectionName: NS, backendId: BACKEND_ID }
                  : process.env.BCN_EXPLICIT_BACKEND === 'active'
                    ? { collectionName: NS, backendId: '_active_' }
                    : { collectionName: NS },
              ports: [],
              children: []
            }
          ],
          connections: [{ fromId: 'query', fromProperty: 'items', toId: 'repeater', toProperty: 'items' }]
        }
      },
      {
        name: '/RecordRow',
        id: 'c_row',
        graph: {
          roots: [
            {
              id: 'row_group',
              type: 'Group',
              label: 'Row',
              x: 300,
              y: 0,
              parameters: {},
              ports: [],
              children: [
                { id: 'row_id', type: 'Text', x: 0, y: 0, parameters: {}, ports: [], children: [] },
                { id: 'row_title', type: 'Text', x: 0, y: 100, parameters: {}, ports: [], children: [] }
              ]
            },
            {
              id: 'ci',
              type: 'Component Inputs',
              x: 0,
              y: 0,
              parameters: {},
              ports: [
                { name: 'Id', plug: 'output', type: { name: '*' }, index: 0 },
                { name: 'title', plug: 'output', type: { name: '*' }, index: 1 }
              ],
              children: []
            }
          ],
          connections: [
            { fromId: 'ci', fromProperty: 'Id', toId: 'row_id', toProperty: 'text' },
            { fromId: 'ci', fromProperty: 'title', toId: 'row_title', toProperty: 'text' }
          ]
        }
      }
    ],
    metadata: {
      backendServices: {
        // BCN_MUTATE=version1 drops the converged marker, which must make the app
        // fall back to the (dead) endpoint. That is the mutation that proves this
        // check discriminates.
        ...(process.env.BCN_MUTATE === 'version1' ? {} : { version: 2 }),
        activeBackendId: BACKEND_ID,
        backends: [
          {
            id: BACKEND_ID,
            name: 'Directus (bcnorch)',
            type: 'directus',
            url: DIRECTUS,
            auth: {
              method: 'bearer',
              // The type's own comment: "This token is NOT published to the deployed app."
              adminToken: ADMIN_TOKEN_SENTINEL,
              // The type's own comment: "This token WILL be published."
              publicToken: DIRECTUS_TOKEN
            },
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z'
          }
        ]
      }
    }
  };
}

async function main() {
  const types = bootstrapNodeLibrary();
  note('node library types', types);

  const dir = path.join(__dirname, 'orch-project');
  fs.mkdirSync(dir, { recursive: true });
  const legacy = projectJSON();
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(legacy, null, 2));

  const project = ProjectModel.fromJSON(legacy as Any);
  (project as Any)._retainedProjectDirectory = dir;

  check('the project has a root node', !!project.getRootNode(), true);

  // ── Check 1: the real deploy export ────────────────────────────────────────
  //
  // The same call `deployToFolder` makes, with a real environment rather than the
  // preview's `null`.
  const environment = {
    id: 'env_bcnorch',
    url: DEAD_ENDPOINT,
    appId: 'bcnorch-app',
    type: 'directus'
  };

  const exportJson = Exporter.exportToJSON(project as Any, {
    useBundles: true,
    useBundleHashes: true,
    environment: environment as Any
  }) as Any;

  check('the exporter produced an export', !!exportJson, true);

  const serialised = JSON.stringify(exportJson);

  // BCN-009's criterion — the unified selection must survive an export.
  check(
    'export metadata carries backendServices',
    !!exportJson.metadata?.backendServices,
    true
  );
  check(
    'export metadata carries the converged activeBackendId',
    exportJson.metadata?.backendServices?.activeBackendId,
    BACKEND_ID
  );
  check(
    'export metadata carries the selection version marker',
    exportJson.metadata?.backendServices?.version,
    2
  );
  check(
    "the Query node's backendId parameter survives the export",
    findParam(exportJson, 'DbCollection2', 'backendId'),
    process.env.BCN_EXPLICIT_BACKEND === '1' ? BACKEND_ID : undefined
  );

  // The security question the type declares an answer to.
  const adminTokenShipped = serialised.includes(ADMIN_TOKEN_SENTINEL);
  note('adminToken present in export JSON', adminTokenShipped);
  check(
    "the adminToken is NOT published to the deployed app (types.ts:59's own promise)",
    adminTokenShipped,
    false
  );

  note('cloudservices in export', exportJson.metadata?.cloudservices);

  // Instrument check before believing the backendId result: dump what the export
  // actually holds for the Query node, and what shape the components take.
  fs.writeFileSync(path.join(__dirname, 'export.json'), JSON.stringify(exportJson, null, 2));
  note('export component names', (exportJson.components ?? []).map((c: Any) => c.name));
  const appComp = (exportJson.components ?? []).find((c: Any) => c.name === '/App');
  note('/App exported node types', (appComp?.nodes ?? []).map((n: Any) => n.type));
  const q = (appComp?.nodes ?? []).find((n: Any) => n.type === 'DbCollection2');
  note('exported Query node', q);

  // ── Build a deployed bundle and serve it ───────────────────────────────────
  const bundles: Record<string, string> = {};
  for (const bundleId of Object.keys(exportJson.componentIndex ?? {})) {
    bundles[bundleId] = JSON.stringify(
      Exporter.exportComponentBundle(project as Any, bundleId, exportJson.componentIndex)
    );
  }
  const template = fs.readFileSync(deployAssetPath('index.html'), 'utf8');
  const html = await new HtmlProcessor(project as Any).process(template, {
    baseUrl: '/',
    indexJsPath: 'index.js'
  });

  const server = new PreviewServer({ projectDir: dir, port: 8577, host: '127.0.0.1' });
  server.setBuild({
    projectName: 'BCN Orchestrator Export Check',
    exportJson,
    bundles,
    html,
    warnings: []
  } as Any);
  const port = await server.listen();
  console.log(`SERVING http://127.0.0.1:${port}/`);

  // Held open for the browser driver; killed by the caller.
  await new Promise(() => undefined);
}

/** First value of `param` on any node of type `type`, anywhere in the export. */
function findParam(exportJson: Any, type: string, param: string): unknown {
  let found: unknown;
  const walk = (nodes: Any[]) => {
    for (const n of nodes ?? []) {
      if (n.type === type && n.parameters && param in n.parameters) found ??= n.parameters[param];
      walk(n.children);
    }
  };
  // WARNING: the EXPORT format is not the project format. A component exports as
  // {name, nodes, connections, ports, roots} -- a FLAT `nodes` array with `roots`
  // as a list of *ids* -- where the project format nests under `graph.roots`. The
  // first version of this walker read `graph.roots`, found nothing, and reported
  // `backendId` as dropped by the exporter. It is not: it survives verbatim.
  for (const c of exportJson.components ?? []) walk(c.nodes);
  return found;
}

main().catch((e) => {
  console.error('DRIVER ERROR', e);
  process.exit(1);
});
