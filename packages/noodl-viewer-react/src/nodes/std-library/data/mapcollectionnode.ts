'use strict';

import { Node } from '@noodl/runtime';
import Collection from '@noodl/runtime/src/collection';
import Model from '@noodl/runtime/src/model';
import type {
  CollectionLike,
  ModelLike,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';


const defaultMapCode =
  'map({\n' +
  '\t// Here you add mappings between the input object and the mapped output object.\n' +
  "\t//myOutputProp: 'inputProp',\n" +
  "\t//anotherProperty: function(object) { return object.get('someProperty') + ' ' + object.get('otherProp') }\n" +
  '})\n';

/**
 * One entry of the object the author's script passes to `map(…)`: either the name of a
 * property to copy across, or a function computing the value from the source record.
 */
type PropertyMapping = string | ((model: ModelLike) => unknown);

/** The single argument the author's script is compiled against. */
type MapDeclarator = (mappings: Record<string, PropertyMapping>) => void;

/** `this` inside the Array Map node. */
interface MapCollectionInstance extends NodeInstance {
  _internal: {
    /** The bound source collection, or `undefined` between binds. */
    collection?: CollectionLike;
    /** Result of the last run. Fresh collection each time — never mutated in place. */
    mappedCollection?: CollectionLike;
    mapCode?: string;
    /**
     * The compiled script, or `undefined` when it failed to parse. Nothing guards the
     * call site below, so a script with a syntax error throws on every change.
     */
    mapFunc?: (map: MapDeclarator, object: ModelLike) => void;
    collectionChangedCallback(): void;
  };
  collectionChangedScheduled?: boolean;
  setCollection(collection: CollectionLike): void;
  unbindCurrentCollection(): void;
  bindCollection(collection: CollectionLike): void;
  scheduleMap(): void;
}

const MapCollectionNode: NodeDefinitionOptions = {
  name: 'Map Collection',
  docs: 'https://docs.noodl.net/nodes/data/array/array-map',
  displayNodeName: 'Array Map',
  shortDesc: 'Map array fields',
  category: 'Data',
  color: 'data',
  initialize: function (this: MapCollectionInstance) {
    this._internal.collectionChangedCallback = () => {
      this.scheduleMap();
    };

    //     this._internal.mappedCollection = Collection.get();
  },
  inputs: {
    items: {
      type: 'array',
      displayName: 'Items',
      group: 'General',
      set: function (this: MapCollectionInstance, value: CollectionLike) {
        this.setCollection(value);
        this.scheduleMap();
      }
    },
    mapScript: {
      type: {
        name: 'string',
        allowEditOnly: true,
        codeeditor: 'javascript'
      },
      displayName: 'Script',
      default: defaultMapCode,
      set: function (this: MapCollectionInstance, value: string) {
        this._internal.mapCode = value;
        try {
          this._internal.mapFunc = new Function('map', 'object', this._internal.mapCode) as MapCollectionInstance['_internal']['mapFunc'];
        } catch (e) {
          this._internal.mapFunc = undefined;
          console.log('Error while parsing map script: ' + e);
        }
        this.scheduleMap();
      }
    },
    // NDA-013: Array Map had no manual "recompute now" input at all — only the automatic
    // paths (`items`/`mapScript` changing, or a `change` event on the bound collection,
    // which a raw mutation such as `push` never fires — the A1 defect). `scheduleMap` reads
    // `this._internal.collection` fresh on every run, so pulsing this is enough to recover
    // from a source that changed without notifying.
    refresh: {
      type: 'signal',
      group: 'General',
      displayName: 'Refresh',
      valueChangedToTrue: function (this: MapCollectionInstance) {
        this.scheduleMap();
      }
    }
  },
  outputs: {
    items: {
      type: 'array',
      displayName: 'Items',
      group: 'General',
      getter: function (this: MapCollectionInstance) {
        return this._internal.mappedCollection;
      }
    },
    count: {
      type: 'number',
      displayName: 'Count',
      group: 'General',
      getter: function (this: MapCollectionInstance) {
        return this._internal.mappedCollection ? this._internal.mappedCollection.size() : 0;
      }
    },
    modified: {
      group: 'Events',
      type: 'signal',
      displayName: 'Changed'
    }
  },
  prototypeExtensions: {
    setCollection: function (this: MapCollectionInstance, collection: CollectionLike) {
      this.bindCollection(collection);
      this.flagOutputDirty('items');
      this.flagOutputDirty('count');
    },
    unbindCurrentCollection: function (this: MapCollectionInstance) {
      const collection = this._internal.collection;
      if (!collection) return;
      collection.off('change', this._internal.collectionChangedCallback);
      this._internal.collection = undefined;
    },
    bindCollection: function (this: MapCollectionInstance, collection: CollectionLike) {
      this.unbindCurrentCollection();
      this._internal.collection = collection;
      collection && collection.on('change', this._internal.collectionChangedCallback);
    },
    _onNodeDeleted: function (this: MapCollectionInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this.unbindCurrentCollection();
    },
    scheduleMap: function (this: MapCollectionInstance) {
      if (this.collectionChangedScheduled) return;
      this.collectionChangedScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.collectionChangedScheduled = false;
        if (this._internal.collection === undefined) return;

        const mappedModels = this._internal.collection.map((model) => {
          const m = Model.create();
          this._internal.mapFunc(function (mappings) {
            for (const key in mappings) {
              const mapping = mappings[key];
              if (typeof mapping === 'function') {
                m.set(key, mapping(model));
              } else if (typeof mapping === 'string') {
                m.set(key, model.get(mapping));
              }
            }
          }, model);
          return m;
        });

        this._internal.mappedCollection = Collection.create(mappedModels);

        this.sendSignalOnOutput('modified');
        this.flagOutputDirty('items');
        this.flagOutputDirty('count');
      });
    }
  }
};

const MapCollectionModule: NodeModule = {
  node: MapCollectionNode,
  setup: function (context: NodeContextLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }
  }
};

export default MapCollectionModule;
