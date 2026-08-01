import BScroll from '@better-scroll/core';
import MouseWheel from '@better-scroll/mouse-wheel';
import ScrollBar from '@better-scroll/scroll-bar';
import React from 'react';

import Layout from '../../../layout';
import PointerListeners from '../../../pointerlisteners';
import { Noodl } from '../../../types';
import NestedScroll from './scroll-plugins/nested-scroll-plugin';
import patchedMomentum from './scroll-plugins/patched-momentum-scroll';
import Slide from './scroll-plugins/slide-scroll-plugin';

BScroll.use(ScrollBar);
BScroll.use(NestedScroll);
BScroll.use(MouseWheel);
BScroll.use(Slide);

export interface GroupProps extends Noodl.ReactProps {
  as?: keyof React.JSX.IntrinsicElements | React.ComponentType<unknown>;

  scrollSnapEnabled: boolean;
  showScrollbar: boolean;
  scrollEnabled: boolean;
  nativeScroll: boolean;
  scrollSnapToEveryItem: boolean;
  flexWrap: 'nowrap' | 'wrap' | 'wrap-reverse';
  scrollBounceEnabled: boolean;
  clip: boolean;

  layout: 'none' | 'row' | 'column';
  dom;

  onScrollPositionChanged?: (value: number) => void;
  onScrollStart?: () => void;
  onScrollEnd?: () => void;

  children?: React.ReactNode;
}

type ScrollRef = HTMLDivElement & { noodlNode?: Noodl.ReactProps['noodlNode'] };

export class Group extends React.Component<GroupProps> {
  scrollNeedsToInit: boolean;
  scrollRef: React.RefObject<ScrollRef>;
  iScroll?: BScroll;

  constructor(props: GroupProps) {
    super(props);
    this.scrollNeedsToInit = false;
    this.scrollRef = React.createRef();
  }

  rootRef = (el: ScrollRef | null) => {
    (this.scrollRef as React.MutableRefObject<ScrollRef | null>).current = el;
    this.props.noodlNode?.setDOMElement(el);
  };

  componentDidMount() {
    if (this.props.scrollEnabled && this.props.nativeScroll !== true) {
      this.setupIScroll();
    }

    //plumbing for the focused signals
    this.scrollRef.current.noodlNode = this.props.noodlNode;
  }

  componentWillUnmount() {
    if (this.iScroll) {
      this.iScroll.destroy();
      this.iScroll = undefined;
    }

    this.props.noodlNode.context.setNodeFocused(this.props.noodlNode, false);
  }

  /**
   * NDA-012 (Visual) B1/B2. Both scroll actions return the reason they did nothing, or
   * `undefined` when they scrolled.
   *
   * Every failure here used to be a `child && …` or an `if (element && …)` with no else: a
   * `Scroll To Index` past the end of the list and a `Scroll To Element` pointing at something
   * the Group does not contain were both indistinguishable from success. The node raises the
   * returned reason on the runtime error bus (`group.ts`), so — unlike the editor-only
   * `sendWarning` this category is full of — the diagnosis survives into a deployed app.
   *
   * The reason is produced here rather than in the node because only the component knows which
   * scroll implementation is live: with iScroll the children hang off an inner wrapper element,
   * without it they are direct children, and "index 5 of 3" has to be counted against whichever
   * of those is actually in the DOM.
   */
  scrollToIndex(index, duration): string | undefined {
    const container = this.scrollRef.current;
    if (!container) return 'the Group has no scrollable element';

    // iScroll wraps the children in one scroller element; the plain path does not.
    const scrollParent = (this.iScroll ? container.children[0] : container) as HTMLElement | undefined;
    if (!scrollParent) return 'the Group has no scrollable element';

    const child = scrollParent.children[index] as HTMLElement | undefined;
    if (!child) {
      return `there is no child at index ${JSON.stringify(index)} — the Group has ${scrollParent.children.length}`;
    }

    if (this.iScroll) {
      this.iScroll.scrollToElement(child, duration, 0, 0);
    } else {
      child.scrollIntoView({ behavior: 'smooth' });
    }

    return undefined;
  }

  scrollToElement(noodlChild, duration): string | undefined {
    // An unwired `Element` is a port with no opinion, not a failure — Empty-Value Contract.
    if (!noodlChild) return undefined;

    // Get the ref - in React 19, we need to access the DOM element directly
    // rather than using the deprecated findDOMNode
    const ref = noodlChild.getRef();
    // The ref might be a DOM element directly, or a ref object with a current property.
    //
    // ⚠️ `typeof HTMLElement !== 'undefined'` is load-bearing, not defensive noise: `instanceof`
    // against an undeclared global is a `ReferenceError`, not `false`. This node declares SSR
    // `safe`, and the server has no `HTMLElement` — so the bare `instanceof` turned a scroll
    // action fired anywhere without a DOM into a thrown error rather than a no-op. Found by the
    // corpus row for the reason-string contract, which runs in `testEnvironment: node`.
    const isElement = typeof HTMLElement !== 'undefined' && ref instanceof HTMLElement;
    const element = (isElement ? ref : ref?.current) as HTMLElement | null;

    if (!element || !element.scrollIntoView) {
      return 'the node on Element has no rendered DOM element — it may not be mounted';
    }

    const container = this.scrollRef.current;
    // `scrollIntoView` scrolls the nearest scrollable *ancestor* of the target, so an element
    // outside this Group does not fail — it silently scrolls something else, which is the
    // hardest version of this defect to spot. Say so rather than move an unrelated container.
    if (container && !container.contains(element)) {
      return 'the node on Element is not inside this Group, so scrolling it would move a different container';
    }

    if (this.iScroll) {
      this.iScroll.scrollToElement(element, duration, 0, 0);
    } else {
      element.scrollIntoView({ behavior: 'smooth' });
    }

    return undefined;
  }

  setupIScroll() {
    const { scrollSnapEnabled } = this.props;
    const scrollDirection = this.getScrollDirection();

    const snapOptions = {
      disableSetWidth: true,
      disableSetHeight: true,
      loop: false
    };

    const domElement = this.scrollRef.current;
    this.iScroll = new BScroll(domElement, {
      bounceTime: 500,
      swipeBounceTime: 300,
      scrollbar: this.props.showScrollbar ? {} : undefined,
      momentum: scrollSnapEnabled ? !this.props.scrollSnapToEveryItem : true,
      bounce: this.props.scrollBounceEnabled && !(scrollSnapEnabled && snapOptions.loop),
      scrollX: scrollDirection === 'x' || scrollDirection === 'both',
      scrollY: scrollDirection === 'y' || scrollDirection === 'both',
      slide: scrollSnapEnabled ? snapOptions : undefined,
      probeType: this.props.onScrollPositionChanged ? 3 : 1,
      click: true,
      nestedScroll: true,
      //disable CSS animation, they can cause a flicker on iOS,
      //and cause problems with probing the scroll position during an animation
      useTransition: false
    });

    //the scroll behavior when doing a momentum scroll that reaches outside the bounds
    //does a slow and unpleasant animation. Let's patch it to make it behave more like iScroll.
    const scroller = this.iScroll.scroller;
    // @ts-expect-error momentum does exist
    scroller.scrollBehaviorX && (scroller.scrollBehaviorX.momentum = patchedMomentum.bind(scroller.scrollBehaviorX));
    // @ts-expect-error momentum does exist
    scroller.scrollBehaviorY && (scroller.scrollBehaviorY.momentum = patchedMomentum.bind(scroller.scrollBehaviorY));

    //refresh the scroll view in case a child has changed height, e.g. an image loaded
    //seem to be very performant, no observed problem so far
    this.iScroll.on('beforeScrollStart', () => {
      this.iScroll.refresh();
    });

    this.iScroll.on('scrollStart', () => {
      this.props.onScrollStart && this.props.onScrollStart();
    });

    this.iScroll.on('scrollEnd', () => {
      this.props.onScrollEnd && this.props.onScrollEnd();
    });

    if (this.props.onScrollPositionChanged) {
      this.iScroll.on('scroll', () => {
        this.props.onScrollPositionChanged(scrollDirection === 'x' ? -this.iScroll.x : -this.iScroll.y);
      });
    }
  }

  componentDidUpdate(prevProps: GroupProps) {
    const scrollHasUpdated =
      prevProps.scrollSnapEnabled !== this.props.scrollSnapEnabled ||
      prevProps.onScrollPositionChanged !== this.props.onScrollPositionChanged ||
      prevProps.onScrollStart !== this.props.onScrollStart ||
      prevProps.onScrollEnd !== this.props.onScrollEnd ||
      prevProps.showScrollbar !== this.props.showScrollbar ||
      prevProps.scrollEnabled !== this.props.scrollEnabled ||
      prevProps.nativeScroll !== this.props.nativeScroll ||
      prevProps.scrollSnapToEveryItem !== this.props.scrollSnapToEveryItem ||
      prevProps.layout !== this.props.layout ||
      prevProps.flexWrap !== this.props.flexWrap ||
      prevProps.scrollBounceEnabled !== this.props.scrollBounceEnabled;

    if (scrollHasUpdated) {
      if (this.iScroll) {
        this.iScroll.destroy();
        this.iScroll = undefined;
      }

      this.scrollNeedsToInit = this.props.scrollEnabled && !this.props.nativeScroll;
    }

    // Handle scroll initialization (moved from the old componentDidUpdate)
    if (this.scrollNeedsToInit) {
      this.setupIScroll();
      this.scrollNeedsToInit = false;
    }

    if (this.iScroll) {
      setTimeout(() => {
        this.iScroll && this.iScroll.refresh();
      }, 0);
    }
  }

  renderIScroll() {
    const { flexDirection, flexWrap } = this.props.style;

    const childStyle: React.CSSProperties = {
      display: 'inline-flex',
      flexShrink: 0,
      flexDirection,
      flexWrap,
      touchAction: 'none'
      // pointerEvents: this.state.isScrolling ? 'none' : undefined
    };

    if (flexDirection === 'row') {
      if (flexWrap === 'wrap') {
        childStyle.width = '100%';
      } else {
        childStyle.height = '100%';
      }
    } else {
      if (flexWrap === 'wrap') {
        childStyle.height = '100%';
      } else {
        childStyle.width = '100%';
      }
    }

    return (
      <div className="scroll-wrapper-internal" style={childStyle}>
        {this.props.children}
      </div>
    );
  }

  getScrollDirection(): 'x' | 'y' | 'both' {
    // TODO: This never returns both, why?

    if (this.props.flexWrap === 'wrap' || this.props.flexWrap === 'wrap-reverse') {
      return this.props.layout === 'row' ? 'y' : 'x';
    }

    return this.props.layout === 'row' ? 'x' : 'y';
  }

  render() {
    // React.ElementType collapses the intrinsic-elements union; with the ref prop added,
    // the raw union exceeds the compiler's representation limit (TS2590).
    const { as = 'div', ...props } = this.props;
    const Component = as as React.ElementType;

    const children = props.scrollEnabled && !props.nativeScroll ? this.renderIScroll() : props.children;
    
    const style = { ...props.style };
    Layout.size(style, props);
    Layout.align(style, props);

    if (props.clip) {
      style.overflowX = 'hidden';
      style.overflowY = 'hidden';
    }

    if (props.scrollEnabled && props.nativeScroll) {
      const scrollDirection = this.getScrollDirection();
      if (scrollDirection === 'y') {
        style.overflowY = 'auto';
      } else if (scrollDirection === 'x') {
        style.overflowX = 'auto';
      } else if (scrollDirection === 'both') {
        style.overflowX = 'auto';
        style.overflowY = 'auto';
      }
    }

    if (style.opacity === 0) {
      style.pointerEvents = 'none';
    }

    return (
      <Component
        className={props.className}
        {...props.dom}
        {...PointerListeners(props)}
        style={style}
        ref={this.rootRef}
      >
        {children}
      </Component>
    );
  }
}
