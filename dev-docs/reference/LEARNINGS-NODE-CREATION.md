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
      type: 'string',           // See "Port Types" section below
      displayName: 'Input Name',
      group: 'General',         // Group in property panel
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
    require('./src/nodes/std-library/data/mynode'),
    
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
        items: ['net.noodl.MyNode', 'REST2']  // Add your node name here
      }
    ]
  },
  // ... more categories ...
];
```

---

## Port Types

### Common Input/Output Types

| Type | Description | Example Use |
|------|-------------|-------------|
| `string` | Text value | URLs, names, content |
| `number` | Numeric value | Counts, sizes, coordinates |
| `boolean` | True/false | Toggles, conditions |
| `signal` | Trigger without data | Action buttons, events |
| `object` | JSON object | API responses, data structures |
| `array` | List of items | Collections, results |
| `color` | Color value | Styling |
| `*` | Any type | Generic ports |

### Input-Specific Types

| Type | Description |
|------|-------------|
| `{ name: 'enum', enums: [...] }` | Dropdown selection |
| `{ name: 'stringlist' }` | List of strings (comma-separated) |
| `{ name: 'number', min, max }` | Number with constraints |

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

**Cause:** Method name doesn't match pattern `inputName + 'Trigger'`.

**Fix:** Ensure signal handler method is named correctly (e.g., `fetchTrigger` for input `fetch`).

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

| Node | File | Good Example Of |
|------|------|-----------------|
| REST | `data/restnode.js` | Full-featured data node with scripts |
| HTTP | `data/httpnode.js` | Dynamic ports, configuration |
| String | `variables/string.js` | Simple variable node |
| Counter | `counter.js` | Stateful logic node |
| Condition | `condition.js` | Boolean logic |

---

*Last Updated: December 2024*
