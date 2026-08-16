/**
 * UNI-011 AC3 — the impure half: the node's ports, and the picture on disk.
 *
 * The split is [`nodequestioncontext.ts`](./nodequestioncontext.ts)'s, which is ALPHA-007's:
 * everything touching a model, the node library, Node or Electron lives here and nothing else does,
 * so [`portshare.ts`](./portshare.ts)'s rule is graded in `tests-unit/` against plain data.
 *
 * ## 🔴 Nothing here opens a socket, and that is AC3's second sentence
 *
 * > Nothing leaves the machine before the user posts.
 *
 * Both halves this file joins were already local and stay local:
 * [`captureLivePreview`](../../views/SandboxSurface/livePreviewCapture.ts) calls `capturePage()` on
 * the preview `<webview>` and the bytes never leave the renderer, and the port values come off
 * `getPortValues`, which is the editor **asking the runtime on this machine** over the local relay.
 * The only outbound action in the whole feature is the composer's button, and it is the same one
 * AC2 already had.
 *
 * ⚠️ **The capture is written to the user's own disk, not uploaded**, because there is nowhere to
 * upload to: D16 keeps the entry point on the browser until the threshold is met, and there is no
 * forum and no issuer. Writing the PNG where the user can drag it into a browser composer is the
 * honest v0 of *"can be attached"*, and it is the half that changes when there is somewhere to post
 * — {@link saveCaptureNextTo} is the one function that becomes an upload.
 *
 * @module models/community/nodesharecontext
 */

import { filesystem, platform } from '@noodl/platform';

import { NodeLibrary } from '../nodelibrary';
import { bucketTypeName } from '../../utils/report/diagnostics';
import { LibraryPorts, isLibraryPort } from './nodeexcerpt';
import { SharePortDirection } from './portshare';

/** Duck-typed to what this file reads, so the graph model does not leak into the pure half. */
interface NodeLike {
  id: string;
  typename?: string;
  getPorts?(filter?: 'input' | 'output'): { name?: string; type?: string | { name?: string } | null }[];
}

/** One port worth offering: its name, its direction, and whether the library declares it. */
export interface SharablePortRef {
  node: string;
  port: string;
  direction: SharePortDirection;
  declared: boolean;
}

function safe<T>(read: () => T, fallback: T): T {
  try {
    const value = read();
    return value === undefined || value === null ? fallback : value;
  } catch (_error) {
    return fallback;
  }
}

/**
 * Every port on the node that could carry a live value, with the disclosure question answered.
 *
 * ⚠️ **Signals are dropped**, the same filter `PortsTab/portValues`' `isValuePort` applies and for
 * the same reason: a signal carries no value, so reading one reports the internal sender. The test
 * is `NodeLibrary.nameForPortType(port.type) === 'signal'`, which is how the Ports tab decides it —
 * a port's `type` is a shape, not a string, and comparing it to `'signal'` directly silently
 * matches nothing.
 *
 * 🔴 `declared` comes from {@link isLibraryPort}, the predicate the excerpt uses, applied to the
 * **bucketed** type. A component instance's ports are its `Component Inputs` declarations, so its
 * type buckets to `<component>` and none of its ports are ours — which is the whole rule AC2 found,
 * reused rather than restated.
 */
export function sharablePortRefs(node: NodeLike | null | undefined, library: LibraryPorts | null): SharablePortRef[] {
  if (!node || !node.id || typeof node.getPorts !== 'function') return [];

  const knownTypes = library ? new Set(library.keys()) : new Set<string>();
  const bucketed = bucketTypeName(node.typename, knownTypes);

  const refs: SharablePortRef[] = [];
  const seen = new Set<string>();

  for (const direction of ['input', 'output'] as const) {
    const ports = safe(() => node.getPorts?.(direction) || [], []);
    for (const port of ports) {
      if (!port || typeof port.name !== 'string' || port.name === '') continue;
      if (safe(() => NodeLibrary.nameForPortType(port.type), '') === 'signal') continue;

      // A port plugged `input/output` is returned by both filters. Keyed by direction, so both
      // rows survive — a node may hold different values on the two ends of one name.
      const key = port.name + '|' + direction;
      if (seen.has(key)) continue;
      seen.add(key);

      refs.push({
        node: node.id,
        port: port.name,
        direction,
        declared: isLibraryPort(bucketed, port.name, library)
      });
    }
  }

  return refs;
}

/**
 * Write the capture beside the user, and return where it went.
 *
 * 🔴 **The returned path is for the dialog to show and for nothing else to publish.** It is a
 * machine path — under the home directory, and often named after the project — which is exactly
 * what `redact` exists to remove from anything outbound. `formatShareAttachment` carries the
 * picture's dimensions and never its location.
 *
 * ⚠️ The name carries a timestamp rather than a project or node name, for the same reason: a
 * filename is the one part of an attachment a forum shows to everybody, and *"NodeGX capture"* plus
 * a clock reading says everything a reader needs.
 */
export async function saveCaptureNextTo(base64Png: string): Promise<string | null> {
  return safe(
    () => {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const path = filesystem.makeUniquePath(
        filesystem.join(platform.getDocumentsPath(), `nodegx-capture-${stamp}.png`)
      );
      return filesystem.writeFile(path, Buffer.from(base64Png, 'base64')).then(
        () => path,
        () => null
      );
    },
    Promise.resolve(null as string | null)
  );
}
