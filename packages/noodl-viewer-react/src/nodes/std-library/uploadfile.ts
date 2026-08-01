import CloudFile from '@noodl/runtime/src/api/cloudfile';
import CloudStore from '@noodl/runtime/src/api/cloudstore';
import type { InspectInfo, NodeDefinitionOptions, NodeInstance } from '@noodl/types';

/** What `CloudStore.uploadFile`'s `error` callback is given, and what `setError` reads. */
interface UploadError {
  error?: string;
  code?: number;
  status?: number;
}

interface UploadFileInstance extends NodeInstance {
  _internal: {
    file?: File;
    /** BAK-006 follow-up: upload as a private (owner-only, ACL'd) file. */
    private?: boolean;
    cloudFile?: unknown;
    error?: unknown;
    errorStatus?: number;
    progressTotal?: number;
    progressLoaded?: number;
  };
  setError(err: UploadError | string): void;
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

          CloudStore.instance.uploadFile({
            file,
            private: this._internal.private,
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
            success: (response: { name: string; url: string; contentType?: string; size?: number }) => {
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

export default {
  node: UploadFile
};
