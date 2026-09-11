import { NodeLibrary } from '@noodl-models/nodelibrary';
import { AggregateRecordsAdapter } from '@noodl-models/NodeTypeAdapters/AggregateRecordsAdapter';
import { CloudFunctionAdapter } from '@noodl-models/NodeTypeAdapters/CloudFunctionAdapter';
import {
  CloudQueryPortsAdapter,
  CloudRecordPortsAdapter,
  CloudScriptPortsAdapter
} from '@noodl-models/NodeTypeAdapters/CloudDynamicPortsAdapter';
import { FilterRecordsAdapter } from '@noodl-models/NodeTypeAdapters/FilterRecordsAdapter';
import { NamedPortsAdapter } from '@noodl-models/NodeTypeAdapters/NamedPortsAdapter';
import { PageInputsAdapter } from '@noodl-models/NodeTypeAdapters/PageInputsAdapter';
import { QueryRecordsAdapter } from '@noodl-models/NodeTypeAdapters/QueryRecordsAdapter';
import { RouterAdapter } from '@noodl-models/NodeTypeAdapters/RouterAdapter';
import { RouterNavigateAdapter } from '@noodl-models/NodeTypeAdapters/RouterNavigateAdapter';
import { SubscribeToChangesAdapter } from '@noodl-models/NodeTypeAdapters/SubscribeToChangesAdapter';
import { ProjectModel } from '@noodl-models/projectmodel';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';

const _adapters = {
  Router: () => RouterAdapter,
  RouterNavigate: () => RouterNavigateAdapter,
  PageInputs: () => PageInputsAdapter,
  DbCollection2: () => QueryRecordsAdapter,
  // FH-021. Same rule, worse consequence — see the adapter.
  SubscribeToChanges: () => SubscribeToChangesAdapter,
  FilterDBModels: () => FilterRecordsAdapter,
  CloudFunction2: () => CloudFunctionAdapter,
  AggregateRecords: () => AggregateRecordsAdapter,
  // WFA-009. The key is a label; unlike its neighbours this adapter is bound to
  // no node type — it acts on whatever the node library says has a
  // `namedports/list` rule.
  NamedPorts: () => NamedPortsAdapter,
  // SB-017. Three more labels, for the same reason: these are bound to node
  // types, but the types are already spoken for above (`DbCollection2` is
  // `QueryRecordsAdapter`'s key) and this map is keyed by label, not by type.
  // They act only inside cloud components — see the adapter's docblock.
  CloudScriptPorts: () => CloudScriptPortsAdapter,
  CloudRecordPorts: () => CloudRecordPortsAdapter,
  CloudQueryPorts: () => CloudQueryPortsAdapter
};

const _listeners = {
  componentAdded: [],
  componentRemoved: [],
  componentRenamed: [],
  componentDuplicated: [],
  nodeAdded: [],
  nodeRemoved: [],
  parametersChanged: [],
  connectionAdded: [],
  connectionRemoved: [],
  projectLoaded: []
};

EventDispatcher.instance.on(
  'Model.componentAdded',
  (e) => {
    _listeners.componentAdded.forEach((l) => {
      l(e.args);
    });
  },
  null
);

EventDispatcher.instance.on(
  'Model.componentRemoved',
  (e) => {
    _listeners.componentRemoved.forEach((l) => {
      l(e.args);
    });
  },
  null
);

EventDispatcher.instance.on(
  'Model.componentRenamed',
  (e) => {
    _listeners.componentRenamed.forEach((l) => {
      l(e.args);
    });
  },
  null
);

EventDispatcher.instance.on(
  'Model.componentDuplicated',
  (e) => {
    _listeners.componentDuplicated.forEach((l) => {
      l(e.args);
    });
  },
  null
);

/**
 * SB-017 — wires, not just nodes and parameters.
 *
 * `CloudDynamicPortsAdapter` derives a Record node's `prop-*` ports partly from
 * the wires attached to it (there is no schema to derive them from — see
 * `cloudDynamicPorts.ts`), so drawing one has to be able to mint its port. No
 * adapter listened to either event before, which is why they are added here
 * rather than only subscribed to.
 */
EventDispatcher.instance.on(
  'Model.connectionAdded',
  (e) => {
    _listeners.connectionAdded.forEach((l) => {
      l(e);
    });
  },
  null
);

EventDispatcher.instance.on(
  'Model.connectionRemoved',
  (e) => {
    _listeners.connectionRemoved.forEach((l) => {
      l(e);
    });
  },
  null
);

EventDispatcher.instance.on(
  'Model.nodeAdded',
  (e) => {
    const typename = e.args.model.type.name;

    _listeners.nodeAdded.forEach((l) => {
      l(e);
    });

    if (_listeners['nodeAdded:' + typename])
      _listeners['nodeAdded:' + typename].forEach((l) => {
        l(e);
      });
  },
  null
);

EventDispatcher.instance.on(
  'Model.nodeRemoved',
  (e) => {
    const typename = e.args.model.type.name;

    _listeners.nodeRemoved.forEach((l) => {
      l(e);
    });

    if (_listeners['nodeRemoved:' + typename])
      _listeners['nodeRemoved:' + typename].forEach((l) => {
        l(e);
      });
  },
  null
);

EventDispatcher.instance.on(
  'Model.parametersChanged',
  function (e) {
    const typename = e.model.type.name;

    _listeners.parametersChanged.forEach((l) => {
      l(e);
    });

    if (_listeners['parametersChanged:' + typename])
      _listeners['parametersChanged:' + typename].forEach((l) => {
        l(e);
      });
  },
  null
);

NodeLibrary.instance.on('libraryUpdated', () => {
  onProjectAndNodeLibraryLoaded();
});

//Trigger the "projectLoaded" event when a project is loaded AND the node library is ready
//keep track of when the event has fired so it doesn't get triggered multiple times
let projectLoaded = false;

EventDispatcher.instance.on(
  'ProjectModel.instanceHasChanged',
  () => {
    projectLoaded = false;
    onProjectAndNodeLibraryLoaded();
  },
  null
);

function onProjectAndNodeLibraryLoaded() {
  if (!projectLoaded && NodeLibrary.instance.isLoaded() && ProjectModel.instance) {
    projectLoaded = true;
    _listeners.projectLoaded.forEach((l) => l());
  }
}

function _registerNewAdapter(adapter) {
  const a = new adapter();
  Object.keys(a.events).forEach((key) => {
    if (_listeners[key] === undefined) _listeners[key] = [];
    _listeners[key].push(a.events[key]);
  });
  return a;
}

const _adapterInstances = {};

Object.keys(_adapters).forEach((adapterName) => {
  _adapterInstances[adapterName] = _registerNewAdapter(_adapters[adapterName]());
});
