import React, { useLayoutEffect, useState } from "react";

/**
 * Track the Bounding Client Rect on a HTMLElement.
 *
 * @param ref The HTML Element we are tracking.
 * @returns ref.current.getBoundingClientRect() result.
 */
export function useTrackBounds(ref: React.MutableRefObject<HTMLElement>) {
  const [bounds, setBounds] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => {
      const newBounds = ref.current?.getBoundingClientRect();
      setBounds(newBounds);
    });

    /**
     * BEN-004: `observe(null)` **throws**, and this runs in a layout effect — so
     * a ref pointed at a conditionally-rendered element did not degrade to "no
     * measurements", it took down the entire React tree the hook was used in.
     * That cost the editor its whole preview panel the first time the component
     * bench was driven.
     *
     * Lines below already guard `ref.current` with `?.`; this one did not, which
     * is the whole bug. Guarding turns the crash into what the rest of the hook
     * already assumes.
     *
     * ⚠️ It is not a substitute for mounting the element: the effect keys on
     * `[ref]`, which never changes, so an element that appears later is never
     * picked up. If you need bounds for something conditional, render the box
     * unconditionally and put the condition inside it.
     */
    if (ref.current) {
      observer.observe(ref.current);
    }

    setBounds(ref.current?.getBoundingClientRect());

    return function () {
      observer.disconnect();
    };
  }, [ref]);

  return bounds;
}
