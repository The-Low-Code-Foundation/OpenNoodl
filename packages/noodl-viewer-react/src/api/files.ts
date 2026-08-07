const CloudStore = require('@noodl/runtime/src/api/cloudstore');
const CloudFile = require('@noodl/runtime/src/api/cloudfile');

export interface FileUploadOptions {
  /** Receives the upload progress event as the browser reports it. */
  onProgress?: (progress: unknown) => void;
}

/**
 * `Noodl.Files` — the file half of the JavaScript API a project's own script nodes
 * use. Resolves with a `CloudFile` wrapper rather than the raw backend response.
 */
const files = {
  async upload(file: File | Blob, options?: FileUploadOptions): Promise<unknown> {
    return new Promise((resolve, reject) => {
      CloudStore.instance.uploadFile({
        file,
        onUploadProgress: (p: unknown) => {
          options && options.onProgress && options.onProgress(p);
        },
        success: (response: unknown) => {
          resolve(new CloudFile(response));
        },
        error: (e: unknown) => {
          reject(e);
        }
      });
    });
  }
};

export default files;
