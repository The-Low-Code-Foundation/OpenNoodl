/**
 * AIX-002 — measurement harness: the prompt corpus.
 *
 * Eight authoring requests against the real-project corpus
 * (tests/testfs/git-repo-utf8 — a 44-component Contentful article app),
 * written the way a user would type them, not the way the schema thinks.
 * They span the loop's demands: signal outputs, component inputs, a
 * repeater, reuse of an existing project component, pure logic, and
 * conditional visibility.
 *
 * Component paths are all new (the session refuses to author over an
 * existing component), prefixed AIX so a stray accept in some future
 * editor-side use is recognisable.
 */

export interface MeasurePrompt {
  slug: string;
  componentPath: string;
  description: string;
}

export const PROMPTS: MeasurePrompt[] = [
  {
    slug: 'hello-cta',
    componentPath: 'Pages/AIX Hello',
    description:
      "A simple page with a large title that says 'Welcome to Shine', a short subtitle underneath, " +
      "and a 'Get started' button. When the button is clicked the page should emit a 'Get Started' " +
      'signal as a component output.'
  },
  {
    slug: 'newsletter-form',
    componentPath: 'Pages/AIX Newsletter',
    description:
      'A newsletter sign-up page: a text input where the user types their email address, and a ' +
      "'Subscribe' button. Expose the typed email as a component output called 'Email', and emit a " +
      "'Subscribed' signal output when the button is clicked."
  },
  {
    slug: 'article-list',
    componentPath: 'Pages/AIX Article List',
    description:
      'A page that shows a scrolling vertical list of articles. Use a repeater bound to a list of ' +
      "items; each item shows the article's title and a short summary. Clicking an item should send " +
      'the item id out of the component as an output.'
  },
  {
    slug: 'profile-card',
    componentPath: 'Visual Components/AIX Profile Card',
    description:
      "A reusable profile card: component inputs for 'Name', 'Bio' and 'Avatar URL'. It renders the " +
      'avatar image on the left, and on the right the name in bold with the bio text underneath.'
  },
  {
    slug: 'pill-row',
    componentPath: 'Pages/AIX Tags',
    description:
      "A page with a horizontal row of three of this project's existing Pill components, one for " +
      "each of the labels 'Design', 'Engineering' and 'News'."
  },
  {
    slug: 'counter-logic',
    componentPath: 'Logic Components/AIX Counter',
    description:
      "A logic component with two signal inputs, 'Increment' and 'Reset', and a number output " +
      "'Count'. Increment adds one to the count, Reset puts it back to zero."
  },
  {
    slug: 'toggle-section',
    componentPath: 'Pages/AIX FAQ',
    description:
      'A page with a question row that can expand and collapse: clicking the question text toggles ' +
      'the visibility of the answer text below it.'
  },
  {
    slug: 'login-form',
    componentPath: 'Pages/AIX Login',
    description:
      "A login page with email and password text inputs and a 'Sign in' button. The button must stay " +
      "disabled until both fields are non-empty. Expose 'Email' and 'Password' as component outputs, " +
      "and a 'Sign In' signal output that fires when the button is clicked."
  }
];
