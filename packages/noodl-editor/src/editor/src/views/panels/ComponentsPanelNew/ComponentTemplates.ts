import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { IconName } from '@noodl-core-ui/components/common/Icon';

import View from '../../../../../shared/ListenableView';
import { ComponentModel } from '../../../models/componentmodel';
import { NodeGraphModel } from '../../../models/nodegraphmodel';
import { RouterAdapter } from '../../../models/NodeTypeAdapters/RouterAdapter';
import { declareRequestParams, FUNCTION_NAME_RE, isLegalFunctionName } from '../../../models/workflow/newFunctionFromStep';
import Utils from '../../../utils/utils';
import PopupLayer from '../../popuplayer';
import { PageComponentTemplatePopup } from './PageTemplatePopup';

class ComponentTemplate {
  parentTypes: string[];
  runtimeTypes: string[];
  template: any;
  label: string;
  icon: IconName;
  /**
   * SPR-005 — what the name prompt asks for, per template.
   *
   * F26 already established that a shared prompt is how the comment editor's
   * hint reached a cloud function's name field. The same argument applies one
   * level up: "New component name / e.g. ProductCard" is the wrong question to
   * ask someone creating a cloud function, whose name is an HTTP path segment.
   */
  promptLabel = 'New component name';
  promptPlaceholder = 'e.g. ProductCard';

  constructor(label, icon) {
    this.label = label;
    this.icon = icon;
  }

  createComponent(componentName, options, undoGroup) {
    // Create component from template
    const component = new ComponentModel({
      name: componentName,
      graph: NodeGraphModel.fromJSON(JSON.parse(JSON.stringify(this.template))),
      id: Utils.guid()
    });

    component.rekeyAllIds();

    return component;
  }

  /**
   * SPR-005 — is this a name this template is willing to be given?
   *
   * A message to show, or `null` to accept. Most components may be called
   * anything; the rule exists because one of them may not (see
   * `CloudFunctionComponentTemplate`), and putting it on the template rather
   * than in the panel keeps the panel free of any knowledge of runtimes.
   */
  validateLocalName(localName: string): string | null {
    return null;
  }

  createPopup(options: any): { el: HTMLElement } {
    const popup = new PopupLayer.StringInputPopup({
      label: this.promptLabel,
      okLabel: 'Add',
      cancelLabel: 'Cancel',
      // F26: this is the prompt a user meets when creating a cloud function.
      placeholder: this.promptPlaceholder,
      onOk(localName) {
        options.onCreate(localName);
      },
      onCancel() {
        options.onCancel && options.onCancel();
      }
    });
    popup.render();

    return popup;
  }
}

class VisualComponentTemplate extends ComponentTemplate {
  constructor() {
    super('Visual Component', IconName.Component);

    this.parentTypes = ['folder', 'component'];
    this.runtimeTypes = ['browser'];

    this.template = {
      connections: [],
      roots: [
        {
          id: 'xxx',
          type: 'Group',
          x: 0,
          y: 0,
          parameters: {},
          ports: [],
          dynamicports: [],
          children: []
        }
      ]
    };
  }
}

class LogicComponentTemplate extends ComponentTemplate {
  constructor() {
    super('Logic Component', IconName.Component);

    this.parentTypes = ['folder', 'component'];
    this.runtimeTypes = ['cloud', 'browser'];

    this.template = {
      connections: [],
      roots: [
        {
          id: 'A',
          type: 'Component Inputs',
          x: 0,
          y: 0,
          parameters: {},
          ports: [
            {
              name: 'Do',
              plug: 'output',
              type: '*'
            }
          ],
          dynamicports: [],
          children: []
        },
        {
          id: 'B',
          type: 'Component Outputs',
          x: 300,
          y: 0,
          parameters: {},
          ports: [
            {
              name: 'Success',
              plug: 'input',
              type: '*'
            },
            {
              name: 'Failure',
              plug: 'input',
              type: '*'
            }
          ],
          dynamicports: [],
          children: []
        }
      ]
    };
  }
}

class CloudFunctionComponentTemplate extends ComponentTemplate {
  constructor() {
    super('Cloud Function Component', IconName.CloudFunction);

    this.parentTypes = ['folder'];
    this.runtimeTypes = ['cloud'];

    // SPR-005: the name it is really asking for. `chargeCard` is the example the
    // rest of the cloud-function docs use, and it satisfies `FUNCTION_NAME_RE`.
    this.promptLabel = 'New cloud function name';
    this.promptPlaceholder = 'e.g. chargeCard';

    this.template = {
      connections: [],
      roots: [
        {
          id: 'A',
          type: 'noodl.cloud.request',
          x: 0,
          y: 0,
          parameters: {},
          ports: [],
          dynamicports: [],
          children: []
        },
        {
          id: 'B',
          type: 'noodl.cloud.response',
          x: 300,
          y: 0,
          parameters: {},
          ports: [],
          dynamicports: [],
          children: []
        }
      ]
    };
  }

  /**
   * CWF-004 S6 — the same template, optionally arriving with its inputs already
   * declared.
   *
   * "New function from this step" creates a function for a workflow step, and
   * the step already says what it will send it (CWF-001's param mapping). So the
   * gesture passes those names as `requestParams` and the author lands in a
   * graph whose Request node already has one output port per value the step
   * sends, rather than in an empty one they have to re-type the contract into.
   *
   * It is an OPTION on the existing template rather than a second creation path
   * on purpose: the shape of a new cloud function — a Request node, a Response
   * node, rekeyed ids — is decided in exactly one place, and the panel's own
   * popup path passes no options and is byte-for-byte unchanged.
   *
   * The write itself is `declareRequestParams`, which lives in
   * `models/workflow/newFunctionFromStep` — which node carries a function's
   * public interface is a rule worth a spec, and a rule stated inside this
   * React-importing module could only be checked by starting Electron.
   */
  createComponent(componentName, options, undoGroup) {
    const component = super.createComponent(componentName, options, undoGroup);

    const requestParams = options && options.requestParams;
    if (requestParams) declareRequestParams(component.graph, requestParams);

    return component;
  }

  /**
   * SPR-005 — the two doors onto a new cloud function, held to one naming rule.
   *
   * CWF-004 S6's gesture only ever mints a name matching `FUNCTION_NAME_RE`,
   * because a function's name is a **URL path segment** (`POST /functions/<name>`)
   * as well as a component's local name and a workflow step's `ref`. The panel's
   * door asked for a free string and accepted it, so the two doors could produce
   * functions of which only one was addressable — `Charge card!` looked like a
   * cloud function in the tree, deployed, and answered nothing.
   *
   * The rule is `isLegalFunctionName`, imported rather than restated: one regex,
   * two doors.
   */
  validateLocalName(localName: string): string | null {
    if (isLegalFunctionName(localName)) return null;
    return (
      `"${localName}" cannot be a cloud function name. Your backend serves it as POST /functions/${localName}, ` +
      `so it must match ${FUNCTION_NAME_RE.source} — a letter or underscore, then letters, digits, "_" or "-". ` +
      `Try "chargeCard".`
    );
  }
}

class PageComponentTemplate extends ComponentTemplate {
  constructor() {
    super('Page Component', IconName.File);

    this.parentTypes = ['folder'];
    this.runtimeTypes = ['browser'];

    this.template = {
      connections: [],
      roots: [
        {
          id: 'xxx',
          type: 'Page',
          x: 0,
          y: 0,
          parameters: {},
          ports: [],
          dynamicports: [],
          children: []
        },
        {
          id: 'yyy',
          type: 'PageInputs',
          x: -100,
          y: -50,
          parameters: {},
          ports: [],
          dynamicports: [],
          children: []
        }
      ]
    };
  }

  createComponent(componentName, options, undoGroup) {
    // Create component from template
    const component = new ComponentModel({
      name: componentName,
      graph: NodeGraphModel.fromJSON(JSON.parse(JSON.stringify(this.template))),
      id: Utils.guid()
    });

    component.rekeyAllIds();

    // Find the router and add the template to the router
    RouterAdapter.addPageToRouters(options.router, componentName, { undo: undoGroup });

    return component;
  }

  createPopup(options: any) {
    // Find all routers in the project
    const _routers = RouterAdapter.getRouterNames();

    const props = {
      routers: _routers,
      onCreate(localName, router) {
        options.onCreate(localName, { router });
      },
      onCancel() {
        options.onCancel && options.onCancel();
      }
    };
    const div = document.createElement('div');
    const root = createRoot(div);
    // Synchronous so the popup layer can measure real content (DEBT-010).
    flushSync(() => root.render(React.createElement(PageComponentTemplatePopup, props)));

    return { el: div };
  }
}

/**
 * Panel that opens in the sidepanel components header plus icon
 */
export class ComponentTemplates {
  templates: ComponentTemplate[];

  constructor() {
    this.templates = [
      new PageComponentTemplate(),
      new VisualComponentTemplate(),
      new LogicComponentTemplate(),
      new CloudFunctionComponentTemplate()
    ];
  }

  /**
   * The one cloud-function template (CWF-004 S6).
   *
   * By identity rather than by label or by list position: a caller that has to
   * find it with `getTemplates({forRuntimeType: 'cloud'})` gets the Logic
   * Component too, and picking out of that by `label` would break the day
   * someone rewords a menu entry.
   */
  get cloudFunction(): ComponentTemplate {
    return this.templates.find((t) => t instanceof CloudFunctionComponentTemplate);
  }

  getTemplates(args) {
    if (args && (args.forParentType || args.forRuntimeType)) {
      return this.templates.filter(
        (t) =>
          (args.forParentType === undefined || t.parentTypes.indexOf(args.forParentType) !== -1) &&
          (args.forRuntimeType === undefined || t.runtimeTypes.indexOf(args.forRuntimeType) !== -1)
      );
    }
    return this.templates;
  }

  static instance = new ComponentTemplates();
}
