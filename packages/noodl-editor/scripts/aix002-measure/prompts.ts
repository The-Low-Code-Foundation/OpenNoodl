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
  },
  /**
   * FIX-006 AC1 + AC2 — the reported request, and the only prompt here written to
   * grade a prompt change rather than the loop.
   *
   * The report: *"It made a Script node inside a component for this … it used like
   * `var foo = "bar"` type code instead of more modern const / let, and used a
   * complex regex function instead of a simple splice."* AC1 asks which of the
   * three compute nodes the model reaches for; AC2 asks what the body looks like.
   *
   * ⚠️ **Deliberately names no node type, and no JavaScript.** A request that said
   * "with a Function node" or "using slice" would answer both criteria in the
   * question. The one addition to the reported wording is the price example — the
   * report gives no sample value, and "cut the first character" needs one to be a
   * task rather than a riddle.
   */
  {
    slug: 'fix006-string-math',
    componentPath: 'Logic Components/AIX Discount',
    description:
      "Takes a price that arrives as a piece of text with a currency symbol on the front, like " +
      "'$42.50'. Drop that first character, turn what is left into a number, and multiply it by " +
      '0.9. Send the result out of the component as a number.'
  },
  /**
   * FIX-006's ruling — the alternation instrument.
   *
   * `fix006-string-math` grades **node choice**: the whole request is one simple step, so it can
   * only show whether the model reached for `Substring` or wrote `.slice(1)`. It cannot show the
   * shape the ruling actually forbids, because there is not enough work in it to split.
   *
   * 🔴 Richard's exception is the load-bearing half — *"otherwise you end up with function nodes
   * connected to substring nodes connected to functions"* — and a rule that only pushed "use the
   * node" would **manufacture** that shape while scoring as a win on the criterion above. So this
   * request is deliberately one calculation with a simple head (drop a currency symbol: a node
   * does that) and a body that needs real code (thousands separators, two decimals, a composed
   * line). Per the ruling the right answer is ONE code node, and the tempting wrong answer is
   * `Substring` → `Function` → `String Format`.
   *
   * ⚠️ **Names no node type and no JavaScript**, for the same reason as the prompt above: a
   * request that said "with a Function node" would answer the question being asked.
   */
  {
    slug: 'fix006-price-line',
    componentPath: 'Logic Components/AIX Price Line',
    description:
      "Takes a price that arrives as text with a currency symbol on the front, like '$1,299.50', " +
      'and a whole number quantity. Work out what the order comes to, and send out of the ' +
      "component one line of text reading like '3 x $1,299.50 = $3,898.50' — keep the thousands " +
      'separators and two decimal places on both amounts.'
  }
];
