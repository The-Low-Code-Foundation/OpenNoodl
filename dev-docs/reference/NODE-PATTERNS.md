# Node Patterns Reference

How to create and modify nodes in OpenNoodl.

## Node Types

There are two main types of nodes:

1. **Runtime Nodes** (`noodl-runtime`) - Logic, data, utilities
2. **Visual Nodes** (`noodl-viewer-react`) - React components for UI

## Basic Node Structure

### Runtime Node (JavaScript)

Location: `packages/noodl-runtime/src/nodes/`

```javascript
'use strict';

const MyNode = {
  // === METADATA ===
  name: 'My.Custom.Node',           // Unique identifier
  displayName: 'My Custom Node',     // Shown in UI
  category: 'Custom',                // Node picker category
  color: 'data',                     // Node color theme
  docs: 'https://docs.example.com',  // Documentation link
  
  // === INITIALIZATION ===
  initialize() {
    // Called when node is created
    this._internal.myValue = '';
    this._internal.callbacks = [];
  },
  
  // === INPUTS ===
  inputs: {
    // Simple input
    textInput: {
      type: 'string',
      displayName: 'Text Input',
      group: 'General',
      default: '',
      set(value) {
        this._internal.textInput = value;
        this.flagOutputDirty('result');
      }
    },
    
    // Number with validation
    numberInput: {
      type: 'number',
      displayName: 'Number',
      group: 'General',
      default: 0,
      set(value) {
        if (typeof value !== 'number') return;
        this._internal.numberInput = value;
        this.flagOutputDirty('result');
      }
    },
    
    // Signal input (trigger)
    doAction: {
      type: 'signal',
      displayName: 'Do Action',
      group: 'Actions',
      valueChangedToTrue() {
        // Called when signal received
        this.performAction();
      }
    },
    
    // Boolean toggle
    enabled: {
      type: 'boolean',
      displayName: 'Enabled',
      group: 'General',
      default: true,
      set(value) {
        this._internal.enabled = value;
      }
    },
    
    // Dropdown/enum
    mode: {
      type: {
        name: 'enum',
        enums: [
          { value: 'mode1', label: 'Mode 1' },
          { value: 'mode2', label: 'Mode 2' }
        ]
      },
      displayName: 'Mode',
      group: 'General',
      default: 'mode1',
      set(value) {
        this._internal.mode = value;
      }
    }
  },
  
  // === OUTPUTS ===
  outputs: {
    // Value output
    result: {
      type: 'string',
      displayName: 'Result',
      group: 'General',
      getter() {
        return this._internal.result;
      }
    },
    
    // Signal output
    completed: {
      type: 'signal',
      displayName: 'Completed',
      group: 'Events'
    },
    
    // Error output
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      getter() {
        return this._internal.error;
      }
    }
  },
  
  // === METHODS ===
  methods: {
    performAction() {
      if (!this._internal.enabled) return;
      
      try {
        // Do something
        this._internal.result = 'Success';
        this.flagOutputDirty('result');
        this.sendSignalOnOutput('completed');
      } catch (e) {
        this._internal.error = e.message;
        this.flagOutputDirty('error');
      }
    },
    
    // Called when node is deleted
    _onNodeDeleted() {
      // Cleanup
      this._internal.callbacks = [];
    }
  },
  
  // === INSPECTOR (Debug Panel) ===
  getInspectInfo() {
    return {
      type: 'text',
      value: `Current: ${this._internal.result}`
    };
  }
};

module.exports = {
  node: MyNode
};
```

### Visual Node (React)

Location: `packages/noodl-viewer-react/src/nodes/`

```javascript
'use strict';

const { Node } = require('@noodl/noodl-runtime');

const MyVisualNode = {
  name: 'My.Visual.Node',
  displayName: 'My Visual Node',
  category: 'UI Elements',
  
  // Visual nodes need these
  allowChildren: true,        // Can have child nodes
  allowChildrenWithCategory: ['UI Elements'],  // Restrict child types
  
  getReactComponent() {
    return MyReactComponent;
  },
  
  // Frame updates for animations
  frame: {
    // Called every frame if registered
    update(context) {
      // Animation logic
    }
  },
  
  inputs: {
    // Standard style inputs
    backgroundColor: {
      type: 'color',
      displayName: 'Background Color',
      group: 'Style',
      default: 'transparent',
      set(value) {
        this.props.style.backgroundColor = value;
        this.forceUpdate();
      }
    },
    
    // Dimension with units
    width: {
      type: {
        name: 'number',
        units: ['px', '%', 'vw'],
        defaultUnit: 'px'
      },
      displayName: 'Width',
      group: 'Dimensions',
      set(value) {
        this.props.style.width = value.value + value.unit;
        this.forceUpdate();
      }
    }
  },
  
  outputs: {
    // DOM event outputs
    onClick: {
      type: 'signal',
      displayName: 'Click',
      group: 'Events'
    }
  },
  
  methods: {
    // Called when mounted
    didMount() {
      // Setup
    },
    
    // Called when unmounted  
    willUnmount() {
      // Cleanup
    }
  }
};

// React component
function MyReactComponent(props) {
  const handleClick = () => {
    props.noodlNode.sendSignalOnOutput('onClick');
  };
  
  return (
    <div style={props.style} onClick={handleClick}>
      {props.children}
    </div>
  );
}

module.exports = {
  node: MyVisualNode
};
```

## Common Patterns

### Scheduled Updates

Batch multiple input changes before processing:

```javascript
inputs: {
  value1: {
    set(value) {
      this._internal.value1 = value;
      this.scheduleProcess();
    }
  },
  value2: {
    set(value) {
      this._internal.value2 = value;
      this.scheduleProcess();
    }
  }
},
methods: {
  scheduleProcess() {
    if (this._internal.scheduled) return;
    this._internal.scheduled = true;
    
    this.scheduleAfterInputsHaveUpdated(() => {
      this._internal.scheduled = false;
      this.processValues();
    });
  },
  processValues() {
    // Process both values together
  }
}
```

### Async Operations

Handle promises and async work:

```javascript
inputs: {
  fetch: {
    type: 'signal',
    valueChangedToTrue() {
      this.doFetch();
    }
  }
},
methods: {
  async doFetch() {
    try {
      const response = await fetch(this._internal.url);
      const data = await response.json();
      
      this._internal.result = data;
      this.flagOutputDirty('result');
      this.sendSignalOnOutput('success');
    } catch (error) {
      this._internal.error = error.message;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');
    }
  }
}
```

### Collection/Model Binding

Work with Noodl's data system:

```javascript
const Collection = require('../../../collection');
const Model = require('../../../model');

inputs: {
  items: {
    type: 'array',
    set(value) {
      this.bindCollection(value);
    }
  }
},
methods: {
  bindCollection(collection) {
    // Unbind previous
    if (this._internal.collection) {
      this._internal.collection.off('change', this._internal.onChange);
    }
    
    this._internal.collection = collection;
    
    if (collection) {
      this._internal.onChange = () => {
        this.flagOutputDirty('count');
      };
      collection.on('change', this._internal.onChange);
    }
  }
}
```

### Dynamic Ports

Add ports based on configuration:

```javascript
inputs: {
  properties: {
    type: { name: 'stringlist', allowEditOnly: true },
    displayName: 'Properties',
    set(value) {
      // Register dynamic inputs/outputs based on list
      value.forEach(prop => {
        if (!this.hasInput('prop-' + prop)) {
          this.registerInput('prop-' + prop, {
            set(val) {
              this._internal.values[prop] = val;
            }
          });
        }
      });
    }
  }
}
```

## Input Types Reference

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text input | `type: 'string'` |
| `number` | Numeric input | `type: 'number'` |
| `boolean` | Toggle | `type: 'boolean'` |
| `color` | Color picker | `type: 'color'` |
| `signal` | Trigger/event | `type: 'signal'` |
| `array` | Array/collection | `type: 'array'` |
| `object` | Object/model | `type: 'object'` |
| `component` | Component reference | `type: 'component'` |
| `enum` | Dropdown selection | `type: { name: 'enum', enums: [...] }` |
| `stringlist` | Editable list | `type: { name: 'stringlist' }` |
| `number` with units | Dimension | `type: { name: 'number', units: [...] }` |

## Node Colors

Available color themes for nodes:

- `data` - Blue (data operations)
- `logic` - Purple (logic/control)
- `visual` - Green (UI elements)
- `component` - Orange (component utilities)
- `default` - Gray

## Registering Nodes

Add to the node library export:

```javascript
// In packages/noodl-runtime/src/nodelibraryexport.js
const MyNode = require('./nodes/my-node');

// Add to appropriate category in coreNodes array
```

## Testing Nodes

```javascript
// Example test structure
describe('MyNode', () => {
  it('should process input correctly', () => {
    const node = createNode('My.Custom.Node');
    node.setInput('textInput', 'hello');
    
    expect(node.getOutput('result')).toBe('HELLO');
  });
});
```
