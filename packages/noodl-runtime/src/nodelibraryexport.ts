'use strict';

/**
 * Builds the node-library blob the editor receives over `sendNodeLibrary` — the palette,
 * the type index and every node type's ports. `catalog:check` compares this file's output
 * byte-for-byte, so the *order* of the conditional assignments below is load-bearing:
 * JSON.stringify serialises keys in insertion order.
 */

/** One port as it appears in the export. `type` is the port-type spec, passed through verbatim. */
interface ExportedPort {
  name: string;
  type: unknown;
  plug: string;
  group?: unknown;
  displayName?: unknown;
  description?: unknown;
  editorName?: unknown;
  default?: unknown;
  index?: unknown;
  tooltip?: unknown;
  /** FB-015 — a shape hint shown in the empty field, for a port whose value has a syntax. */
  placeholder?: unknown;
  tab?: unknown;
  popout?: unknown;
  allowVisualStates?: unknown;
}

/**
 * One entry of a node's `dynamicports` metadata — either already in the editor's format
 * (`ports`/`template`/`port`/`channelPort`) and passed through, or the name-list form
 * (`inputs`/`outputs`) that {@link formatDynamicPorts} expands against the node's own
 * port metadata.
 */
interface DynamicPortsEntry {
  ports?: unknown;
  template?: unknown;
  port?: unknown;
  channelPort?: { plug: string; name: string };
  inputs?: string[];
  outputs?: string[];
  name?: string;
  condition?: unknown;
  [extra: string]: unknown;
}

/** The slice of a compiled node definition's `metadata` this export reads. */
interface NodeExportMetadata {
  searchTags?: unknown;
  version?: unknown;
  displayNodeName?: unknown;
  nodeDoubleClickAction?: unknown;
  module?: unknown;
  deprecated?: unknown;
  haveComponentPorts?: unknown;
  /**
   * P77 SBR-008 §9 — ports with this prefix on this node type are declared by the author's
   * wires, not only by the node. The editor reads it to stop calling such a wire broken
   * before the runtime has minted the port; see `data/dbmodelcrudbase.ts`.
   */
  wireDeclaredPortPrefix?: string;
  category?: string;
  allowAsExportRoot?: unknown;
  allowChildren?: unknown;
  allowChildrenWithCategory?: unknown;
  singleton?: unknown;
  allowAsChild?: unknown;
  docs?: string;
  docsUrl?: string;
  shortDocs?: string;
  panels?: unknown;
  usePortAsLabel?: unknown;
  portLabelTruncationMode?: unknown;
  color?: unknown;
  dynamicports?: DynamicPortsEntry[];
  exportDynamicPorts?: unknown;
  visualStates?: unknown;
  useVariants?: unknown;
  connectionPanel?: unknown;
  inputs: Record<string, Record<string, unknown>>;
  outputs: Record<string, Record<string, unknown>>;
  [extra: string]: unknown;
}

/** One entry in the export's `nodetypes` list. Fields are added only when present. */
interface ExportedNodeType {
  name: string;
  searchTags?: unknown;
  version?: unknown;
  displayNodeName?: unknown;
  nodeDoubleClickAction?: unknown;
  module?: unknown;
  deprecated?: boolean;
  haveComponentPorts?: boolean;
  /** P77 SBR-008 §9 — see the same field on the metadata above. */
  wireDeclaredPortPrefix?: string;
  allowAsChild?: boolean;
  allowAsExportRoot?: unknown;
  color?: unknown;
  allowChildrenWithCategory?: unknown;
  singleton?: boolean;
  docs?: string;
  docsUrl?: string;
  shortDocs?: string;
  category?: string;
  panels?: unknown;
  usePortAsLabel?: unknown;
  portLabelTruncationMode?: unknown;
  dynamicports?: DynamicPortsEntry[];
  exportDynamicPorts?: unknown;
  visualStates?: unknown;
  useVariants?: unknown;
  connectionPanel?: unknown;
  ports?: ExportedPort[];
  haveComponentChildren?: string[];
}

/** The node register as this export reads it — the compiled-definition table. */
interface NodeRegisterLike {
  _constructors: Record<string, { metadata: NodeExportMetadata }>;
}

/** One category of the add-node picker's index. */
interface NodeIndexCategory {
  name: string;
  description: string;
  type: string;
  subCategories: Array<{ name?: string; items: string[] }>;
}

function formatDynamicPorts(nodeMetadata: NodeExportMetadata): DynamicPortsEntry[] {
  const dynamicports: DynamicPortsEntry[] = [];

  for (const dp of nodeMetadata.dynamicports) {
    if (dp.ports || dp.template || dp.port || dp.channelPort) {
      //same format as editor expects, no need to transform it
      dynamicports.push(dp);
    } else if (dp.inputs || dp.outputs) {
      //inputs and outputs is just list of names
      //need to pull the metadata from the inputs/outputs since they
      //won't be registered by the editor (it's either a regular port
      // or a dynamic port, can't register both)
      const ports: ExportedPort[] = [];

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

function formatPort(portName: string, portData: Record<string, unknown>, plugType: string): ExportedPort {
  const port: ExportedPort = {
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
  if (portData.placeholder) {
    port.placeholder = portData.placeholder;
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

/**
 * @param options.runtimeType The runtime this library describes (`NoodlRuntime.type`). Only
 *   `'cloud'` changes anything: it drops `Component Children` from the seeded types below. Left
 *   optional so the browser path and the tests are unchanged by its introduction.
 */
function generateNodeLibrary(nodeRegister: NodeRegisterLike, options?: { runtimeType?: string }) {
  const isCloud = options?.runtimeType === 'cloud';

  const obj = {
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
        // The resolved color string (context.styles.resolveColor already
        // produces it), so a Color variable can feed anything that takes text.
        from: 'color',
        to: ['string']
      },
      {
        from: 'enum',
        to: []
      },
      {
        // PORT-TYPE-CONTRACT.md: declaring `object` must not strand the port.
        // The string form is JSON — the conversion lives in
        // Node.setInputValue, which mirrors the existing string -> object
        // parse on the way out.
        from: 'object',
        to: ['string']
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
        to: ['collection', 'string']
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
    //
    // 🔴 NAT-003 (2026-08-19) RE-DERIVED EVERY VALUE BELOW, and did not hand-pick one. The editor
    // builds a node scheme as `mix(bg-1, categoryAccent, 0.2)` for the card and
    // `mix(bg-0, categoryAccent, 0.2)` for the header, so lifting the elevation ramp moves the
    // node cards WITH the canvas — which is the point: a card that dissolved into a near-black
    // ground would still dissolve if only the ground moved. These are those same mixes against
    // the new `bg-0`/`bg-1`, so this blob and CanvasTheme still agree.
    // ⚠️ THIS IS A SECOND PALETTE and it is only kept honest by a spec:
    // `noodl-editor/tests/canvas/CanvasThemeNodeSchemes.test.ts` compares CanvasTheme's derived
    // scheme to these literals within 16 per channel. If you change the ramp and not these, that
    // spec is what tells you — and it lives in the ELECTRON suite (`npm run test:ci`), not the
    // fast one, so it will not be the first thing that goes red.
    colors: {
      nodes: {
        component: {
          base: '#3c3d5a',
          baseHighlighted: '#4c4872',
          header: '#33324f',
          headerHighlighted: '#3c3d5a',
          outline: '#33324f',
          outlineHighlighted: '#a78bfa',
          text: '#EEF2F6'
        },
        visual: {
          base: '#2d435b',
          baseHighlighted: '#345274',
          header: '#243850',
          headerHighlighted: '#2d435b',
          outline: '#243850',
          outlineHighlighted: '#5ca9ff',
          text: '#EEF2F6'
        },
        data: {
          base: '#284a44',
          baseHighlighted: '#2d5e4e',
          header: '#1f4038',
          headerHighlighted: '#284a44',
          outline: '#1f4038',
          outlineHighlighted: '#45d08a',
          text: '#EEF2F6'
        },
        javascript: {
          base: '#4c384f',
          baseHighlighted: '#654261',
          header: '#432e44',
          headerHighlighted: '#4c384f',
          outline: '#432e44',
          outlineHighlighted: '#f776c4',
          text: '#EEF2F6'
        },
        default: {
          base: '#333c46',
          baseHighlighted: '#3e4853',
          header: '#2b323b',
          headerHighlighted: '#333c46',
          outline: '#2b323b',
          outlineHighlighted: '#7d8a98',
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
    // `Component Children` is seeded here rather than registered: it has no node definition at
    // all, it is a marker `NodeScope` interprets structurally (nodescope.ts:162, 393-425). That
    // is why subtracting it from the cloud vocabulary (TALK-007 Pile B) happens here and not in
    // the runtime's registration list with the other nine — and why nothing about a cloud
    // function's *behaviour* changes: the marker still works if a graph carries one, it is only
    // no longer offered on a canvas that has nothing visual to place children into.
    nodetypes: (isCloud
      ? []
      : [
          {
            name: 'Component Children',
            docs: 'https://docs.noodl.net/nodes/component-utilities/component-children',
            color: 'component',
            allowAsChild: true,
            category: 'Visual',
            haveComponentChildren: ['Visual']
          }
        ]) as ExportedNodeType[],
    // Assigned unconditionally below; declared here so the object's type carries it.
    // JSON.stringify omits `undefined` members, and key order (last) matches the
    // original post-hoc assignment, so the serialised export is unchanged.
    nodeIndex: undefined as
      | undefined
      | {
          coreNodes: NodeIndexCategory[];
          moduleNodes?: Array<{ name: string; items: string[] }>;
        }
  };

  const nodeTypes = Object.keys(nodeRegister._constructors);

  nodeTypes.forEach(function (type) {
    const nodeMetadata = nodeRegister._constructors[type].metadata;

    const nodeObj: ExportedNodeType = {
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
    if (nodeMetadata.module) {
      nodeObj.module = nodeMetadata.module;
    }
    if (nodeMetadata.deprecated) {
      nodeObj.deprecated = true;
    }
    if (nodeMetadata.haveComponentPorts) {
      nodeObj.haveComponentPorts = true;
    }
    if (nodeMetadata.wireDeclaredPortPrefix) {
      nodeObj.wireDeclaredPortPrefix = nodeMetadata.wireDeclaredPortPrefix;
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
    // D10. Carried separately from `docs` and deliberately NOT fed into the
    // `shortDocs` derivation below: that branch turns a `docs.noodl.net` URL
    // into a companion `-short.md` path on the docs site, which exists for
    // shipped nodes only. A kit's `docsUrl` points at the author's own page and
    // has no such companion.
    if (nodeMetadata.docsUrl) {
      nodeObj.docsUrl = nodeMetadata.docsUrl;
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

    const dynamicports = nodeObj.dynamicports || [];
    const selectorNames: Record<string, boolean> = {};
    const conditionalPortNames: Record<string, boolean> = {};

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
      const port = nodeMetadata.inputs[inputName];
      if (port.exportToEditor === false) {
        return;
      }

      nodeObj.ports.push(formatPort(inputName, port, 'input'));
    });

    /**
     * ⚠️ This used to be a hand-copied duplicate of `formatPort` that omitted
     * `description`, and it silently deleted **every output-port description in the
     * library** on its way to the editor.
     *
     * Measured live during ERG-004's QA, against the running editor's `NodeLibrary`:
     * **1656 of 1809 input ports carried a description and 0 of 1144 outputs did.**
     * Not one. Every `description` written on an output port — including all of phase
     * 30's documentation pass — existed in the source, was picked up by the catalog
     * generator (which reads the node definitions directly, so its own checks stayed
     * green), and was dropped here, at the one boundary where an author would ever
     * have read it.
     *
     * The asymmetry was never a decision. Inputs went through `formatPort` on the line
     * above; the *dynamic*-port path calls `formatPort` for outputs too
     * ({@link formatDynamicPorts}), so a dynamic output would have kept its description
     * while a static one could not. Only this copy diverged.
     *
     * Delegating is the fix, and it is deliberately the whole fix: the duplication is
     * what allowed one branch to fall behind the other, so leaving two branches and
     * adding `description` to this one would leave the same trap set for the next
     * field. `formatPort` copies a few keys that are meaningless on an output port
     * (`default`, `popout`, `tab`, `allowVisualStates`) — they are copied only when
     * present, and no output port in the library declares any of them, so nothing new
     * appears in the payload today.
     */
    function exportOutput(name: string, output: Record<string, unknown>) {
      nodeObj.ports.push(formatPort(name, output, 'output'));
    }

    Object.keys(nodeMetadata.outputs).forEach(function (prop) {
      if (selectorNames.hasOwnProperty('output/' + prop) || conditionalPortNames.hasOwnProperty('output/' + prop)) {
        //this is a selector or dynamic port. It's already been registered
        return;
      }

      const output = nodeMetadata.outputs[prop];
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
          /**
           * Was `Logic`. Renamed on Richard's ruling 2026-08-12, because
           * LGC-001 §4 gave the `javascript` rail the label `Logic` and the
           * picker then showed a rail entry and this unrelated group heading
           * with the same word. The ruling was to rename here rather than
           * revert the rail — the rail names a choice a builder makes, this
           * names six boolean and branching primitives, and the second is the
           * one that can move without losing anything.
           *
           * ⚠️ Display string only, same as the rail label: the nodes' own
           * `category` field is untouched, nothing saved refers to it, and
           * `node-catalog.json` does not contain it.
           */
          name: 'Conditions & Booleans',
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
          // CWF-010. Shared runtime — none of these three takes a key, so none of them is a
          // secret waiting to be shipped in a browser bundle. The three that do (HMAC, JWT
          // Sign, JWT Verify) live under Cloud Functions instead.
          name: 'Crypto',
          items: ['net.noodl.Hash', 'net.noodl.RandomBytes', 'net.noodl.UUID']
        },
        {
          // CWF-011. `Date To String` stays where it is, under String Manipulation, because
          // that is where authors have always found it; the maths gets its own row.
          name: 'Date & Time',
          items: [
            'net.noodl.Now',
            'net.noodl.DateAdd',
            'net.noodl.DateDifference',
            'net.noodl.DateCompare',
            'net.noodl.DateParts'
          ]
        },
        {
          // CWF-013. `Log` sits beside `On App Error` because they are the two nodes an author
          // reaches for when the question is "what is this thing actually doing" — one you place
          // deliberately, one that catches what you did not.
          name: 'System',
          items: ['Screen Resolution', 'Open File Picker', 'On App Error', 'net.noodl.Log']
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
            'Static Data',
            // CWF-012. A type absent from this index is unreachable in the add-node picker, so
            // these two would have been registered and invisible — which is exactly how the
            // parser inside Static Array stayed authoring-only for years.
            'net.noodl.ParseCSV',
            'net.noodl.ToCSV'
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
            // FH-021. A type absent from this index is unreachable in the add-node picker,
            // which is the whole complaint this node answers: realtime shipped as a checkbox
            // and its owner never found it. Registered browser-only, so the cloud library's
            // copy of this index filters it back out (`createnodeindex.ts` drops names with
            // no type).
            'SubscribeToChanges',
            'DeleteDbModelProperties',
            'AddDbModelRelation',
            'RemoveDbModelRelation',
            'Cloud File',
            'Upload File',
            'Sign File URL',
            'CloudFunction2'
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
            'net.noodl.user.RequestPasswordReset',
            // BCN-010 found these two registered, not deprecated, and absent from this
            // index — so unreachable in the picker, which is the same silent gap the
            // deleted BYOB family was retired to avoid.
            'net.noodl.user.RequestMagicLink',
            'net.noodl.user.SignInWith'
          ]
        },
        {
          name: 'External Data',
          items: ['net.noodl.HTTP', 'REST2']
        },
        {
          // AIX-005. A type absent from this index is absent from the add-node
          // picker, so a node that is registered but not listed here is
          // unreachable for an app author.
          name: 'Streaming',
          items: [
            'net.noodl.SSE',
            'net.noodl.WebSocket',
            'net.noodl.TextAccumulator',
            'net.noodl.JSONStreamParser',
            'net.noodl.PatternExtractor',
            'net.noodl.StreamBuffer'
          ]
        },
        {
          name: 'App State',
          items: [
            'net.noodl.GlobalStore',
            'net.noodl.GlobalStore.Set',
            'net.noodl.GlobalStore.Subscribe',
            'net.noodl.OptimisticUpdate',
            'net.noodl.StateHistory',
            'net.noodl.StateHistory.Undo',
            'net.noodl.StateSnapshot'
          ]
        },
        {
          name: 'Agent Actions',
          items: ['net.noodl.ActionDispatcher', 'net.noodl.ActionHandler']
        }
      ]
    },
    {
      /**
       * LGC-001 §4. This read `Custom Code` — an implementation word. A person
       * who wants to work out a total does not think "custom code"; the test
       * user in the originating video never opened this rail entry at all. The
       * rail is where a builder *chooses*, so it names the choice.
       *
       * ⚠️ This is a **display string only**: it is the picker's rail label and
       * group heading and nothing else. It is not the nodes' `category` field
       * (still `CustomCode`, which is what the catalog carries and what
       * `generate-node-docs.js` slugs into the docs-site path), it is not in any
       * saved project, and `node-catalog.json` does not contain it. One line to
       * revert.
       *
       * ⚠️ Two known consequences were recorded in LGC-001's Register. The
       * first is now closed:
       *  - ✅ `Logic & Utilities` above had a **sub-category** called `Logic`,
       *    so the picker showed a rail entry and an unrelated group heading
       *    with the same word. Confirmed visually 2026-08-12. Ruled: rename
       *    the sub-category, keep this rail label. It is now
       *    `Conditions & Booleans`;
       *  - 📋 the category still holds `Javascript2` (labelled "Script") and
       *    `CSS Definition`, so "Logic" contains one node that is not logic.
       *    Moving it out is a taxonomy change, not a display string, so it was
       *    left alone.
       */
      name: 'Logic',
      description: 'Three ways to compute — pick by how much you want to type',
      type: 'javascript',
      subCategories: [
        {
          /**
           * LGC-001 §1/§4 — the order is load-bearing, not cosmetic. A picker
           * row that matched on a *tag* rather than on its name is ranked by its
           * position in this list (`NodePicker.search.ts`, `withLibraryOrder`),
           * so this is what makes `multiply` answer
           * Expression → Visual Function → Function: the cheapest correct answer
           * for `price * quantity` first, and the one that is the wrong tool for
           * a one-liner last.
           */
          name: '',
          items: ['Expression', 'Logic Builder', 'JavaScriptFunction', 'Javascript2', 'CSS Definition']
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
        },
        {
          // CWF-009: server-side only, and the only category it could be in —
          // a Secret node offered on a browser canvas would be a defect.
          name: 'Secrets',
          items: ['noodl.cloud.secret']
        },
        {
          // CWF-010: the crypto nodes that hold a key. Cloud-only, deliberately — see the
          // module comments on hmac.ts and jwtsign.ts.
          name: 'Security',
          items: ['noodl.cloud.hmac', 'noodl.cloud.jwtsign', 'noodl.cloud.jwtverify']
        },
        {
          // CWF-015: user administration AS THE SYSTEM. Cloud-only for a reason one
          // notch past Secret's — a node that creates accounts, offered on a browser
          // canvas, is account creation in the hands of everyone who opens the page.
          //
          // ⚠️ `Verify Session Token` sits here and NOT beside `noodl.cloud.jwtverify`
          // above, deliberately: the two are the pair CWF-015 says naming apart is half
          // the work. JWT Verify checks somebody else's token against a key you hold;
          // this one asks our own backend about our own session. Listing them together
          // is how an author reaches for the wrong one.
          name: 'Users',
          items: [
            'noodl.cloud.createuser',
            'noodl.cloud.updateuser',
            'noodl.cloud.deleteuser',
            'noodl.cloud.verifysessiontoken'
          ]
        },
        {
          // F86: role membership. A category of its own rather than three more
          // entries under Users, because the two families are separated on
          // purpose all the way down — `users/SystemUsers.ts` has a documented,
          // tested property that it writes no roles, and these are the nodes
          // that do. An author scanning the picker should be able to see that
          // granting privilege is its own thing.
          name: 'Roles',
          items: [
            'noodl.cloud.addusertorole',
            'noodl.cloud.removeuserfromrole',
            'noodl.cloud.getuserroles',
            // DEF-005 (b). Beside Get User Roles rather than under Users,
            // because the two are the two directions of one junction and an
            // author who found one should see the other.
            'noodl.cloud.listusersinrole'
          ]
        }
      ]
    }
  ];

  obj.nodeIndex = {
    coreNodes
  };

  // CN-018 — one picker subcategory per kit, named after the kit.
  //
  // 🔴 This loop used to read `nodeMetadata.module` purely as a boolean ("is this
  // a module node?") and then emit a single group named `''`. Every kit in a
  // project therefore collapsed into one unnamed section under "External
  // libraries": two kits each shipping a `Stat Tile` drew two identical cards —
  // same name, same category, same tooltip — with nothing on screen to tell an
  // author which kit either came from. Found by driving the editor in CN-006 s11.
  //
  // The name was always right here. `NoodlRuntime.registerModule` stamps
  // `module.name || 'Unknown Module'` onto every definition it registers
  // (`noodl-runtime.ts:517`), and since CN-003 that name is the kit's
  // `manifest.json` name, adopted in `defineModule` from the
  // `window.__noodl_module_name` marker the injector writes before each kit's
  // script tag. So the only thing missing was carrying it across.
  //
  // ⚠️ `'Unknown Module'` is a real group, not a bug to filter out: a kit whose
  // manifest names it nothing, loaded by a page the injector did not build, is
  // genuinely unattributable and saying so beats silently merging it into a
  // neighbour's section.
  const moduleNodesByKit = new Map<string, string[]>();

  nodeTypes.forEach((type) => {
    const nodeMetadata = nodeRegister._constructors[type].metadata;
    if (nodeMetadata.module) {
      const kitName = String(nodeMetadata.module);
      const items = moduleNodesByKit.get(kitName);
      if (items) items.push(type);
      else moduleNodesByKit.set(kitName, [type]);
    }
  });

  if (moduleNodesByKit.size) {
    // Sorted by name rather than left in registration order: module load order is
    // an implementation detail no author can predict, so an alphabetical picker is
    // the only ordering that stays put between sessions. Plain code-unit
    // comparison, not `localeCompare` — the latter varies with the runtime's
    // locale, and this blob is snapshot-compared across machines.
    obj.nodeIndex.moduleNodes = Array.from(moduleNodesByKit.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, items]) => ({ name, items }));
  }

  return obj;
}

export = generateNodeLibrary;
