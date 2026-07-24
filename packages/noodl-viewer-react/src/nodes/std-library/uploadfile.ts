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
    cloudFile?: unknown;
    error?: unknown;
    errorStatus?: number;
    progressTotal?: number;
    progressLoaded?: number;
  };
  setError(err: UploadError | string): void;
}

const UploadFile: NodeDefinitionOptions = {
  name: 'Upload File',
  docs: 'https://docs.noodl.net/nodes/data/cloud-data/upload-file',
  category: 'Cloud Services',
  color: 'data',
  // `_internal.response` is never assigned anywhere in this node, so this always returns
  // `undefined` and the inspector shows nothing. Left alone — see PLAT-003 NOTES §13.
  getInspectInfo(this: UploadFileInstance) {
    return (this._internal as { response?: unknown }).response as InspectInfo;
  },
  inputs: {
    file: {
      group: 'General',
      displayName: 'File',
      type: '*',
      set(this: UploadFileInstance, file: File) {
        this._internal.file = file;
      }
    },
    upload: {
      type: 'signal',
      displayName: 'Upload',
      group: 'Actions',
      valueChangedToTrue(this: UploadFileInstance) {
        this.scheduleAfterInputsHaveUpdated(() => {
          const file = this._internal.file;

          if (!file) {
            this.setError('No file specified');
            return;
          }

          CloudStore.instance.uploadFile({
            file,
            onUploadProgress: (p: { total: number; loaded: number }) => {
              this._internal.progressTotal = p.total;
              this._internal.progressLoaded = p.loaded;

              this.flagOutputDirty('progressTotalBytes');
              this.flagOutputDirty('progressLoadedBytes');
              this.flagOutputDirty('progressLoadedPercent');
              this.sendSignalOnOutput('progressChanged');
            },
            success: (response: unknown) => {
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
      get(this: UploadFileInstance) {
        return this._internal.cloudFile;
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
      get(this: UploadFileInstance) {
        return this._internal.error;
      }
    },
    errorStatus: {
      type: 'number',
      displayName: 'Error Status Code',
      group: 'Error',
      get(this: UploadFileInstance) {
        return this._internal.errorStatus;
      }
    },
    progressChanged: {
      type: 'signal',
      displayName: 'Progress Changed',
      group: 'Events'
    },
    progressTotalBytes: {
      type: 'number',
      displayName: 'Total Bytes',
      group: 'Progress',
      get(this: UploadFileInstance) {
        return this._internal.progressTotal;
      }
    },
    progressLoadedBytes: {
      type: 'number',
      displayName: 'Uploaded Bytes',
      group: 'Progress',
      get(this: UploadFileInstance) {
        return this._internal.progressLoaded;
      }
    },
    progressLoadedPercent: {
      type: 'number',
      displayName: 'Uploaded Percent',
      group: 'Progress',
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
    }
  }
};

export default {
  node: UploadFile
};
