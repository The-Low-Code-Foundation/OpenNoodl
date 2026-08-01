/**
 * Sign File URL (BAK-006 follow-up; generalised by BCN-007 step 4).
 *
 * Asks the backend for a link to a file that the app can actually use, so an
 * app can refresh access to a PRIVATE file without a cloud function. Reuses the
 * same `CloudFile` a Cloud File / Upload File node already produces.
 *
 * ## Why the node has a `URL Kind` output
 *
 * The name is `nodegx-backend`'s — `GET /files/:name/sign`, which mints a real
 * `?exp=&sig=` signature — and **only two of the five backends sign anything**.
 * Directus has no per-asset token and answers with the *caller's own session
 * token* on the query string; PocketBase mints a short-lived file token. Both
 * produce a working link, and both produce a link that is a completely different
 * object from a signature:
 *
 * - A **signed** link carries its own proof. Anyone holding it can read the file
 *   until `Expires At`, and nobody can afterwards. Verified expiring, on both
 *   backends that do it.
 * - A **token** link works only while it carries a credential belonging to
 *   whoever asked for it. Pasting it into a chat either fails for the recipient
 *   or hands them the credential. On Directus it is the *session* token, so the
 *   thing being shared is the user's whole sign-in.
 * - A **public** link needs nothing and never expires — and, measured on our own
 *   backend, an *expired* signature on a public file still serves, because the
 *   file was never gated. An author who signs a public file and believes the
 *   link has stopped working is wrong.
 *
 * The spec's third desired state asks for exactly this: *"a URL that expires and
 * a URL that requires a header are different things for an app author to hold"*,
 * and *"the difference is visible … on the node's output rather than only in
 * docs"*. `URL Kind` and `Safe To Share` are that.
 *
 * @module noodl-runtime
 */
import type { FileUrlKind, SignedFileUrl } from '@noodl/backend-contract';
import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

import CloudFile = require('../../../api/cloudfile');
import CloudStore = require('../../../api/cloudstore');
import { recordBackendPickerPorts, recordSchemaContext } from './record-ports';
import { sendSchemaPorts, staticPortNames } from './schema-ports';

/** What `CloudStore.signFileUrl`'s `error` callback is given. */
interface SignError {
  error?: string;
  code?: number;
  status?: number;
}

/**
 * What every adapter's `signFileUrl` resolves with — `SignedFileUrl`.
 *
 * ⚠️ Not the 200 body of `GET /files/:name/sign` any more, and the difference is
 * the point of BCN-007 step 4. That route is `nodegx-backend`'s and only two of
 * the five backends have anything like it; the contract's shape carries `kind`
 * so the other three can answer honestly with something that is *not* a
 * signature. `expiresAt` and `ttlSeconds` are optional here because a `public`
 * URL has no expiry to report.
 */
type SignedUrlResult = SignedFileUrl;

/** The subset of `CloudStore` this node uses. `cloudstore.js` is still JavaScript. */
interface CloudStoreLike {
  signFileUrl(options: Record<string, unknown>): void;
}

interface SignFileUrlInstance extends NodeInstance {
  _internal: {
    cloudFile?: CloudFile;
    /** BCN-007 step 6 — see `registerInputIfNeeded`. */
    backendId?: string;
    url?: string;
    kind?: FileUrlKind;
    expiresAt?: string;
    ttlSeconds?: number;
    error?: unknown;
    errorStatus?: number;
  };
  setError(err: SignError | string): void;
  cloudStore(): CloudStoreLike | undefined;
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
      return [
        {
          type: 'value',
          value: { url: this._internal.url, kind: this._internal.kind, expiresAt: this._internal.expiresAt }
        }
      ];
    }
    return '[Not signed yet]';
  },
  inputs: {
    file: {
      group: 'General',
      displayName: 'File',
      type: 'cloudfile',
      description:
        'Stored file to mint a link for, as an Upload File node or a record property produces it; any other value leaves the previous file in place',
      set(this: SignFileUrlInstance, value: unknown) {
        if (value instanceof CloudFile === false) return;
        this._internal.cloudFile = value as CloudFile;
      }
    },
    sign: {
      type: 'signal',
      displayName: 'Sign',
      group: 'Actions',
      description: 'Mints a fresh link for File, refused for a caller who could not read the file directly',
      valueChangedToTrue(this: SignFileUrlInstance) {
        this.scheduleAfterInputsHaveUpdated(() => {
          const cloudFile = this._internal.cloudFile;
          if (!cloudFile) {
            this.setError('No file specified');
            return;
          }

          const store = this.cloudStore();
          if (!store) return;

          store.signFileUrl({
            name: cloudFile.getName(),
            // BCN-007 step 3: PocketBase addresses a file by (collection,
            // record id, filename) and Supabase by (bucket, path). Neither can
            // be reconstructed from a name, so it rides along on the file the
            // upload produced. `undefined` on the three backends that store
            // files independently, and those adapters never read it.
            target: cloudFile.getTarget(),
            success: (result: SignedUrlResult) => {
              this._internal.url = result.url;
              this._internal.kind = result.kind;
              this._internal.expiresAt = result.expiresAt;
              this._internal.ttlSeconds = result.ttlSeconds;
              this.flagOutputDirty('url');
              this.flagOutputDirty('urlKind');
              this.flagOutputDirty('isShareable');
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
      description:
        'Usable link to the file; empty until Sign has succeeded once. Read URL Kind before sharing it — on some backends this link carries your own credential rather than a signature',
      get(this: SignFileUrlInstance) {
        return this._internal.url;
      }
    },
    // ── BCN-007 step 4 ───────────────────────────────────────────────────
    // "Signed URLs where supported, access-token URLs where not, **and the
    // difference is visible**: a URL that expires and a URL that requires a
    // header are different things for an app author to hold."
    //
    // The contract has carried `kind` since step 1; step 1 deliberately did not
    // add the port, because with one adapter implemented it would have read
    // `signed` on every project that could reach it and taught nobody anything.
    // Four adapters answer it now and they do not agree — measured:
    //
    //   nodegx     signed   ?exp=&sig=, expires for real (403 after the ttl)
    //   supabase   signed   POST /object/sign, expires for real (400 jwt expired)
    //   directus   token    ?access_token=<the caller's SESSION token>
    //   pocketbase token    ?token=<a short-lived file token>
    //   parse      —        no signing route at all; the cell is `unsupported`
    urlKind: {
      group: 'General',
      displayName: 'URL Kind',
      type: 'string',
      description:
        'How this link is protected: "signed" — it carries its own proof and stops working at Expires At; "token" — it carries your own sign-in credential; "public" — it needs nothing and never expires',
      get(this: SignFileUrlInstance) {
        return this._internal.kind;
      }
    },
    isShareable: {
      group: 'General',
      displayName: 'Safe To Share',
      type: 'boolean',
      description:
        'False when the link only works because it carries your own credential — sending it to someone else either fails for them or hands them your session. True for a signed or public link',
      get(this: SignFileUrlInstance) {
        const kind = this._internal.kind;
        // `undefined` until Sign has succeeded once, rather than `false`: a node
        // that has never run has not decided the link is unsafe.
        if (kind === undefined) return undefined;
        return kind !== 'token';
      }
    },
    expiresAt: {
      group: 'General',
      displayName: 'Expires At',
      type: 'string',
      description:
        'Moment the link stops working, as an ISO 8601 timestamp. Empty for a "public" link, which never expires; for a "token" link on Directus this is the session\'s expiry rather than the link\'s',
      get(this: SignFileUrlInstance) {
        return this._internal.expiresAt;
      }
    },
    ttlSeconds: {
      group: 'General',
      displayName: 'TTL (Seconds)',
      type: 'number',
      description: 'How long Signed URL stays valid from the moment it was minted, in seconds',
      get(this: SignFileUrlInstance) {
        return this._internal.ttlSeconds;
      }
    },
    success: {
      group: 'Events',
      displayName: 'Success',
      type: 'signal',
      description: 'Fires once a link has been minted and Signed URL is up to date'
    },
    failure: {
      group: 'Events',
      displayName: 'Failure',
      type: 'signal',
      description:
        'Fires when no link could be minted — no file was set, or the backend refused the caller access — after the reason has been reported on the error channel'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      description: 'Why the last signing attempt failed; empty until one does',
      get(this: SignFileUrlInstance) {
        return this._internal.error;
      }
    },
    errorStatus: {
      type: 'number',
      displayName: 'Error Status Code',
      group: 'Error',
      description: 'HTTP status the backend refused with, or 0 when the request never left the app',
      get(this: SignFileUrlInstance) {
        return this._internal.errorStatus;
      }
    }
  },
  methods: {
    /**
     * The Backend picker's input. See `uploadfile.ts` for the finding: this
     * node called `CloudStore.instance`, the singleton that always resolves the
     * legacy `cloudservices` endpoint, so it could not sign a file on any
     * backend the Record nodes could reach.
     */
    registerInputIfNeeded(this: SignFileUrlInstance, name: string) {
      if (this.hasInput(name)) return;
      if (name === 'backendId') {
        this.registerInput(name, {
          set: (value: unknown) => {
            this._internal.backendId = value as string;
          }
        });
      }
    },
    /** The routed store. A backend id naming nothing is an error, never a fallback. */
    cloudStore(this: SignFileUrlInstance): CloudStoreLike | undefined {
      const store = (CloudStore as unknown as {
        forBackend(modelScope: unknown, backendId: string | undefined): CloudStoreLike | undefined;
      }).forBackend(this.nodeScope ? this.nodeScope.modelScope : undefined, this._internal.backendId);

      if (!store) {
        this.setError(
          `The backend this node is set to ("${this._internal.backendId}") is not configured in this project.`
        );
      }
      return store;
    },
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

/** The Backend dropdown, emitted into the editor. See `uploadfile.ts::updatePorts`. */
function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: EditorConnectionLike,
  graphModel: GraphModelLike
) {
  const ctx = recordSchemaContext(graphModel, parameters);
  sendSchemaPorts(editorConnection, nodeId, recordBackendPickerPorts(ctx), {
    staticPorts: staticPortNames(SignFileUrl)
  });
}

const SignFileUrlModule: NodeModule = {
  node: SignFileUrl,
  setup(context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) return;

    function manage(node: GraphNodeModel) {
      updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      node.on('parameterUpdated', () => updatePorts(node.id, node.parameters, context.editorConnection, graphModel));
      graphModel.on('metadataChanged.backendServices', () =>
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel)
      );
      graphModel.on('metadataChanged.cloudservices', () =>
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel)
      );
    }

    graphModel.on('nodeAdded.Sign File URL', manage);
    for (const node of graphModel.getNodesWithType('Sign File URL')) manage(node);
  }
};

export = SignFileUrlModule;
