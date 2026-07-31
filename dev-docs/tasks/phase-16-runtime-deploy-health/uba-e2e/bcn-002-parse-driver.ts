/**
 * BCN-002 — the live pass, both directions.
 *
 * Drives the **real `ParseWireAdapter`** (bundled from `noodl-runtime` sources,
 * not reimplemented) against two servers that speak the same wire:
 *
 *   - `nodegx-backend` on 8093 — our own, started with `serve --data-dir …`
 *   - upstream `parseplatform/parse-server:7.3.0` on 8092 — the `parse` profile
 *
 * **Why both, and why the second one is the point.** A green pass against our
 * own backend proves the adapter's shape and nothing about upstream Parse. It
 * is a safety net and a trap at once, and BCN-001 shipped ~15 `parse` descriptor
 * cells reading "documented, not probed" precisely because no second server
 * existed. Every difference this run finds is a cell that was a reading of the
 * Parse docs and is now a measurement.
 *
 * The probe set is BCN-002 step 5's: query with a filter, create, save, delete,
 * addRelation, uploadFile, signFileUrl — plus count, distinct, aggregate,
 * increment and fetch, because they are the same trip and the descriptor needs
 * them.
 *
 * Run:
 *   docker compose --profile parse up -d
 *   (cd ../../../../packages/nodegx-backend && node bin/nodegx-backend.js serve --data-dir /tmp/bcn002-backend --port 8093 &)
 *   node build-bcn-002.mjs && node bcn-002-parse-driver.cjs
 *
 * Recorded output: BCN-002-PARSE-WIRE-OUTPUT.txt.
 */

import { ParseWireAdapter } from '../../../../packages/noodl-runtime/src/api/backends/ParseWireAdapter';
import type { BackendHandle } from '@noodl/backend-contract';

// The adapter picks its request branch on this global: absent means "browser,
// use XHR", present means "cloud runtime, use fetch". Node has no XHR, so the
// fetch branch is the one under test here. `_noodl_cloudservices` is left
// undefined on purpose — that is the branch where the handle actually decides
// the endpoint, which is the whole seam BCN-002 introduced.
(globalThis as Record<string, unknown>)._noodl_cloud_runtime_version = 'bcn-002-driver';

interface Target {
  label: string;
  handle: BackendHandle;
  /** Master key, when the probe needs to ask what a privileged client can do. */
  masterKey?: string;
}

const NODEGX: Target = {
  label: 'nodegx-backend (ours, :8093)',
  handle: {
    id: 'nodegx',
    type: 'nodegx',
    name: 'Built-in',
    url: 'http://127.0.0.1:8093',
    publicToken: 'bcn-002-probe'
  }
};

const PARSE: Target = {
  label: 'parse-server 7.3.0 (upstream, :8092)',
  handle: {
    id: 'parse',
    type: 'parse',
    name: 'Parse Server',
    url: 'http://localhost:8092/parse',
    publicToken: 'uba-e2e-app'
  },
  masterKey: 'uba-e2e-master-key'
};

// ── reporting ──────────────────────────────────────────────────────────────

let checks = 0;
const differences: string[] = [];

function hr(title: string) {
  console.log('\n' + '═'.repeat(74));
  console.log(title);
  console.log('═'.repeat(74));
}

function sub(title: string) {
  console.log('\n── ' + title + ' ' + '─'.repeat(Math.max(0, 70 - title.length)));
}

function line(target: Target, label: string, outcome: string) {
  checks++;
  console.log(`  ${label.padEnd(30)} ${outcome}`);
}

/** Promisify one adapter call so the probe reads top to bottom. */
function call<T>(fn: (cb: { success: (...a: unknown[]) => void; error: (e?: unknown) => void }) => void): Promise<
  { ok: true; value: T } | { ok: false; error: unknown }
> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: { ok: true; value: T } | { ok: false; error: unknown }) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    fn({
      success: (...args: unknown[]) => done({ ok: true, value: (args.length > 1 ? args : args[0]) as T }),
      error: (e?: unknown) => done({ ok: false, error: e })
    });
    // An adapter that neither calls back is a finding, not a hang.
    setTimeout(() => done({ ok: false, error: 'no callback within 10s' }), 10_000);
  });
}

function describe(r: { ok: boolean; value?: unknown; error?: unknown }, maxLen = 160): string {
  const payload = r.ok ? r.value : r.error;
  let s: string;
  try {
    s = typeof payload === 'string' ? payload : JSON.stringify(payload);
  } catch {
    s = String(payload);
  }
  if (s === undefined) s = 'undefined';
  if (s.length > maxLen) s = s.slice(0, maxLen) + ' …';
  return `${r.ok ? 'OK  ' : 'ERR '} ${s}`;
}

function makeAdapter(target: Target) {
  return new ParseWireAdapter({
    // The driver sends plain JSON, so the Model-aware serialiser is not needed.
    // Its absence is fine here and is NOT a claim that pointers and dates round
    // trip — `cloudstore.js` supplies the real one, and that path is covered by
    // the unit suite and by driving the editor.
    serializeObject: (data) => data,
    // Both servers are modern; the sub-5 fork is covered by a unit test.
    getServerVersionMajor: () => 5
  });
}

// ── the probe ──────────────────────────────────────────────────────────────

async function probe(target: Target) {
  hr(target.label);
  const a = makeAdapter(target);
  const h = target.handle;
  const collection = 'Bcn002Post';
  const authorCollection = 'Bcn002Author';

  sub('create');
  const created = await call<Record<string, unknown>>((cb) =>
    a.create(h, { collection, data: { title: 'first', views: 10, tag: 'red' }, ...cb } as never)
  );
  line(target, 'create', describe(created));
  const objectId = created.ok ? (created.value as { objectId?: string }).objectId : undefined;

  const second = await call<Record<string, unknown>>((cb) =>
    a.create(h, { collection, data: { title: 'second', views: 25, tag: 'blue' }, ...cb } as never)
  );
  line(target, 'create (second row)', describe(second));

  sub('read');
  const fetched = await call<Record<string, unknown>>((cb) =>
    a.fetch(h, { collection, objectId: objectId as string, ...cb } as never)
  );
  line(target, 'fetch', describe(fetched));
  // The BCN-002 claim under test: whatever the wire called it, the caller reads
  // the identity at the contract's name.
  const identityOk = fetched.ok && typeof (fetched.value as { objectId?: unknown }).objectId === 'string';
  line(target, 'identity is `objectId`', identityOk ? 'OK   contract name present' : 'ERR  missing');

  const queried = await call<unknown>((cb) =>
    a.query(h, { collection, where: { views: { $gt: 20 } }, ...cb } as never)
  );
  line(target, 'query (filtered, $gt)', describe(queried));

  const counted = await call<number>((cb) => a.count(h, { collection, ...cb } as never));
  line(target, 'count', describe(counted));

  const distinct = await call<unknown>((cb) => a.distinct(h, { collection, property: 'tag', ...cb } as never));
  line(target, 'distinct', describe(distinct));

  const aggregated = await call<unknown>((cb) =>
    a.aggregate(h, { collection, group: { total: { sum: 'views' } }, ...cb } as never)
  );
  line(target, 'aggregate (no master key)', describe(aggregated));

  sub('write');
  const saved = await call<Record<string, unknown>>((cb) =>
    a.save(h, { collection, objectId: objectId as string, data: { title: 'first, edited' }, ...cb } as never)
  );
  line(target, 'save', describe(saved));

  const incremented = await call<Record<string, unknown>>((cb) =>
    a.increment(h, { collection, objectId: objectId as string, properties: { views: 5 }, ...cb } as never)
  );
  line(target, 'increment', describe(incremented));

  sub('relations');
  const author = await call<Record<string, unknown>>((cb) =>
    a.create(h, { collection: authorCollection, data: { name: 'Ada' }, ...cb } as never)
  );
  line(target, 'create (relation target)', describe(author));
  const authorId = author.ok ? (author.value as { objectId?: string }).objectId : undefined;

  const related = await call<unknown>((cb) =>
    a.addRelation(h, {
      collection,
      objectId: objectId as string,
      key: 'authors',
      targetObjectId: authorId as string,
      targetClass: authorCollection,
      ...cb
    } as never)
  );
  line(target, 'addRelation', describe(related));

  const unrelated = await call<unknown>((cb) =>
    a.removeRelation(h, {
      collection,
      objectId: objectId as string,
      key: 'authors',
      targetObjectId: authorId as string,
      targetClass: authorCollection,
      ...cb
    } as never)
  );
  line(target, 'removeRelation', describe(unrelated));

  sub('files');
  // The fetch branch JSON-stringifies `content`, so this uploads a JSON body
  // rather than a binary. Both servers are being asked the same question —
  // "does this route exist and will you take an upload from a client holding
  // only the app id" — and that is the capability cell, not the encoding.
  const uploaded = await call<{ name?: string; url?: string }>((cb) =>
    a.uploadFile(h, { file: { name: 'bcn002.txt', type: 'text/plain' }, data: undefined, ...cb } as never)
  );
  line(target, 'uploadFile', describe(uploaded));

  const uploadedName = uploaded.ok ? uploaded.value?.name : undefined;
  const signed = await call<unknown>((cb) =>
    a.signFileUrl(h, { name: (uploadedName as string) || 'bcn002.txt', ...cb } as never)
  );
  line(target, 'signFileUrl', describe(signed));

  const deletedFile = await call<unknown>((cb) =>
    a.deleteFile(h, { file: { name: (uploadedName as string) || 'bcn002.txt' }, ...cb } as never)
  );
  line(target, 'deleteFile', describe(deletedFile));

  sub('delete');
  const deleted = await call<void>((cb) =>
    a.delete(h, { collection, objectId: objectId as string, ...cb } as never)
  );
  line(target, 'delete', describe(deleted));

  sub('events fired by the adapter');
  const seen: string[] = [];
  for (const type of ['create', 'save', 'delete', 'fetch'] as const) {
    a.on(type, (e) => seen.push(`${e.type}:${e.collection}`));
  }
  const eventProbe = await call<Record<string, unknown>>((cb) =>
    a.create(h, { collection, data: { title: 'event probe' }, ...cb } as never)
  );
  line(target, 'create emits `create`', seen.length > 0 ? `OK   ${seen.join(', ')}` : 'ERR  no event');
  if (eventProbe.ok) {
    const evId = (eventProbe.value as { objectId?: string }).objectId;
    await call<void>((cb) => a.delete(h, { collection, objectId: evId as string, ...cb } as never));
  }

  return {
    aggregateWithoutMasterKey: aggregated.ok,
    distinctWithoutMasterKey: distinct.ok,
    uploadWithoutSession: uploaded.ok,
    signSupported: signed.ok,
    increment: incremented.ok,
    relations: related.ok
  };
}

/**
 * The questions that need the master key.
 *
 * BCN-001 gave `nodegx` and `parse` separate descriptor columns because our
 * backend serves `/aggregate` under ordinary ACLs while upstream Parse restricts
 * it. The anonymous calls above failing on Parse is only half the evidence; this
 * is what shows they failed *for that reason* rather than because the route,
 * the class or the rig was wrong.
 *
 * These go through raw `fetch` rather than the adapter deliberately. The adapter
 * has no way to send a master key from a browser and must not grow one — this is
 * a question about the server, not about our client.
 */
async function masterKeyProbes(target: Target) {
  if (!target.masterKey) {
    console.log('  n/a — no master key configured for this target');
    return;
  }

  const headers = {
    'X-Parse-Application-Id': target.handle.publicToken as string,
    'X-Parse-Master-Key': target.masterKey
  };

  const probes: [string, string][] = [
    [
      'aggregate',
      `/aggregate/Bcn002Post?$group=${encodeURIComponent(JSON.stringify({ total: { $sum: '$views' }, _id: null }))}`
    ],
    ['distinct', '/aggregate/Bcn002Post?distinct=tag'],
    ['files/:name/sign', '/files/nonexistent.txt/sign']
  ];

  for (const [label, path] of probes) {
    const res = await fetch(target.handle.url + path, { headers });
    const text = await res.text();
    console.log(`  ${label.padEnd(20)} ${res.status} ${text.slice(0, 150)}`);
  }
}

async function main() {
  const nodegx = await probe(NODEGX);
  const parse = await probe(PARSE);

  hr('The delta — which is the whole reason the second server exists');

  const rows: [string, boolean, boolean][] = [
    ['aggregate, app-id only', nodegx.aggregateWithoutMasterKey, parse.aggregateWithoutMasterKey],
    ['distinct, app-id only', nodegx.distinctWithoutMasterKey, parse.distinctWithoutMasterKey],
    ['uploadFile, app-id only', nodegx.uploadWithoutSession, parse.uploadWithoutSession],
    ['signFileUrl', nodegx.signSupported, parse.signSupported],
    ['increment', nodegx.increment, parse.increment],
    ['addRelation', nodegx.relations, parse.relations]
  ];

  console.log(`\n  ${'capability'.padEnd(28)} ${'nodegx'.padEnd(10)} parse`);
  for (const [label, ours, theirs] of rows) {
    const flag = ours === theirs ? ' ' : '≠';
    if (ours !== theirs) differences.push(label);
    console.log(`${flag} ${label.padEnd(28)} ${(ours ? 'yes' : 'no').padEnd(10)} ${theirs ? 'yes' : 'no'}`);
  }

  sub('upstream Parse, WITH the master key — the separate-columns question');
  await masterKeyProbes(PARSE);

  hr('Summary');
  console.log(`  ${checks} checks run.`);
  console.log(
    differences.length === 0
      ? '  No differences — which would itself be a finding worth doubting.'
      : `  ${differences.length} difference(s): ${differences.join(', ')}`
  );
  console.log('\n  Every row above is evidence for one descriptor cell. A cell flipped');
  console.log('  without a line here is the failure mode the table exists to prevent.');
}

main().catch((e) => {
  console.error('driver failed:', e);
  process.exit(1);
});
