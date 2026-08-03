import React from 'react';

import { Model } from '@noodl-utils/model';
import { guid } from '@noodl-utils/utils';

import { ConfirmDialog, ConfirmDialogProps } from '../views/DialogLayer/components/ConfirmDialog';

export enum DialogLayerModelEvent {
  DialogsChanged = 'dialogs-changed'
}

export type DialogLayerModelEvents = {
  [DialogLayerModelEvent.DialogsChanged]: () => void;
};

type DialogEntry = {
  id: string;
  slot: () => React.JSX.Element;
};

export type DialogLayerOptions = {
  /** Make it possible to only show one unique dialog at once. */
  id?: string;
};

export type ShowDialogOptions = DialogLayerOptions & {
  /** Called when the dialog is closed */
  onClose?: () => void;
};

export class DialogLayerModel extends Model<DialogLayerModelEvent, DialogLayerModelEvents> {
  public static instance = new DialogLayerModel();

  public get dialogs(): readonly DialogEntry[] {
    return this._order.map((x) => this._dialogs[x]);
  }

  private _order: string[] = [];
  private _dialogs: Record<string, DialogEntry> = {};

  constructor() {
    super();

    // const showDebug = (index) => {
    //   this.showConfirm({
    //     title: 'Hello World',
    //     text: 'Oh no' + new Array(index + 1).join('!'),
    //     onConfirm() {
    //       showDebug(index + 1);
    //     }
    //   });
    // };
    // showDebug(1);
  }

  public closeById(id: string): boolean {
    if (this._dialogs[id]) {
      this._order = this._order.filter((x) => x !== id);
      delete this._dialogs[id];
      this.notifyListeners(DialogLayerModelEvent.DialogsChanged);
      return true;
    }
    return false;
  }

  public showConfirm(props: ConfirmDialogProps & DialogLayerOptions) {
    const { onConfirm, onAbort } = props;
    const id = props.id ?? guid();

    props.onConfirm = () => {
      this.closeById(id);
      onConfirm && onConfirm();
    };

    props.onAbort = () => {
      this.closeById(id);
      onAbort && onAbort();
    };

    if (this._dialogs[id]) {
      this._order = this._order.filter((x) => x !== id);
      delete this._dialogs[id];
    }

    this._order.push(id);
    this._dialogs[id] = {
      id,
      slot: () => <ConfirmDialog {...props} />
    };
    this.notifyListeners(DialogLayerModelEvent.DialogsChanged);
  }

  /**
   * Show a custom dialog component.
   * Returns a close function that can be called to programmatically close the dialog.
   * 
   * @param render - Function that receives a close callback and returns JSX
   * @param options - Dialog options including optional id
   * @returns A function to close the dialog
   */
  public showDialog(
    render: (close: () => void) => React.JSX.Element,
    options: ShowDialogOptions = {}
  ): () => void {
    const id = options.id ?? guid();
    const { onClose } = options;

    const close = () => {
      this.closeById(id);
      onClose && onClose();
    };

    // Remove existing dialog with same id if present
    if (this._dialogs[id]) {
      this._order = this._order.filter((x) => x !== id);
      delete this._dialogs[id];
    }

    this._order.push(id);
    this._dialogs[id] = {
      id,
      slot: () => render(close)
    };
    this.notifyListeners(DialogLayerModelEvent.DialogsChanged);

    return close;
  }
}
