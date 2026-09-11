import React, { useState, useRef, useEffect, useCallback } from "react";
import classNames from 'classnames';

import css from "./ChatContainer.module.scss";

function ChatContainer({
  children,
  style,
  className,
  eventHandler,
  outAtBottom,
  outScrollPosition,
  outScrolling,
  outScrollingStarted,
  outScrollingStopped
}) {
  const scrollableRef = useRef(null);
  const scrollBottomRef = useRef(null);
  const [isTracking, setIsTracking] = useState(true);
  const isTrackingRef = useRef(true);
  const lastScrollTop = useRef(0);
  const isScrolling = useRef(false);
  const isJumpingToPresent = useRef(false);

  const onResize = useCallback(() => {
    if (isTrackingRef.current && scrollBottomRef.current) {
      scrollBottomRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    if (!scrollableRef.current) return;

    let scrollHandler = null;

    function handleScroll() {
      const elem = scrollableRef.current;

      // if (!isJumpingToPresent.current) {
      //   // Remove decimals from scrollTop to make it pixel perfect
      //   elem.scrollTop = Math.round(elem.scrollTop);
      // }

      outScrolling && outScrolling();

      // scrollTop can be half a pixel off, so you will never hit the bottom.
      const isAtBottom = elem.scrollTop + elem.clientHeight + 1 >= elem.scrollHeight;
      setIsTracking(isAtBottom);
      isTrackingRef.current = isAtBottom;
      outAtBottom && outAtBottom(isAtBottom);
      outScrollPosition && outScrollPosition(elem.scrollTop);

      lastScrollTop.current = scrollableRef.current.scrollTop;

      // HACK: Keep track of when the browser is scrolling.
      if (scrollHandler !== null) {
        clearTimeout(scrollHandler);        
      }

      if (!isScrolling.current) {
        isScrolling.current = true;
        outScrollingStarted && outScrollingStarted();
      }

      scrollHandler = setTimeout(function() {
        isScrolling.current = false;
        outScrollingStopped && outScrollingStopped();
      }, 150);

      if (isAtBottom && isJumpingToPresent.current) {
        isJumpingToPresent.current = false;
      }
    }

    const scrollable = scrollableRef.current;
    scrollable.addEventListener('scroll', handleScroll);

    const observer = new ResizeObserver(onResize);
    observer.observe(scrollableRef.current);

    return () => {
      if (scrollHandler !== null) {
        clearTimeout(scrollHandler);        
      }
      observer.disconnect();
      scrollable.removeEventListener('scroll', handleScroll);
    };
  }, [onResize, scrollableRef]);

  useEffect(() => {
    // Scroll to the bottom at the start
    if (scrollBottomRef.current) {
      scrollBottomRef.current.scrollIntoView({ behavior: 'auto' });
    }

    // Set the default "At Bottom" output
    outAtBottom && outAtBottom(isTracking);
    outScrollPosition && outScrollPosition(0);
  }, []);

  useEffect(() => {
    if (scrollableRef.current && !isTracking) {
      scrollableRef.current.scrollTop = lastScrollTop.current;
    }
  }, [children, isTracking]);

  useEffect(() => {
    function handleScrollToBottom() {
      if (scrollBottomRef.current) {
        isJumpingToPresent.current = true;
        scrollBottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }

    eventHandler.addEventListener('scrollToBottom', handleScrollToBottom);
    return () => {
      eventHandler.removeEventListener('scrollToBottom', handleScrollToBottom);
    }
  }, [eventHandler]);

  if (isTracking && scrollBottomRef.current) {
    requestAnimationFrame(() => {
      if (scrollBottomRef.current) {
        scrollBottomRef.current.scrollIntoView({ behavior: 'auto' });
      }
    });
  }

  return (
    <div style={style} className={classNames([css["ScrollContainer"], className])}>
      <div className={css["ScrollArea"]} ref={scrollableRef}>
        {children}
        <span ref={scrollBottomRef}></span>
      </div>
    </div>
  );
}

export default {
  name: "noodl.controls.chat-container",
  displayName: "Chat Container",
  category: "ChatContainer",
  getReactComponent() {
    return ChatContainer;
  },
  initialize() {
    this.internal = {};
    this.props.eventHandler = new EventTarget();
  },
  inputs: {
    scrollToBottom: {
      type: "signal",
      displayName: "Scroll To Bottom",
      valueChangedToTrue() {
        this.props.eventHandler.dispatchEvent(new Event("scrollToBottom"));
      },
    },
  },
  inputProps: {},
  outputProps: {
    outAtBottom: {
      type: "boolean",
      displayName: "At Bottom",
      group: "State",
    },
    outScrollPosition: {
      type: "number",
      displayName: "Scroll Position",
      group: "Scroll",
    },
    outScrolling: {
      type: "signal",
      displayName: "Scrolling",
      group: "Scroll",
    },
    outScrollingStarted: {
      type: "signal",
      displayName: "Scroll Start",
      group: "Scroll",
    },
    outScrollingStopped: {
      type: "signal",
      displayName: "Scroll Stop",
      group: "Scroll",
    },
  },
};
