import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import View from './view';

export interface ReactViewDefaultProps {
  owner?: TSFixme;
}

export abstract class ReactView<TProps extends ReactViewDefaultProps> extends View {
  private props: TProps;
  private root: Root | null = null;

  public el: HTMLElement;

  constructor(props: TProps) {
    super();

    this.props = props;
  }

  public set owner(owner: TSFixme) {
    this.props.owner = owner;
    this.render();
  }

  public render() {
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.style.width = '100%';
      this.el.style.height = '100%';
    }

    if (!this.root) {
      this.root = createRoot(this.el);
    }
    this.root.render(React.createElement(this.renderReact.bind(this), this.props));

    return this.el;
  }

  public dispose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  protected abstract renderReact(props: TProps): React.JSX.Element;
}
