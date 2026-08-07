import React from 'react';

import Layout from '../../../layout';
import PointerListeners from '../../../pointerlisteners';
import { Noodl } from '../../../types';
import { noodlRootRef } from '../../noodl-root-ref';

export interface ImageProps extends Noodl.ReactProps {
  dom: {
    alt?: string;
    src: string;
    srcSet?: string;
    onLoad?: () => void;
  };

  /** NDA-012 (Visual): the `On Error` signal, no longer a bare DOM forward. */
  onError?: () => void;
  /** NDA-012 (Visual): the `Error` string that has to accompany it. */
  imageError?: (message: string) => void;
}

/**
 * Report a failed image load on all three surfaces — NDA-012 (Visual), checks B1/B2.
 *
 * The same three the Failure Contract asks for and that `Video.reportFailure` already
 * satisfies: the runtime error channel (so `On App Error` and a deployed console can see it,
 * where `editorConnection.sendWarning` reaches neither), the signal a graph branches on, and
 * the message that stops the signal from being information-free.
 *
 * `<img>`'s `error` event carries **no reason at all** — there is no `MediaError` equivalent,
 * so a 404, a DNS failure, a CORS refusal and an undecodable file are one indistinguishable
 * event. Naming the source that failed is therefore the whole of the available diagnosis, and
 * it is the part an author needs: the usual cause is a URL built from a record property that
 * arrived empty or wrong.
 */
function reportImageError(props: ImageProps, src: string | undefined) {
  const message = src
    ? 'The image could not be loaded: ' + src
    : 'The image could not be loaded — no Source was set';

  props.noodlNode?.raiseRuntimeError('image/load-failed', message, { src });
  props.imageError && props.imageError(message);
  props.onError && props.onError();
}

export function Image(props: ImageProps) {
  const style = { ...props.style };

  Layout.size(style, props);
  Layout.align(style, props);

  if (style.opacity === 0) {
    style.pointerEvents = 'none';
  }

  if (props.dom?.src?.startsWith('/')) {
    const baseUrl = Noodl.Env['BaseUrl'];
    if (baseUrl) {
      props.dom.src = baseUrl + props.dom.src.substring(1);
    }
  }

  return (
    <img
      ref={noodlRootRef(props.noodlNode)}
      className={props.className}
      {...props.dom}
      {...PointerListeners(props)}
      // After the `props.dom` spread, so it is this handler and not a stale forwarded one.
      onError={() => reportImageError(props, props.dom?.src)}
      style={style}
    />
  );
}
