# Creating Nodes in OpenNoodl

This guide documents the complete process for creating new nodes in the OpenNoodl runtime, based on learnings from building the HTTP Request node.

---

## Overview

Nodes in Noodl are defined in the `noodl-runtime` package and need to be:

1. **Created** - Define the node in a `.js` file
2. **Registered** - Add to `noodl-runtime.js`
3. **Indexed** - Add to `nodelibraryexport.js` for Node Picker visibility

---

## Step 1: Create the Node File

Create a new file in the appropriate category folder:

```
packages/noodl-runtime/src/nodes/std-library/
├── data/           # Data nodes (REST, HTTP, collections)
├── variables/      # Variable nodes (string, number, boolean)
├── user/           # User authentication nodes
└── *.js            # General utility nodes
```

### Basic Node Structure

```javascript
'use strict';

var MyNode = {
  // REQUIRED: Unique identifier for the node
  name: 'net.noodl.MyNode',

  // REQUIRED: Display name in Node Picker and canvas
  displayNodeName: 'My Node',

  // OPTIONAL: Documentation URL
  docs: 'https://docs.noodl.net/nodes/category/my-node',

  // REQUIRED: Category for organization (Data, Visual, Logic, etc.)
  category: 'Data',

  // OPTIONAL: Node color theme
  // Options: 'data' (green), 'visual' (blue), 'component' (purple), 'javascript' (pink), 'default' (gray)
  color: 'data',

  // OPTIONAL: Search keywords for Node Picker
  searchTags: ['my', 'node', 'custom', 'example'],

  // OPTIONAL: Called when node instance is created
  initialize: function () {
    this._internal.myData = {};
  },

  // OPTIONAL: Data shown in debug inspector
  getInspectInfo() {
    return this._internal.inspectData;
  },

  // REQUIRED: Define input ports
  inputs: {
    inputName: {
      type: 'string', // See "Port Types" section below
      displayName: 'Input Name',
      group: 'General', // Group in property panel
      default: 'default value'
    },
    doAction: {
      type: 'signal',
      displayName: 'Do Action',
      group: 'Actions'
    }
  },

  // REQUIRED: Define output ports
  outputs: {
    outputValue: {
      type: 'string',
      displayName: 'Output Value',
      group: 'Results'
    },
    success: {
      type: 'signal',
      displayName: 'Success',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    }
  },

  // OPTIONAL: Methods to handle input changes
  methods: {
    setInputName: function (value) {
      this._internal.inputName = value;
      // Optionally trigger output update
      this.flagOutputDirty('outputValue');
    },

    // Signal handler - name must match input name with 'Trigger' suffix
    doActionTrigger: function () {
      // Perform the action
      const result = this.processInput(this._internal.inputName);
      this._internal.outputValue = result;

      // Update outputs
      this.flagOutputDirty('outputValue');
      this.sendSignalOnOutput('success');
    }
  },

  // OPTIONAL: Return output values
  getOutputValue: function (name) {
    if (name === 'outputValue') {
      return this._internal.outputValue;
    }
  }
};

// REQUIRED: Export the node
module.exports = {
  node: MyNode,

  // OPTIONAL: Setup function for dynamic ports
  setup: function (context, graphModel) {
    // See "Dynamic Ports" section below
  }
};
```

---

## Step 2: Register the Node

Add the node to the `registerNodes` function in `packages/noodl-runtime/noodl-runtime.js`:

```javascript
function registerNodes(noodlRuntime) {
  [
    // ... existing nodes ...

    // Add your new node
    require('./src/nodes/std-library/data/mynode')

    // ... more nodes ...
  ].forEach((node) => noodlRuntime.registerNode(node));
}
```

**Important:** The order in this array doesn't matter, but group related nodes together for readability.

---

## Step 3: Add to Node Picker Index

**CRITICAL:** This step is often forgotten! Without it, the node won't appear in the Node Picker.

Edit `packages/noodl-runtime/src/nodelibraryexport.js` and add your node to the appropriate category in the `coreNodes` array:

```javascript
const coreNodes = [
  // ... other categories ...
  {
    name: 'Read & Write Data',
    description: 'Arrays, objects, cloud data',
    type: 'data',
    subCategories: [
      // ... other subcategories ...
      {
        name: 'External Data',
        items: ['net.noodl.MyNode', 'REST2'] // Add your node name here
      }
    ]
  }
  // ... more categories ...
];
```

---

## Port Types

### Common Input/Output Types

| Type      | Description          | Example Use                    |
| --------- | -------------------- | ------------------------------ |
| `string`  | Text value           | URLs, names, content           |
| `number`  | Numeric value        | Counts, sizes, coordinates     |
| `boolean` | True/false           | Toggles, conditions            |
| `signal`  | Trigger without data | Action buttons, events         |
| `object`  | JSON object          | API responses, data structures |
| `array`   | List of items        | Collections, results           |
| `color`   | Color value          | Styling                        |
| `*`       | Any type             | Generic ports                  |

### Input-Specific Types

| Type                             | Description                       |
| -------------------------------- | --------------------------------- |
| `{ name: 'enum', enums: [...] }` | Dropdown selection                |
| `{ name: 'stringlist' }`         | List of strings (comma-separated) |
| `{ name: 'number', min, max }`   | Number with constraints           |

### Example Enum Input

```javascript
inputs: {
  method: {
    type: {
      name: 'enum',
      enums: [
        { value: 'GET', label: 'GET' },
        { value: 'POST', label: 'POST' },
        { value: 'PUT', label: 'PUT' },
        { value: 'DELETE', label: 'DELETE' }
      ]
    },
    displayName: 'Method',
    default: 'GET',
    group: 'Request'
  }
}
```

---

## Dynamic Ports

Dynamic ports are created at runtime based on configuration. This is useful when the number or names of ports depend on user settings.

### Setup Function Pattern

```javascript
module.exports = {
  node: MyNode,

  setup: function (context, graphModel) {
    // Only run in editor, not deployed
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function updatePorts(nodeId, parameters, editorConnection) {
      const ports = [];

      // Always include base ports from node definition
      // Add dynamic ports based on parameters
      if (parameters.items) {
        parameters.items.split(',').forEach((item) => {
          ports.push({
            name: 'item-' + item.trim(),
            displayName: item.trim(),
            type: 'string',
            plug: 'input',
            group: 'Items'
          });
        });
      }

      // Send ports to editor
      editorConnection.sendDynamicPorts(nodeId, ports);
    }

    function managePortsForNode(node) {
      updatePorts(node.id, node.parameters || {}, context.editorConnection);

      node.on('parameterUpdated', function (event) {
        if (event.name === 'items') {
          updatePorts(node.id, node.parameters, context.editorConnection);
        }
      });
    }

    // Listen for graph import completion
    graphModel.on('editorImportComplete', () => {
      // Listen for new nodes of this type
      graphModel.on('nodeAdded.net.noodl.MyNode', function (node) {
        managePortsForNode(node);
      });

      // Handle existing nodes
      for (const node of graphModel.getNodesWithType('net.noodl.MyNode')) {
        managePortsForNode(node);
      }
    });
  }
};
```

---

## Handling Signals

Signals are trigger-based ports (no data, just an event).

### Receiving Signals (Input)

```javascript
// In methods object
methods: {
  // Pattern: inputName + 'Trigger'
  fetchTrigger: function () {
    // Called when 'fetch' signal is triggered
    this.doFetch();
  }
}
```

### Sending Signals (Output)

```javascript
// Send a signal pulse
this.sendSignalOnOutput('success');
this.sendSignalOnOutput('failure');
```

---

## Updating Outputs

When an output value changes, you must flag it as dirty:

```javascript
// Flag a single output
this.flagOutputDirty('outputValue');

// Flag multiple outputs
this.flagOutputDirty('response');
this.flagOutputDirty('statusCode');

// Then send signal if needed
this.sendSignalOnOutput('complete');
```

---

## Async Operations

For asynchronous operations (API calls, file I/O), use standard async patterns:

```javascript
methods: {
  fetchTrigger: function () {
    const self = this;

    fetch(this._internal.url)
      .then(response => response.json())
      .then(data => {
        self._internal.response = data;
        self.flagOutputDirty('response');
        self.sendSignalOnOutput('success');
      })
      .catch(error => {
        self._internal.error = error.message;
        self.flagOutputDirty('error');
        self.sendSignalOnOutput('failure');
      });
  }
}
```

---

## Debug Inspector

Provide data for the debug inspector popup:

```javascript
getInspectInfo() {
  // Return an array of objects with type and value
  return [
    { type: 'text', value: 'Status: ' + this._internal.status },
    { type: 'value', value: this._internal.response }
  ];
}
```

---

## Testing Your Node

1. Start the dev server: `npm run dev`
2. Open the Node Picker (click in the node graph)
3. Search for your node by name or search tags
4. Navigate to the category to verify placement
5. Add the node and test inputs/outputs
6. Check console for any errors

---

## ⚠️ CRITICAL GOTCHAS - READ BEFORE CREATING NODES

These issues will cause silent failures with NO error messages. They were discovered during the HTTP node debugging session (December 2024) and cost hours of debugging time.

---

### 🔴 GOTCHA #1: Never Override `setInputValue` in prototypeExtensions

**THE BUG:**

```javascript
// ❌ DEADLY - This silently breaks ALL signal inputs
prototypeExtensions: {
  setInputValue: function (name, value) {
    this._internal.inputValues[name] = value;  // Signal setters NEVER called!
  }
}
```

**WHY IT BREAKS:**

- `prototypeExtensions.setInputValue` **completely overrides** `Node.prototype.setInputValue`
- The base method contains `input.set.call(this, value)` which triggers signal callbacks
- Without it, signals never fire - NO errors, just silent failure

**THE FIX:**

```javascript
// ✅ SAFE - Use a different method name for storing dynamic values
prototypeExtensions: {
  _storeInputValue: function (name, value) {
    this._internal.inputValues[name] = value;
  },

  registerInputIfNeeded: function (name) {
    // Register dynamic inputs with _storeInputValue, not setInputValue
    if (name.startsWith('body-')) {
      return this.registerInput(name, {
        set: this._storeInputValue.bind(this, name)
      });
    }
  }
}
```

---

### 🔴 GOTCHA #2: Dynamic Ports REPLACE Static Ports

**THE BUG:**

```javascript
// Node has static inputs defined in inputs: {}
inputs: {
  url: { type: 'string', set: function(v) {...} },
  fetch: { type: 'signal', valueChangedToTrue: function() {...} }
},

// But setup function only sends dynamic ports
function updatePorts(nodeId, parameters, editorConnection) {
  const ports = [
    { name: 'headers', ... },
    { name: 'queryParams', ... }
  ];
  // ❌ MISSING url, fetch - they won't appear in editor!
  editorConnection.sendDynamicPorts(nodeId, ports);
}
```

**WHY IT BREAKS:**

- `sendDynamicPorts()` tells the editor "these are ALL the ports for this node"
- Static `inputs` are NOT automatically merged
- The editor only shows dynamic ports, connections to static ports fail

**THE FIX:**

```javascript
// ✅ SAFE - Include ALL ports in dynamic ports array
function updatePorts(nodeId, parameters, editorConnection) {
  const ports = [];

  // Dynamic configuration ports
  ports.push({ name: 'headers', type: {...}, plug: 'input' });
  ports.push({ name: 'queryParams', type: {...}, plug: 'input' });

  // MUST include static ports too!
  ports.push({ name: 'url', type: 'string', plug: 'input', group: 'Request' });
  ports.push({ name: 'fetch', type: 'signal', plug: 'input', group: 'Actions' });
  ports.push({ name: 'cancel', type: 'signal', plug: 'input', group: 'Actions' });

  // Include outputs too
  ports.push({ name: 'success', type: 'signal', plug: 'output', group: 'Events' });

  editorConnection.sendDynamicPorts(nodeId, ports);
}
```

---

### 🔴 GOTCHA #3: Configuration Inputs Need Explicit Registration

**THE BUG:**

```javascript
// Dynamic ports send method, bodyType, etc. to editor
ports.push({ name: 'method', type: { name: 'enum', ... } });
ports.push({ name: 'bodyType', type: { name: 'enum', ... } });

// ❌ Values never reach runtime - no setter registered!
// User selects POST in editor, but doFetch() always uses GET
doFetch: function() {
  const method = this._internal.method || 'GET';  // Always undefined!
}
```

**WHY IT BREAKS:**

- Dynamic port values are sent to runtime as input values via `setInputValue`
- But `registerInputIfNeeded` is only called for ports not in static `inputs`
- If there's no setter, the value is lost

**THE FIX:**

```javascript
// ✅ SAFE - Register setters for all config inputs
prototypeExtensions: {
  // Setter methods
  setMethod: function (value) { this._internal.method = value || 'GET'; },
  setBodyType: function (value) { this._internal.bodyType = value; },
  setHeaders: function (value) { this._internal.headers = value || ''; },

  registerInputIfNeeded: function (name) {
    if (this.hasInput(name)) return;

    // Configuration inputs - bind to their setters
    const configSetters = {
      method: this.setMethod.bind(this),
      bodyType: this.setBodyType.bind(this),
      headers: this.setHeaders.bind(this),
      timeout: this.setTimeout.bind(this)
    };

    if (configSetters[name]) {
      return this.registerInput(name, { set: configSetters[name] });
    }

    // Dynamic inputs for prefixed ports
    if (name.startsWith('body-') || name.startsWith('header-')) {
      return this.registerInput(name, {
        set: this._storeInputValue.bind(this, name)
      });
    }
  }
}
```

---

### 🔴 GOTCHA #4: Signal Inputs Use `valueChangedToTrue`, Not `set`

**THE BUG:**

```javascript
// ❌ WRONG - This won't trigger on signal
inputs: {
  fetch: {
    type: 'signal',
    set: function() {
      this.doFetch();  // Never called!
    }
  }
}
```

**WHY IT BREAKS:**

- Signal inputs don't use `set` - they use `valueChangedToTrue`
- The runtime wraps signals with `EdgeTriggeredInput.createSetter()` which tracks state transitions
- Signals only fire on FALSE → TRUE transition

**THE FIX:**

```javascript
// ✅ CORRECT - Use valueChangedToTrue for signals
inputs: {
  fetch: {
    type: 'signal',
    displayName: 'Fetch',
    group: 'Actions',
    valueChangedToTrue: function () {
      this.scheduleFetch();
    }
  },
  cancel: {
    type: 'signal',
    displayName: 'Cancel',
    group: 'Actions',
    valueChangedToTrue: function () {
      this.cancelFetch();
    }
  }
}
```

---

### 🔴 GOTCHA #5: Node Registration Path Matters (Signals Not Wrapping)

**THE BUG:**

- Nodes in `noodl-runtime/noodl-runtime.js` → Go through `defineNode()`
- Nodes in `noodl-viewer-react/register-nodes.js` → Go through `defineNode()`
- Raw node object passed directly → Does NOT go through `defineNode()`

**WHY IT MATTERS:**

- `defineNode()` in `nodedefinition.js` wraps signal inputs with `EdgeTriggeredInput.createSetter()`
- Without `defineNode()`, signals are registered but never fire
- The `{node, setup}` export format automatically calls `defineNode()`

**THE FIX:**

```javascript
// ✅ CORRECT - Always export with {node, setup} format
module.exports = {
  node: MyNode, // Goes through defineNode()
  setup: function (context, graphModel) {
    // Dynamic port setup
  }
};

// ✅ ALSO CORRECT - Call defineNode explicitly
const NodeDefinition = require('./nodedefinition');
module.exports = NodeDefinition.defineNode(MyNode);
```

---

### 🔴 GOTCHA #6: Signal in Static `inputs` + Dynamic Ports = Duplicate Ports (Dec 2025)

**THE BUG:**

```javascript
// Signal defined in static inputs with handler
inputs: {
  fetch: {
    type: 'signal',
    valueChangedToTrue: function() { this.scheduleFetch(); }
  }
}

// updatePorts() ALSO adds fetch - CAUSES DUPLICATE!
function updatePorts(nodeId, parameters, editorConnection) {
  const ports = [];
  // ... other ports ...
  ports.push({ name: 'fetch', type: 'signal', plug: 'input' }); // ❌ Duplicate!
  editorConnection.sendDynamicPorts(nodeId, ports);
}
```

**SYMPTOM:** When trying to connect to the node, TWO "Fetch" signals appear in the connection popup.

**WHY IT BREAKS:**

- GOTCHA #2 says "include static ports in dynamic ports" which is true for MOST ports
- But signals with `valueChangedToTrue` handlers ALREADY have a runtime registration
- Adding them again in `updatePorts()` creates a duplicate visual port
- The handler still works, but UX is confusing

**THE FIX:**

```javascript
// ✅ CORRECT - Only define signal in static inputs, NOT in updatePorts()
inputs: {
  fetch: {
    type: 'signal',
    valueChangedToTrue: function() { this.scheduleFetch(); }
  }
}

function updatePorts(nodeId, parameters, editorConnection) {
  const ports = [];
  // ... dynamic ports ...

  // NOTE: 'fetch' signal is defined in static inputs (with valueChangedToTrue handler)
  // DO NOT add it here again or it will appear twice in the connection popup

  // ... other ports ...
  editorConnection.sendDynamicPorts(nodeId, ports);
}
```

**RULE:** Signals with `valueChangedToTrue` handlers → ONLY in static `inputs`. All other ports (value inputs, outputs) → in `updatePorts()` dynamic ports.

---

### 🔴 GOTCHA #7: Require Path Depth for noodl-runtime (Dec 2025)

**THE BUG:**

```javascript
// File: src/nodes/std-library/data/mynode.js
// Trying to require noodl-runtime.js at package root

const NoodlRuntime = require('../../../noodl-runtime'); // ❌ WRONG - only 3 levels
// This breaks the entire runtime with "Cannot find module" error
```

**WHY IT MATTERS:**

- From `src/nodes/std-library/data/` you need to go UP 4 levels to reach the package root
- Path: data → std-library → nodes → src → (package root)
- One wrong `../` and the entire app fails to load

**THE FIX:**

```javascript
// ✅ CORRECT - Count the directories carefully
// From src/nodes/std-library/data/mynode.js:
const NoodlRuntime = require('../../../../noodl-runtime'); // 4 levels

// Reference: cloudstore.js at src/api/ uses 2 levels:
const NoodlRuntime = require('../../noodl-runtime'); // 2 levels from src/api/
```

**Quick Reference:**

| File Location                 | Levels to Package Root | Require Path                |
| ----------------------------- | ---------------------- | --------------------------- |
| `src/api/`                    | 2                      | `../../noodl-runtime`       |
| `src/nodes/`                  | 2                      | `../../noodl-runtime`       |
| `src/nodes/std-library/`      | 3                      | `../../../noodl-runtime`    |
| `src/nodes/std-library/data/` | 4                      | `../../../../noodl-runtime` |

---

### 🔴 GOTCHA #8: Port Properties Must Be Inside `type` Object (Jan 2026)

**THE BUG:**

```javascript
// Port-level properties are NOT passed to property panel
generatedCode: {
  type: {
    name: 'string',
    codeeditor: 'javascript'
  },
  readOnly: true  // ❌ Not accessible in property panel!
}
```

**WHY IT BREAKS:**

- Port object only contains: `['name', 'type', 'plug', 'group', 'displayName', 'index']`
- Custom properties like `readOnly` at port level are NOT included in this list
- Property panel accesses ports via `port.type.propertyName`, not `port.propertyName`
- Result: `port.readOnly` is `undefined`, property panel ignores the flag

**THE FIX:**

```javascript
// ✅ CORRECT - Put custom properties inside type object
generatedCode: {
  type: {
    name: 'string',
    codeeditor: 'javascript',
    readOnly: true  // ✅ Accessible as port.type.readOnly
  },
  displayName: 'Generated code',
  group: 'Advanced'
}
```

**DEBUGGING TIP:**

Add logging to see what properties are actually available:

```javascript
console.log('Port properties:', {
  name: p.name,
  readOnly: p.readOnly, // undefined ❌
  typeReadOnly: p.type?.readOnly, // true ✅
  allKeys: Object.keys(p) // Shows actual properties
});
```

**RULE:** Any custom property you want accessible in the property panel must be inside the `type` object.

---

## Complete Working Pattern (HTTP Node Reference)

Here's the proven pattern from the HTTP node that handles all gotchas:

```javascript
var MyNode = {
  name: 'net.noodl.MyNode',
  displayNodeName: 'My Node',
  category: 'Data',
  color: 'data',

  initialize: function () {
    this._internal.inputValues = {};  // For dynamic input storage
    this._internal.method = 'GET';     // Config defaults
  },

  // Static inputs - signals and essential ports
  inputs: {
    url: {
      type: 'string',
      set: function (value) { this._internal.url = value; }
    },
    fetch: {
      type: 'signal',
      valueChangedToTrue: function () { this.scheduleFetch(); }
    }
  },

  outputs: {
    response: { type: '*', getter: function() { return this._internal.response; } },
    success: { type: 'signal' },
    failure: { type: 'signal' }
  },

  prototypeExtensions: {
    // Store dynamic values WITHOUT overriding setInputValue
    _storeInputValue: function (name, value) {
      this._internal.inputValues[name] = value;
    },

    // Configuration setters
    setMethod: function (value) { this._internal.method = value || 'GET'; },
    setHeaders: function (value) { this._internal.headers = value || ''; },

    // Register ALL dynamic inputs
    registerInputIfNeeded: function (name) {
      if (this.hasInput(name)) return;

      // Config inputs
      const configSetters = {
        method: this.setMethod.bind(this),
        headers: this.setHeaders.bind(this)
      };
      if (configSetters[name]) {
        return this.registerInput(name, { set: configSetters[name] });
      }

      // Prefixed dynamic inputs
      if (name.startsWith('header-') || name.startsWith('body-')) {
        return this.registerInput(name, {
          set: this._storeInputValue.bind(this, name)
        });
      }
    },

    scheduleFetch: function () {
      this.scheduleAfterInputsHaveUpdated(this.doFetch.bind(this));
    },

    doFetch: function () {
      const method = this._internal.method;  // Now correctly captured!
      // ... fetch implementation
    }
  }
};

module.exports = {
  node: MyNode,
  setup: function (context, graphModel) {
    function updatePorts(nodeId, parameters, editorConnection) {
      const ports = [];

      // Config ports
      ports.push({ name: 'method', type: { name: 'enum', enums: [...] }, plug: 'input' });
      ports.push({ name: 'headers', type: { name: 'stringlist' }, plug: 'input' });

      // MUST include static ports!
      ports.push({ name: 'url', type: 'string', plug: 'input' });
      ports.push({ name: 'fetch', type: 'signal', plug: 'input' });

      // Outputs
      ports.push({ name: 'response', type: '*', plug: 'output' });
      ports.push({ name: 'success', type: 'signal', plug: 'output' });

      editorConnection.sendDynamicPorts(nodeId, ports);
    }
    // ... rest of setup
  }
};
```

---

## Common Issues

### Node Not Appearing in Node Picker

**Cause:** Node not added to `nodelibraryexport.js` coreNodes array.

**Fix:** Add the node name to the appropriate subcategory items array.

### "Cannot read property of undefined" Errors

**Cause:** Accessing `this._internal` before `initialize()` runs.

**Fix:** Always check for undefined or initialize values in `initialize()`.

### Outputs Not Updating

**Cause:** Forgot to call `flagOutputDirty()`.

**Fix:** Call `this.flagOutputDirty('portName')` after setting internal value.

### Signal Not Firing

**Cause #1:** Method name pattern wrong - use `valueChangedToTrue`, not `inputName + 'Trigger'`.

**Cause #2:** Custom `setInputValue` overriding base - see GOTCHA #1.

**Cause #3:** Signal not in dynamic ports - see GOTCHA #2.

**Fix:** Review ALL gotchas above!

---

## File Checklist for New Nodes

- [ ] Create node file in `packages/noodl-runtime/src/nodes/std-library/[category]/`
- [ ] Add `require()` to `packages/noodl-runtime/noodl-runtime.js`
- [ ] Add node name to `packages/noodl-runtime/src/nodelibraryexport.js` coreNodes
- [ ] Test node appears in Node Picker
- [ ] Test all inputs/outputs work correctly
- [ ] Verify debug inspector shows useful info

---

## Reference Files

When creating new nodes, reference these existing nodes for patterns:

| Node      | File                  | Good Example Of                      |
| --------- | --------------------- | ------------------------------------ |
| REST      | `data/restnode.js`    | Full-featured data node with scripts |
| HTTP      | `data/httpnode.js`    | Dynamic ports, configuration         |
| String    | `variables/string.js` | Simple variable node                 |
| Counter   | `counter.js`          | Stateful logic node                  |
| Condition | `condition.js`        | Boolean logic                        |

---

_Last Updated: December 2024_
