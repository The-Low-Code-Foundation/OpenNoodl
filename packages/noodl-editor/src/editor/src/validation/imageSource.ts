/**
 * VIB-007 / register **V33** — an image parameter that is empty and has nothing feeding it.
 *
 * `ui-image-scrim-band` — VIB-002's flagship recipe, the one named for its image — shipped
 * `"backgroundImage": ""` with no connection into that port: a scrim gradient over a bare colour,
 * through `catalog:examples` at **66/66 strict, warnings-as-errors**. Nothing anywhere asked
 * whether the picture had a source.
 *
 * 🔴 **The connection list is the whole of the predicate, and the corpus proves why.**
 * `ui-card-grid-repeater`'s `"src": ""` is *correct* authoring — `card_inputs.image` is wired into
 * `photo.src`, so the empty parameter is the placeholder a repeater overwrites per row. Two
 * identical empty strings, opposite verdicts, and only the wires separate them. A static
 * "no empty image parameters" sweep — the obvious form of this check — would be wrong about one
 * of the only two in the corpus. Register V7's corrected reading, verbatim.
 *
 * ⚠️ **An ABSENT parameter is not a hit.** `src` never written is a node an author has not got to
 * yet; `"src": ""` is a positive statement that there is nothing to show. The distinction is the
 * same one {@link checkParameterValues} draws for a cleared editor field, and it keeps this check
 * off every freshly-dropped Image on a canvas.
 *
 * 🔴 **A `backgroundImage` beside a `backgroundGradient` is exempt, and the corpus said so before
 * this check did.** `ui-image-scrim-band`'s own description ends *"Leaving it empty is not broken:
 * the gradient alone is still a designed ground"* — and it is right: the two ports compose into one
 * CSS `background-image`, so a Group carrying a gradient has a ground whatever the picture slot
 * says. Without the exemption this check would have contradicted the recipe it was written for, and
 * the register row it came from would have been traded for a V39 (*a recipe's description
 * contradicting its own artefact*). The narrowing is the rule, not a concession to it.
 *
 * @module validation/imageSource
 */
import { CatalogIndex } from './CatalogIndex';
import { DiagnosticCode, type Diagnostic, type Severity } from './diagnostics';

/** A node as this check reads it. */
export interface ImageSourceNode {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown> | null;
}

export interface CheckImageSourcesOptions {
  /** Component identifier for the diagnostics' location. */
  component: string;
  /** Read for which input ports are typed `image`. */
  catalog: CatalogIndex;
  /** `"nodeId::portName"` for every wired input — the same set {@link connectedInputs} builds. */
  connectedInputs?: ReadonlySet<string>;
  /** Severity for these findings. Defaults to `warning`; see {@link DiagnosticCode.UnsourcedImage}. */
  severity?: Severity;
}

/**
 * What a port typed `image` is called in prose, so the message can name the thing rather than
 * the type. `backgroundImage` on a Group is a ground; `src` on an Image is the picture itself.
 */
const WHAT_IT_IS: Record<string, string> = {
  backgroundImage: 'this element has no ground image',
  src: 'this Image draws nothing',
  poster: 'this Video shows no poster frame',
  iconImageSource: 'this control shows no icon'
};

/**
 * Whether this element already has a designed ground from the port that composes with
 * `backgroundImage`.
 *
 * A wired `backgroundGradient` counts as much as a set one: the value arriving over a connection
 * is a ground this check cannot read and must not claim is absent.
 */
function hasGround(
  parameters: Record<string, unknown>,
  nodeId: string,
  connectedInputs: ReadonlySet<string> | undefined
): boolean {
  const gradient = parameters.backgroundGradient;
  if (typeof gradient === 'string' && gradient.trim() !== '') return true;
  return connectedInputs?.has(`${nodeId}::backgroundGradient`) ?? false;
}

/**
 * Report every image-typed input that is explicitly empty and unfed.
 *
 * One diagnostic per port rather than per node: each is a separate decision — a file to point at,
 * a wire to draw, or the parameter to delete.
 */
export function checkImageSources(
  nodes: readonly ImageSourceNode[],
  options: CheckImageSourcesOptions
): Diagnostic[] {
  const { component, catalog, connectedInputs, severity = 'warning' } = options;
  const diagnostics: Diagnostic[] = [];

  for (const node of nodes) {
    const parameters = node.parameters;
    if (!parameters) continue;
    // An unknown type has no declared ports to read, and `UnknownNodeType`/`NodeUncheckable` own
    // saying so. A component instance (`/Components/Card`) lands here too, and its `image` input
    // is the component's own business.
    if (!catalog.hasType(node.type)) continue;

    for (const [name, value] of Object.entries(parameters)) {
      if (typeof value !== 'string' || value.trim() !== '') continue;
      const port = catalog.getPort(node.type, 'input', name);
      if (CatalogIndex.portTypeName(port) !== 'image') continue;
      if (connectedInputs?.has(`${node.id}::${name}`)) continue;
      if (name === 'backgroundImage' && hasGround(parameters, node.id, connectedInputs)) continue;

      diagnostics.push({
        code: DiagnosticCode.UnsourcedImage,
        severity,
        message:
          `"${name}" is set to the empty string and nothing is connected to it, so ` +
          `${WHAT_IT_IS[name] ?? 'this image has no source'}. An empty image parameter is only ` +
          'correct when a connection fills it per row — a repeater item, or a component input — ' +
          'and there is no such connection here.',
        location: { component, nodeId: node.id, nodeType: node.type, nodeLabel: node.label, port: name },
        suggestion:
          `Point "${name}" at a file in the project (the starter imagery in ` +
          '`noodl_modules/starter-imagery/` is installed in every project), or draw a connection ' +
          `into "${name}", or remove the parameter if this element is not meant to carry a picture.`
      });
    }
  }

  return diagnostics;
}
