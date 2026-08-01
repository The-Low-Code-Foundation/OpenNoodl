import type { FileTarget } from '@noodl/backend-contract';
import CloudFile from '@noodl/runtime/src/api/cloudfile';
import CloudStore from '@noodl/runtime/src/api/cloudstore';
import { recordBackendPickerPorts, recordSchemaContext } from '@noodl/runtime/src/nodes/std-library/data/record-ports';
import { sendSchemaPorts, staticPortNames } from '@noodl/runtime/src/nodes/std-library/data/schema-ports';
import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance
} from '@noodl/types';

/** What `CloudStore.uploadFile`'s `error` callback is given, and what `setError` reads. */
interface UploadError {
  error?: string;
  code?: number;
  status?: number;
}

interface UploadFileInstance extends NodeInstance {
  _internal: {
    file?: File;
    /** BCN-007 step 6 — see `registerInputIfNeeded`. */
    backendId?: string;
    /** BAK-006 follow-up: upload as a private (owner-only, ACL'd) file. */
    private?: boolean;
    /** BCN-007 step 3 — see the `File Location` input group. */
    bucket?: string;
    path?: string;
    collection?: string;
    recordId?: string;
    field?: string;
    cloudFile?: unknown;
    error?: unknown;
    errorStatus?: number;
    progressTotal?: number;
    progressLoaded?: number;
  };
  setError(err: UploadError | string): void;
  fileTarget(): FileTarget | undefined;
  cloudStore(): CloudStoreLike | undefined;
}

/** The subset of `CloudStore` this node uses. `cloudstore.js` is still JavaScript. */
interface CloudStoreLike {
  uploadFile(options: Record<string, unknown>): void;
}

/** NDA-004 §2 — see `setError`. Also the editor's warning key; the bus keys by `code`. */
const UPLOAD_ERROR_CODE = 'upload-file/upload-failed';

const UploadFile: NodeDefinitionOptions = {
  name: 'Upload File',
  docs: 'https://docs.noodl.net/nodes/data/cloud-data/upload-file',
  category: 'Cloud Services',
  color: 'data',
  // DEBT-006: the old inspector read `_internal.response`, which nothing ever
  // wrote (PLAT-003 NOTES §13.3). Inspect the state the node actually tracks.
  getInspectInfo(this: UploadFileInstance): InspectInfo {
    if (this._internal.cloudFile) return [{ type: 'value', value: this._internal.cloudFile }];
    return '[Not uploaded yet]';
  },
  inputs: {
    file: {
      group: 'General',
      displayName: 'File',
      type: '*',
      description: 'The file to upload, as an Open File Picker node produces it',
      set(this: UploadFileInstance, file: File) {
        this._internal.file = file;
      }
    },
    // BAK-006 follow-up: the header-based private-upload surface
    // (`X-NodeGX-File-Private`) already works over raw HTTP; this just gives
    // it a node input so an app author doesn't need a cloud function to set
    // it. A private upload's file is only readable by its uploader (or an
    // admin) — see "Sign File URL" for getting a usable, time-limited link to
    // it back out.
    private: {
      group: 'General',
      displayName: 'Private',
      type: 'boolean',
      default: false,
      description: 'Restricts the stored file to whoever uploaded it, so reading it later needs a Sign File URL node',
      set(this: UploadFileInstance, value: boolean) {
        this._internal.private = value;
      }
    },
    // ── BCN-007 step 3: File Location ────────────────────────────────────
    //
    // ⚠️ **Two of the five backends cannot store a file without being told
    // where**, and neither value can be guessed:
    //
    //   Supabase    an object at a path inside a named bucket
    //   PocketBase  a field on a record in a collection
    //
    // The spec asked for either an optional target on `uploadFile` or a
    // `degraded` capability, *"prefer the latter [target] if it does not
    // distort the contract; prefer the former over a lie"*. Both shipped: the
    // target is here, and `files.upload` on those two backends is `degraded`,
    // because an Upload File node with these blank is a file with nowhere to
    // live and the author should be told before they ship rather than after.
    //
    // Every one of them is **inert on NodeGX, Parse and Directus**, which store
    // files independently — their adapters never read the target.
    bucket: {
      group: 'File Location',
      displayName: 'Bucket (Supabase)',
      type: 'string',
      description:
        'Supabase Storage bucket to upload into. Supabase only; there is no default, and a bucket that does not exist fails with an error that does not say so',
      set(this: UploadFileInstance, value: string) {
        this._internal.bucket = value;
      }
    },
    path: {
      group: 'File Location',
      displayName: 'Path (Supabase)',
      type: 'string',
      description:
        'Object path inside the bucket, such as avatars/me.png. Supabase only. Leave blank to use the file\'s own name',
      set(this: UploadFileInstance, value: string) {
        this._internal.path = value;
      }
    },
    collection: {
      group: 'File Location',
      displayName: 'Collection (PocketBase)',
      type: 'string',
      description: 'PocketBase collection holding the record the file attaches to. PocketBase only',
      set(this: UploadFileInstance, value: string) {
        this._internal.collection = value;
      }
    },
    recordId: {
      group: 'File Location',
      displayName: 'Record ID (PocketBase)',
      type: 'string',
      description:
        'Existing record to attach the file to. PocketBase only. Leave blank to create a new record as part of the upload',
      set(this: UploadFileInstance, value: string) {
        this._internal.recordId = value;
      }
    },
    field: {
      group: 'File Location',
      displayName: 'Field (PocketBase)',
      type: 'string',
      description: 'The file-typed field on that record. PocketBase only',
      set(this: UploadFileInstance, value: string) {
        this._internal.field = value;
      }
    },
    upload: {
      type: 'signal',
      displayName: 'Upload',
      group: 'Actions',
      description: 'Starts uploading File, and fails straight away when no file has been set',
      valueChangedToTrue(this: UploadFileInstance) {
        this.scheduleAfterInputsHaveUpdated(() => {
          const file = this._internal.file;

          if (!file) {
            this.setError('No file specified');
            return;
          }

          const store = this.cloudStore();
          if (!store) return;

          store.uploadFile({
            file,
            private: this._internal.private,
            target: this.fileTarget(),
            onUploadProgress: (p: { total: number; loaded: number }) => {
              this._internal.progressTotal = p.total;
              this._internal.progressLoaded = p.loaded;

              this.flagOutputDirty('progressTotalBytes');
              this.flagOutputDirty('progressLoadedBytes');
              this.flagOutputDirty('progressLoadedPercent');
              this.sendSignalOnOutput('progressChanged');
            },
            // `CloudStore.uploadFile` resolves with the adapter-normalised `FileRef`.
            // That is *not* `{ name, url }` — BCN-007 gave it `contentType` and `size`
            // as well, and this annotation saying otherwise is why they were silently
            // discarded by the `CloudFile` constructor. Typed as the contract's shape
            // structurally rather than imported, because `cloudstore.js` is still
            // JavaScript and declares this callback `unknown` (PLAT-006 residual).
            success: (response: {
              name: string;
              url: string;
              contentType?: string;
              size?: number;
              target?: FileTarget;
            }) => {
              this._internal.cloudFile = new CloudFile(response);
              this.flagOutputDirty('cloudFile');
              this.sendSignalOnOutput('success');
            },
            error: (e: UploadError) => this.setError(e)
          });
        });
      }
    }
  },
  outputs: {
    cloudFile: {
      group: 'General',
      displayName: 'Cloud File',
      type: 'cloudfile',
      description: 'The stored file, for wiring into a record property or a Cloud File node',
      get(this: UploadFileInstance) {
        return this._internal.cloudFile;
      }
    },
    success: {
      group: 'Events',
      displayName: 'Success',
      type: 'signal',
      description: 'Fires once the file is stored and Cloud File is up to date'
    },
    failure: {
      group: 'Events',
      displayName: 'Failure',
      type: 'signal',
      description: 'Fires when the file could not be stored, after the reason has been reported on the error channel'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      description: 'Why the last upload failed; empty until one does',
      get(this: UploadFileInstance) {
        return this._internal.error;
      }
    },
    errorStatus: {
      type: 'number',
      displayName: 'Error Status Code',
      group: 'Error',
      description: 'HTTP status the backend refused with, or 0 when the request never left the app',
      get(this: UploadFileInstance) {
        return this._internal.errorStatus;
      }
    },
    progressChanged: {
      type: 'signal',
      displayName: 'Progress Changed',
      group: 'Events',
      description: 'Fires each time the byte counts below move during an upload'
    },
    progressTotalBytes: {
      type: 'number',
      displayName: 'Total Bytes',
      group: 'Progress',
      description: 'Size of the file being uploaded, in bytes',
      get(this: UploadFileInstance) {
        return this._internal.progressTotal;
      }
    },
    progressLoadedBytes: {
      type: 'number',
      displayName: 'Uploaded Bytes',
      group: 'Progress',
      description: 'How much of the file has been sent so far, in bytes',
      get(this: UploadFileInstance) {
        return this._internal.progressLoaded;
      }
    },
    progressLoadedPercent: {
      type: 'number',
      displayName: 'Uploaded Percent',
      group: 'Progress',
      description: 'How much of the file has been sent so far, from 0 to 100',
      get(this: UploadFileInstance) {
        if (!this._internal.progressTotal) return 0;
        return (this._internal.progressLoaded / this._internal.progressTotal) * 100;
      }
    }
  },
  methods: {
    /**
     * The Backend picker's input, registered on demand.
     *
     * ⚠️ **BCN-007 step 6 found this node could not reach any backend but the
     * legacy one, and nothing had noticed.** It called `CloudStore.instance` —
     * the module-level singleton that always resolves `cloudservices` — while
     * BCN-004 step 5 gave the six Record nodes `CloudStore.forBackend`. So an
     * adapter could implement `uploadFile` for Directus perfectly and an Upload
     * File node in a graph would still post to the built-in backend. The live
     * driver caught it on its first run, on all four backends at once, as a
     * transport failure with an empty error message.
     *
     * Registered through `registerInputIfNeeded` rather than declared as a
     * static input, which is the Record family's own pattern
     * (`dbmodelcrudbase.ts:112`): the port is a **dynamic** one whose enum is
     * built from the project's backends, so a static declaration would fix its
     * type at a moment when there is no project metadata.
     */
    registerInputIfNeeded(this: UploadFileInstance, name: string) {
      if (this.hasInput(name)) return;
      if (name === 'backendId') {
        this.registerInput(name, {
          set: (value: unknown) => {
            this._internal.backendId = value as string;
          }
        });
      }
    },
    /**
     * The store this node writes through — the routed one, not the singleton.
     *
     * A backend id naming nothing is an **error with a sentence**, never a
     * fallback to the default: falling back would upload the user's file to a
     * different backend from the one the graph names, silently. Same rule, and
     * the same sentence, as `dbmodelcrudbase.ts::cloudStoreForScope`.
     */
    cloudStore(this: UploadFileInstance): CloudStoreLike | undefined {
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
    /**
     * The five File Location inputs, as the one thing the contract takes.
     *
     * ⚠️ **A partly-filled group produces `undefined`, not a partial target.**
     * A `{kind:'record'}` with no collection would reach the adapter, pass its
     * `target?.kind !== 'record'` guard, and then compose a URL containing the
     * string `undefined` — a request that looks well-formed and addresses
     * nothing. The adapter's refusal sentence, which names the inputs to fill
     * in, is a strictly better outcome than a 404 from a fabricated path.
     *
     * `bucket` wins if both groups are filled, and the two are never both
     * meaningful: a project has one backend selected, and only one of the two
     * backends reads either group.
     */
    fileTarget(this: UploadFileInstance): FileTarget | undefined {
      const { bucket, path, collection, recordId, field, file } = this._internal;

      if (bucket) {
        // Path defaults to the file's own name — the one value here that CAN be
        // derived, because the file always has one and an object must have a
        // path. Bucket cannot: there is no conventional default bucket name.
        return { kind: 'bucket', bucket, path: path || file?.name || '' };
      }

      if (collection && field) {
        return recordId
          ? { kind: 'record', collection, field, recordId }
          : { kind: 'record', collection, field };
      }

      return undefined;
    },
    // `err` is a string on the "no file" path and an object from CloudStore. `hasOwnProperty`
    // on a string primitive boxes it and returns false, so both paths work.
    setError(this: UploadFileInstance, err: UploadError | string) {
      this._internal.error = err.hasOwnProperty('error') ? (err as UploadError).error : err;
      //use the error code. If there is none, use the http status
      this._internal.errorStatus = (err as UploadError).code || (err as UploadError).status || 0;
      this.flagOutputDirty('error');
      this.flagOutputDirty('errorStatus');
      this.sendSignalOnOutput('failure');

      // NDA-004 §2 / FINDINGS B-iv: the message reached the `Error` port and stopped — no
      // diagnosis in any runtime, the editor included.
      this.raiseRuntimeError(UPLOAD_ERROR_CODE, String(this._internal.error), {
        status: this._internal.errorStatus
      });
    }
  }
};

/**
 * The Backend dropdown, emitted into the editor.
 *
 * Only the picker: unlike the Record family this node has no Collection or
 * field ports to derive, so `recordSchemaContext` is used purely for the
 * backend list it resolves out of both metadata keys. Importing the Record
 * family's helper rather than writing a second one is the point — BCN-004's
 * `hideWhenSingleBackend` counts `cloudservices` as a backend, and a
 * hand-rolled copy here would have re-introduced the defect where a project
 * with the built-in backend plus one other counted as "one" and hid the picker.
 */
function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: EditorConnectionLike,
  graphModel: GraphModelLike
) {
  const ctx = recordSchemaContext(graphModel, parameters);
  sendSchemaPorts(editorConnection, nodeId, recordBackendPickerPorts(ctx), {
    staticPorts: staticPortNames(UploadFile)
  });
}

export default {
  node: UploadFile,
  setup(context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) return;

    function manage(node: GraphNodeModel) {
      updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      node.on('parameterUpdated', () => updatePorts(node.id, node.parameters, context.editorConnection, graphModel));
      // The picker's enum is built from this key, so it has to be re-emitted
      // when a backend is added or removed — not only when a parameter changes.
      graphModel.on('metadataChanged.backendServices', () =>
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel)
      );
      graphModel.on('metadataChanged.cloudservices', () =>
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel)
      );
    }

    graphModel.on('nodeAdded.Upload File', manage);
    for (const node of graphModel.getNodesWithType('Upload File')) manage(node);
  }
};
