'use strict';

function formatDynamicPorts(nodeMetadata) {
  const dynamicports = [];

  for (const dp of nodeMetadata.dynamicports) {
    if (dp.ports || dp.template || dp.port || dp.channelPort) {
      //same format as editor expects, no need to transform it
      dynamicports.push(dp);
    } else if (dp.inputs || dp.outputs) {
      //inputs and outputs is just list of names
      //need to pull the metadata from the inputs/outputs since they
      //won't be registered by the editor (it's either a regular port
      // or a dynamic port, can't register both)
      const ports = [];

      if (dp.inputs) {
        for (const inputName of dp.inputs) {
          ports.push(formatPort(inputName, nodeMetadata.inputs[inputName], 'input'));
        }
      }

      if (dp.outputs) {
        for (const outputName of dp.outputs) {
          ports.push(formatPort(outputName, nodeMetadata.outputs[outputName], 'output'));
        }
      }

      const dynamicPortGroup = {
        name: dp.name || 'conditionalports/basic',
        condition: dp.condition,
        ports
      };

      dynamicports.push(dynamicPortGroup);
    }
  }

  return dynamicports;
}

function formatPort(portName, portData, plugType) {
  var port = {
    name: portName,
    type: portData.type,
    plug: plugType
  };
  if (portData.group) {
    port.group = portData.group;
  }
  if (portData.displayName) {
    port.displayName = portData.displayName;
  }
  if (portData.description) {
    port.description = portData.description;
  }
  if (portData.editorName) {
    port.editorName = portData.editorName;
  }
  if (portData.default !== undefined) {
    port.default = portData.default;
  }
  if (portData.hasOwnProperty('index')) {
    port.index = portData.index;
  }
  if (portData.tooltip) {
    port.tooltip = portData.tooltip;
  }
  if (portData.tab) {
    port.tab = portData.tab;
  }
  if (portData.popout) {
    port.popout = portData.popout;
  }
  if (portData.allowVisualStates) {
    port.allowVisualStates = portData.allowVisualStates;
  }
  return port;
}

function generateNodeLibrary(nodeRegister) {
  var obj = {
    //note: needs to include ALL types
    typecasts: [
      {
        from: 'string',
        to: ['number', 'boolean', 'image', 'color', 'enum', 'textStyle', 'dimension', 'array', 'object']
      },
      {
        from: 'boolean',
        to: ['number', 'string', 'signal']
      },
      {
        from: 'number',
        to: ['boolean', 'string', 'dimension']
      },
      {
        from: 'date',
        to: ['string']
      },
      {
        from: 'signal',
        to: ['boolean', 'number']
      },
      {
        from: 'image',
        to: []
      },
      {
        from: 'cloudfile',
        to: ['string', 'image']
      },
      {
        from: 'color',
        to: []
      },
      {
        from: 'enum',
        to: []
      },
      {
        from: 'object',
        to: []
      },
      {
        from: 'domelement',
        to: []
      },
      {
        from: 'reference',
        to: []
      },
      {
        from: 'font',
        to: []
      },
      {
        from: 'textStyle',
        to: ['string']
      },
      {
        // Collection is deprecated but supported via typecasts
        from: 'collection',
        to: ['array']
      },
      {
        from: 'array',
        to: ['collection']
      }
    ],
    dynamicports: [
      {
        type: 'conditionalports',
        name: 'basic'
      },
      {
        type: 'expand',
        name: 'basic'
      }
    ],
    // UIX-005: hues harmonised with the NodeGX category tokens (violet/azure/
    // emerald/pink/neutral). The editor canvas paints from CanvasTheme (CSS
    // tokens) — this blob remains the category taxonomy + the palette for
    // consumers that don't go through CanvasTheme (node picker, connection
    // popup, references panel, headless preview). Shape is load-bearing; keep
    // the keys exactly as they are.
    colors: {
      nodes: {
        component: {
          base: '#363050',
          baseHighlighted: '#464066',
          header: '#2a2440',
          headerHighlighted: '#363050',
          outline: '#2a2440',
          outlineHighlighted: '#a78bfa',
          text: '#EEF2F6'
        },
        visual: {
          base: '#1e3450',
          baseHighlighted: '#2a4466',
          header: '#16283e',
          headerHighlighted: '#1e3450',
          outline: '#16283e',
          outlineHighlighted: '#5ca9ff',
          text: '#EEF2F6'
        },
        data: {
          base: '#1c3f2b',
          baseHighlighted: '#275239',
          header: '#14301f',
          headerHighlighted: '#1c3f2b',
          outline: '#14301f',
          outlineHighlighted: '#45d08a',
          text: '#EEF2F6'
        },
        javascript: {
          base: '#4c2940',
          baseHighlighted: '#603552',
          header: '#3a1f30',
          headerHighlighted: '#4c2940',
          outline: '#3a1f30',
          outlineHighlighted: '#f776c4',
          text: '#EEF2F6'
        },
        default: {
          base: '#222933',
          baseHighlighted: '#2c3540',
          header: '#181d24',
          headerHighlighted: '#222933',
          outline: '#181d24',
          outlineHighlighted: '#6b7682',
          text: '#EEF2F6'
        }
      },
      connections: {
        signal: {
          normal: '#35c3e8',
          highlighted: '#7ad8f0',
          pulsing: '#ffffff'
        },
        default: {
          normal: '#45d08a',
          highlighted: '#7de0ac',
          pulsing: '#ffffff'
        }
      }
    },
    nodetypes: [
      {
        name: 'Component Children',
        shortDesc: 'This node is a placeholder for where children of this component will be inserted.',
        docs: 'https://docs.noodl.net/nodes/component-utilities/component-children',
        color: 'component',
        allowAsChild: true,
        category: 'Visual',
        haveComponentChildren: ['Visual']
      }
    ]
  };

  var nodeTypes = Object.keys(nodeRegister._constructors);

  nodeTypes.forEach(function (type) {
    var nodeMetadata = nodeRegister._constructors[type].metadata;

    var nodeObj = {
      name: type,
      searchTags: nodeMetadata.searchTags
    };
    obj.nodetypes.push(nodeObj);

    if (nodeMetadata.version) {
      nodeObj.version = nodeMetadata.version;
    }
    if (nodeMetadata.displayNodeName) {
      nodeObj.displayNodeName = nodeMetadata.displayNodeName;
    }
    if (nodeMetadata.nodeDoubleClickAction) {
      nodeObj.nodeDoubleClickAction = nodeMetadata.nodeDoubleClickAction;
    }
    if (nodeMetadata.shortDesc) {
      nodeObj.shortDesc = nodeMetadata.shortDesc;
    }
    if (nodeMetadata.module) {
      nodeObj.module = nodeMetadata.module;
    }
    if (nodeMetadata.deprecated) {
      nodeObj.deprecated = true;
    }
    if (nodeMetadata.haveComponentPorts) {
      nodeObj.haveComponentPorts = true;
    }
    if (nodeMetadata.category === 'Visual') {
      nodeObj.allowAsChild = true;
      nodeObj.allowAsExportRoot = true;
      nodeObj.color = 'visual';
    }

    if (nodeMetadata.allowAsExportRoot !== undefined) {
      nodeObj.allowAsExportRoot = nodeMetadata.allowAsExportRoot;
    }

    if (nodeMetadata.allowChildren) {
      nodeObj.allowChildrenWithCategory = ['Visual'];
      nodeObj.color = 'visual';
    }
    if (nodeMetadata.allowChildrenWithCategory) {
      nodeObj.allowChildrenWithCategory = nodeMetadata.allowChildrenWithCategory;
    }
    if (nodeMetadata.singleton) {
      nodeObj.singleton = true;
    }
    if (nodeMetadata.allowAsChild) {
      nodeObj.allowAsChild = true;
    }
    if (nodeMetadata.docs) {
      nodeObj.docs = nodeMetadata.docs;
    }
    if (nodeMetadata.shortDocs) {
      nodeObj.shortDocs = nodeMetadata.shortDocs;
    } else if (nodeMetadata.docs && nodeMetadata.docs.indexOf('https://docs.noodl.net') === 0) {
      nodeObj.shortDocs = nodeMetadata.docs.replace('/#', '') + '-short.md';
    }
    nodeObj.category = nodeMetadata.category;

    if (nodeMetadata.panels) {
      nodeObj.panels = nodeMetadata.panels;
    }
    if (nodeMetadata.usePortAsLabel) {
      nodeObj.usePortAsLabel = nodeMetadata.usePortAsLabel;
      nodeObj.portLabelTruncationMode = nodeMetadata.portLabelTruncationMode;
    }
    if (nodeMetadata.color) {
      nodeObj.color = nodeMetadata.color;
    }
    if (nodeMetadata.dynamicports) {
      nodeObj.dynamicports = formatDynamicPorts(nodeMetadata);
    }
    if (nodeMetadata.exportDynamicPorts) {
      nodeObj.exportDynamicPorts = nodeMetadata.exportDynamicPorts;
    }
    if (nodeMetadata.visualStates) {
      nodeObj.visualStates = nodeMetadata.visualStates;
    }
    if (nodeMetadata.useVariants) {
      nodeObj.useVariants = nodeMetadata.useVariants;
    }
    if (nodeMetadata.connectionPanel) {
      nodeObj.connectionPanel = nodeMetadata.connectionPanel;
    }
    nodeObj.ports = [];

    var dynamicports = nodeObj.dynamicports || [];
    var selectorNames = {};
    var conditionalPortNames = {};

    //flag conditional ports so they don't get added from the normal ports, making them appear twice in the export
    /* dynamicports.filter(d=> d.name === 'conditionalports/basic')
            .forEach(d=> {
                d.ports.forEach(port=> {
                    conditionalPortNames[port.plug + '/' + port.name] = true;
                });
            });*/

    //same for channel ports
    dynamicports
      .filter((d) => d.channelPort !== undefined)
      .forEach((port) => {
        conditionalPortNames[port.channelPort.plug + '/' + port.channelPort.name] = true;
      });

    if (dynamicports.length) {
      nodeObj.dynamicports = dynamicports;
    }

    Object.keys(nodeMetadata.inputs).forEach(function (inputName) {
      if (
        selectorNames.hasOwnProperty('input/' + inputName) ||
        conditionalPortNames.hasOwnProperty('input/' + inputName)
      ) {
        //this is a selector or dynamic port. It's already been registered
        return;
      }
      var port = nodeMetadata.inputs[inputName];
      if (port.exportToEditor === false) {
        return;
      }

      nodeObj.ports.push(formatPort(inputName, port, 'input'));
    });

    function exportOutput(name, output) {
      var port = {
        name: name,
        type: output.type,
        plug: 'output'
      };
      if (output.group) {
        port.group = output.group;
      }
      if (output.displayName) {
        port.displayName = output.displayName;
      }
      if (output.editorName) {
        port.editorName = output.editorName;
      }
      if (output.hasOwnProperty('index')) {
        port.index = output.index;
      }
      nodeObj.ports.push(port);
    }

    Object.keys(nodeMetadata.outputs).forEach(function (prop) {
      if (selectorNames.hasOwnProperty('output/' + prop) || conditionalPortNames.hasOwnProperty('output/' + prop)) {
        //this is a selector or dynamic port. It's already been registered
        return;
      }

      var output = nodeMetadata.outputs[prop];
      exportOutput(prop, output);
    });
  });

  const coreNodes = [
    {
      name: 'UI Elements',
      description: 'Buttons, inputs, containers, media',
      type: 'visual',
      subCategories: [
        {
          name: 'Basic Elements',
          items: ['Group', 'net.noodl.visual.columns', 'Text', 'Image', 'Video', 'Circle', 'net.noodl.visual.icon']
        },
        {
          name: 'UI Controls',
          items: [
            'net.noodl.controls.button',
            'net.noodl.controls.checkbox',
            'net.noodl.controls.options',
            'net.noodl.controls.radiobutton',
            'Radio Button Group',
            'net.noodl.controls.range',
            'net.noodl.controls.textinput'
          ]
        }
      ]
    },
    {
      name: 'Navigation & Popups',
      description: 'Page routing, navigation, popups',
      type: 'logic',
      subCategories: [
        {
          name: 'Navigation',
          items: ['Router', 'RouterNavigate', 'PageInputs', 'net.noodl.externallink', 'PageStackNavigateToPath']
        },
        {
          name: 'Component Stack',
          items: ['Page Stack', 'PageStackNavigate', 'PageStackNavigateBack']
        },
        {
          name: 'Popups',
          items: ['NavigationShowPopup', 'NavigationClosePopup']
        }
      ]
    },
    {
      name: 'Logic & Utilities',
      description: 'Logic, events, string manipulation',
      type: 'logic',
      subCategories: [
        {
          name: 'General Utils',
          items: [
            'States',
            'Value Changed',
            'Timer',
            'Color Blend',
            'Number Remapper',
            'Counter',
            'Drag',
            'net.noodl.animatetovalue'
          ]
        },
        {
          name: 'Logic',
          items: ['Boolean To String', 'Switch', 'And', 'Or', 'Condition', 'Inverter']
        },
        {
          name: 'Events',
          items: ['Event Sender', 'Event Receiver']
        },
        {
          name: 'String Manipulation',
          items: ['Substring', 'String Mapper', 'String Format', 'Date To String', 'Unique Id']
        },
        {
          name: 'System',
          items: ['Screen Resolution', 'Open File Picker']
        },
        {
          name: 'Variables',
          items: ['String', 'Boolean', 'Color', 'Number']
        }
      ]
    },
    {
      name: 'Component Utilities',
      description: 'Component inputs, outputs & object',
      type: 'component',
      subCategories: [
        {
          name: '',
          items: [
            'Component Inputs',
            'Component Outputs',
            'Component Children',
            'net.noodl.ComponentObject',
            'net.noodl.ParentComponentObject',
            'net.noodl.SetComponentObjectProperties',
            'net.noodl.SetParentComponentObjectProperties'
          ]
        }
      ]
    },
    {
      name: 'Read & Write Data',
      description: 'Arrays, objects, cloud data',
      type: 'data',
      subCategories: [
        {
          name: '',
          items: [
            'RunTasks',
            'For Each',
            'For Each Actions',
            'Model2',
            'SetModelProperties',
            'NewModel',
            'Set Variable',
            'Variable2'
          ]
        },
        {
          name: 'Array',
          items: [
            'Collection2',
            'CollectionNew',
            'CollectionRemove',
            'CollectionClear',
            'CollectionInsert',
            'Filter Collection',
            'Map Collection',
            'Static Data'
          ]
        },
        {
          name: 'Cloud Data',
          items: [
            'DbModel2',
            'NewDbModelProperties',
            'FilterDBModels',
            'SetDbModelProperties',
            'DbCollection2',
            'DeleteDbModelProperties',
            'AddDbModelRelation',
            'RemoveDbModelRelation',
            'Cloud File',
            'Upload File',
            'CloudFunction2',
            'DbConfig'
          ]
        },
        {
          name: 'User',
          items: [
            'net.noodl.user.LogIn',
            'net.noodl.user.LogOut',
            'net.noodl.user.SignUp',
            'net.noodl.user.User',
            'net.noodl.user.SetUserProperties',
            'net.noodl.user.VerifyEmail',
            'net.noodl.user.SendEmailVerification',
            'net.noodl.user.ResetPassword',
            'net.noodl.user.RequestPasswordReset'
          ]
        },
        {
          name: 'External Data',
          items: ['net.noodl.HTTP', 'REST2', 'net.noodl.WebSocket']
        },
        {
          name: 'BYOB Data',
          items: [
            'noodl.byob.QueryData',
            'noodl.byob.CreateRecord',
            'noodl.byob.UpdateRecord',
            'noodl.byob.DeleteRecord',
            'noodl.byob.SubscribeToChanges'
          ]
        },
        {
          name: 'App State',
          items: ['net.noodl.GlobalStore', 'net.noodl.GlobalStore.Set', 'net.noodl.GlobalStore.Subscribe']
        }
      ]
    },
    {
      name: 'Custom Code',
      description: 'Custom JavaScript and CSS',
      type: 'javascript',
      subCategories: [
        {
          name: '',
          items: ['Expression', 'JavaScriptFunction', 'Javascript2', 'Logic Builder', 'CSS Definition']
        }
      ]
    },
    {
      name: 'Cloud Functions',
      description: 'Nodes to be used in cloud functions',
      type: 'data',
      subCategories: [
        {
          name: '',
          items: ['noodl.cloud.request', 'noodl.cloud.response']
        },
        {
          name: 'Cloud Data',
          items: ['noodl.cloud.aggregate']
        },
        {
          // BAK-002: server-side only, same as the rest of this category.
          name: 'Email',
          items: ['noodl.cloud.sendemail']
        }
      ]
    }
  ];

  obj.nodeIndex = {
    coreNodes
  };

  const moduleNodes = [];

  nodeTypes.forEach((type) => {
    const nodeMetadata = nodeRegister._constructors[type].metadata;
    if (nodeMetadata.module) {
      moduleNodes.push(type);
    }
  });

  if (moduleNodes.length) {
    obj.nodeIndex.moduleNodes = [
      {
        name: '',
        items: moduleNodes
      }
    ];
  }

  return obj;
}

module.exports = generateNodeLibrary;
