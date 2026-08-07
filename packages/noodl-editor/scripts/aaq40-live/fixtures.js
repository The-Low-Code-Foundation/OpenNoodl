/**
 * AAQ Layer-1 live pass — the recorded conversation.
 *
 * Phase 40's Layer 1 (page registration, the scroll setting, the provisioned
 * backend) is performed by the **apply transaction**, downstream of the provider
 * boundary. None of it is a model output. So the live pass does not need a
 * provider, and this file is what stands in for one: a recorded scoping turn and
 * two recorded component submissions, replayed into `AiClient.chatStream`.
 *
 * The recordings are deliberately *plain*. They are here to prove that what the
 * apply does reaches the runtime — that a page the plan created is listed in the
 * router, that a page taller than the window scrolls, that a Create Record node
 * has its `prop-*` ports at first load. They are not an attempt to demonstrate
 * authoring quality, which is what the engine tasks (AAQ-005..007) are for.
 *
 * The one thing they ARE careful about: every value is written the way the
 * validator requires (object-form dimensions, no bare numbers on %-defaulting
 * ports — the phase-38 lesson), so a gate failure here means a real regression
 * and not a badly written fixture.
 */

/* -------------------------------------------------------------------------- */
/* The scope                                                                  */
/* -------------------------------------------------------------------------- */

/** The brief, as a user types it into the launcher's wizard. */
const BRIEF =
  'A puppy adoption site. Visitors browse the puppies we have available, and staff have a ' +
  'separate admin page where they add a new puppy to the list.';

/**
 * `record_scope` arguments. Two pages, a nodegx backend with one collection, and
 * `scroll: 'page'` — a listing site is the page-like shape, which is the choice
 * AAQ-003 exists to make and which nothing in the AI path used to make at all.
 */
const SCOPE_ARGS = {
  summary:
    'A puppy adoption site: visitors browse available puppies, and shelter staff add new ones on an ' +
    'admin page.',
  audience:
    'Families looking to adopt a puppy, and the two or three shelter staff who keep the listings current.',
  objects: [
    {
      name: 'Puppy',
      purpose: 'One puppy currently available for adoption.',
      fields: ['name (text)', 'age (number, in months)', 'bio (long text)']
    }
  ],
  pages: [
    {
      name: 'Puppies',
      purpose: 'Browse every puppy available for adoption. Read-only — nothing is created here.'
    },
    {
      name: 'Admin',
      purpose: 'Shelter staff add a new puppy. This is the only page where a Puppy record is created.'
    }
  ],
  outOfScope: ['Adoption applications', 'Payments', 'Photo uploads'],
  backend: {
    kind: 'nodegx',
    description:
      'The puppies are stored in a built-in backend on this computer, because nobody wanted to run a ' +
      'server for a shelter with thirty dogs.',
    collections: [
      {
        name: 'Puppy',
        fields: [
          { name: 'name', type: 'string' },
          { name: 'age', type: 'number' },
          { name: 'bio', type: 'string' }
        ]
      }
    ],
    needsAuth: false
  },
  conventions: ['Every puppy shown on the listing page comes from the Puppy collection, never hard-coded.'],
  scroll: 'page',
  agreed: true
};

/** What the model "says" alongside the tool call, in the two rounds of the turn. */
const SCOPE_PROSE_ROUND_1 =
  "Here's what I've got. A puppy adoption site with two pages: a **Puppies** listing that anyone can " +
  'browse, and an **Admin** page where staff add a new puppy. One record type — Puppy, with a name, an ' +
  'age in months and a short bio — kept in a built-in backend running on this machine.\n\n' +
  "Deliberately not in scope: adoption applications, payments and photo uploads. Say if any of those " +
  'should be in, and I will move it.';

const SCOPE_PROSE_ROUND_2 = 'Recorded. Two pages, one Puppy record, a built-in backend.';

/* -------------------------------------------------------------------------- */
/* The components                                                             */
/* -------------------------------------------------------------------------- */

const INK = '#1B1D21';
const MUTED = '#5A6472';
const CARD = '#FFFFFF';
const LINE = '#E3E7EC';
const ACCENT = '#2F6FED';

const px = (value) => ({ value, unit: 'px' });

/** One puppy card in the listing. Twelve of these is what makes the page overflow. */
function puppyCard(index, name, age, bio) {
  const cardId = `card-${index}`;
  return [
    {
      id: cardId,
      type: 'Group',
      label: `${name} card`,
      parent: 'list',
      parameters: {
        sizeMode: 'contentHeight',
        width: { value: 100, unit: '%' },
        backgroundColor: CARD,
        borderRadius: px(12),
        borderStyle: 'solid',
        borderWidth: px(1),
        borderColor: LINE,
        paddingTop: px(20),
        paddingBottom: px(20),
        paddingLeft: px(24),
        paddingRight: px(24),
        marginBottom: px(16),
        rowGap: px(6)
      }
    },
    {
      id: `${cardId}-name`,
      type: 'Text',
      parent: cardId,
      parameters: { text: name, fontSize: px(20), color: INK }
    },
    {
      id: `${cardId}-age`,
      type: 'Text',
      parent: cardId,
      parameters: { text: `${age} months old`, fontSize: px(14), color: MUTED }
    },
    {
      id: `${cardId}-bio`,
      type: 'Text',
      parent: cardId,
      parameters: { text: bio, fontSize: px(15), color: MUTED }
    }
  ];
}

const PUPPIES = [
  ['Biscuit', 4, 'A beagle mix who has opinions about the postman and none about anything else.'],
  ['Marlow', 7, 'Sleeps through thunderstorms. Wakes for the fridge door.'],
  ['Pepper', 3, 'Small, fast, and entirely convinced she is large and slow.'],
  ['Otis', 9, 'Walks well on the lead as long as the lead is going somewhere he chose.'],
  ['Juno', 5, 'Will retrieve the ball. Will not return the ball.'],
  ['Fen', 6, 'A quiet lurcher who would like the sofa, please, and thank you.'],
  ['Sable', 2, 'Learning that shoes are not food. Progress is real but slow.'],
  ['Rye', 8, 'Good with cats, better with the cat food.'],
  ['Wren', 4, 'Startles at her own reflection, then apologises to it.'],
  ['Bodie', 11, 'An older gentleman looking for an equally unhurried household.'],
  ['Clover', 3, 'Every walk is the best walk that has ever happened.'],
  ['Nettle', 6, 'Terrier energy in a body that has not yet agreed to it.']
];

/**
 * `Pages/Puppies` — the listing.
 *
 * Deliberately taller than any window: twelve cards at ~150px is ~1900px of
 * content. On `bodyScroll: false` (the default nothing in the AI path ever
 * changed) this page is clipped at the viewport with no scrollbar, which is
 * exactly finding #8. It is the fixture that can tell the two states apart.
 *
 * The `RouterNavigate` is here on purpose too: its `target` is a **component
 * name**, not an invented URL path (finding #6), and it points at a sibling the
 * same plan authors — which is the case AAQ-001 threaded `plannedComponents`
 * through the session for.
 */
const PUPPIES_PAGE = {
  description: 'The public puppy listing: a header, twelve available puppies, and a link to the admin page.',
  nodes: [
    // The Page node IS what makes this a page. The runtime's page index is built
    // from Page nodes and nothing else, so a component the router lists without
    // one is a route to a blank screen — which is exactly what the first live
    // pass produced, with every layer above it reporting success.
    {
      id: 'page',
      type: 'Page',
      label: 'Puppies',
      parameters: { title: 'Puppies', urlPath: 'puppies' }
    },
    {
      id: 'page-root',
      type: 'Group',
      label: 'Puppies page',
      parent: 'page',
      parameters: {
        sizeMode: 'contentHeight',
        width: { value: 100, unit: '%' },
        backgroundColor: '#F6F8FA',
        paddingTop: px(48),
        paddingBottom: px(64),
        paddingLeft: px(32),
        paddingRight: px(32)
      }
    },
    {
      id: 'heading',
      type: 'Text',
      parent: 'page-root',
      parameters: { text: 'Puppies looking for a home', fontSize: px(34), color: INK, marginBottom: px(8) }
    },
    {
      id: 'subheading',
      type: 'Text',
      parent: 'page-root',
      parameters: {
        text: 'Twelve puppies are with us right now. Scroll for the full list.',
        fontSize: px(16),
        color: MUTED,
        marginBottom: px(32)
      }
    },
    {
      id: 'list',
      type: 'Group',
      label: 'Puppy list',
      parent: 'page-root',
      parameters: { sizeMode: 'contentHeight', width: { value: 100, unit: '%' } }
    },
    ...PUPPIES.flatMap((p, i) => puppyCard(i + 1, p[0], p[1], p[2])),
    {
      id: 'admin-link',
      type: 'Group',
      label: 'Admin link',
      parent: 'page-root',
      parameters: {
        sizeMode: 'contentHeight',
        backgroundColor: ACCENT,
        borderRadius: px(8),
        paddingTop: px(12),
        paddingBottom: px(12),
        paddingLeft: px(20),
        paddingRight: px(20),
        marginTop: px(24)
      }
    },
    {
      id: 'admin-link-text',
      type: 'Text',
      parent: 'admin-link',
      parameters: { text: 'Staff: add a puppy', fontSize: px(15), color: '#FFFFFF' }
    },
    {
      id: 'go-admin',
      type: 'RouterNavigate',
      label: 'Go to Admin',
      x: 320,
      y: 40,
      // The component name **as the router lists it**, not a URL path (finding
      // #6) and not the display name either — `RouterNavigateAdapter` matches
      // `target` against the router's own `pages.routes` entries, which are full
      // legacy names. This is what the authoring prompt tells the model to write.
      parameters: { target: '/Pages/Admin' }
    }
  ],
  connections: [{ fromId: 'admin-link', fromProperty: 'onClick', toId: 'go-admin', toProperty: 'navigate' }]
};

/**
 * `Pages/Admin` — where a Puppy is created.
 *
 * The Create Record node (`NewDbModelProperties`) carries `collection: 'Puppy'`
 * and three `prop-*` parameters. Those ports are generated from the introspected
 * schema cache, and AAQ-002 slice 3 is the fix that makes that cache exist for a
 * built-in backend at all — so this node is the criterion-2 probe: three live
 * ports at first load, or three phantom parameters.
 */
const ADMIN_PAGE = {
  description: 'Staff-only page: a form that creates a Puppy record in the built-in backend.',
  nodes: [
    {
      id: 'admin-page',
      type: 'Page',
      label: 'Admin',
      parameters: { title: 'Add a puppy', urlPath: 'admin' }
    },
    {
      id: 'admin-root',
      type: 'Group',
      label: 'Admin page',
      parent: 'admin-page',
      parameters: {
        sizeMode: 'contentHeight',
        width: { value: 100, unit: '%' },
        backgroundColor: '#F6F8FA',
        paddingTop: px(48),
        paddingBottom: px(48),
        paddingLeft: px(32),
        paddingRight: px(32)
      }
    },
    {
      id: 'admin-heading',
      type: 'Text',
      parent: 'admin-root',
      parameters: { text: 'Add a puppy', fontSize: px(30), color: INK, marginBottom: px(24) }
    },
    {
      id: 'form',
      type: 'Group',
      label: 'Form',
      parent: 'admin-root',
      parameters: {
        sizeMode: 'contentHeight',
        width: { value: 100, unit: '%' },
        backgroundColor: CARD,
        borderRadius: px(12),
        borderStyle: 'solid',
        borderWidth: px(1),
        borderColor: LINE,
        paddingTop: px(24),
        paddingBottom: px(24),
        paddingLeft: px(24),
        paddingRight: px(24),
        rowGap: px(16)
      }
    },
    {
      id: 'name-input',
      type: 'net.noodl.controls.textinput',
      label: 'Name',
      parent: 'form',
      parameters: { label: 'Name', placeholder: "The puppy's name" }
    },
    {
      id: 'age-input',
      type: 'net.noodl.controls.textinput',
      label: 'Age',
      parent: 'form',
      parameters: { label: 'Age in months', placeholder: '4' }
    },
    {
      id: 'bio-input',
      type: 'net.noodl.controls.textinput',
      label: 'Bio',
      parent: 'form',
      parameters: { label: 'Bio', placeholder: 'A sentence about this puppy' }
    },
    {
      id: 'save-button',
      type: 'net.noodl.controls.button',
      label: 'Save',
      parent: 'form',
      parameters: { label: 'Add puppy' }
    },
    {
      id: 'create-puppy',
      type: 'NewDbModelProperties',
      label: 'Create Puppy',
      x: 380,
      y: 40,
      parameters: {
        // ⚠️ `collectionName`, NOT `collection`. The Record family passes
        // `collectionParam: 'collectionName'` to `resolveSchemaPortContext`,
        // whose own DEFAULT is `'collection'` — so reading the resolver and not
        // the caller gets this wrong, which is how this fixture got it wrong.
        // It is a runtime-discovered port, so nothing in the catalog says so and
        // nothing diagnoses the wrong name: the parameter is simply inert.
        collectionName: 'Puppy',
        'prop-name': '',
        'prop-age': 0,
        'prop-bio': ''
      }
    },
    {
      id: 'back-to-list',
      type: 'RouterNavigate',
      label: 'Back to Puppies',
      x: 380,
      y: 260,
      parameters: { target: '/Pages/Puppies' }
    }
  ],
  // Port names read out of the catalog, not remembered: the button signals
  // `onClick`, and the Create Record node's success signal is `done` (there is
  // no `stored`). Its `prop-*` ports are runtime-discovered, so they are set as
  // parameters — which is precisely the state finding #7 was reported in.
  connections: [
    { fromId: 'save-button', fromProperty: 'onClick', toId: 'create-puppy', toProperty: 'store' },
    { fromId: 'create-puppy', fromProperty: 'done', toId: 'back-to-list', toProperty: 'navigate' }
  ]
};

/**
 * Keyed by the component path the plan targets. `planFromScope` turns a scope
 * page named "Puppies" into `Pages/Puppies`, so these keys are derived from the
 * scope above and not chosen independently — a mismatch is a fixture bug, and
 * the driver says so rather than replaying the wrong component.
 */
const COMPONENTS = {
  'Pages/Puppies': PUPPIES_PAGE,
  'Pages/Admin': ADMIN_PAGE
};

module.exports = { BRIEF, SCOPE_ARGS, SCOPE_PROSE_ROUND_1, SCOPE_PROSE_ROUND_2, COMPONENTS };
