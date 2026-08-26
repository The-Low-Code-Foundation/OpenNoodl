/**
 * FB-005 T3 — the community install path, driven over a **real socket** onto a **real disk**.
 *
 * ## 🔴 Why this file exists beside `template-shelf.test.ts`
 *
 * That file grades `PlatformTemplateProvider` against an injected `TemplateSource` and an injected
 * filesystem — which means the two things a template install actually consists of, *reading a
 * response off a wire* and *writing files to a disk*, are both stubbed. Every decision is graded
 * and neither mechanism is. `communityapi`'s own header records what that costs: `externalId` was
 * declared, read, and `undefined` on every request for months, because *"TypeScript checks the
 * declaration against the consumers and never against the wire"*.
 *
 * So this file removes both fakes. A real `http.Server` answers the two routes; the provider is
 * given a real `CommunityApiClient` pointed at it; the files land in a real temporary directory
 * and are read back with `node:fs`.
 *
 * ⚠️ **What is still not real: the route handler.** The server here answers with the envelope
 * `nodegx-community` produces (`{ item: … }` / `{ items: … }`), which is a claim about the
 * platform, not a measurement of it. That half is gated over there by `nat006-api-contract` and
 * `uni011-mirror-api`, which drive the real handlers with seeded rows. **What no gate in either
 * repo covers is the two meeting**, and this file does not close that either — it narrows it to
 * the envelope shape alone.
 */

import { createServer, type Server } from 'http';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { mkdir, writeFile } from 'fs/promises';

import { CommunityApiClient } from '@noodl-models/community/communityapi';
import { PlatformTemplateProvider, type TemplateWriteFs } from '@noodl-models/template/PlatformTemplateProvider';

/**
 * A real filesystem behind the provider's narrow interface.
 *
 * ⚠️ Not `@noodl/platform`'s — that resolves an Electron implementation this runner has no
 * business loading. What it proves is the provider's own write loop against a real disk: that the
 * parents get made, that nesting works, and that the bytes arrive.
 */
const realFs: TemplateWriteFs = {
  join: (...parts) => join(...parts),
  dirname: (p) => dirname(p),
  makeDirectory: async (p) => {
    await mkdir(p, { recursive: true });
  },
  writeFile: async (p, contents) => {
    await writeFile(p, contents, 'utf8');
  }
};

type Routes = Record<string, { status: number; body: unknown }>;

function serve(routes: Routes): Promise<{ server: Server; baseUrl: string; hits: string[] }> {
  const hits: string[] = [];
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = req.url ?? '';
      hits.push(path);
      const route = routes[path];
      if (!route) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end('{}');
        return;
      }
      res.writeHead(route.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(route.body));
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}`, hits });
    });
  });
}

const BUNDLE = {
  slug: 'starter-crm',
  title: 'Starter CRM',
  version: 3,
  updatedAt: '2026-08-26T00:00:00.000Z',
  files: {
    'project.json': '{"name":"Starter CRM"}',
    'components/pages/Home.json': '{"id":"home"}',
    'README.md': '# Starter CRM\n'
  }
};

const SHELF = {
  items: [
    {
      slug: 'starter-crm',
      title: 'Starter CRM',
      summary: 'Contacts, companies and a deal board.',
      category: 'data-app',
      version: 3,
      fileCount: 3,
      updatedAt: '2026-08-26T00:00:00.000Z'
    }
  ]
};

describe('FB-005 T3 — a community template over a real socket, onto a real disk', () => {
  let server: Server;
  let baseUrl: string;
  let hits: string[];
  let workspace: string;

  beforeEach(async () => {
    ({ server, baseUrl, hits } = await serve({
      '/api/v1/community/templates': { status: 200, body: SHELF },
      '/api/v1/community/templates/starter-crm/bundle': { status: 200, body: { item: BUNDLE } }
    }));
    workspace = mkdtempSync(join(tmpdir(), 'fb005-'));
  });

  afterEach(async () => {
    await new Promise<void>((done) => server.close(() => done()));
    rmSync(workspace, { recursive: true, force: true });
  });

  const provider = () =>
    new PlatformTemplateProvider({
      source: async () => new CommunityApiClient({ baseUrl }),
      fs: async () => realFs
    });

  it('lists the shelf off the wire', async () => {
    const items = await provider().list();
    expect(items).toEqual([
      {
        title: 'Starter CRM',
        desc: 'Contacts, companies and a deal board.',
        category: 'data-app',
        iconURL: '',
        projectURL: 'community://starter-crm'
      }
    ]);
    expect(hits).toEqual(['/api/v1/community/templates']);
  });

  it('installs the project into a directory that did not exist', async () => {
    const destination = join(workspace, 'My Project');
    await provider().install('community://starter-crm', destination);

    expect(readFileSync(join(destination, 'project.json'), 'utf8')).toBe('{"name":"Starter CRM"}');
    expect(readFileSync(join(destination, 'README.md'), 'utf8')).toBe('# Starter CRM\n');
    // 🔴 The nested entry, whose parent directory the bundle never names. `makeDirectory` on each
    // file's dirname is what makes that work, and a stub filesystem cannot fail this.
    expect(readFileSync(join(destination, 'components/pages/Home.json'), 'utf8')).toBe('{"id":"home"}');
  });

  it('asks for the bundle route, encoded, and nothing else', async () => {
    await provider().install('community://starter-crm', join(workspace, 'p'));
    expect(hits).toEqual(['/api/v1/community/templates/starter-crm/bundle']);
  });

  it('WRITES NOTHING when the platform answers 404 — AC2, over a real socket', async () => {
    // 🔴 The route is absent from this server, so this is a genuine 404 from a genuine HTTP
    // stack, not a hand-built `{ outcome: 'absent' }`.
    const destination = join(workspace, 'gone');
    await expect(provider().install('community://not-published', destination)).rejects.toThrow(
      /no longer on the community shelf/
    );
    expect(existsSync(destination)).toBe(false);
  });

  it('writes nothing when a bundle carries a traversing path', async () => {
    // The check that protects THIS MACHINE, run against a response that really arrived over a
    // socket. `isSafeBundleEntry`'s comment: a validator on the far side of a wire is a claim
    // about a server, not a gate on a disk.
    await new Promise<void>((done) => server.close(() => done()));
    ({ server, baseUrl, hits } = await serve({
      '/api/v1/community/templates/evil/bundle': {
        status: 200,
        body: { item: { ...BUNDLE, slug: 'evil', files: { 'project.json': '{}', '../escaped.txt': 'x' } } }
      }
    }));

    const destination = join(workspace, 'evil');
    await expect(provider().install('community://evil', destination)).rejects.toThrow(/not a relative path/);
    expect(existsSync(destination)).toBe(false);
    expect(existsSync(join(workspace, 'escaped.txt'))).toBe(false);
  });

  it('control: the same server DOES install a bundle with only safe paths', async () => {
    // 🔴 Without this arm, "nothing escaped" is satisfied by a provider that writes nothing ever.
    const destination = join(workspace, 'good');
    await provider().install('community://starter-crm', destination);
    expect(existsSync(join(destination, 'project.json'))).toBe(true);
  });
});
