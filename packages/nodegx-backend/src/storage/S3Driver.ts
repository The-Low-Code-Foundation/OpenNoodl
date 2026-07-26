/**
 * S3Driver — StorageDriver over an S3-compatible endpoint, signed with the
 * zero-dependency SigV4 implementation in ./sigv4.ts.
 *
 * Requests go over plain `node:http`/`node:https` — no AWS SDK (see sigv4.ts's
 * module doc for why). Path-style addressing (`<endpoint>/<bucket>/<key>`) is
 * the default because the primary target is a self-hosted S3-compatible
 * service (MinIO, and friends) that require it; set `forcePathStyle: false`
 * for AWS S3 buckets that need virtual-hosted-style (`<bucket>.<endpoint>`).
 *
 * Same hash-bucketed key layout as `LocalDriver` (`hh/hh/hash-random`) — one
 * mental model for both drivers, and BAK-006-NOTES documents both under one
 * "storage layout" heading for BAK-007.
 *
 * Not implemented (out of scope, v1): multipart upload (no >5GB/resumable
 * uploads — the spec excludes resumable uploads entirely), bucket creation/
 * lifecycle management (operator's job), request retries/backoff (a failed
 * request surfaces as a thrown error, loud per doctrine, not silently retried
 * into a different failure mode).
 *
 * @module nodegx-backend/storage/S3Driver
 */

import * as crypto from 'crypto';
import * as http from 'http';
import * as https from 'https';
import { PassThrough } from 'stream';
import { URL } from 'url';

import type { StorageDriver, StorageStat } from './types';
import { signAws4, sha256hex } from './sigv4';

export interface S3DriverConfig {
  /** e.g. "https://s3.us-east-1.amazonaws.com" or "http://127.0.0.1:9000" (MinIO). */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Default true (MinIO and most self-hosted S3-compatible services require it). */
  forcePathStyle?: boolean;
}

function amzDateNow(): string {
  return new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
}

interface HttpResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

export class S3Driver implements StorageDriver {
  readonly kind = 's3' as const;
  private readonly config: S3DriverConfig;
  private readonly endpointUrl: URL;
  private readonly forcePathStyle: boolean;

  constructor(config: S3DriverConfig) {
    this.config = config;
    this.endpointUrl = new URL(config.endpoint);
    this.forcePathStyle = config.forcePathStyle !== false;
  }

  /** host header + request path for a given object key ("" for the bucket root, used by list). */
  private target(key: string): { host: string; path: string } {
    const encKey = key
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    if (this.forcePathStyle) {
      return { host: this.endpointUrl.host, path: `/${this.config.bucket}${encKey ? '/' + encKey : ''}` };
    }
    return { host: `${this.config.bucket}.${this.endpointUrl.host}`, path: encKey ? `/${encKey}` : '/' };
  }

  private async request(
    method: string,
    key: string,
    opts: { body?: Buffer; query?: Array<[string, string]> } = {}
  ): Promise<HttpResult> {
    const { host, path } = this.target(key);
    const body = opts.body || Buffer.alloc(0);
    const payloadHash = sha256hex(body);
    const amzDate = amzDateNow();
    const headers: Record<string, string> = {
      host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash
    };
    if (body.length > 0) headers['content-length'] = String(body.length);

    const { authorization } = signAws4(
      { method, path, query: opts.query, headers, payloadHash },
      {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        region: this.config.region,
        service: 's3'
      },
      amzDate
    );

    const queryString = opts.query && opts.query.length ? '?' + opts.query.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';

    return this.rawRequest({
      method,
      path: path + queryString,
      headers: { ...headers, authorization },
      body: body.length > 0 ? body : undefined
    });
  }

  private rawRequest(opts: { method: string; path: string; headers: Record<string, string>; body?: Buffer }): Promise<HttpResult> {
    const isHttps = this.endpointUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    return new Promise((resolve, reject) => {
      const req = transport.request(
        {
          protocol: this.endpointUrl.protocol,
          hostname: this.endpointUrl.hostname,
          port: this.endpointUrl.port || (isHttps ? 443 : 80),
          method: opts.method,
          path: opts.path,
          headers: opts.headers
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) }));
          res.on('error', reject);
        }
      );
      req.on('error', reject);
      if (opts.body) req.write(opts.body);
      req.end();
    });
  }

  /** Stream variant of rawRequest used by createReadStream: pipes the response body as it arrives. */
  private streamGet(key: string): NodeJS.ReadableStream {
    const out = new PassThrough();
    (async () => {
      try {
        const { host, path } = this.target(key);
        const amzDate = amzDateNow();
        const payloadHash = sha256hex(Buffer.alloc(0));
        const headers: Record<string, string> = { host, 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash };
        const { authorization } = signAws4(
          { method: 'GET', path, headers, payloadHash },
          {
            accessKeyId: this.config.accessKeyId,
            secretAccessKey: this.config.secretAccessKey,
            region: this.config.region,
            service: 's3'
          },
          amzDate
        );
        const isHttps = this.endpointUrl.protocol === 'https:';
        const transport = isHttps ? https : http;
        const req = transport.request(
          {
            protocol: this.endpointUrl.protocol,
            hostname: this.endpointUrl.hostname,
            port: this.endpointUrl.port || (isHttps ? 443 : 80),
            method: 'GET',
            path,
            headers: { ...headers, authorization }
          },
          (res) => {
            if ((res.statusCode || 0) >= 400) {
              out.destroy(new Error(`S3 GET ${key} failed with status ${res.statusCode}`));
              return;
            }
            res.pipe(out);
          }
        );
        req.on('error', (e) => out.destroy(e));
        req.end();
      } catch (e) {
        out.destroy(e instanceof Error ? e : new Error(String(e)));
      }
    })();
    return out;
  }

  async put(hash: string, data: Buffer): Promise<string> {
    const bucket1 = hash.slice(0, 2) || '00';
    const bucket2 = hash.slice(2, 4) || '00';
    const key = `${bucket1}/${bucket2}/${hash}-${crypto.randomBytes(4).toString('hex')}`;
    const res = await this.request('PUT', key, { body: data });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`S3 PUT ${key} failed with status ${res.status}: ${res.body.toString('utf-8').slice(0, 500)}`);
    }
    return key;
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.request('GET', key);
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`S3 GET ${key} failed with status ${res.status}`);
    }
    return res.body;
  }

  createReadStream(key: string): NodeJS.ReadableStream {
    return this.streamGet(key);
  }

  async delete(key: string): Promise<void> {
    const res = await this.request('DELETE', key);
    // S3 DELETE is idempotent: 204/200/404 are all "gone" outcomes.
    if (res.status >= 400 && res.status !== 404) {
      throw new Error(`S3 DELETE ${key} failed with status ${res.status}`);
    }
  }

  async stat(key: string): Promise<StorageStat> {
    const res = await this.request('HEAD', key);
    if (res.status === 404) return { exists: false, size: 0 };
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`S3 HEAD ${key} failed with status ${res.status}`);
    }
    const len = res.headers['content-length'];
    return { exists: true, size: len ? Number(len) : 0 };
  }

  async *listKeys(): AsyncIterable<string> {
    let continuationToken: string | undefined;
    do {
      const query: Array<[string, string]> = [['list-type', '2']];
      if (continuationToken) query.push(['continuation-token', continuationToken]);
      const res = await this.request('GET', '', { query });
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`S3 ListObjectsV2 failed with status ${res.status}: ${res.body.toString('utf-8').slice(0, 500)}`);
      }
      const xml = res.body.toString('utf-8');
      const keyMatches = xml.matchAll(/<Key>([^<]*)<\/Key>/g);
      for (const m of keyMatches) yield decodeXmlEntities(m[1]);
      const truncatedMatch = xml.match(/<IsTruncated>(true|false)<\/IsTruncated>/);
      const tokenMatch = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/);
      continuationToken = truncatedMatch && truncatedMatch[1] === 'true' && tokenMatch ? decodeXmlEntities(tokenMatch[1]) : undefined;
    } while (continuationToken);
  }
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
