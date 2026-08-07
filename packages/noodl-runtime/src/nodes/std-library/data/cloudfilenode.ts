import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import CloudFile = require('../../../api/cloudfile');

/** `this` inside the Cloud File node — it holds one file and reports its URL and name. */
interface CloudFileNodeInstance extends NodeInstance {
  _internal: {
    cloudFile?: CloudFile;
  };
}

const CloudFileNode: NodeDefinitionOptions = {
  name: 'Cloud File',
  docs: 'https://docs.noodl.net/nodes/data/cloud-data/cloud-file',
  category: 'Cloud Services',
  color: 'data',
  getInspectInfo(this: CloudFileNodeInstance) {
    return this._internal.cloudFile && this._internal.cloudFile.getUrl();
  },
  outputs: {
    url: {
      type: 'string',
      displayName: 'URL',
      group: 'General',
      description: 'Address the file can be fetched from; a private file needs a Sign File URL node before this link works',
      get(this: CloudFileNodeInstance) {
        return this._internal.cloudFile && this._internal.cloudFile.getUrl();
      }
    },
    name: {
      type: 'string',
      displayName: 'Name',
      group: 'General',
      description: 'Original file name as it was uploaded, without the storage prefix',
      get(this: CloudFileNodeInstance) {
        if (!this._internal.cloudFile) return;

        //parse prefixes the file with a guid_
        //remove it so the name is the same as the original file name
        const n = this._internal.cloudFile.getName().split('_');
        return n.length === 1 ? n[0] : n.slice(1).join('_');
      }
    },
    // BCN-007's live pass found the backend reports both on a real 201 and
    // `normalizeFileRef` keeps both, but nothing downstream could read them.
    // Both stay `undefined` rather than `''`/`0` on a backend that does not
    // report them, and on a file read back out of a saved record property —
    // see `cloudfile.ts` for why that distinction is kept rather than defaulted.
    contentType: {
      type: 'string',
      displayName: 'Content Type',
      group: 'General',
      description: 'MIME type the backend recorded on upload; empty on a backend that does not report one, and on a file read back from a record property',
      get(this: CloudFileNodeInstance) {
        return this._internal.cloudFile && this._internal.cloudFile.getContentType();
      }
    },
    size: {
      type: 'number',
      displayName: 'Size',
      group: 'General',
      description: 'Size in bytes the backend recorded on upload; empty on a backend that does not report one, and on a file read back from a record property',
      get(this: CloudFileNodeInstance) {
        return this._internal.cloudFile && this._internal.cloudFile.getSize();
      }
    }
  },
  inputs: {
    file: {
      type: 'cloudfile',
      displayName: 'Cloud File',
      group: 'General',
      description:
        'Stored file to read, as an Upload File node or a record property produces it; any other value leaves the previous file in place',
      set(this: CloudFileNodeInstance, value: unknown) {
        if (value instanceof CloudFile === false) {
          return;
        }
        this._internal.cloudFile = value as CloudFile;
        this.flagOutputDirty('name');
        this.flagOutputDirty('url');
        this.flagOutputDirty('contentType');
        this.flagOutputDirty('size');
      }
    }
  }
};

const CloudFileNodeModule: NodeModule = {
  node: CloudFileNode
};

export = CloudFileNodeModule;
