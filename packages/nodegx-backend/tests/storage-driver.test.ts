/**
 * BAK-006 driver conformance suite: the same behavioral contract asserted
 * against BOTH `StorageDriver` implementations. `LocalDriver` runs always.
 * `S3Driver` runs ONLY against a real S3-compatible endpoint set via env vars
 * (skip-by-default — Docker/MinIO may not be available in every sandbox; see
 * BAK-006-NOTES.md for exactly how this suite was run and against what).
 *
 * To run the S3 half locally against MinIO:
 *   docker run -d -p 9000:9000 -e MINIO_ROOT_USER=minioadmin \
 *     -e MINIO_ROOT_PASSWORD=minioadmin minio/minio server /data
 *   (create a bucket, e.g. via `mc mb local/nodegx-test`)
 *   NODEGX_TEST_S3_ENDPOINT=http://127.0.0.1:9000 \
 *   NODEGX_TEST_S3_BUCKET=nodegx-test \
 *   NODEGX_TEST_S3_ACCESS_KEY=minioadmin \
 *   NODEGX_TEST_S3_SECRET_KEY=minioadmin \
 *   npx jest tests/storage-driver.test.ts
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { LocalDriver } from '../src/storage/LocalDriver';
import { S3Driver } from '../src/storage/S3Driver';
import type { StorageDriver } from '../src/storage/types';

jest.setTimeout(30000);

async function collect(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/** The one conformance suite, parameterized over a driver factory. */
function conformance(name: string, makeDriver: () => StorageDriver | Promise<StorageDriver>) {
  describe(`StorageDriver conformance: ${name}`, () => {
    let driver: StorageDriver;

    beforeAll(async () => {
      driver = await makeDriver();
    });

    it('put -> get round-trips the exact bytes', async () => {
      const data = Buffer.from(`hello ${name} ${Date.now()}-${Math.random()}`);
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      const key = await driver.put(hash, data);
      expect(typeof key).toBe('string');
      const got = await driver.get(key);
      expect(got.equals(data)).toBe(true);
    });

    it('put -> stat reports exists + correct size', async () => {
      const data = Buffer.from('a'.repeat(1234));
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      const key = await driver.put(hash, data);
      const stat = await driver.stat(key);
      expect(stat.exists).toBe(true);
      expect(stat.size).toBe(1234);
    });

    it('stat on a never-written key reports absent', async () => {
      const stat = await driver.stat('does/not/exist-' + crypto.randomBytes(8).toString('hex'));
      expect(stat.exists).toBe(false);
    });

    it('createReadStream yields the exact bytes', async () => {
      const data = Buffer.from('streamed content ' + Date.now());
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      const key = await driver.put(hash, data);
      const streamed = await collect(driver.createReadStream(key));
      expect(streamed.equals(data)).toBe(true);
    });

    it('two puts of identical bytes get DIFFERENT keys (no silent dedupe/collision)', async () => {
      const data = Buffer.from('duplicate-content-marker');
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      const key1 = await driver.put(hash, data);
      const key2 = await driver.put(hash, data);
      expect(key1).not.toBe(key2);
      // Both remain independently readable and independently deletable.
      expect((await driver.get(key1)).equals(data)).toBe(true);
      expect((await driver.get(key2)).equals(data)).toBe(true);
      await driver.delete(key1);
      expect((await driver.stat(key1)).exists).toBe(false);
      expect((await driver.stat(key2)).exists).toBe(true);
      await driver.delete(key2);
    });

    it('delete removes the object; delete is idempotent (no error on a missing key)', async () => {
      const data = Buffer.from('to be deleted');
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      const key = await driver.put(hash, data);
      await driver.delete(key);
      expect((await driver.stat(key)).exists).toBe(false);
      await expect(driver.delete(key)).resolves.not.toThrow();
    });

    it('listKeys enumerates every stored key', async () => {
      const marker = crypto.randomBytes(6).toString('hex');
      const data = Buffer.from(`list-me-${marker}`);
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      const key = await driver.put(hash, data);
      const seen = new Set<string>();
      for await (const k of driver.listKeys()) seen.add(k);
      expect(seen.has(key)).toBe(true);
      await driver.delete(key);
    });
  });
}

// ---------------------------------------------------------------- local ----

let localDataDir: string;
conformance('LocalDriver', () => {
  localDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-local-driver-'));
  return new LocalDriver(path.join(localDataDir, 'blobs'));
});

afterAll(() => {
  if (localDataDir) fs.rmSync(localDataDir, { recursive: true, force: true });
});

// ------------------------------------------------------------------ s3 ----

const S3_ENDPOINT = process.env.NODEGX_TEST_S3_ENDPOINT;
const describeS3 = S3_ENDPOINT ? describe : describe.skip;

describeS3('S3Driver against a real S3-compatible endpoint (env-gated)', () => {
  conformance('S3Driver (' + S3_ENDPOINT + ')', () => {
    return new S3Driver({
      endpoint: S3_ENDPOINT as string,
      region: process.env.NODEGX_TEST_S3_REGION || 'us-east-1',
      bucket: process.env.NODEGX_TEST_S3_BUCKET || 'nodegx-test',
      accessKeyId: process.env.NODEGX_TEST_S3_ACCESS_KEY || '',
      secretAccessKey: process.env.NODEGX_TEST_S3_SECRET_KEY || '',
      forcePathStyle: process.env.NODEGX_TEST_S3_VIRTUAL_HOSTED !== 'true'
    });
  });
});

if (!S3_ENDPOINT) {
  // eslint-disable-next-line no-console
  console.warn(
    '[storage-driver.test.ts] S3Driver conformance SKIPPED — set NODEGX_TEST_S3_ENDPOINT (+ _BUCKET/_ACCESS_KEY/_SECRET_KEY) ' +
      'to run it against a real S3-compatible endpoint (e.g. MinIO). See this file\'s module doc.'
  );
}
