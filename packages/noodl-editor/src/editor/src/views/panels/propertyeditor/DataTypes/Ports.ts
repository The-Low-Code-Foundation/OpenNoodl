import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { NodeLibrary } from '@noodl-models/nodelibrary';

import { EventDispatcher } from '../../../../../../shared/utils/EventDispatcher';
import View from '../../../../../../shared/view';
import PopupLayer from '../../../popuplayer';
import { CodeEditorType } from '../CodeEditor';
import { PropertyGroups, PropertyGroupModel } from '../components/PropertyGroups';
import { ModelProxy } from '../models/modelProxy';
import { PagesType } from '../Pages';
import { getEditType } from '../utils';
import { AlignToolsType } from './AlignTools/AlignToolsType';
import { BasicType } from './BasicType';
import { BooleanType } from './BooleanType';
import { ByobFilterType } from './ByobFilterType';
import { ColorType } from './ColorPicker/ColorType';
import { ComponentType } from './ComponentType';
import { CurveType } from './CurveEditor/CurveType';
import { Dimension } from './Dimension';
import { EnumType } from './EnumType';
import { SourceCodeType } from './FilePicker/SourceCodeType';
import { FontType } from './FontType';
import { IconType } from './IconType';
import { IdentifierType } from './IdentifierType';
import { ImageType } from './ImageType';
import { LogicBuilderHiddenType } from './LogicBuilderHiddenType';
import { LogicBuilderWorkspaceType } from './LogicBuilderWorkspaceType';
import { MarginPaddingType } from './MarginPaddingType';
import { NumberWithUnits } from './NumberWithUnits';
import { PopoutGroup } from './PopoutGroup';
import { PropListType } from './PropListType';
import { QueryFilterType } from './QueryFilterType';
import { QuerySortingType } from './QuerySortingType';
import { ResizingType } from './ResizingType';
import { SizeModeType } from './SizeModeType';
import { StringListType } from './StringList/StringListType';
import { TabGroup } from './TabGroup';
import { TextAreaType } from './TextAreaType';
import { TextStyleType } from './TextStyleType';
import { VariableType } from './VariableType';

const groupExpansions = {};

type Port = {
  popout?: TSFixme;
  group: string;
  name: string;
  displayName?: string;
  index?: number;
  plug?: string;
  type?: string;
};

export class Ports extends View {
  model: ModelProxy;
  popout: TSFixme;
  _selectedTabForGroup: TSFixme;
  activePopout: TSFixme;
  _portsHash: TSFixme;
  views: TSFixme;
  _toolsType: TSFixme;
  groups: TSFixme[];
  el: HTMLElement;
  private root: Root | null = null;

  constructor(args) {
    super();
    this.model = args.model;
    this.popout = args.popout;
    this._selectedTabForGroup = {};

    this.bindModel(this.model);
  }
  showPopout(popout) {
    if (this.activePopout) {
      this.hidePopout();
    }

    const _onClose = popout.onClose;
    popout.onClose = () => {
      this.activePopout = null;
      _onClose && _onClose();
    };

    this.activePopout = PopupLayer.instance.showPopout(popout);
  }
  hidePopout() {
    PopupLayer.instance.hidePopout(this.activePopout);
  }
  bindModel(model) {
    model.on(
      [
        'instancePortsChanged',
        'portAdded',
        'portRemoved',
        'portRenamed',
        'connectionRemoved',
        'variantChanged',
        'variantUpdated'
      ],
      () => {
        this.renderGroups();
      },
      this
    );

    model.on(
      ['modelParameterUndo', 'modelParameterRedo'],
      () => {
        this._portsHash = undefined;
        this.renderGroups();
      },
      this
    );

    model.owner &&
      model.owner.on(
        ['connectionAdded', 'connectionRemoved'],
        () => {
          this.renderGroups();
        },
        this
      );
  }
  dispose() {
    this.model && this.model.off(this);
    // @ts-expect-error
    this.model && this.model.owner && this.model.owner.off(this);
    EventDispatcher.instance.off(this);

    this.views.forEach((v) => v.dispose && v.dispose());

    if (this.root) {
      this.root.unmount();
      this.root = null;
    }

    this.hidePopout();
  }
  /** Render a group's views (and their child views) and collect their elements. */
  renderParams(views): TSFixme[] {
    const els = [];
    for (const j in views) {
      const v = views[j];
      v.childViews && v.childViews.forEach((v) => v.render()); // Render any child views first
      els.push(v.render());
    }
    return els;
  }
  renderGroups() {
    if (!this.root) return; // not rendered yet

    const inputData = {
      ports: this._getPorts(),
      variant: this.model.variantName
    };

    const _portsHash = JSON.stringify(inputData);
    if (_portsHash === this._portsHash)
      // No change in ports, no need to re-render
      return;

    this._portsHash = _portsHash;

    //remember the scrolling so a re-render doesn't reset the scroll position
    let scrollTop = 0;
    if (this.el.parentElement) {
      scrollTop = this.el.parentElement.parentElement.scrollTop;
    }

    const groups = this.getViewGroupsFromPorts();

    // If only one group then don't render group sections
    const showHeaders = !(groups.length === 1 && groups[0].name === 'Other');

    const groupModels: PropertyGroupModel[] = groups.map((g) => {
      if (groupExpansions.hasOwnProperty(g.name)) {
        g.isExpanded = groupExpansions[g.name];
      }

      return {
        name: g.name,
        isExpanded: g.isExpanded,
        els: this.renderParams(g.views)
      };
    });

    this.root.render(React.createElement(PropertyGroups, { groups: groupModels, showHeaders }));

    //and now the rendering is done. In case any scrolling was done, set the scrolling again.
    //React commits asynchronously, so this has to wait for the rows to be in the DOM.
    if (scrollTop) {
      setTimeout(() => {
        if (this.el.parentElement) {
          this.el.parentElement.parentElement.scrollTop = scrollTop;
        }
      }, 0);
    }
  }
  render() {
    this._portsHash = undefined; // Clear cache

    if (!this.el) {
      this.el = document.createElement('div');

      // Some element in the prop editor has gained focus — move the ports to
      // the front so dropdowns are not clipped by the panels below.
      this.el.addEventListener('focusin', () => {
        this.el.style.zIndex = '1000';
      });
      this.el.addEventListener('focusout', () => {
        // Move back when blurred (wait 500ms)
        setTimeout(() => {
          this.el.style.zIndex = '';
        }, 500);
      });
    }

    if (!this.root) {
      this.root = createRoot(this.el);
    }

    this.renderGroups();
  }
  setParameterEx(name, newvalue, oldvalue, skipundo) {
    this.model.setParameter(name, newvalue, {
      undo: !skipundo,
      oldValue: oldvalue,
      label: 'edit parameter'
    });
  }
  setParameter(name, newvalue) {
    this.model.setParameter(name, newvalue, { undo: true, label: 'edit parameter' });
  }
  viewClassForPort(p) {
    const type = getEditType(p);

    // Check for custom editorType
    if (typeof type === 'object' && type.editorType === 'logic-builder-workspace') {
      return LogicBuilderWorkspaceType;
    }

    // Hidden type for internal Logic Builder parameters (renders nothing)
    if (typeof type === 'object' && type.editorType === 'logic-builder-hidden') {
      return LogicBuilderHiddenType;
    }

    // Align tools types
    function isOfAlignToolsType() {
      return NodeLibrary.nameForPortType(type) === 'enum' && typeof type === 'object' && type.alignComp !== undefined;
    }

    // Size mode types
    function isOfSizeModeType() {
      return NodeLibrary.nameForPortType(type) === 'enum' && typeof type === 'object' && type.sizeComp === 'mode';
    }

    // Enum types
    function isOfEnumType() {
      return NodeLibrary.nameForPortType(type) === 'enum' && typeof type === 'object' && type.enums;
    }

    // Color types
    function isOfColorType() {
      return NodeLibrary.nameForPortType(type) === 'color';
    }

    // Boolean types
    function isOfBooleanType() {
      return NodeLibrary.nameForPortType(type) === 'boolean';
    }

    // Basic types
    function isOfBasicType() {
      const name = NodeLibrary.nameForPortType(type);
      return name === 'string' || name === 'number';
    }

    // Is of text area type
    function isOfTextAreaType() {
      return NodeLibrary.nameForPortType(type) === 'string' && typeof type === 'object' && type.multiline;
    }

    // Is of code editor type
    function isOfCodeEditorType() {
      return NodeLibrary.nameForPortType(type) === 'string' && typeof type === 'object' && type.codeeditor;
    }

    function isOfArrayType() {
      return NodeLibrary.nameForPortType(type) === 'array';
    }

    // Image ref type
    function isOfImageType() {
      return NodeLibrary.nameForPortType(type) === 'image';
    }

    // Icon ref type
    function isOfIconType() {
      return NodeLibrary.nameForPortType(type) === 'icon';
    }

    // Font ref type
    function isOfFontType() {
      return NodeLibrary.nameForPortType(type) === 'font';
    }

    // Text style type
    function isOfTextStyleType() {
      return NodeLibrary.nameForPortType(type) === 'textStyle';
    }

    // Component reference type
    function isOfComponentType() {
      return NodeLibrary.nameForPortType(type) === 'component';
    }

    // Number with units
    function isOfNumberWithUnitsType() {
      return NodeLibrary.nameForPortType(type) === 'number' && type.units !== undefined;
    }

    // Dimension type (number, unit dropdown and special boolean for fixed dimension)
    function isOfDimensionType() {
      return NodeLibrary.nameForPortType(type) === 'dimension';
    }

    // Is source code file
    function isOfSourceCodeFileType() {
      return NodeLibrary.nameForPortType(type) === 'source';
    }

    // Is string list type
    function isOfStringListType() {
      return NodeLibrary.nameForPortType(type) === 'stringlist';
    }

    // Is margin padding type
    function isOfMarginPaddingType() {
      //  return NodeLibrary.nameForPortType(type) === 'margins' || NodeLibrary.nameForPortType(type) === 'padding';
      return type && type.marginPaddingComp !== undefined;
    }

    // Is of resizing type
    function isOfResizingType() {
      return NodeLibrary.nameForPortType(type) === 'resizing';
    }

    // Is of variable type
    function isOfVariableType() {
      return NodeLibrary.nameForPortType(type) === 'variable';
    }

    // Is of identifier
    function isOfIdentifierType() {
      return NodeLibrary.nameForPortType(type) === 'string' && typeof type === 'object' && type.identifierOf;
    }

    // Is of curve
    function isOfCurveType() {
      return NodeLibrary.nameForPortType(type) === 'curve';
    }

    // Is of query
    function isOfQueryFilterType() {
      return NodeLibrary.nameForPortType(type) === 'query-filter';
    }

    function isOfQuerySortingType() {
      return NodeLibrary.nameForPortType(type) === 'query-sorting';
    }

    function isOfByobFilterType() {
      return NodeLibrary.nameForPortType(type) === 'byob-filter';
    }

    // Is of pages type
    function isOfPagesType() {
      return NodeLibrary.nameForPortType(type) === 'pages';
    }

    // Is of proplist
    function isOfPropListType() {
      return NodeLibrary.nameForPortType(type) === 'proplist';
    }

    if (isOfAlignToolsType()) return AlignToolsType;
    else if (isOfSizeModeType()) return SizeModeType;
    else if (isOfEnumType()) return EnumType;
    else if (isOfColorType()) return ColorType;
    else if (isOfBooleanType()) return BooleanType;
    else if (isOfTextAreaType()) return TextAreaType;
    else if (isOfCodeEditorType()) return CodeEditorType;
    else if (isOfArrayType()) return CodeEditorType;
    else if (isOfMarginPaddingType()) return MarginPaddingType;
    else if (isOfNumberWithUnitsType()) return NumberWithUnits;
    else if (isOfDimensionType()) return Dimension;
    else if (isOfIdentifierType()) return IdentifierType;
    else if (isOfBasicType()) return BasicType;
    else if (isOfImageType()) return ImageType;
    else if (isOfIconType()) return IconType;
    else if (isOfFontType()) return FontType;
    else if (isOfTextStyleType()) return TextStyleType;
    else if (isOfComponentType()) return ComponentType;
    else if (isOfSourceCodeFileType()) return SourceCodeType;
    else if (isOfStringListType()) return StringListType;
    else if (isOfResizingType()) return ResizingType;
    else if (isOfVariableType()) return VariableType;
    else if (isOfCurveType()) return CurveType;
    else if (isOfQueryFilterType()) return QueryFilterType;
    else if (isOfQuerySortingType()) return QuerySortingType;
    else if (isOfByobFilterType()) return ByobFilterType;
    else if (isOfPagesType()) return PagesType;
    else if (isOfPropListType()) return PropListType;
  }
  _getPorts(): readonly Port[] {
    let ports = this.model.getPorts('input');

    // Is type editable
    function isOfEditableType(p) {
      return !(typeof p.type === 'object' && p.type.allowConnectionsOnly);
    }

    // Remote not editable and ports that don't have an associated view
    ports = ports.filter((p) => isOfEditableType(p) && this.viewClassForPort(p) !== undefined);

    // If this is a popout remote all ports not beloning to this popout
    if (this.popout !== undefined)
      ports = ports.filter((p) => !(p.popout === undefined || p.popout.group !== this.popout));

    return ports;
  }

  getViewGroupsFromPorts() {
    const ports = this._getPorts();

    // Loop over all ports and create views
    this._toolsType = {};
    const _viewForPort = {};
    const _tabViews = {};
    const _popoutViews = {};
    this.views = [];

    let v: TSFixme;
    for (const i in ports) {
      const p = ports[i];

      if (p.popout !== undefined && this.popout === undefined) {
        // This port belongs to a popout
        if (_popoutViews[p.popout.group] === undefined) {
          _popoutViews[p.popout.group] = new PopoutGroup({
            group: p.popout.parentGroup || p.group,
            popoutGroup: p.popout.group,
            label: p.popout.label,
            parent: this
          });

          this.views.push(_popoutViews[p.popout.group]);
          _viewForPort[p.name] = v;
        }

        continue;
      }

      const viewClass = this.viewClassForPort(p);
      if (viewClass !== undefined) {
        v = viewClass.fromPort({ port: p, parent: this });
        if (v !== undefined) {
          // Rows whose default comes from a text style refresh when it changes.
          // Done here rather than in each row's render() because the converted
          // (React) rows do not all chain up to TypeView.render().
          v.bindStyleDefaultWatch && v.bindStyleDefaultWatch();

          this.views.push(v);
          _viewForPort[p.name] = v;
        }
      }
    }

    // Group property views
    const groups = (this.groups = []);

    function addToGroup(view) {
      const name = view.group ? view.group : 'Other';
      for (const i in groups) {
        const g = groups[i];
        if (g.name === name) {
          g.views.push(view);
          return;
        }
      }

      groups.push({ name: name, views: [view], isExpanded: true });
    }

    for (const i in this.views) {
      v = this.views[i];
      if (v.port !== undefined && v.port.parent !== undefined) {
        // This view port is a child to a parent port
        // add it to that view
        const parentV = _viewForPort[v.port.parent];
        parentV && parentV.addChildTypeView && parentV.addChildTypeView(v);
      } else if (v.port !== undefined && v.port.tab !== undefined) {
        // This port belongs to a tab group
        const group = v.port.tab.group;
        if (_tabViews[group] === undefined) {
          _tabViews[group] = new TabGroup({
            group: v.group,
            tabGroup: group,
            parent: this
          });
          addToGroup(_tabViews[group]);
        }
        _tabViews[group].addView(v);
      } else addToGroup(v);
    }

    return this.groups;
  }
}
