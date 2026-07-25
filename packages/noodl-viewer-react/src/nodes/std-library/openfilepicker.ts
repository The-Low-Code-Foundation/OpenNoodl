import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

/**
 * `path` is not a standard `File` member — it is Electron's addition, and the `path`
 * output below is undefined in a browser. Declared rather than cast so the source says so.
 */
type PickedFile = File & { path?: string };

interface OpenFilePickerInstance extends NodeInstance {
  _internal: {
    inputElement: HTMLInputElement;
    file?: PickedFile;
    acceptedFileTypes?: string;
    capture?: string;
  };
}

const OpenFilePicker: NodeDefinitionOptions = {
  name: 'Open File Picker',
  docs: 'https://docs.noodl.net/nodes/utilities/open-file-picker',
  category: 'Utilities',
  // initialize creates a DOM input element, so the node cannot even be
  // constructed server-side.
  ssr: { compat: 'client-only', note: 'File dialogs only exist in the browser.' },
  getInspectInfo(this: OpenFilePickerInstance) {
    if (this._internal.file) {
      return this._internal.file.path;
    }
  },
  initialize(this: OpenFilePickerInstance) {
    //for some reason the input element has to be created here, it doesn't
    //work predictably in Safari when created in the open signal function.
    //Creating it here and reusing it seems to work correctly in all browsers.
    const input = document.createElement('input');
    input.type = 'file';

    this._internal.inputElement = input;
  },
  inputs: {
    open: {
      type: 'signal',
      displayName: 'Open',
      group: 'Actions',
      valueChangedToTrue(this: OpenFilePickerInstance) {
        const input = this._internal.inputElement;

        const onChange = (e: Event) => {
          this._internal.file = (e.target as HTMLInputElement).files[0];

          this.flagOutputDirty('file');
          this.flagOutputDirty('path');
          this.flagOutputDirty('name');
          this.flagOutputDirty('sizeInBytes');
          this.flagOutputDirty('type');

          this.sendSignalOnOutput('success');

          input.onchange = null;
          input.value = ''; //reset value so the same file can be picked again
        };

        input.accept = this._internal.acceptedFileTypes;

        if (this._internal.capture) {
          input.capture = this._internal.capture;
        }

        input.onchange = onChange;
        input.click();
      }
    },
    acceptedFileTypes: {
      group: 'General',
      type: 'string',
      displayName: 'Accepted file types',
      set(this: OpenFilePickerInstance, value: string) {
        this._internal.acceptedFileTypes = value;
      }
    },
    capture: {
      group: 'General',
      type: 'string',
      displayName: 'Capture',
      set(this: OpenFilePickerInstance, value: string) {
        this._internal.capture = value;
      }
    }
  },
  outputs: {
    file: {
      type: '*',
      displayName: 'File',
      group: 'General',
      get(this: OpenFilePickerInstance) {
        return this._internal.file;
      }
    },
    path: {
      displayName: 'Path',
      group: 'Metadata',
      type: 'string',
      get(this: OpenFilePickerInstance) {
        return this._internal.file && this._internal.file.path;
      }
    },
    name: {
      displayName: 'Name',
      group: 'Metadata',
      type: 'string',
      get(this: OpenFilePickerInstance) {
        return this._internal.file && this._internal.file.name;
      }
    },
    sizeInBytes: {
      displayName: 'Size in bytes',
      group: 'Metadata',
      type: 'number',
      get(this: OpenFilePickerInstance) {
        return this._internal.file && this._internal.file.size;
      }
    },
    type: {
      displayName: 'Type',
      group: 'Metadata',
      type: 'string',
      get(this: OpenFilePickerInstance) {
        return this._internal.file && this._internal.file.type;
      }
    },
    success: {
      type: 'signal',
      group: 'Events',
      displayName: 'Success'
    }
  }
};

export default {
  node: OpenFilePicker
};
