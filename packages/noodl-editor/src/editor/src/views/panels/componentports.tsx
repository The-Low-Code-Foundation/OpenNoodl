/* eslint-disable @typescript-eslint/no-this-alias */
import { filter as _filter } from 'underscore';
import React, { useEffect, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';

import { UndoQueue, UndoActionGroup } from '@noodl-models/undo-queue-model';

import { PanelHeader, usePanelModeSlot } from '@noodl-core-ui/components/sidebar/PanelHeader';

import View from '../../../../shared/ListenableView';
import { Frame } from '../common/Frame';
import PopupLayer, { StringInputPopup } from '../popuplayer';
import { ToastLayer } from '../ToastLayer/ToastLayer';
import { ComponentPortItem, ComponentPortsView } from './componentports/ComponentPortsView';

export class ComponentPorts extends View {
  el: HTMLElement;

  parent: TSFixme;
  model: TSFixme;
  type: TSFixme;
  plug: TSFixme;
  title: TSFixme;
  group: TSFixme;
  lastIndex: number;
  lastGroup: TSFixme;
  canArrangeInGroups: TSFixme;
  items: ComponentPortItem[];
  refreshItemsScheduled: boolean;
  renderScheduled: TSFixme;
  item: TSFixme[];

  private root: Root | null = null;

  constructor(args) {
    super();

    this.parent = args.parent;
    this.model = args.model;
    this.type = args.type;
    this.plug = args.plug;
    this.title = args.title ? args.title : 'Ports';
    this.group = args.group;
    this.lastIndex = 0;
    this.lastGroup = undefined;
    this.canArrangeInGroups = args.canArrangeInGroups;
  }

  render() {
    this.el = document.createElement('div');
    this.el.className = 'sidebar-panel';

    if (!this.root) {
      this.root = createRoot(this.el);
    }

    this.bindModel();

    this.renderPorts(true);

    this.parent && this.parent.append(this.el);

    return this.el;
  }

  dispose() {
    this.model.off(this);

    if (this.root) {
      const root = this.root;
      this.root = null;
      // dispose runs from a React effect cleanup; unmount cannot be synchronous
      setTimeout(() => root.unmount(), 0);
    }
  }

  resize(layout: TSFixme) {
    Object.assign(this.el.style, {
      position: 'absolute',
      left: layout.x + 'px',
      top: layout.y + 'px',
      width: layout.width + 'px',
      height: layout.height + 'px'
    });
  }

  bindModel() {
    const _this = this;

    this.model.on(
      ['portAdded', 'portRemoved', 'portRenamed', 'portRearranged'],
      function () {
        _this.scheduleRender(true);
      },
      this
    );
  }

  getPorts(filter) {
    // We must explicitly get node instance ports only
    const ports = _filter(this.model.ports, function (p) {
      return !filter || p.plug === filter;
    });
    ports.sort(function (a, b) {
      return a.index > b.index ? 1 : -1;
    });
    return ports;
  }

  getItemsWithGroups() {
    const groups = [
      {
        name: undefined,
        ports: []
      }
    ];

    function addToGroup(name, p) {
      for (let i = 0; i < groups.length; i++)
        if (groups[i].name === name) {
          groups[i].ports.push(p);
          return;
        }

      groups.push({ name: name, ports: [p] });
    }

    const ports = this.getPorts(this.plug);
    for (let i = 0; i < ports.length; i++) {
      const p = ports[i];
      addToGroup(p.group, p);
    }

    const items = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (g.name !== undefined) items.push({ type: 'group', label: g.name });
      for (let j = 0; j < g.ports.length; j++) {
        const p = g.ports[j];
        items.push({ type: 'port', label: p.name, port: p });
      }
    }

    this.lastIndex = items.length > 0 ? items[items.length - 1].port.index : 0;
    this.lastGroup = groups[groups.length - 1].name;

    return items;
  }

  getItems(): ComponentPortItem[] {
    if (this.canArrangeInGroups) return this.getItemsWithGroups();
    else {
      const ports = this.getPorts(this.plug);
      return ports.map(function (p) {
        return { type: 'port', label: p.name, port: p };
      });
    }
  }

  arrangePorts(args?: TSFixme) {
    const items = this.items;
    const undo = new UndoActionGroup({ label: args && args.label ? args.label : 'rearrange ports' });

    // Update groups and index for all ports
    let group = undefined;
    let index = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type === 'group') group = item.label;
      else if (item.type === 'port') {
        this.model.arrangePort(item.port.name, index, group, { undo: undo });
        index++;
      }
    }

    UndoQueue.instance.push(undo);
  }

  dropOnItem(args: TSFixme) {
    if (args.target === args.source) return;

    // Reorder items
    const sourceIdx = this.items.indexOf(args.source);
    const targetIdx = this.items.indexOf(args.target);

    this.items.splice(sourceIdx, 1);

    const newIdx = targetIdx;
    // if(sourceIdx > targetIdx) newIdx++;
    this.items.splice(newIdx, 0, args.source);

    this.arrangePorts();
  }

  scheduleRender(refresh?: TSFixme) {
    const _this = this;

    if (refresh) this.refreshItemsScheduled = true;
    if (this.renderScheduled) return;
    this.renderScheduled = true;

    setTimeout(function () {
      if (_this.renderScheduled) {
        _this.renderPorts(_this.refreshItemsScheduled);
      }
      _this.renderScheduled = false;
      _this.refreshItemsScheduled = false;
    }, 1);
  }

  renderPorts(refresh?: TSFixme) {
    if (!this.root) return;

    if (refresh) this.items = this.getItems();

    this.root.render(
      React.createElement(ComponentPortsView, {
        // A new array each render so React sees the reordering after a drop
        items: [...this.items],
        canArrangeInGroups: Boolean(this.canArrangeInGroups),
        onRenamePort: (item, newName) => {
          const result = this.performRename({ newName, oldName: item.port.name });
          if (!result.success) {
            ToastLayer.showError(result.message);
          }
        },
        onDeletePort: (item) => {
          const result = this.performDelete(item.port.name);
          if (!result.success) {
            ToastLayer.showError(result.message);
          }

          this.notifyListeners('panelResized');
        },
        onRenameGroup: (item, newName) => {
          const result = this.performRenameGroup({ newName, item });
          if (!result.success) {
            ToastLayer.showError(result.message);
          }
        },
        onDeleteGroup: (item) => {
          this.performDeleteGroup(item);
          this.notifyListeners('panelResized');
        },
        onAddPort: (anchor) => this.onAddPortClicked(anchor),
        onAddGroup: (anchor) => this.onAddGroupClicked(anchor),
        onDrop: (target, source) => this.dropOnItem({ target, source })
      })
    );
  }

  // Add port
  onAddPortClicked(anchor: HTMLElement) {
    const _this = this;

    const popup = new StringInputPopup({
      label: 'New port name',
      okLabel: 'Add',
      cancelLabel: 'Cancel',
      // `performAdd` splits on commas, so the hint says so — the box is one
      // line because a list of port names is one line, not eight.
      placeholder: 'e.g. title, subtitle',
      onOk: function (portName) {
        const result = _this.performAdd(portName);
        if (!result.success) {
          ToastLayer.showError(result.message);
        }

        _this.notifyListeners('panelResized');
      }
    });
    popup.render();

    PopupLayer.instance.showPopup({
      content: popup,
      attachTo: anchor,
      position: 'top'
    });
  }

  performAdd(portNames: TSFixme) {
    if (portNames === '') {
      return { success: false, message: 'Port name cannot be empty' };
    } else {
      const result = portNames.split(',').map((port) => {
        const portName = port.trim();
        if (this.model.findPortWithName(portName)) {
          return { success: false, message: 'Cannot create a port with the same name as an existing one.' };
        } else {
          const port = {
            name: portName,
            plug: this.plug,
            type: this.type,
            group: this.group !== undefined ? this.group : this.lastGroup,
            index: ++this.lastIndex
          };

          this.model.addPort(port, { undo: true, label: 'add port' });

          return { success: true };
        }
      });

      const failed = result.find((r) => !r.success);
      return failed ? failed : { success: true };
    }
  }

  // Rename port
  performRename(args: TSFixme) {
    if (args.newName === '') {
      return { success: false, message: 'Port name cannot be empty' };
    } else if (this.model.findPortWithName(args.newName)) {
      // Show alert that component cannot have same name as an
      // existing component
      return { success: false, message: 'Cannot rename a port to the same name as an existing one.' };
    } else {
      this.model.renamePortWithName(args.oldName, args.newName, { undo: true, label: 'rename port' });

      return { success: true };
    }
  }

  // Delete port
  performDelete(portname: TSFixme) {
    if (this.model.isPortConnected(portname)) {
      return { success: false, message: 'Cannot remove port, does it have active connections?' };
    } else {
      this.model.removePortWithName(portname, { undo: true, label: 'delete port' });

      return { success: true };
    }
  }

  // Add group
  onAddGroupClicked(anchor: HTMLElement) {
    const _this = this;

    const popup = new StringInputPopup({
      label: 'New group name',
      okLabel: 'Add',
      cancelLabel: 'Cancel',
      placeholder: 'e.g. Layout',
      onOk: function (groupName) {
        const result = _this.performAddGroup(groupName);
        if (!result.success) {
          ToastLayer.showError(result.message);
        }

        _this.notifyListeners('panelResized');
      }
    });
    popup.render();

    PopupLayer.instance.showPopup({
      content: popup,
      attachTo: anchor,
      position: 'top'
    });
  }

  findGroupWithName(groupName: TSFixme) {
    if (!this.items) this.item = this.getItems();

    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.label === groupName && item.type === 'group') return item;
    }
  }

  performAddGroup(groupNames: TSFixme) {
    const _this = this;

    if (groupNames === '') {
      return { success: false, message: 'Group name cannot be empty' };
    } else {
      const result = groupNames.split(',').map((group) => {
        const groupName = group.trim();

        if (this.findGroupWithName(groupName)) {
          return { success: false, message: 'Group with that name already exist' };
        } else {
          const oldLastGroup = this.lastGroup;
          const newGroup: ComponentPortItem = { type: 'group', label: groupName };

          // @ts-expect-error TODO: What?
          UndoQueue.instance.pushAndDo({
            label: 'add group',
            do: function () {
              _this.lastGroup = groupName;
              _this.items.push(newGroup);
              _this.scheduleRender();
            },
            undo: function () {
              _this.lastGroup = oldLastGroup;
              const idx = _this.items.indexOf(newGroup);
              idx !== -1 && _this.items.splice(idx, 1);
              _this.scheduleRender();
            }
          });

          return { success: true };
        }
      });

      const failed = result.find((r) => !r.success);
      return failed ? failed : { success: true };
    }
  }

  // Rename group
  performRenameGroup(args: TSFixme) {
    if (args.newName === '') {
      return { success: false, message: 'Group name cannot be empty' };
    } else {
      args.item.label = args.newName;
      this.arrangePorts({ label: 'rename group' });

      return { success: true };
    }
  }

  // Delete group
  performDeleteGroup(item: ComponentPortItem) {
    const idx = this.items.indexOf(item);
    this.items.splice(idx, 1);

    this.arrangePorts({ label: 'delete group' });
    return { success: true };
  }
}

export function ComponentPortsComponent(props: { title?: string }) {
  const [instance, setInstance] = useState(null);

  /*
   * PNL-005 (follow-up): the header moved out of `ComponentPortsView` and up
   * here, into the *main* React tree.
   *
   * It used to live inside the view that `Frame` hosts, which is rendered into
   * its own React root (`createRoot` in `ComponentPorts.render`). Two
   * consequences, both real defects the panel-chrome gate's sibling findings
   * turned up:
   *
   *   1. On the first render pass `instance` is still null, so the whole panel —
   *      header included — was an empty `<div>`. A registered panel rendering no
   *      chrome at all, which is the exact class of defect this task exists to
   *      remove (`VersionControlPanel` had the same shape).
   *   2. `PanelModeSlotContext` does not cross a React root boundary, so the
   *      Ports panel could never show the side panel's widen / hide / float /
   *      full controls. Up here it can, and does.
   *
   * A plain flex column rather than `BasePanel`: this panel's box model is a
   * legacy imperative view sized by `Frame`, and wrapping it in `BasePanel`'s
   * border, radius and insets would change more than the header.
   */
  const modeSlot = usePanelModeSlot();
  const title = props?.title ?? 'Ports';

  useEffect(() => {
    const instance = new ComponentPorts(props);
    instance.render();
    setInstance(instance);

    return () => instance.dispose();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <PanelHeader title={title} modeSlot={modeSlot} />
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Frame instance={instance} isFitWidth />
      </div>
    </div>
  );
}
