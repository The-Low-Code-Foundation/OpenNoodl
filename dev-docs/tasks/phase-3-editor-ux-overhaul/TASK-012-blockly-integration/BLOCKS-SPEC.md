# Blockly Blocks Specification

This document defines the custom Blockly blocks for Noodl integration.

---

## Block Categories & Colors

| Category | Color (HSL Hue) | Description |
|----------|-----------------|-------------|
| Inputs/Outputs | 230 (Blue) | Node I/O |
| Variables | 330 (Pink) | Noodl.Variables |
| Objects | 20 (Orange) | Noodl.Objects |
| Arrays | 260 (Purple) | Noodl.Arrays |
| Events | 180 (Cyan) | Signals & triggers |
| Logic | 210 (Standard) | If/else, comparisons |
| Math | 230 (Standard) | Math operations |
| Text | 160 (Standard) | String operations |

---

## Inputs/Outputs Blocks

### noodl_define_input

Declares an input port on the node.

```javascript
// Block Definition
{
  type: 'noodl_define_input',
  message0: '📥 Define input %1 type %2',
  args0: [
    { type: 'field_input', name: 'NAME', text: 'myInput' },
    { type: 'field_dropdown', name: 'TYPE', options: [
      ['any', '*'],
      ['string', 'string'],
      ['number', 'number'],
      ['boolean', 'boolean'],
      ['object', 'object'],
      ['array', 'array']
    ]}
  ],
  colour: 230,
  tooltip: 'Defines an input port that appears on the node',
  helpUrl: ''
}

// Generator
Blockly.JavaScript['noodl_define_input'] = function(block) {
  // No runtime code - used for I/O detection only
  return '';
};
```

### noodl_get_input

Gets a value from a node input.

```javascript
// Block Definition
{
  type: 'noodl_get_input',
  message0: '📥 get input %1',
  args0: [
    { type: 'field_input', name: 'NAME', text: 'value' }
  ],
  output: null, // Can connect to any type
  colour: 230,
  tooltip: 'Gets the value from an input port',
  helpUrl: ''
}

// Generator
Blockly.JavaScript['noodl_get_input'] = function(block) {
  var name = block.getFieldValue('NAME');
  var code = 'Inputs["' + name + '"]';
  return [code, Blockly.JavaScript.ORDER_MEMBER];
};
```

### noodl_define_output

Declares an output port on the node.

```javascript
// Block Definition
{
  type: 'noodl_define_output',
  message0: '📤 Define output %1 type %2',
  args0: [
    { type: 'field_input', name: 'NAME', text: 'result' },
    { type: 'field_dropdown', name: 'TYPE', options: [
      ['any', '*'],
      ['string', 'string'],
      ['number', 'number'],
      ['boolean', 'boolean'],
      ['object', 'object'],
      ['array', 'array']
    ]}
  ],
  colour: 230,
  tooltip: 'Defines an output port that appears on the node',
  helpUrl: ''
}

// Generator
Blockly.JavaScript['noodl_define_output'] = function(block) {
  // No runtime code - used for I/O detection only
  return '';
};
```

### noodl_set_output

Sets a value on a node output.

```javascript
// Block Definition
{
  type: 'noodl_set_output',
  message0: '📤 set output %1 to %2',
  args0: [
    { type: 'field_input', name: 'NAME', text: 'result' },
    { type: 'input_value', name: 'VALUE' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 230,
  tooltip: 'Sets the value of an output port',
  helpUrl: ''
}

// Generator
Blockly.JavaScript['noodl_set_output'] = function(block) {
  var name = block.getFieldValue('NAME');
  var value = Blockly.JavaScript.valueToCode(block, 'VALUE', 
    Blockly.JavaScript.ORDER_ASSIGNMENT) || 'null';
  return 'Outputs["' + name + '"] = ' + value + ';\n';
};
```

### noodl_define_signal_input

Declares a signal input port.

```javascript
// Block Definition
{
  type: 'noodl_define_signal_input',
  message0: '⚡ Define signal input %1',
  args0: [
    { type: 'field_input', name: 'NAME', text: 'trigger' }
  ],
  colour: 180,
  tooltip: 'Defines a signal input that can trigger logic',
  helpUrl: ''
}
```

### noodl_define_signal_output

Declares a signal output port.

```javascript
// Block Definition
{
  type: 'noodl_define_signal_output',
  message0: '⚡ Define signal output %1',
  args0: [
    { type: 'field_input', name: 'NAME', text: 'done' }
  ],
  colour: 180,
  tooltip: 'Defines a signal output that can trigger other nodes',
  helpUrl: ''
}
```

### noodl_send_signal

Sends a signal output.

```javascript
// Block Definition
{
  type: 'noodl_send_signal',
  message0: '⚡ send signal %1',
  args0: [
    { type: 'field_input', name: 'NAME', text: 'done' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 180,
  tooltip: 'Sends a signal to connected nodes',
  helpUrl: ''
}

// Generator
Blockly.JavaScript['noodl_send_signal'] = function(block) {
  var name = block.getFieldValue('NAME');
  return 'this.sendSignalOnOutput("' + name + '");\n';
};
```

---

## Variables Blocks

### noodl_get_variable

Gets a global variable value.

```javascript
// Block Definition
{
  type: 'noodl_get_variable',
  message0: '📖 get variable %1',
  args0: [
    { type: 'field_input', name: 'NAME', text: 'myVariable' }
  ],
  output: null,
  colour: 330,
  tooltip: 'Gets the value of a global Noodl variable',
  helpUrl: ''
}

// Generator
Blockly.JavaScript['noodl_get_variable'] = function(block) {
  var name = block.getFieldValue('NAME');
  var code = 'Noodl.Variables["' + name + '"]';
  return [code, Blockly.JavaScript.ORDER_MEMBER];
};
```

### noodl_set_variable

Sets a global variable value.

```javascript
// Block Definition
{
  type: 'noodl_set_variable',
  message0: '✏️ set variable %1 to %2',
  args0: [
    { type: 'field_input', name: 'NAME', text: 'myVariable' },
    { type: 'input_value', name: 'VALUE' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 330,
  tooltip: 'Sets the value of a global Noodl variable',
  helpUrl: ''
}

// Generator
Blockly.JavaScript['noodl_set_variable'] = function(block) {
  var name = block.getFieldValue('NAME');
  var value = Blockly.JavaScript.valueToCode(block, 'VALUE',
    Blockly.JavaScript.ORDER_ASSIGNMENT) || 'null';
  return 'Noodl.Variables["' + name + '"] = ' + value + ';\n';
};
```

---

## Objects Blocks

### noodl_get_object

Gets an object by ID.

```javascript
// Block Definition
{
  type: 'noodl_get_object',
  message0: '📦 get object %1',
  args0: [
    { type: 'input_value', name: 'ID', check: 'String' }
  ],
  output: 'Object',
  colour: 20,
  tooltip: 'Gets a Noodl Object by its ID',
  helpUrl: ''
}

// Generator
Blockly.JavaScript['noodl_get_object'] = function(block) {
  var id = Blockly.JavaScript.valueToCode(block, 'ID',
    Blockly.JavaScript.ORDER_NONE) || '""';
  var code = 'Noodl.Objects[' + id + ']';
  return [code, Blockly.JavaScript.ORDER_MEMBER];
};
```

### noodl_get_object_property

Gets a property from an object.

```javascript
// Block Definition
{
  type: 'noodl_get_object_property',
  message0: '📖 get %1 from object %2',
  args0: [
    { type: 'field_input', name: 'PROPERTY', text: 'name' },
    { type: 'input_value', name: 'OBJECT' }
  ],
  output: null,
  colour: 20,
  tooltip: 'Gets a property value from an object',
  helpUrl: ''
}

// Generator
Blockly.JavaScript['noodl_get_object_property'] = function(block) {
  var property = block.getFieldValue('PROPERTY');
  var object = Blockly.JavaScript.valueToCode(block, 'OBJECT',
    Blockly.JavaScript.ORDER_MEMBER) || '{}';
  var code = object + '["' + property + '"]';
  return [code, Blockly.JavaScript.ORDER_MEMBER];
};
```

### noodl_set_object_property

Sets a property on an object.

```javascript
// Block Definition
{
  type: 'noodl_set_object_property',
  message0: '✏️ set %1 on object %2 to %3',
  args0: [
    { type: 'field_input', name: 'PROPERTY', text: 'name' },
    { type: 'input_value', name: 'OBJECT' },
    { type: 'input_value', name: 'VALUE' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 20,
  tooltip: 'Sets a property value on an object',
  helpUrl: ''
}

// Generator
Blockly.JavaScript['noodl_set_object_property'] = function(block) {
  var property = block.getFieldValue('PROPERTY');
  var object = Blockly.JavaScript.valueToCode(block, 'OBJECT',
    Blockly.JavaScript.ORDER_MEMBER) || '{}';
  var value = Blockly.JavaScript.valueToCode(block, 'VALUE',
    Blockly.JavaScript.ORDER_ASSIGNMENT) || 'null';
  return object + '["' + property + '"] = ' + value + ';\n';
};
```

### noodl_create_object

Creates a new object.

```javascript
// Block Definition
{
  type: 'noodl_create_object',
  message0: '➕ create object with ID %1',
  args0: [
    { type: 'input_value', name: 'ID', check: 'String' }
  ],
  output: 'Object',
  colour: 20,
  tooltip: 'Creates a new Noodl Object with the given ID',
  helpUrl: ''
}

// Generator
Blockly.JavaScript['noodl_create_object'] = function(block) {
  var id = Blockly.JavaScript.valueToCode(block, 'ID',
    Blockly.JavaScript.ORDER_NONE) || 'Noodl.Object.guid()';
  var code = 'Noodl.Object.create(' + id + ')';
  return [code, Blockly.JavaScript.ORDER_FUNCTION_CALL];
};
```

---

## Arrays Blocks

### noodl_get_array

Gets an array by name.

```javascript
// Block Definition
{
  type: 'noodl_get_array',
  message0: '📋 get array %1',
  args0: [
    { type: 'field_input', name: 'NAME', text: 'myArray' }
  ],
  output: 'Array',
  colour: 260,
  tooltip: 'Gets a Noodl Array by name',
  helpUrl: ''
}

// Generator
Blockly.JavaScript['noodl_get_array'] = function(block) {
  var name = block.getFieldValue('NAME');
  var code = 'Noodl.Arrays["' + name + '"]';
  return [code, Blockly.JavaScript.ORDER_MEMBER];
};
```

### noodl_array_add

Adds an item to an array.

```javascript
// Block Definition
{
  type: 'noodl_array_add',
  message0: '➕ add %1 to array %2',
  args0: [
    { type: 'input_value', name: 'ITEM' },
    { type: 'input_value', name: 'ARRAY', check: 'Array' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 260,
  tooltip: 'Adds an item to the end of an array',
  helpUrl: ''
}

// Generator
Blockly.JavaScript['noodl_array_add'] = function(block) {
  var item = Blockly.JavaScript.valueToCode(block, 'ITEM',
    Blockly.JavaScript.ORDER_NONE) || 'null';
  var array = Blockly.JavaScript.valueToCode(block, 'ARRAY',
    Blockly.JavaScript.ORDER_MEMBER) || '[]';
  return array + '.push(' + item + ');\n';
};
```

### noodl_array_remove

Removes an item from an array.

```javascript
// Block Definition
{
  type: 'noodl_array_remove',
  message0: '➖ remove %1 from array %2',
  args0: [
    { type: 'input_value', name: 'ITEM' },
    { type: 'input_value', name: 'ARRAY', check: 'Array' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 260,
  tooltip: 'Removes an item from an array',
  helpUrl: ''
}

// Generator
Blockly.JavaScript['noodl_array_remove'] = function(block) {
  var item = Blockly.JavaScript.valueToCode(block, 'ITEM',
    Blockly.JavaScript.ORDER_NONE) || 'null';
  var array = Blockly.JavaScript.valueToCode(block, 'ARRAY',
    Blockly.JavaScript.ORDER_MEMBER) || '[]';
  return array + '.splice(' + array + '.indexOf(' + item + '), 1);\n';
};
```

### noodl_array_length

Gets the length of an array.

```javascript
// Block Definition
{
  type: 'noodl_array_length',
  message0: '🔢 length of array %1',
  args0: [
    { type: 'input_value', name: 'ARRAY', check: 'Array' }
  ],
  output: 'Number',
  colour: 260,
  tooltip: 'Gets the number of items in an array',
  helpUrl: ''
}

// Generator
Blockly.JavaScript['noodl_array_length'] = function(block) {
  var array = Blockly.JavaScript.valueToCode(block, 'ARRAY',
    Blockly.JavaScript.ORDER_MEMBER) || '[]';
  var code = array + '.length';
  return [code, Blockly.JavaScript.ORDER_MEMBER];
};
```

### noodl_array_foreach

Loops over array items.

```javascript
// Block Definition
{
  type: 'noodl_array_foreach',
  message0: '🔄 for each %1 in %2',
  args0: [
    { type: 'field_variable', name: 'VAR', variable: 'item' },
    { type: 'input_value', name: 'ARRAY', check: 'Array' }
  ],
  message1: 'do %1',
  args1: [
    { type: 'input_statement', name: 'DO' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 260,
  tooltip: 'Executes code for each item in the array',
  helpUrl: ''
}

// Generator
Blockly.JavaScript['noodl_array_foreach'] = function(block) {
  var variable = Blockly.JavaScript.nameDB_.getName(
    block.getFieldValue('VAR'), Blockly.VARIABLE_CATEGORY_NAME);
  var array = Blockly.JavaScript.valueToCode(block, 'ARRAY',
    Blockly.JavaScript.ORDER_MEMBER) || '[]';
  var statements = Blockly.JavaScript.statementToCode(block, 'DO');
  return 'for (var ' + variable + ' of ' + array + ') {\n' + 
    statements + '}\n';
};
```

---

## Event Blocks

### noodl_on_signal

Event handler for when a signal input is triggered.

```javascript
// Block Definition
{
  type: 'noodl_on_signal',
  message0: '⚡ when %1 is triggered',
  args0: [
    { type: 'field_input', name: 'SIGNAL', text: 'trigger' }
  ],
  message1: 'do %1',
  args1: [
    { type: 'input_statement', name: 'DO' }
  ],
  colour: 180,
  tooltip: 'Runs code when the signal input is triggered',
  helpUrl: ''
}

// Generator - This is a special case, generates a handler function
Blockly.JavaScript['noodl_on_signal'] = function(block) {
  var signal = block.getFieldValue('SIGNAL');
  var statements = Blockly.JavaScript.statementToCode(block, 'DO');
  // This generates a named handler that the runtime will call
  return '// Handler for signal: ' + signal + '\n' +
    'function _onSignal_' + signal + '() {\n' + 
    statements + 
    '}\n';
};
```

### noodl_on_variable_change

Event handler for when a variable changes.

```javascript
// Block Definition
{
  type: 'noodl_on_variable_change',
  message0: '👁️ when variable %1 changes',
  args0: [
    { type: 'field_input', name: 'NAME', text: 'myVariable' }
  ],
  message1: 'do %1',
  args1: [
    { type: 'input_statement', name: 'DO' }
  ],
  colour: 330,
  tooltip: 'Runs code when the variable value changes',
  helpUrl: ''
}
```

---

## I/O Detection Algorithm

```typescript
interface DetectedIO {
  inputs: Array<{ name: string; type: string }>;
  outputs: Array<{ name: string; type: string }>;
  signalInputs: string[];
  signalOutputs: string[];
}

function detectIO(workspace: Blockly.Workspace): DetectedIO {
  const result: DetectedIO = {
    inputs: [],
    outputs: [],
    signalInputs: [],
    signalOutputs: []
  };
  
  const blocks = workspace.getAllBlocks(false);
  
  for (const block of blocks) {
    switch (block.type) {
      case 'noodl_define_input':
        result.inputs.push({
          name: block.getFieldValue('NAME'),
          type: block.getFieldValue('TYPE')
        });
        break;
        
      case 'noodl_get_input':
        // Auto-detect from usage if not explicitly defined
        const inputName = block.getFieldValue('NAME');
        if (!result.inputs.find(i => i.name === inputName)) {
          result.inputs.push({ name: inputName, type: '*' });
        }
        break;
        
      case 'noodl_define_output':
        result.outputs.push({
          name: block.getFieldValue('NAME'),
          type: block.getFieldValue('TYPE')
        });
        break;
        
      case 'noodl_set_output':
        // Auto-detect from usage
        const outputName = block.getFieldValue('NAME');
        if (!result.outputs.find(o => o.name === outputName)) {
          result.outputs.push({ name: outputName, type: '*' });
        }
        break;
        
      case 'noodl_define_signal_input':
      case 'noodl_on_signal':
        const sigIn = block.getFieldValue('SIGNAL') || block.getFieldValue('NAME');
        if (!result.signalInputs.includes(sigIn)) {
          result.signalInputs.push(sigIn);
        }
        break;
        
      case 'noodl_define_signal_output':
      case 'noodl_send_signal':
        const sigOut = block.getFieldValue('NAME');
        if (!result.signalOutputs.includes(sigOut)) {
          result.signalOutputs.push(sigOut);
        }
        break;
    }
  }
  
  return result;
}
```

---

## Toolbox Configuration

```javascript
const LOGIC_BUILDER_TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Inputs/Outputs',
      colour: 230,
      contents: [
        { kind: 'block', type: 'noodl_define_input' },
        { kind: 'block', type: 'noodl_get_input' },
        { kind: 'block', type: 'noodl_define_output' },
        { kind: 'block', type: 'noodl_set_output' },
        { kind: 'block', type: 'noodl_define_signal_input' },
        { kind: 'block', type: 'noodl_define_signal_output' },
        { kind: 'block', type: 'noodl_send_signal' }
      ]
    },
    {
      kind: 'category',
      name: 'Events',
      colour: 180,
      contents: [
        { kind: 'block', type: 'noodl_on_signal' },
        { kind: 'block', type: 'noodl_on_variable_change' }
      ]
    },
    {
      kind: 'category',
      name: 'Variables',
      colour: 330,
      contents: [
        { kind: 'block', type: 'noodl_get_variable' },
        { kind: 'block', type: 'noodl_set_variable' }
      ]
    },
    {
      kind: 'category',
      name: 'Objects',
      colour: 20,
      contents: [
        { kind: 'block', type: 'noodl_get_object' },
        { kind: 'block', type: 'noodl_get_object_property' },
        { kind: 'block', type: 'noodl_set_object_property' },
        { kind: 'block', type: 'noodl_create_object' }
      ]
    },
    {
      kind: 'category',
      name: 'Arrays',
      colour: 260,
      contents: [
        { kind: 'block', type: 'noodl_get_array' },
        { kind: 'block', type: 'noodl_array_add' },
        { kind: 'block', type: 'noodl_array_remove' },
        { kind: 'block', type: 'noodl_array_length' },
        { kind: 'block', type: 'noodl_array_foreach' }
      ]
    },
    { kind: 'sep' },
    {
      kind: 'category',
      name: 'Logic',
      colour: 210,
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
        { kind: 'block', type: 'logic_ternary' }
      ]
    },
    {
      kind: 'category',
      name: 'Loops',
      colour: 120,
      contents: [
        { kind: 'block', type: 'controls_repeat_ext' },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for' },
        { kind: 'block', type: 'controls_flow_statements' }
      ]
    },
    {
      kind: 'category',
      name: 'Math',
      colour: 230,
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_single' },
        { kind: 'block', type: 'math_round' },
        { kind: 'block', type: 'math_modulo' },
        { kind: 'block', type: 'math_random_int' }
      ]
    },
    {
      kind: 'category',
      name: 'Text',
      colour: 160,
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'text_length' },
        { kind: 'block', type: 'text_isEmpty' },
        { kind: 'block', type: 'text_indexOf' },
        { kind: 'block', type: 'text_charAt' }
      ]
    }
  ]
};

// Simplified toolbox for Expression Builder
const EXPRESSION_BUILDER_TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Inputs',
      colour: 230,
      contents: [
        { kind: 'block', type: 'noodl_define_input' },
        { kind: 'block', type: 'noodl_get_input' }
      ]
    },
    {
      kind: 'category',
      name: 'Variables',
      colour: 330,
      contents: [
        { kind: 'block', type: 'noodl_get_variable' }
      ]
    },
    {
      kind: 'category',
      name: 'Logic',
      colour: 210,
      contents: [
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
        { kind: 'block', type: 'logic_ternary' }
      ]
    },
    {
      kind: 'category',
      name: 'Math',
      colour: 230,
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_single' },
        { kind: 'block', type: 'math_round' }
      ]
    },
    {
      kind: 'category',
      name: 'Text',
      colour: 160,
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'text_length' }
      ]
    }
  ]
};
```
