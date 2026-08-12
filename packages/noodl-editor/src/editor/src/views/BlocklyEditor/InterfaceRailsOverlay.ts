/**
 * LGC-004 §1 — the two interface rails, rendered.
 *
 * An **Inputs** rail on the left edge of the block editor and an **Outputs** rail on the right,
 * always visible, never scrolling away with the blocks. Together they are the answer to the video's
 * *"I'd really like to build my functions visually"*: the function part stops being inferred from
 * fifteen scattered blocks and becomes something you can look at.
 *
 * ## What it is, structurally
 *
 * 🔴 **Two plain DOM elements outside Blockly's SVG, and nothing in the workspace model.**
 * `BlocklyWorkspace` reads `initialWorkspace` once, and every settled edit is serialised through a
 * 300 ms debounce into the node's `workspace` parameter. So a rail built out of blocks, comments,
 * icons or fields would be written into the user's saved program and would diff in git — the same
 * trap `DoItBalloons` documents, and the reason that file is imperative SVG rather than a
 * `Blockly.Comment`. Nothing here creates a Blockly event except the block a drag deliberately
 * makes.
 *
 * They are **siblings** of the injection div rather than absolutely-positioned layers over it,
 * which is the one structural decision worth arguing. Blockly's toolbox occupies the left edge of
 * the injection div; a left rail floated on top of it would cover the toolbox and eat its clicks.
 * As siblings the two rails simply take their width out of the row, and — because they exist in
 * the DOM before `Blockly.inject` runs — the workspace is injected at its final size and no
 * `svgResize` is needed. See `blocklyResize.ts` for why a `ResizeObserver` would not have been
 * available as a fallback anyway.
 *
 * ## Where the rows come from
 *
 * `railModelForWorkspace`, every refresh, with nothing cached. See `interfaceRails.ts` for why
 * that matters (registers L10 and L11). This class deliberately holds **no port state at all**:
 * `refresh()` derives and repaints, and there is no field on it from which a stale signature
 * could be read.
 *
 * @module BlocklyEditor
 */

import * as Blockly from 'blockly';

import css from './BlocklyWorkspace.module.scss';
import { RailModel, RailRow, dragBlockJsonForRow, railModelForWorkspace, unusedOutputName } from './interfaceRails';

/** Blockly's component id for the outputs rail's drop behaviour. */
const OUTPUTS_DROP_TARGET_ID = 'noodlInterfaceOutputsRail';

/** How far a pointer must travel before a press on a row counts as a drag rather than a click. */
const DRAG_THRESHOLD_PX = 4;

/** Where a `set output` minted by a drop on the rail lands, as an inset from the right edge. */
const DROP_INSET_WS_UNITS = 280;

export interface InterfaceRailsOptions {
  workspace: Blockly.WorkspaceSvg;
  /** The element the Inputs rail owns. Must already be in the DOM. */
  inputsHost: HTMLElement;
  /** The element the Outputs rail owns. Must already be in the DOM. */
  outputsHost: HTMLElement;
}

export interface InterfaceRailsHandle {
  /** Re-derive from the workspace and repaint. Called for you on every settled change. */
  refresh(): void;
  dispose(): void;
}

/**
 * Turn the rails on for one open block editor.
 *
 * @returns a handle whose `dispose` must be called from the same teardown that disposes the
 *   workspace — the rails hold a change listener and a registered drag target on it.
 */
export function attachInterfaceRails(options: InterfaceRailsOptions): InterfaceRailsHandle {
  const rails = new InterfaceRails(options);
  return {
    refresh: () => rails.refresh(),
    dispose: () => rails.dispose()
  };
}

class InterfaceRails {
  private readonly workspace: Blockly.WorkspaceSvg;
  private readonly inputsHost: HTMLElement;
  private readonly outputsHost: HTMLElement;

  private readonly changeListener: (event: Blockly.Events.Abstract) => void;
  private readonly dropTarget: OutputsRailDropTarget;

  private disposed = false;

  constructor({ workspace, inputsHost, outputsHost }: InterfaceRailsOptions) {
    this.workspace = workspace;
    this.inputsHost = inputsHost;
    this.outputsHost = outputsHost;

    /**
     * ⚠️ **No debounce, and no timer of any kind.** Serialising a workspace of the size block
     * programs actually reach — App Inventor's median is 54 blocks — is microseconds, while a
     * timer in an occluded Electron renderer is clamped by roughly 1000× (in the registers), which
     * would leave the rails minutes stale in exactly the window nobody is looking at and nobody
     * can reproduce. The 300 ms save debounce is a separate concern: it exists to avoid writing
     * the project file, not to avoid this.
     */
    this.changeListener = (event) => {
      if (event.isUiEvent) return;
      if (this.workspace.isDragging()) return;
      this.refresh();
    };
    this.workspace.addChangeListener(this.changeListener);

    this.dropTarget = new OutputsRailDropTarget(this.workspace, this.outputsHost, () => this.model());
    this.workspace.getComponentManager().addComponent({
      component: this.dropTarget,
      weight: 3,
      capabilities: [Blockly.ComponentManager.Capability.DRAG_TARGET]
    });

    this.refresh();
  }

  /** 🔴 Derived here and nowhere else. There is deliberately no field holding this. */
  private model(): RailModel {
    return railModelForWorkspace(this.workspace);
  }

  refresh(): void {
    if (this.disposed) return;

    const model = this.model();
    this.paint(this.inputsHost, 'inputs', model.inputs);
    this.paint(this.outputsHost, 'outputs', model.outputs);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.workspace.removeChangeListener(this.changeListener);
    this.workspace.getComponentManager().removeComponent(OUTPUTS_DROP_TARGET_ID);
    this.dropTarget.dispose();

    this.inputsHost.replaceChildren();
    this.outputsHost.replaceChildren();
  }

  private paint(host: HTMLElement, side: 'inputs' | 'outputs', rows: RailRow[]): void {
    // The host's own `.Rail` classes are set by `BlocklyWorkspace`'s JSX, not here: its width must
    // exist before Blockly is injected into the sibling next to it.
    host.replaceChildren();

    const header = document.createElement('div');
    header.className = css.RailHeader;
    header.textContent = side === 'inputs' ? 'Inputs' : 'Outputs';
    host.appendChild(header);

    const list = document.createElement('div');
    list.className = css.RailRows;
    host.appendChild(list);

    if (rows.length === 0) {
      const empty = document.createElement('div');
      empty.className = css.RailEmpty;
      /**
       * ⚠️ The empty state has to say the port set is *derived*, because an empty rail with a
       * "+ Add" button would teach the opposite — that ports are a list you maintain here. They
       * are not; they are what the blocks say. Register L12: never turn "works undeclared" into
       * "must declare".
       */
      empty.textContent =
        side === 'inputs'
          ? 'None yet. Any “get input” or “Define input” block you add shows up here.'
          : 'None yet. Any “set output” or “Define output” block you add shows up here.';
      list.appendChild(empty);
      return;
    }

    for (const row of rows) {
      list.appendChild(this.buildRow(row, side));
    }
  }

  private buildRow(row: RailRow, side: 'inputs' | 'outputs'): HTMLElement {
    const element = document.createElement('div');
    element.className = css.RailRow;
    element.dataset.portName = row.name;
    element.dataset.portKind = row.kind;
    element.dataset.portDeclared = String(row.declared);

    if (!row.declared) element.classList.add(css.RailRowInferred);
    if (row.kind === 'signal') element.classList.add(css.RailRowSignal);

    const name = document.createElement('span');
    name.className = css.RailRowName;
    name.textContent = row.name;
    element.appendChild(name);

    const type = document.createElement('span');
    type.className = css.RailRowType;
    type.textContent = row.displayType;
    element.appendChild(type);

    const draggable = dragBlockJsonForRow(row, side) !== null;

    /**
     * The tooltip carries the one thing the row cannot show: *why* it is here. An inferred row is
     * not a warning — it says the port exists because a block uses it, which is the property that
     * lets a program run before anyone declares anything.
     */
    element.title = [
      row.declared
        ? row.name + ' — declared, type ' + row.displayType
        : row.name + ' — inferred from use, type ' + row.displayType + '. It works; declare it to give it a type.',
      draggable ? 'Drag it onto the blocks, or click, to add a bound block.' : null
    ]
      .filter(Boolean)
      .join('\n');

    if (draggable) {
      element.classList.add(css.RailRowDraggable);
      element.addEventListener('pointerdown', (event) => this.beginRowDrag(event, row, side, element));
    }

    return element;
  }

  /**
   * Press → drag → drop creates the bound block; press → release creates it in the middle of the
   * view.
   *
   * ⚠️ **The click is not a convenience, it is the discoverable half.** A builder who has never
   * been taught this surface will click a row long before they think to drag one, and a click that
   * does nothing reads as a dead control. Both routes make the same block and both are one undo
   * step, so the cheap gesture is not a worse one.
   */
  private beginRowDrag(event: PointerEvent, row: RailRow, side: 'inputs' | 'outputs', element: HTMLElement): void {
    if (event.button !== 0) return;
    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;
    let ghost: HTMLElement | null = null;

    const move = (moveEvent: PointerEvent) => {
      const travelled = Math.abs(moveEvent.clientX - startX) + Math.abs(moveEvent.clientY - startY);
      if (!ghost && travelled < DRAG_THRESHOLD_PX) return;

      if (!ghost) {
        ghost = document.createElement('div');
        ghost.className = css.RailDragGhost;
        ghost.textContent = (side === 'inputs' ? 'get input ' : 'set output ') + row.name;
        document.body.appendChild(ghost);
        element.classList.add(css.RailRowDragging);
      }

      ghost.style.left = moveEvent.clientX + 12 + 'px';
      ghost.style.top = moveEvent.clientY + 12 + 'px';
    };

    const finish = (upEvent: PointerEvent) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', cancel);
      element.classList.remove(css.RailRowDragging);

      const dragged = ghost !== null;
      if (ghost) {
        ghost.remove();
        ghost = null;
      }

      if (dragged) {
        // A drag that ended somewhere other than the canvas is a cancelled drag, not a create.
        if (!this.isOverWorkspace(upEvent.clientX, upEvent.clientY)) return;
        this.createBoundBlock(row, side, this.workspaceCoordinatesAt(upEvent.clientX, upEvent.clientY));
        return;
      }

      this.createBoundBlock(row, side, this.centreOfView());
    };

    const cancel = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', cancel);
      element.classList.remove(css.RailRowDragging);
      if (ghost) {
        ghost.remove();
        ghost = null;
      }
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', cancel);
  }

  /**
   * Create the row's block, already carrying the row's name.
   *
   * Wrapped in one event group so the whole thing is a single Ctrl+Z. A create that took two
   * undos — one for the block, one for the field — would be the sort of small wrongness a builder
   * cannot name but stops trusting.
   */
  private createBoundBlock(row: RailRow, side: 'inputs' | 'outputs', at: Blockly.utils.Coordinate): void {
    const json = dragBlockJsonForRow(row, side);
    if (!json) return;

    Blockly.Events.setGroup(true);
    try {
      const block = Blockly.serialization.blocks.append(json, this.workspace, { recordUndo: true }) as Blockly.BlockSvg;
      block.moveTo(at);
      block.select();
    } catch (error) {
      console.error('[Blockly] The interface rail could not create a block for ' + row.name, error);
    } finally {
      Blockly.Events.setGroup(false);
    }
  }

  private isOverWorkspace(clientX: number, clientY: number): boolean {
    const svg = this.workspace.getParentSvg();
    if (!svg) return false;
    const rect = svg.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  private workspaceCoordinatesAt(clientX: number, clientY: number): Blockly.utils.Coordinate {
    return Blockly.utils.svgMath.screenToWsCoordinates(this.workspace, new Blockly.utils.Coordinate(clientX, clientY));
  }

  private centreOfView(): Blockly.utils.Coordinate {
    const view = this.workspace.getMetricsManager().getViewMetrics(true);
    return new Blockly.utils.Coordinate(view.left + view.width / 2 - 60, view.top + view.height / 2 - 12);
  }
}

/**
 * The outputs rail as a Blockly drop target — LGC-004 §1's second gesture.
 *
 * Drag any value block onto the Outputs rail and it becomes that output: a `set output` bound to
 * the row you dropped on, with the block plugged into it. Dropped below the rows there is no port
 * to bind to, so one is minted with an unused name.
 *
 * ⚠️ Blockly's drag machinery reports *that* a target was entered, never *where* in it, so the row
 * under the cursor is tracked from a document-level `pointermove` installed only while a drag is
 * over this rail. Blockly 12 drives its own gestures with pointer events, so those fire; a
 * `mousemove` listener would not.
 */
class OutputsRailDropTarget implements Blockly.IDragTarget {
  readonly id = OUTPUTS_DROP_TARGET_ID;

  private readonly workspace: Blockly.WorkspaceSvg;
  private readonly host: HTMLElement;
  private readonly currentModel: () => RailModel;

  private pointerY: number | null = null;
  private readonly trackPointer: (event: PointerEvent) => void;

  constructor(workspace: Blockly.WorkspaceSvg, host: HTMLElement, currentModel: () => RailModel) {
    this.workspace = workspace;
    this.host = host;
    this.currentModel = currentModel;
    this.trackPointer = (event) => {
      this.pointerY = event.clientY;
    };
  }

  getClientRect(): Blockly.utils.Rect | null {
    const rect = this.host.getBoundingClientRect();
    // A hidden pane measures 0×0; a zero rect would still "contain" a stray coordinate on some
    // rounding paths, so it is refused outright.
    if (rect.width === 0 || rect.height === 0) return null;
    return Blockly.utils.Rect.from(rect);
  }

  onDragEnter(): void {
    this.host.classList.add(css.RailDropActive);
    document.addEventListener('pointermove', this.trackPointer);
  }

  onDragOver(): void {
    // Nothing per-frame: the row highlight follows `pointerY`, which the listener above keeps.
  }

  onDragExit(): void {
    this.host.classList.remove(css.RailDropActive);
    document.removeEventListener('pointermove', this.trackPointer);
  }

  onDrop(dragElement: Blockly.IDraggable): void {
    this.onDragExit();

    const block = dragElement as Blockly.BlockSvg;
    // A statement block has no value to write, so there is nothing honest to build from it.
    if (!block || typeof block.getRelativeToSurfaceXY !== 'function' || !block.outputConnection) return;

    const name = this.portNameForDrop();

    /**
     * ⚠️ Deferred by one microtask, not run inline. `onDrop` is called from inside Blockly's
     * end-of-drag, which still holds the dragged block; appending and connecting blocks under it
     * is asking a gesture to survive the workspace changing beneath it. A microtask runs after the
     * drag has finished unwinding and — unlike a `setTimeout` — is not a timer, so it is not
     * subject to the occluded-renderer clamp in the registers.
     */
    queueMicrotask(() => this.wrapInSetOutput(block, name));
  }

  shouldPreventMove(): boolean {
    // The block is about to be connected into a `set output` that decides where it sits, so
    // sending it back to where the drag started would fight that.
    return false;
  }

  dispose(): void {
    document.removeEventListener('pointermove', this.trackPointer);
    this.host.classList.remove(css.RailDropActive);
  }

  /** The name of the row the pointer was over, or a fresh unused one. */
  private portNameForDrop(): string {
    const model = this.currentModel();

    if (this.pointerY !== null) {
      const rows = Array.from(this.host.querySelectorAll<HTMLElement>('[data-port-name]'));
      for (const element of rows) {
        if (element.dataset.portKind === 'signal') continue;
        const rect = element.getBoundingClientRect();
        if (this.pointerY >= rect.top && this.pointerY <= rect.bottom) {
          return element.dataset.portName as string;
        }
      }
    }

    return unusedOutputName(model);
  }

  private wrapInSetOutput(block: Blockly.BlockSvg, name: string): void {
    if (block.disposed || !block.workspace) return;

    Blockly.Events.setGroup(true);
    try {
      const setter = Blockly.serialization.blocks.append(
        { type: 'noodl_set_output', fields: { NAME: name } },
        this.workspace,
        { recordUndo: true }
      ) as Blockly.BlockSvg;

      setter.moveTo(this.landingSpot());

      const socket = setter.getInput('VALUE')?.connection;
      const plug = block.outputConnection;

      /**
       * ⚠️ Asked, not attempted. LGC-005 puts a real connection check on this socket when the
       * matching `Define output` states a type, and `connect` on a refused pair throws. A `number`
       * output that refuses a `text` block is the check doing its job — so the `set output` is
       * still created and named, and the block is simply left where it was rather than the whole
       * gesture failing with an exception in the console.
       */
      if (socket && plug && this.workspace.connectionChecker.canConnect(socket, plug, false)) {
        socket.connect(plug);
      }

      setter.select();
    } catch (error) {
      console.error('[Blockly] The outputs rail could not build a “set output” for ' + name, error);
    } finally {
      Blockly.Events.setGroup(false);
    }
  }

  /** Just inside the right edge of the view, next to the rail the block was dropped on. */
  private landingSpot(): Blockly.utils.Coordinate {
    const view = this.workspace.getMetricsManager().getViewMetrics(true);

    const x = view.left + Math.max(0, view.width - DROP_INSET_WS_UNITS);
    const y =
      this.pointerY === null
        ? view.top + view.height / 2
        : Math.min(
            Math.max(
              Blockly.utils.svgMath.screenToWsCoordinates(this.workspace, new Blockly.utils.Coordinate(0, this.pointerY)).y,
              view.top + 8
            ),
            view.top + Math.max(8, view.height - 48)
          );

    return new Blockly.utils.Coordinate(x, y);
  }
}
