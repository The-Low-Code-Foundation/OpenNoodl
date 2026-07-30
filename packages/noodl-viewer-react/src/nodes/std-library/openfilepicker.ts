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
    /** Latest failure message, for the `Error` output (NDA-004 §2). */
    error?: string;
  };
  _detachHandlers(): void;
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
          this._detachHandlers();

          const files = (e.target as HTMLInputElement).files;
          const file: PickedFile | undefined = files && files[0];

          input.value = ''; //reset value so the same file can be picked again

          // NDA-004 §2. This used to assign `files[0]` unconditionally and fire `Success`.
          // `change` can arrive with an empty `FileList` — a re-pick the user backed out of is
          // the common way — and the node then reported success while every one of its five
          // outputs read `undefined`, having also discarded whatever file *had* been picked. A
          // completion signal for an operation that produced nothing is the one thing the
          // Failure Contract says must not happen, and `undefined` on `Name`/`Type` is
          // indistinguishable from a file with no name.
          if (!file) {
            this.sendSignalOnOutput('cancelled');
            return;
          }

          this._internal.file = file;

          this.flagOutputDirty('file');
          this.flagOutputDirty('path');
          this.flagOutputDirty('name');
          this.flagOutputDirty('sizeInBytes');
          this.flagOutputDirty('type');

          this.sendSignalOnOutput('success');
        };

        /**
         * The outcome the node could not express at all.
         *
         * `<input type="file">` fires `cancel` when the dialog closes with nothing chosen
         * (Chrome 113+, Safari 16.4+, Firefox 109+). Before this there was no listener, so
         * "the user chose a file" and "the user changed their mind" were the same observable:
         * `Success` in one case and, for ever, nothing in the other. Anything an author put
         * behind `Open` — a spinner, a disabled button, a queued upload — had no way back.
         *
         * Deliberately **not** a `Failure`, and not raised on the error channel. A user
         * declining a dialog is a legitimate empty result, which the contract lists among the
         * things that must not raise; a `Failure` here would fire on a graph working exactly as
         * written. It is a *completion* signal — the contract's other clause, that an action
         * node must let downstream sequencing proceed without timing hacks.
         *
         * Older browsers simply never call it, which costs nothing: the node is no worse off
         * than it was, and the empty-`FileList` branch above catches the flow they do report.
         */
        const onCancel = () => {
          this._detachHandlers();
          this.sendSignalOnOutput('cancelled');
        };

        input.accept = this._internal.acceptedFileTypes;

        if (this._internal.capture) {
          input.capture = this._internal.capture;
        }

        input.onchange = onChange;
        input.oncancel = onCancel;

        // `click()` on a file input is refused in some contexts — a sandboxed frame without
        // `allow-modals` is the reachable one.
        //
        // Unguarded, that exception does not crash the app: `nodecontext.ts:220-228` wraps every
        // node's `update()` in a `try`/`catch` that only `console.error`s. It does two other
        // things though. `Node.update` rethrows after clearing `_isUpdating`, so the rest of
        // *this* node's pass — its remaining queued inputs and after-update callbacks — is
        // abandoned. And the only diagnosis is an unstructured console line with no code and no
        // provenance, invisible to `On App Error` and to every subscriber on the channel. Which
        // is to say the runtime's blanket catch is why this was never noticed, not a reason it
        // did not need reporting.
        //
        // The node is also left with no handlers attached, because no dialog was opened and a
        // stale `onchange` from this attempt would fire against a later one.
        try {
          input.click();
        } catch (e) {
          this._detachHandlers();
          const message =
            'Could not open the file picker: ' + ((e as Error) && (e as Error).message ? (e as Error).message : e);
          this._internal.error = message;
          this.flagOutputDirty('error');
          this.raiseRuntimeError('open-file-picker/open-failed', message);
          this.sendSignalOnOutput('failure');
        }
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
    },
    cancelled: {
      type: 'signal',
      group: 'Events',
      displayName: 'Cancelled'
    },
    failure: {
      type: 'signal',
      group: 'Events',
      displayName: 'Failure'
    },
    error: {
      type: 'string',
      group: 'Events',
      displayName: 'Error',
      get(this: OpenFilePickerInstance) {
        return this._internal.error;
      }
    }
  },
  methods: {
    /**
     * One `open` produces exactly one outcome, so both handlers come off as soon as either fires.
     *
     * The original only cleared `onchange`, and only on the success path. A cancelled dialog left
     * a live handler behind, so the *next* `open` had two candidate closures on the element until
     * assignment replaced one of them — harmless today only because there is a single element and
     * a single handler slot. With `oncancel` added there are two slots, and leaving them
     * independently armed is how a `Success` from one attempt arrives against another.
     */
    _detachHandlers(this: OpenFilePickerInstance) {
      const input = this._internal.inputElement;
      input.onchange = null;
      input.oncancel = null;
    }
  }
};

export default {
  node: OpenFilePicker
};
