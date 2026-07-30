/**
 * Sign File URL (BAK-006 follow-up).
 *
 * Mints a short-TTL signed URL for a file — `GET /files/:name/sign` on
 * nodegx-backend — so an app can refresh a usable link to a PRIVATE file (or
 * any file, though only private/ACL'd ones need it) without a cloud function.
 * Reuses the same `CloudFile` a Cloud File / Upload File node already
 * produces, and the same row-ACL gate `assertReadable` uses when serving the
 * file itself: this call fails exactly the way reading the file directly
 * would for a caller without access, never mints a signature it should not.
 *
 * @module noodl-runtime
 */
import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import CloudFile = require('../../../api/cloudfile');
import CloudStore = require('../../../api/cloudstore');

/** What `CloudStore.signFileUrl`'s `error` callback is given. */
interface SignError {
  error?: string;
  code?: number;
  status?: number;
}

/** The 200 body of `GET /files/:name/sign` (nodegx-backend's `FileRoutes.signUrl`). */
interface SignedUrlResult {
  url: string;
  expiresAt: string;
  ttlSeconds: number;
}

interface SignFileUrlInstance extends NodeInstance {
  _internal: {
    cloudFile?: CloudFile;
    url?: string;
    expiresAt?: string;
    ttlSeconds?: number;
    error?: unknown;
    errorStatus?: number;
  };
  setError(err: SignError | string): void;
}

/** NDA-004 §2 — see `setError`. Also the editor's warning key; the bus keys by `code`. */
const SIGN_ERROR_CODE = 'sign-file-url/sign-failed';

const SignFileUrl: NodeDefinitionOptions = {
  name: 'Sign File URL',
  docs: 'https://docs.noodl.net/nodes/data/cloud-data/sign-file-url',
  category: 'Cloud Services',
  color: 'data',
  getInspectInfo(this: SignFileUrlInstance): InspectInfo {
    if (this._internal.url) {
      return [{ type: 'value', value: { url: this._internal.url, expiresAt: this._internal.expiresAt } }];
    }
    return '[Not signed yet]';
  },
  inputs: {
    file: {
      group: 'General',
      displayName: 'File',
      type: 'cloudfile',
      set(this: SignFileUrlInstance, value: unknown) {
        if (value instanceof CloudFile === false) return;
        this._internal.cloudFile = value as CloudFile;
      }
    },
    sign: {
      type: 'signal',
      displayName: 'Sign',
      group: 'Actions',
      valueChangedToTrue(this: SignFileUrlInstance) {
        this.scheduleAfterInputsHaveUpdated(() => {
          const cloudFile = this._internal.cloudFile;
          if (!cloudFile) {
            this.setError('No file specified');
            return;
          }

          CloudStore.instance.signFileUrl({
            name: cloudFile.getName(),
            success: (result: SignedUrlResult) => {
              this._internal.url = result.url;
              this._internal.expiresAt = result.expiresAt;
              this._internal.ttlSeconds = result.ttlSeconds;
              this.flagOutputDirty('url');
              this.flagOutputDirty('expiresAt');
              this.flagOutputDirty('ttlSeconds');
              this.sendSignalOnOutput('success');
            },
            error: (e: SignError) => this.setError(e)
          });
        });
      }
    }
  },
  outputs: {
    url: {
      group: 'General',
      displayName: 'Signed URL',
      type: 'string',
      get(this: SignFileUrlInstance) {
        return this._internal.url;
      }
    },
    expiresAt: {
      group: 'General',
      displayName: 'Expires At',
      type: 'string',
      get(this: SignFileUrlInstance) {
        return this._internal.expiresAt;
      }
    },
    ttlSeconds: {
      group: 'General',
      displayName: 'TTL (Seconds)',
      type: 'number',
      get(this: SignFileUrlInstance) {
        return this._internal.ttlSeconds;
      }
    },
    success: {
      group: 'Events',
      displayName: 'Success',
      type: 'signal'
    },
    failure: {
      group: 'Events',
      displayName: 'Failure',
      type: 'signal'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      get(this: SignFileUrlInstance) {
        return this._internal.error;
      }
    },
    errorStatus: {
      type: 'number',
      displayName: 'Error Status Code',
      group: 'Error',
      get(this: SignFileUrlInstance) {
        return this._internal.errorStatus;
      }
    }
  },
  methods: {
    // Same shape as Upload File's setError: `err` is a string on the "no file"
    // path and an object from CloudStore. `hasOwnProperty` on a boxed string
    // primitive returns false, so both paths work.
    setError(this: SignFileUrlInstance, err: SignError | string) {
      this._internal.error = err.hasOwnProperty('error') ? (err as SignError).error : err;
      this._internal.errorStatus = (err as SignError).code || (err as SignError).status || 0;
      this.flagOutputDirty('error');
      this.flagOutputDirty('errorStatus');
      this.sendSignalOnOutput('failure');

      // NDA-004 §2 / FINDINGS B-iv: the message reached the `Error` port and stopped — no
      // diagnosis in any runtime, the editor included. `detail` carries the status because
      // the node distinguishes "no file specified" (0) from a backend refusal.
      this.raiseRuntimeError(SIGN_ERROR_CODE, String(this._internal.error), {
        status: this._internal.errorStatus
      });
    }
  }
};

const SignFileUrlModule: NodeModule = {
  node: SignFileUrl
};

export = SignFileUrlModule;
