/**
 * VIB-007 / register **V33** — a picture with no source.
 *
 * `ui-image-scrim-band`, the recipe named for its image, shipped `"backgroundImage": ""` with no
 * connection into that port through `catalog:examples` at 66/66 strict. The instructive half of the
 * row is the control found in the same sweep: `ui-card-grid-repeater`'s identical `"src": ""` **is**
 * connection-fed and is *correct* authoring. Two empty strings, opposite verdicts, and only the
 * connection list separates them.
 *
 * 🔴 **The corpus reads 0 with the check on, and read 0 before it too** — V33's own hit was repaired
 * by hand the day the row was filed. So the corpus arm here is a **mutation**: a census over a clean
 * corpus passes just as happily against a check that returns nothing.
 */
import * as fs from 'fs';
import * as path from 'path';

import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { checkImageSources } from '../../src/editor/src/validation/imageSource';

const catalog = loadDefaultCatalog();
const REPO = path.join(__dirname, '..', '..', '..', '..');
const EXAMPLES = path.join(REPO, 'docs', 'node-catalog', 'examples');

const run = (
  nodes: Array<{ id: string; type: string; parameters?: Record<string, unknown> }>,
  fed: string[] = [],
  component = '/Test'
) => checkImageSources(nodes, { component, catalog, connectedInputs: new Set(fed) });

describe('V33 — the two empty strings with opposite verdicts', () => {
  it('reports an empty backgroundImage that nothing feeds', () => {
    const d = run([{ id: 'band', type: 'Group', parameters: { backgroundImage: '' } }]);
    expect(d).toHaveLength(1);
    expect(d[0].code).toBe('unsourced-image');
    expect(d[0].location.port).toBe('backgroundImage');
    expect(d[0].suggestion).toContain('starter-imagery');
  });

  it('is silent on the identical value when a connection fills it — the corpus control', () => {
    // `ui-card-grid-repeater`'s shape verbatim: `card_inputs.image` → `photo.src`.
    expect(run([{ id: 'photo', type: 'Image', parameters: { src: '' } }], ['photo::src'])).toEqual([]);
  });

  /**
   * 🔴 The failure this check exists to prevent is silent, so its own silence is worth more tests
   * than its noise. A parameter never written is a node an author has not got to yet.
   */
  it('says nothing about an image parameter that was never written', () => {
    expect(run([{ id: 'photo', type: 'Image', parameters: { objectFit: 'cover' } }])).toEqual([]);
  });

  it('says nothing about a parameter that carries a path', () => {
    expect(
      run([{ id: 'photo', type: 'Image', parameters: { src: 'noodl_modules/starter-imagery/ground-city-dusk.webp' } }])
    ).toEqual([]);
  });

  it('reads the PORT TYPE, not the parameter name — an empty string elsewhere is not this', () => {
    expect(run([{ id: 't', type: 'Text', parameters: { text: '' } }])).toEqual([]);
  });

  it('skips a type the catalog does not have, which is another check\'s job to report', () => {
    expect(run([{ id: 'card', type: '/Components/ProductCard', parameters: { src: '' } }])).toEqual([]);
  });
});

describe('V33 — the gradient exemption, which the corpus asked for before the check existed', () => {
  /**
   * `ui-image-scrim-band`'s description ends *"Leaving it empty is not broken: the gradient alone is
   * still a designed ground"*, and it is right — the two ports compose into one CSS
   * `background-image`. Without this, the check would contradict the recipe it was written for.
   */
  it('is silent on an empty backgroundImage beside a set backgroundGradient', () => {
    expect(
      run([{ id: 'band', type: 'Group', parameters: { backgroundImage: '', backgroundGradient: 'var(--gradient-scrim)' } }])
    ).toEqual([]);
  });

  it('is silent when the gradient arrives over a connection instead', () => {
    expect(
      run([{ id: 'band', type: 'Group', parameters: { backgroundImage: '' } }], ['band::backgroundGradient'])
    ).toEqual([]);
  });

  it('still reports when the gradient is itself empty — an exemption is not a keyword', () => {
    expect(
      run([{ id: 'band', type: 'Group', parameters: { backgroundImage: '', backgroundGradient: '' } }])
    ).toHaveLength(1);
  });

  it('does not extend the exemption to src — a gradient is not a picture', () => {
    expect(
      run([{ id: 'photo', type: 'Image', parameters: { src: '', backgroundGradient: 'var(--gradient-scrim)' } }])
    ).toHaveLength(1);
  });
});

describe('V33 — the corpus, by mutation', () => {
  type Example = {
    components: {
      name: string;
      nodes: Array<{ id: string; type: string; parameters?: Record<string, unknown> }>;
      connections?: Array<{ toId: string; toProperty: string }>;
    }[];
  };

  const load = (): { file: string; example: Example }[] =>
    fs
      .readdirSync(EXAMPLES)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((file) => ({ file, example: JSON.parse(fs.readFileSync(path.join(EXAMPLES, file), 'utf-8')) }));

  const sweep = (examples: { file: string; example: Example }[]) => {
    const hits: string[] = [];
    for (const { file, example } of examples) {
      for (const c of example.components ?? []) {
        const d = checkImageSources(c.nodes ?? [], {
          component: c.name,
          catalog,
          connectedInputs: new Set((c.connections ?? []).map((k) => `${k.toId}::${k.toProperty}`))
        });
        if (d.length) hits.push(`${file}:${c.name}:${d.map((x) => x.location.port).join('+')}`);
      }
    }
    return hits;
  };

  it('is clean — and the population is asserted, so an empty read is not mistaken for a pass', () => {
    const examples = load();
    // 🔴 Cardinality before the verdict, twice over: the files, and the image parameters among
    // them. A corpus with no image parameters at all would sweep clean and mean nothing.
    expect(examples.length).toBeGreaterThanOrEqual(67);
    const imageParams = examples.flatMap(({ example }) =>
      (example.components ?? []).flatMap((c) =>
        (c.nodes ?? []).flatMap((n) =>
          Object.keys(n.parameters ?? {}).filter((k) => k === 'src' || k === 'backgroundImage')
        )
      )
    );
    expect(imageParams.length).toBeGreaterThanOrEqual(8);

    expect(sweep(examples)).toEqual([]);
  });

  it('reddens when V33s own hit is restored on ONE file, and only that file', () => {
    const examples = load();
    const subject = 'ui-image-scrim-band.json';
    const target = examples.find((e) => e.file === subject)!;
    const band = target.example.components
      .flatMap((c) => c.nodes)
      .find((n) => typeof n.parameters?.backgroundImage === 'string')!;

    // The mutation IS the pre-repair corpus, with the gradient left in place — so this also
    // proves the exemption above is scoped to a gradient that is actually THERE.
    expect(band.parameters!.backgroundImage).toBe('noodl_modules/starter-imagery/ground-city-dusk.webp');
    band.parameters!.backgroundImage = '';
    delete band.parameters!.backgroundGradient;

    expect(sweep(examples)).toEqual([`${subject}:/Pages/Example:backgroundImage`]);
  });
});
