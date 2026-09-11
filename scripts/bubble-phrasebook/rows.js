/**
 * COM-002 — the Bubble phrasebook, as data.
 *
 * One row per operator in the community's Bubble→Noodl dictionary (94 rows,
 * `dev-docs/tasks/phase-86-the-community-already-built-it/corpus/bubble-dictionary/`).
 * This file is the single source of truth for BOTH the published page and the
 * checker that executes its code, which is the point: COM-002 AC4 asks that
 * every code cell be *executed*, not read, and a page generated from prose
 * cannot be.
 *
 * 🔴 Why the corpus's code is not simply copied across. It was written for an
 * editor that no longer exists and it had never been run. Executing it found
 * **18 demonstrably wrong rows**, in three kinds, and `corpusBugKind` says which:
 *
 *   'code'    (11) the code produces the wrong answer when executed
 *   'result'  (3)  the code is fine and the row's own stated ANSWER is wrong
 *   'missing' (2)  the row claims an answer it never shipped
 *
 * Each is recorded on its row and rendered on the page, because a phrasebook
 * that silently repairs its source teaches the reader to trust code nobody ran.
 *
 * 🔴 And the accusation is itself executed. The eleven 'code' rows carry the
 * ORIGINAL verbatim in `corpusOriginal`, and `check.js` runs it: a row claiming
 * the community was wrong FAILS THE BUILD if the old code turns out to return
 * the right answer. That check demoted two rows — `:formatted as currency` and
 * `contains` — from "broken" to "right answer, wrong reason", and those now
 * carry `note_corpus` instead, which makes no correctness claim.
 *
 * Row shape:
 *   id            Bubble "Public Id" from the CSV — traceability back to the corpus
 *   bubble        the operator EXACTLY as Bubble writes it; this is the search term
 *   type          Bubble's data type, used to group the page
 *   example       Bubble's own example expression
 *   bubbleResult  what Bubble's own row says that example returns
 *   answer        { kind, node, code?, prose? }
 *                   'expression' — an Expression node body; `fixture.vars` are its free
 *                                  variables, each of which becomes an input port
 *                   'function'   — a Function node body reading `Inputs` / writing `Outputs`
 *                   'node'       — a node does it; no code to run
 *                   'none'       — NodeGX has no equivalent. `prose` says what to do instead.
 *   fixture       what the checker runs. Omitted only for 'node' and 'none'.
 *                   vars    — free variables, for an expression
 *                   inputs  — the `Inputs` object, for a function
 *                   expect  — the expected value ('expression'), or an object of
 *                             expected `Outputs` values ('function')
 *                   signals — output signal names the function must fire, in any order
 *   corpusBug     what the corpus's own code did, when it did not work
 *   note          anything the reader needs that the code does not say
 *
 * @module scripts/bubble-phrasebook/rows
 */

/**
 * The dictionary's own worked values, recovered from its Example/Result columns
 * and used verbatim so a reader can check a row against the corpus.
 *
 * `Date1` and `Date2` are built from local parts rather than parsed from an ISO
 * string: `new Date('2023-07-06T14:22')` is local time but
 * `new Date('2023-07-06')` is UTC, and a fixture that changes answer with the
 * machine's timezone is not a fixture.
 */
const SAMPLE = {
  String1: 'Hello',
  String2: 'Hello world',
  String3: '99',
  String4: 'pink, blue, purple, red, white, cherry/deep-red',
  Int1: 3.333,
  Int2: 9000,
  IntRange1: [1, 20],
  IntRange2: [5, 10],
  List1: ['pink', 'blue', 'purple', 'red', 'white', 'cherry/deep-red'],
  List2: ['apples', 'bananas', 'yellow', 'blueberries'],
  List3: [
    { name: 'Frank', location: 'New York' },
    { name: 'Jim', location: 'New York' },
    { name: 'Jane', location: 'Boston' }
  ],
  Date1: new Date(2023, 6, 6, 14, 22, 0),
  Date2: new Date(1970, 0, 1, 0, 1, 0)
};

const rows = [
  // ── Any ────────────────────────────────────────────────────────────────────
  {
    id: '96', bubble: '... is ...', type: 'Any',
    example: 'String1 is String2', bubbleResult: 'FALSE',
    answer: { kind: 'expression', node: 'Expression', code: 'String1 === String2' },
    fixture: { vars: { String1: SAMPLE.String1, String2: SAMPLE.String2 }, expect: false },
    note: 'Every free name in an Expression becomes an input port, so `String1` and `String2` are the two ports this node grows. Use `===`, never `==`.'
  },
  {
    id: '97', bubble: '... is not ...', type: 'Any',
    example: 'String1 is not String2', bubbleResult: 'TRUE',
    answer: { kind: 'expression', node: 'Expression', code: 'String1 !== String2' },
    fixture: { vars: { String1: SAMPLE.String1, String2: SAMPLE.String2 }, expect: true }
  },
  {
    id: '98', bubble: '... is empty', type: 'Any',
    example: 'String1 is empty', bubbleResult: 'FALSE',
    answer: {
      kind: 'function', node: 'Function',
      code: [
        'const hasContent = Boolean(Inputs.String1);',
        '',
        'Outputs.CurrentState = hasContent;',
        'if (hasContent) {',
        '  Outputs.IsNotEmpty();',
        '} else {',
        '  Outputs.IsEmpty();',
        '}'
      ].join('\n')
    },
    fixture: { inputs: { String1: SAMPLE.String1 }, expect: { CurrentState: true }, signals: ['IsNotEmpty'] },
    note: 'One node answers both this row and the next. It publishes a boolean AND a signal per branch, so you can wire it into a Condition or straight into a flow. ⚠️ `Boolean("")` is false and so is `Boolean(0)` — for a number input, "empty" and "zero" are the same answer here.'
  },
  {
    id: '99', bubble: '... is not empty', type: 'Any',
    example: 'String2 is not empty', bubbleResult: 'TRUE',
    answer: { kind: 'function', node: 'Function', code: 'Outputs.IsNotEmpty = Boolean(Inputs.String2);' },
    fixture: { inputs: { String2: SAMPLE.String2 }, expect: { IsNotEmpty: true } },
    corpusBugKind: 'missing',
    corpusBug: 'The corpus’s code cell for this row is the literal text "See above", and its Notes cell is "See above" too. A cell that cannot be pasted into a node is not an answer; row 98 answers both directions, and this row states the one-line form.'
  },
  {
    id: '100', bubble: ':formatted as JSON-safe', type: 'Any',
    example: 'List1 :formatted as JSON-safe', bubbleResult: '"pink, blue, purple, red, white, cherry\\/deep-red"',
    answer: { kind: 'function', node: 'Function', code: 'Outputs.OutputString = JSON.stringify(Inputs.InputString || \'\');\nOutputs.Success();' },
    fixture: { inputs: { InputString: SAMPLE.String4 }, expect: { OutputString: '"pink, blue, purple, red, white, cherry/deep-red"' }, signals: ['Success'] },
    corpusOriginal: {
      kind: 'function',
      code: [
        "const input = Inputs.InputString || '';",
        "const escapedString = JSON.stringify(input);",
        "Outputs.OutputString = `\"${escapedString}\"`;",
        "Outputs.Success();"
      ].join('\n'),
      inputs: { InputString: SAMPLE.String4 }
    },
    corpusBugKind: 'code',
    corpusBug: 'The corpus wrapped the result in quotes a second time — `Outputs.OutputString = `"${escapedString}"`` on top of `JSON.stringify`, which already adds them. Executed, it returns `""pink, blue…""`, and an API called with that body gets a quoted string where it expected a value.',
    note: '`JSON.stringify` is the whole answer: it escapes quotes, backslashes, newlines and control characters and returns the value already quoted. Do not add quotes around it.'
  },
  {
    id: '101', bubble: ':formatted as JSON-safe', type: 'Date',
    example: 'Date1 :formatted as JSON-safe', bubbleResult: '2023-07-06T12:43:14.649Z',
    answer: { kind: 'node', node: 'Now', prose: 'A date in a JSON body wants ISO-8601 UTC. The **Now** node publishes exactly that on its `ISO` output, and for any other date **Date To String** formats one. There is no code for this row.' },
    note: 'Blank in the corpus. `Date.prototype.toISOString()` is the same string if you are already inside a Function node.'
  },

  // ── String ─────────────────────────────────────────────────────────────────
  {
    id: '102', bubble: 'is not in', type: 'String',
    example: 'String1 is not in List1', bubbleResult: 'TRUE',
    answer: { kind: 'expression', node: 'Expression', code: '!List1.includes(String1)' },
    fixture: { vars: { String1: SAMPLE.String1, List1: SAMPLE.List1 }, expect: true },
    note: 'Blank in the corpus. There is no Array Contains node, so this is a one-liner rather than a wiring — which is also true of Bubble’s own operator.'
  },
  {
    id: '103', bubble: '... contains', type: 'String',
    example: 'String2 contains String1', bubbleResult: 'TRUE',
    answer: { kind: 'expression', node: 'Expression', code: 'String2.includes(String1)' },
    fixture: { vars: { String1: SAMPLE.String1, String2: SAMPLE.String2 }, expect: true },
    corpusOriginal: {
      kind: 'expression',
      code: [
        "string1.includes(string2)"
      ].join('\n'),
      vars: { string1: 'Hello', string2: 'Hello world' }
    },
    corpusBugKind: 'code',
    corpusBug: 'The corpus wrote `string1.includes(string2)` — the operands the wrong way round against its own example, which asks whether String2 contains String1. Executed on the row’s own values it answers FALSE where the row says TRUE.',
    note: 'Exact substring match, including case and spaces. For a word-aware search see `... contains keyword(s)` below, which NodeGX does not have.'
  },
  {
    id: '104', bubble: "... doesn't contain", type: 'String',
    example: "String1 doesn't contain String2", bubbleResult: 'TRUE',
    answer: { kind: 'expression', node: 'Expression', code: '!String1.includes(String2)' },
    fixture: { vars: { String1: SAMPLE.String1, String2: SAMPLE.String2 }, expect: true },
    note: 'The corpus wrote `!string1.includes(string2)` here, which — unlike the row above, written from the same template — happens to match its own example and returns the right answer. Executed, this one is correct.'
  },
  {
    id: '105', bubble: '... contains keyword(s)', type: 'String',
    example: 'String2 contains keywords String1', bubbleResult: 'TRUE',
    answer: {
      kind: 'none', node: null,
      prose: '**NodeGX has no equivalent, and `.includes()` is NOT one.** Bubble’s operator breaks the argument into words, removes stop words like "the" and "a", and matches stems — its own documentation says searching `cat hat` returns *the cat in the hat*, and that `pepp` does **not** return `peppers`. Substring matching gets both of those backwards: it fails `cat hat` (those characters never appear together) and it wrongly matches `pepp`. What to do instead: for a real search, put the text in a database column and use your backend’s text search; for a small in-memory list, tokenise deliberately (`text.toLowerCase().split(/\\W+/)`) and decide for yourself about stop words and stems — and write down which you chose.'
    },
    note: 'Blank in the corpus, and it stays blank on purpose. Recorded as a product gap by COM-001 AC4.'
  },
  {
    id: '106', bubble: "... doesn't contain keyword(s)", type: 'String',
    example: "String2 doesn't contain keywords String1", bubbleResult: 'FALSE',
    answer: { kind: 'none', node: null, prose: 'The negation of the row above, and missing for the same reason. See `... contains keyword(s)`.' }
  },
  {
    id: '107', bubble: ':capitalized words', type: 'String',
    example: 'String2 :capitalized words', bubbleResult: '"Hello World"',
    answer: {
      kind: 'function', node: 'Function',
      code: [
        'const input = Inputs.InputString || \'\';',
        '',
        'Outputs.OutputString = input',
        '  .split(\' \')',
        '  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))',
        '  .join(\' \');',
        'Outputs.Success();'
      ].join('\n')
    },
    fixture: { inputs: { InputString: SAMPLE.String2 }, expect: { OutputString: 'Hello World' }, signals: ['Success'] },
    note: '⚠️ Usually the wrong tool. Every node that draws text has a **Case** property under Text Style, and `Capitalize` there costs no node and no wire. Use this when the capitalised string itself has to travel somewhere — into a request body, or a record.'
  },
  {
    id: '108', bubble: ':uppercase', type: 'String',
    example: 'String2 :uppercase', bubbleResult: '"HELLO WORLD"',
    answer: { kind: 'expression', node: 'Expression', code: 'String2.toUpperCase()' },
    fixture: { vars: { String2: SAMPLE.String2 }, expect: 'HELLO WORLD' },
    note: 'Same caveat as `:capitalized words` — Text Style ▸ Case does this without a node.'
  },
  {
    id: '109', bubble: ':lowercase', type: 'String',
    example: 'String1 :lowercase', bubbleResult: '"hello"',
    answer: { kind: 'expression', node: 'Expression', code: 'String1.toLowerCase()' },
    fixture: { vars: { String1: SAMPLE.String1 }, expect: 'hello' },
    corpusOriginal: {
      kind: 'expression',
      code: [
        "string2.toLowerCase()"
      ].join('\n'),
      vars: { string2: 'Hello world' }
    },
    corpusBugKind: 'code',
    corpusBug: 'The corpus wrote `string2.toLowerCase()` under an example reading `String1 :lowercase`. Pasted as written, the node grows a `string2` port and the `String1` the row is about is never read.'
  },
  {
    id: '110', bubble: ':append', type: 'String',
    example: 'String1 :append "World"', bubbleResult: '"Hello World"',
    answer: { kind: 'node', node: 'String Format', prose: 'Set **Format** to `{String1} World`. Every `{tag}` in that string becomes an input port, so this is a node with no code at all — and it stays readable when the sentence grows to three or four values, which a chain of `+` does not.' },
    note: 'An Expression `String1 + \' World\'` also works; String Format is the one to reach for once there is more than one hole.'
  },
  {
    id: '111', bubble: ':formatted as URL encoded', type: 'String',
    example: 'String2 :formatted as URL encoded', bubbleResult: '"Hello%20world"',
    answer: { kind: 'function', node: 'Function', code: 'const value = Inputs.String || \'\';\n\nOutputs.EncodedString = encodeURIComponent(value);\nOutputs.Success();' },
    fixture: { inputs: { String: SAMPLE.String2 }, expect: { EncodedString: 'Hello%20world' }, signals: ['Success'] },
    note: '`encodeURIComponent` is right for one query-string value. `encodeURI` is for a whole URL and will leave `&`, `=` and `?` alone — which is what you want for the URL and what you do not want for a value inside it.'
  },
  {
    id: '112', bubble: ':formatted as MD5 hash', type: 'String',
    example: 'String2 :formatted as MD5 hash', bubbleResult: '"3e25960a79dbc69b674cd4ec67a72c62"',
    answer: {
      kind: 'none', node: 'Hash',
      prose: '**The Hash node offers SHA-256, SHA-384 and SHA-512, and will never offer MD5.** That is a decision rather than a gap: Hash runs on WebCrypto, which implements neither MD5 nor SHA-1 for digesting, and hand-rolling one would mean shipping a hash that is broken for every purpose it was ever used for. **If your Bubble app stored MD5 fingerprints, they will not reproduce here and no setting will make them** — plan a re-hash of the source data with SHA-256, not a translation.'
    }
  },
  {
    id: '113', bubble: ':formatted as SHA1 Hash', type: 'String',
    example: 'String2 :formatted as SHA1 Hash', bubbleResult: '"7b502c3a1f48c8609ae212cdfb639dee39673f5e"',
    answer: { kind: 'none', node: 'Hash', prose: 'Same answer as MD5 above, for the same reason. Use SHA-256 on the **Hash** node. The corpus’s own note says this row was never a native Bubble operator either.' }
  },
  {
    id: '114', bubble: ':trimmed', type: 'String',
    example: 'String2 :trimmed', bubbleResult: '"Hello world"',
    answer: { kind: 'expression', node: 'Expression', code: 'String2.trim()' },
    fixture: { vars: { String2: '  Hello world  ' }, expect: 'Hello world' },
    note: 'The fixture pads the sample value, because `trim()` on a string with no surrounding whitespace demonstrates nothing.'
  },
  {
    id: '115', bubble: ':number of characters', type: 'String',
    example: 'String2 :number of characters', bubbleResult: '11',
    answer: { kind: 'expression', node: 'Expression', code: 'String2.length' },
    fixture: { vars: { String2: SAMPLE.String2 }, expect: 11 },
    note: '⚠️ `.length` counts UTF-16 units, not characters a person would count: an emoji or an accented character built from a combining mark reads as 2. `[...String2].length` is closer to what a reader means.'
  },
  {
    id: '116', bubble: ':truncated to', type: 'String',
    example: 'String2 :truncated to 5', bubbleResult: '"Hello"',
    answer: { kind: 'expression', node: 'Expression', code: 'String2.slice(0, 5)' },
    fixture: { vars: { String2: SAMPLE.String2 }, expect: 'Hello' }
  },
  {
    id: '117', bubble: ':truncated from end to', type: 'String',
    example: 'String2 :truncated from end to 5', bubbleResult: '"world"',
    answer: { kind: 'expression', node: 'Expression', code: 'String2.slice(-5)' },
    fixture: { vars: { String2: SAMPLE.String2 }, expect: 'world' }
  },
  {
    id: '118', bubble: ':converted to number', type: 'String',
    example: 'String3 :convert to number', bubbleResult: '99',
    answer: { kind: 'node', node: 'Number', prose: 'The **Number** node converts a value to a number on its own. In an Expression, `Number(String3)` does the same.' },
    note: '⚠️ Parse CSV and most request bodies hand you strings, and `"42" === 42` is false — a comparison against a number stays false everywhere until something converts.'
  },
  {
    id: '119', bubble: ':split by...', type: 'String',
    example: 'String4 :split by ", "', bubbleResult: '[ "pink", "blue", "purple", "red", "white", "cherry/deep-red" ]',
    answer: { kind: 'expression', node: 'Expression', code: 'String4.split(", ")' },
    fixture: { vars: { String4: SAMPLE.String4 }, expect: ['pink', 'blue', 'purple', 'red', 'white', 'cherry/deep-red'] },
    note: 'For CSV proper, use **Parse CSV** rather than splitting: a cell containing the delimiter, a quote or a newline is exactly what `split` gets wrong and what that node gets right.'
  },
  {
    id: '120', bubble: ':find/replace...', type: 'String',
    example: 'String2 :find/replace "world" "Homer"', bubbleResult: '"Hello Homer"',
    answer: { kind: 'expression', node: 'Expression', code: 'String2.replace("world", "Homer")' },
    fixture: { vars: { String2: SAMPLE.String2 }, expect: 'Hello Homer' },
    note: '⚠️ A string first argument replaces the FIRST occurrence only. For every occurrence use `replaceAll`, or a regular expression with the `g` flag.'
  },
  {
    id: '121', bubble: ':extract with Regex', type: 'String',
    example: 'String2 :extract with Regex', bubbleResult: '"world"',
    answer: {
      kind: 'function', node: 'Function',
      code: [
        'const value = Inputs.String2 || \'\';',
        'const match = value.match(/\\bw\\w*/i);',
        '',
        'if (match) {',
        '  Outputs.allMatches = match;',
        '  Outputs.FirstWord = match[0];',
        '  Outputs.Success();',
        '} else {',
        '  Outputs.Failure();',
        '}'
      ].join('\n')
    },
    fixture: { inputs: { String2: SAMPLE.String2 }, expect: { FirstWord: 'world' }, signals: ['Success'] },
    note: 'Wire **Failure** — a regex that does not match is the ordinary case, not the exceptional one, and without that wire the chain stops with no explanation.'
  },

  // ── Integer ────────────────────────────────────────────────────────────────
  {
    id: '122', bubble: ':formatted as ... (currency)', type: 'Integer',
    example: 'Int1 :formatted as currency', bubbleResult: '"$3.33"',
    answer: {
      kind: 'function', node: 'Function',
      code: [
        'const amount = Number(Inputs.Amount) || 0;',
        '',
        'Outputs.FormattedAmount = new Intl.NumberFormat(Inputs.Locale || \'en-US\', {',
        '  style: \'currency\',',
        '  currency: Inputs.Currency || \'USD\'',
        '}).format(amount);',
        'Outputs.Success();'
      ].join('\n')
    },
    fixture: { inputs: { Amount: SAMPLE.Int1, Currency: 'USD', Locale: 'en-US' }, expect: { FormattedAmount: '$3.33' }, signals: ['Success'] },
    note_corpus: 'The corpus hard-coded the dollar sign, and executed on this row’s own example it returns `$3.33` — exactly what the row says. It is not wrong here; it is wrong everywhere else. It gives `$1234.5` where a German reader expects `1.234,50 €`, and `toFixed(2)` is wrong for JPY, which has no decimal places at all.',
    note: '`Intl.NumberFormat` is built into both runtimes and needs no dependency. It places the symbol, picks the separators and rounds to the currency’s own number of decimals — JPY has none, and `toFixed(2)` gets that wrong too.'
  },
  {
    id: '123', bubble: ':formatted as ... (decimal places)', type: 'Integer',
    example: 'Int1 :formatted as 2 decimal places', bubbleResult: '"3.33"',
    answer: { kind: 'expression', node: 'Expression', code: 'Int1.toFixed(2)' },
    fixture: { vars: { Int1: SAMPLE.Int1 }, expect: '3.33' },
    note: '⚠️ `toFixed` returns a **string**. Feed it to a Text and it draws correctly; compare it to a number and the comparison is false.'
  },
  {
    id: '124', bubble: '< > ≥ ≤ + - / *', type: 'Integer',
    example: 'Int1 * Int2', bubbleResult: '29997',
    answer: { kind: 'expression', node: 'Expression', code: 'Int1 * Int2' },
    fixture: { vars: { Int1: SAMPLE.Int1, Int2: SAMPLE.Int2 }, expect: 29997 },
    note: 'All of Bubble’s arithmetic and comparison operators are just JavaScript here. Expression also pre-defines `min`, `max`, `round`, `floor`, `ceil`, `abs`, `sqrt`, `pow`, `log`, `exp`, `pi`, `random`, `sin`, `cos` and `tan`, so you write `floor(x)` and not `Math.floor(x)`.'
  },
  {
    id: '125', bubble: ':rounded to', type: 'Integer',
    example: 'Int1 :rounded to 0', bubbleResult: '3',
    answer: { kind: 'expression', node: 'Expression', code: 'round(Int1)' },
    fixture: { vars: { Int1: SAMPLE.Int1 }, expect: 3 },
    corpusOriginal: {
      kind: 'expression',
      code: [
        "int1.toFixed(0)"
      ].join('\n'),
      vars: { int1: 3.333 }
    },
    corpusBugKind: 'code',
    corpusBug: 'The corpus wrote `int1.toFixed(0)`, which returns the STRING `"3"` where the row says the number `3`. `round` is pre-defined in an Expression and returns a number.',
    note: 'For a number of decimal places rather than a whole number, `round(Int1 * 100) / 100` keeps it numeric; `toFixed(2)` is the one that turns it into text.'
  },
  {
    id: '126', bubble: ':floor', type: 'Integer',
    example: 'Int1 :floor', bubbleResult: '3',
    answer: { kind: 'expression', node: 'Expression', code: 'floor(Int1)' },
    fixture: { vars: { Int1: SAMPLE.Int1 }, expect: 3 },
    note: '`floor` is pre-defined by the Expression node — this is not shorthand for `Math.floor`, it is the name the node gives you.'
  },
  {
    id: '127', bubble: ':ceiling', type: 'Integer',
    example: 'Int1 :ceiling', bubbleResult: '4',
    answer: { kind: 'expression', node: 'Expression', code: 'ceil(Int1)' },
    fixture: { vars: { Int1: SAMPLE.Int1 }, expect: 4 }
  },
  {
    id: '128', bubble: '... ^ ...', type: 'Integer',
    example: 'Int1 ^ 2', bubbleResult: '9.999',
    answer: { kind: 'expression', node: 'Expression', code: 'Int1 ** 2' },
    fixture: { vars: { Int1: SAMPLE.Int1 }, expect: 11.108889000000001 },
    corpusBugKind: 'result',
    corpusBug: 'The corpus’s stated RESULT is wrong, not its code. `Int1` is 3.333 and the row says `Int1 ^ 2` is `9.999` — that is 3.333 × 3. The square is 11.108889.',
    note: '`**` is exponentiation; `pow(Int1, 2)` is the same thing and is pre-defined. ⚠️ The fixture on this row expects `11.108889000000001`, and that is not a typo — it is what IEEE-754 doubles actually return for `3.333 ** 2`, in this runtime and in Bubble’s. It is here rather than rounded away because money and totals hit it constantly: never compare two computed floats with `===`, compare `abs(a - b) < 1e-9`, and round only at the point you DISPLAY the number. ⚠️ The fixture on this row expects `11.108889000000001`, and that is not a typo — it is what IEEE-754 doubles actually return for `3.333 ** 2`, in this runtime and in Bubble’s. It is here rather than rounded away because money and totals hit it constantly: never compare two computed floats with `===`, compare `abs(a - b) < 1e-9`, and round only at the point you DISPLAY the number.'
  },
  {
    id: '129', bubble: '<- range ->', type: 'Integer',
    example: 'Int1 <-range-> Int2', bubbleResult: '[3.333, 9000]',
    answer: { kind: 'expression', node: 'Expression', code: '[Int1, Int2]' },
    fixture: { vars: { Int1: SAMPLE.Int1, Int2: SAMPLE.Int2 }, expect: [3.333, 9000] },
    note: '🔴 **Bubble has a range TYPE; NodeGX does not.** A range here is a two-element array you make yourself, which is why the range operators below are all short expressions over `[start, end]` rather than node ports. Nothing enforces that start ≤ end — see the warning under `overlaps with`.'
  },

  // ── Integer range ──────────────────────────────────────────────────────────
  {
    id: '130', bubble: ':min', type: 'Integer range',
    example: 'IntRange1 :min', bubbleResult: '1',
    answer: { kind: 'expression', node: 'Expression', code: 'min(...IntRange1)' },
    fixture: { vars: { IntRange1: SAMPLE.IntRange1 }, expect: 1 },
    note: 'The corpus used a Function node with a guard that throws on a malformed range. The expression is enough once the range is built by the graph rather than typed by a user; keep the guard if it comes from outside.'
  },
  {
    id: '131', bubble: ':max', type: 'Integer range',
    example: 'IntRange1 :max', bubbleResult: '20',
    answer: { kind: 'expression', node: 'Expression', code: 'max(...IntRange1)' },
    fixture: { vars: { IntRange1: SAMPLE.IntRange1 }, expect: 20 }
  },
  {
    id: '132', bubble: ':average', type: 'Integer range',
    example: 'IntRange1 :average', bubbleResult: '10.5',
    answer: { kind: 'expression', node: 'Expression', code: '(IntRange1[0] + IntRange1[1]) / 2' },
    fixture: { vars: { IntRange1: SAMPLE.IntRange1 }, expect: 10.5 },
    note: 'The midpoint of the two ends — not the mean of a list. For a list, see `:average` under List.'
  },
  {
    id: '133', bubble: 'contains range', type: 'Integer range',
    example: 'IntRange1 contains range IntRange2', bubbleResult: 'TRUE',
    answer: { kind: 'expression', node: 'Expression', code: 'IntRange2[0] >= IntRange1[0] && IntRange2[1] <= IntRange1[1]' },
    fixture: { vars: { IntRange1: SAMPLE.IntRange1, IntRange2: SAMPLE.IntRange2 }, expect: true }
  },
  {
    id: '134', bubble: 'contains point', type: 'Integer range',
    example: 'IntRange1 contains point Int1', bubbleResult: 'TRUE',
    answer: { kind: 'expression', node: 'Expression', code: 'Int1 >= IntRange1[0] && Int1 <= IntRange1[1]' },
    fixture: { vars: { Int1: SAMPLE.Int1, IntRange1: SAMPLE.IntRange1 }, expect: true }
  },
  {
    id: '135', bubble: 'is contained by', type: 'Integer range',
    example: 'IntRange1 is contained by IntRange2', bubbleResult: 'FALSE',
    answer: { kind: 'expression', node: 'Expression', code: 'IntRange1[0] >= IntRange2[0] && IntRange1[1] <= IntRange2[1]' },
    fixture: { vars: { IntRange1: SAMPLE.IntRange1, IntRange2: SAMPLE.IntRange2 }, expect: false },
    note: '`contains range` with the operands swapped — the same expression read the other way round.'
  },
  {
    id: '136', bubble: 'overlaps with', type: 'Integer range',
    example: 'IntRange1 overlaps with IntRange2', bubbleResult: 'TRUE',
    answer: { kind: 'expression', node: 'Expression', code: 'IntRange1[0] <= IntRange2[1] && IntRange1[1] >= IntRange2[0]' },
    fixture: { vars: { IntRange1: SAMPLE.IntRange1, IntRange2: SAMPLE.IntRange2 }, expect: true },
    note: '🔴 Two intervals overlap exactly when each starts before the other ends — one identity that also answers `contains point`, `is contained by`, `is after` and `is before`. ⚠️ It assumes each range is the right way round: give it `[20, 1]` and it answers "no overlap", which is the wrong answer to a malformed range rather than the right answer to a valid one. Validate the range before you ask.'
  },
  {
    id: '137', bubble: 'is greater', type: 'Integer range',
    example: 'IntRange1 is greater than IntRange2', bubbleResult: '—',
    answer: { kind: 'expression', node: 'Expression', code: 'IntRange1[0] > IntRange2[1]' },
    fixture: { vars: { IntRange1: SAMPLE.IntRange1, IntRange2: SAMPLE.IntRange2 }, expect: false },
    note: 'Blank in the corpus, and its Example and Result cells are blank too — so the reading taken here is Bubble’s: one range is greater than another when it starts after the other ends, with no overlap. `[1,20]` and `[5,10]` overlap, so this is false.'
  },
  {
    id: '138', bubble: 'is greater (point)', type: 'Integer range',
    example: 'IntRange1 is greater than Int1', bubbleResult: '—',
    answer: { kind: 'expression', node: 'Expression', code: 'IntRange1[0] > Int1' },
    fixture: { vars: { IntRange1: SAMPLE.IntRange1, Int1: SAMPLE.Int1 }, expect: false },
    note: 'The whole range sits above the point. 3.333 is inside `[1, 20]`, so this is false.'
  },
  {
    id: '139', bubble: 'is smaller', type: 'Integer range',
    example: 'IntRange1 is smaller than IntRange2', bubbleResult: '—',
    answer: { kind: 'expression', node: 'Expression', code: 'IntRange1[1] < IntRange2[0]' },
    fixture: { vars: { IntRange1: SAMPLE.IntRange1, IntRange2: SAMPLE.IntRange2 }, expect: false }
  },
  {
    id: '140', bubble: 'is smaller (point)', type: 'Integer range',
    example: 'IntRange1 is smaller than Int1', bubbleResult: '—',
    answer: { kind: 'expression', node: 'Expression', code: 'IntRange1[1] < Int1' },
    fixture: { vars: { IntRange1: SAMPLE.IntRange1, Int1: SAMPLE.Int1 }, expect: false }
  },

  // ── Date ───────────────────────────────────────────────────────────────────
  {
    id: '141', bubble: 'Current date & time', type: 'Date',
    example: 'Current date & time', bubbleResult: '15/08/2024',
    answer: { kind: 'node', node: 'Now', prose: 'The **Now** node publishes the same instant three ways — `Date` for the other date nodes, `Timestamp` in milliseconds, and `ISO` for a JSON body. ⚠️ It is not a live clock: it reads the wall clock when it is created and again on every `Read`, so a card left open keeps the instant it was rendered with until something re-reads it. Pair it with a Timer if you want it to tick.' },
    example_link: 'bubble-is-this-date-overdue',
    note: 'Blank in the corpus. In a cloud function this is the SERVER’s clock, which is the one you want for anything a client should not be able to lie about.'
  },
  {
    id: '142', bubble: 'formatted as', type: 'Date',
    example: 'Date1 formatted as ddd dS mm-yy HH:MM', bubbleResult: 'Thu 6th 07-23 14:22',
    answer: { kind: 'node', node: 'Date To String', prose: 'Set **Format String**. The tokens are `{dayName} {monthName} {year} {month} {date} {hours} {minutes} {seconds}` for the padded forms and `{m} {d} {h} {min} {s}` for the unpadded ones, plus `{h12}` and `{ampm}`. **Locale** translates the day and month NAMES and nothing else; **Timezone** decides which day it is.' },
    example_link: 'logic-date-formatting',
    note: 'Blank in the corpus — and the format string in its Example cell is Bubble’s, not ours. 🔴 Anything the node does not recognise is copied through unchanged, so pasting a moment.js or date-fns pattern like `HH:mm:ss` renders the literal text `HH:mm:ss` rather than a time. That failure is silent and looks like a broken node.'
  },
  {
    id: '143', bubble: 'formatted as JSON safe', type: 'Date',
    example: 'Date1 formatted as JSON safe', bubbleResult: '2023-07-06T12:43:14.649Z',
    answer: { kind: 'node', node: 'Now', prose: 'The same answer as the Any-typed row above: **Now**’s `ISO` output, or **Date To String** for a date you already hold. The corpus has this row twice and left both blank.' }
  },
  {
    id: '144', bubble: '<-range->', type: 'Date',
    example: 'Date2 <-range-> Date1', bubbleResult: '—',
    answer: { kind: 'node', node: 'Date Difference', prose: 'A date range is two dates, and the thing you actually want from it is usually its LENGTH — which is **Date Difference**, `To` minus `From` in the unit you choose. It is signed, so "days until" and "days since" are one node read two ways, and `Absolute` drops the sign.' },
    example_link: 'bubble-how-many-days-until',
    note: '⚠️ Fixed units are NOT rounded: 36 hours is `1.5` days. Round in an Expression and say which way you rounded.'
  },
  {
    id: '145', bubble: '+(seconds) / +(minutes) / +(days) …', type: 'Date',
    example: 'Date1 +(days): 2', bubbleResult: '08/07/2023 14:22',
    answer: { kind: 'node', node: 'Date Add', prose: 'Set **Amount** and **Unit**. A negative amount subtracts. 🔴 Months and years CLAMP: 31 January plus one month is 28 February, never 2 March, and 29 February plus one year is 28 February. Both answers are defensible; the classic date bug is not knowing which one you have.' },
    example_link: 'bubble-how-many-days-until',
    corpusOriginal: {
      kind: 'function',
      code: [
        "let date = Inputs.date;",
        "",
        "// Add 2 seconds",
        "date.setSeconds(date.getSeconds() + 2);",
        "",
        "// Add 2 minutes",
        "date.setMinutes(date.getMinutes() + 2);",
        "",
        "// Add 2 hours",
        "date.setHours(date.getHours() + 2);",
        "",
        "// Add 2 days",
        "date.setDate(date.getDate() + 2);",
        "",
        "// Add 2 months",
        "date.setMonth(date.getMonth() + 2);",
        "",
        "// Add 2 years",
        "date.setFullYear(date.getFullYear() + 2);",
        "",
        "Outputs.date = date;",
        "Outputs.Success()"
      ].join('\n'),
      inputs: { date: new Date(2023, 6, 6, 14, 22, 0) }
    },
    corpusBugKind: 'code',
    corpusBug: 'The corpus answered this with a Function that adds seconds AND minutes AND hours AND days AND months AND years in one pass — six shifts where the row asks for one — and does it with `date.setDate(...)`, which MUTATES the Date object it was handed. A Date arriving on an input is shared, so that write reaches whatever else is reading it.'
  },
  {
    id: '146', bubble: 'change seconds to / change minutes to …', type: 'Date',
    example: 'Date1 change minutes to 0', bubbleResult: '06/07/2023 14:00',
    answer: {
      kind: 'function', node: 'Function',
      code: [
        'const source = new Date(Inputs.Date);',
        '',
        'source.setMinutes(Number(Inputs.Minutes) || 0);',
        'Outputs.NewDate = source;',
        'Outputs.Success();'
      ].join('\n')
    },
    fixture: { inputs: { Date: SAMPLE.Date1, Minutes: 0 }, expect: { NewDate: new Date(2023, 6, 6, 14, 0, 0) }, signals: ['Success'] },
    corpusOriginal: {
      kind: 'function',
      code: [
        "let date = Inputs.date;",
        "",
        "Outputs.newDate = date.setMinutes(0)"
      ].join('\n'),
      inputs: { date: new Date(2023, 6, 6, 14, 22, 0) }
    },
    corpusBugKind: 'code',
    corpusBug: 'Two bugs in two lines. `Outputs.newDate = date.setMinutes(0)` publishes the RETURN of `setMinutes`, which is a millisecond timestamp and not a Date — so everything downstream expecting a date gets a number. And it mutated `Inputs.date` in place, for the same reason as the row above.',
    note: '`new Date(Inputs.Date)` copies before writing. That one line is the whole difference between this and the corpus’s version.'
  },
  {
    id: '147', bubble: '>', type: 'Date',
    example: 'Date1 > Date2', bubbleResult: 'TRUE',
    answer: { kind: 'expression', node: 'Expression', code: 'Date1 > Date2' },
    fixture: { vars: { Date1: SAMPLE.Date1, Date2: SAMPLE.Date2 }, expect: true },
    note: '⚠️ `>` and `<` on Dates work because JavaScript converts them to numbers — but `===` does NOT: two Dates for the same instant are different objects and are never `===`. For equality, and for "the same day" rather than "the same millisecond", use **Date Compare**.'
  },
  {
    id: '148', bubble: '<', type: 'Date',
    example: 'Date1 < Date2', bubbleResult: 'FALSE',
    answer: { kind: 'expression', node: 'Expression', code: 'Date1 < Date2' },
    fixture: { vars: { Date1: SAMPLE.Date1, Date2: SAMPLE.Date2 }, expect: false },
    answer_alt: 'Date Compare',
    example_link: 'bubble-is-this-date-overdue'
  },
  {
    id: '149', bubble: '- :formatted as seconds / minutes / years …', type: 'Date',
    example: 'Date1 - Date2 :formatted as years', bubbleResult: '53',
    answer: { kind: 'node', node: 'Date Difference', prose: 'Set **Unit** to Years. Months and years are counted in whole calendar steps rather than divided by an average year, because a fractional month is not a quantity anyone can check.' },
    example_link: 'bubble-how-many-days-until',
    corpusOriginal: {
      kind: 'function',
      code: [
        "let date1 = Inputs.date1;",
        "let date2 = Inputs.date2;",
        "",
        "let differenceInMilliseconds = date2 - date1;",
        "",
        "let differenceInYears = differenceInMilliseconds / (1000 * 60 * 60 * 24 * 365.25);"
      ].join('\n'),
      inputs: { date1: new Date(1970, 0, 1, 0, 1, 0), date2: new Date(2023, 6, 6, 14, 22, 0) }
    },
    corpusBugKind: 'code',
    corpusBug: 'The corpus’s Function computes `differenceInYears` into a local variable and then ends. It never assigns anything to `Outputs`, so executed, it produces nothing at all — the node runs, reports success, and every wire out of it stays empty.'
  },
  {
    id: '150', bubble: 'extract (minutes, day, date, month)', type: 'Date',
    example: 'Date1 extract month', bubbleResult: '7',
    answer: { kind: 'node', node: 'Date Parts', prose: 'Eleven outputs off one node: `Year`, `Month` (1–12, not JavaScript’s 0–11), `Date`, `Hours`, `Minutes`, `Seconds`, `Milliseconds`, `Day Of Week` (0 is Sunday), `Day Name`, `ISO Week` and `Timestamp`.' },
    example_link: 'bubble-round-a-date-down-to-the-month',
    corpusOriginal: {
      kind: 'function',
      code: [
        "let date1 = Inputs.dates;",
        "",
        "Outputs.day = date1.getDay();"
      ].join('\n'),
      inputs: { dates: new Date(2023, 6, 6, 14, 22, 0) }
    },
    corpusBugKind: 'code',
    corpusBug: 'The corpus’s Function reads `Inputs.dates` into a variable it calls `date1`, then answers with `date1.getDay()` — the day of the WEEK — under an example asking for the month. Two different mistakes in three lines, and `getMonth()` would still have been 6 rather than 7.',
    note: '⚠️ All fields are read in the host’s local zone, which on a server is whatever the container’s TZ says. When the zone is part of the answer, format through **Date To String**’s Timezone input instead.'
  },
  {
    id: '151', bubble: 'rounded down to (second, minute, week …)', type: 'Date',
    example: 'Date1 rounded down to week', bubbleResult: '03/07/2023 00:00',
    answer: { kind: 'node', node: 'Date To String', prose: 'It depends what you want the rounded date FOR, and the two answers are different nodes. For a **key to group by**, use **Date To String** with a format like `{year}-{month}` — its `{month}` is zero-padded, so the keys sort correctly as text. To **compare two dates rounded down**, do not round at all: **Date Compare**’s `Granularity` truncates internally, so "same month" is one setting.' },
    example_link: 'bubble-round-a-date-down-to-the-month',
    note: '🔴 Do not build the key from **Date Parts**: its `Month` is the number 1–12, so September renders `2026-9`, which sorts after `2026-10` as text and quietly scrambles a grouped list. ⚠️ Rounding down to a WEEK has no node — and no agreed answer either: the corpus’s own note says Bubble used to round to Sunday and that Monday is the more sensible international choice. Pick one in an Expression and write down which.'
  },
  {
    id: '152', bubble: 'equals rounded down to (second, month …)', type: 'Date',
    example: 'Date1 equals rounded down to year Date2', bubbleResult: 'FALSE',
    answer: { kind: 'node', node: 'Date Compare', prose: 'Set **Granularity** to Year (or Month, Day, Hour, Minute, Second). It answers `Before`, `After` and `Same` together, as booleans and as signals, and fires exactly one signal per comparison.' },
    example_link: 'bubble-round-a-date-down-to-the-month',
    note: '🔴 Left at the default Millisecond, two instants are essentially never `Same` — which is why an invoice "due today" reports as overdue one millisecond after midnight. Granularity is the whole point of the node.'
  },
  {
    id: '153', bubble: '<-max->', type: 'Date',
    example: 'Date1 <-max-> Date2', bubbleResult: '06/07/2023 14:22',
    answer: { kind: 'expression', node: 'Expression', code: 'Date1 > Date2 ? Date1 : Date2' },
    fixture: { vars: { Date1: SAMPLE.Date1, Date2: SAMPLE.Date2 }, expect: SAMPLE.Date1 },
    note: '⚠️ `max(Date1, Date2)` returns a NUMBER — `Math.max` converts its arguments — so it is the wrong tool when you want a Date back. The conditional keeps the Date object.'
  },
  {
    id: '154', bubble: '<-min->', type: 'Date',
    example: 'Date1 <-min-> Date2', bubbleResult: '01/01/1970 00:01',
    answer: { kind: 'expression', node: 'Expression', code: 'Date1 < Date2 ? Date1 : Date2' },
    fixture: { vars: { Date1: SAMPLE.Date1, Date2: SAMPLE.Date2 }, expect: SAMPLE.Date2 }
  },

  // ── Date Range ─────────────────────────────────────────────────────────────
  {
    id: '155', bubble: ':start', type: 'Date Range',
    example: 'DateRange1 :start', bubbleResult: '01/01/2023 14:00',
    answer: { kind: 'expression', node: 'Expression', code: 'DateRange1[0]' },
    fixture: { vars: { DateRange1: [new Date(2023, 0, 1, 14, 0), new Date(2023, 0, 6, 14, 0)] }, expect: new Date(2023, 0, 1, 14, 0) },
    note: '🔴 **NodeGX has no date-range type.** A range is a two-element array, or two ports, whichever your graph already has — so `:start` is indexing rather than an operator. That is the reason all twelve Date Range rows were blank in the corpus.'
  },
  {
    id: '156', bubble: ':end', type: 'Date Range',
    example: 'DateRange1 :end', bubbleResult: '06/01/2023 14:00',
    answer: { kind: 'expression', node: 'Expression', code: 'DateRange1[1]' },
    fixture: { vars: { DateRange1: [new Date(2023, 0, 1, 14, 0), new Date(2023, 0, 6, 14, 0)] }, expect: new Date(2023, 0, 6, 14, 0) }
  },
  {
    id: '157', bubble: ':center', type: 'Date Range',
    example: 'DateRange1 :center', bubbleResult: '03/01/2023 02:00',
    answer: { kind: 'expression', node: 'Expression', code: 'new Date((DateRange1[0].getTime() + DateRange1[1].getTime()) / 2)' },
    fixture: { vars: { DateRange1: [new Date(2023, 0, 1, 14, 0), new Date(2023, 0, 6, 14, 0)] }, expect: new Date(2023, 0, 4, 2, 0) },
    corpusBugKind: 'result',
    corpusBug: 'Blank in the corpus, but its Notes cell describes the operation correctly — "averaging the start and end". ⚠️ Its stated Result, `03/01/2023 02:00`, is the midpoint of 1 Jan 14:00 and **5** Jan 14:00, not of the `:end` its own `:end` row gives (6 Jan 14:00). The midpoint of the range the corpus defines is 4 Jan 02:00.'
  },
  {
    id: '158', bubble: 'contains range', type: 'Date Range',
    example: 'DateRange1 contains range DateRange2', bubbleResult: 'FALSE',
    answer: { kind: 'expression', node: 'Expression', code: 'DateRange2[0] >= DateRange1[0] && DateRange2[1] <= DateRange1[1]' },
    fixture: {
      vars: {
        DateRange1: [new Date(2023, 0, 1), new Date(2023, 0, 6)],
        DateRange2: [new Date(2023, 0, 4), new Date(2023, 0, 9)]
      },
      expect: false
    },
    note: 'Date comparison with `>=` and `<=` works directly — those operators convert a Date to a number. Only `===` does not.'
  },
  {
    id: '159', bubble: 'contains point', type: 'Date Range',
    example: 'DateRange1 contains (point) Date1', bubbleResult: 'FALSE',
    answer: { kind: 'expression', node: 'Expression', code: 'Date1 >= DateRange1[0] && Date1 <= DateRange1[1]' },
    fixture: { vars: { Date1: SAMPLE.Date1, DateRange1: [new Date(2023, 0, 1), new Date(2023, 0, 6)] }, expect: false },
    note: 'A point is a range of zero length, which is why this is the `overlaps with` identity with both ends of the second range set to the same instant.'
  },
  {
    id: '160', bubble: 'is contained by', type: 'Date Range',
    example: 'DateRange3 is contained by DateRange1', bubbleResult: 'TRUE',
    answer: { kind: 'expression', node: 'Expression', code: 'DateRange3[0] >= DateRange1[0] && DateRange3[1] <= DateRange1[1]' },
    fixture: {
      vars: {
        DateRange3: [new Date(2023, 0, 2), new Date(2023, 0, 4)],
        DateRange1: [new Date(2023, 0, 1), new Date(2023, 0, 6)]
      },
      expect: true
    }
  },
  {
    id: '161', bubble: 'overlaps with', type: 'Date Range',
    example: 'DateRange1 overlaps with DateRange2', bubbleResult: 'TRUE',
    answer: { kind: 'expression', node: 'Expression', code: 'DateRange1[0] <= DateRange2[1] && DateRange1[1] >= DateRange2[0]' },
    fixture: {
      vars: {
        DateRange1: [new Date(2023, 0, 1), new Date(2023, 0, 6)],
        DateRange2: [new Date(2023, 0, 4), new Date(2023, 0, 9)]
      },
      expect: true
    },
    answer_alt: 'Date Compare',
    example_link: 'bubble-do-two-date-ranges-overlap',
    note: '🔴 **This is the row worth reading if you read one.** Two intervals overlap exactly when each starts before the other ends — one identity that also answers `contains point`, `is contained by`, `is after` and `is before`, which is half this section. The worked example builds it out of two **Date Compare** nodes instead of raw `<=`, which is what you want when the granularity matters (two bookings that touch at 10:00 are not a clash) or when an unparseable date must be heard rather than silently read as "no overlap".'
  },
  {
    id: '162', bubble: 'is after', type: 'Date Range',
    example: 'DateRange2 is after DateRange3', bubbleResult: 'TRUE',
    answer: { kind: 'expression', node: 'Expression', code: 'DateRange2[0] > DateRange3[1]' },
    fixture: {
      vars: {
        DateRange2: [new Date(2023, 0, 7), new Date(2023, 0, 9)],
        DateRange3: [new Date(2023, 0, 2), new Date(2023, 0, 4)]
      },
      expect: true
    },
    note: 'Entirely after — the range starts after the other one has ended.'
  },
  {
    id: '163', bubble: 'is after (point)', type: 'Date Range',
    example: 'DateRange2 is after (point) Date2', bubbleResult: 'TRUE',
    answer: { kind: 'expression', node: 'Expression', code: 'DateRange2[0] > Date2' },
    fixture: { vars: { DateRange2: [new Date(2023, 0, 7), new Date(2023, 0, 9)], Date2: SAMPLE.Date2 }, expect: true }
  },
  {
    id: '164', bubble: 'is before', type: 'Date Range',
    example: 'DateRange2 is before DateRange3', bubbleResult: 'FALSE',
    answer: { kind: 'expression', node: 'Expression', code: 'DateRange2[1] < DateRange3[0]' },
    fixture: {
      vars: {
        DateRange2: [new Date(2023, 0, 7), new Date(2023, 0, 9)],
        DateRange3: [new Date(2023, 0, 2), new Date(2023, 0, 4)]
      },
      expect: false
    }
  },
  {
    id: '165', bubble: 'is before (point)', type: 'Date Range',
    example: 'DateRange2 is before (point) Date1', bubbleResult: 'TRUE',
    answer: { kind: 'expression', node: 'Expression', code: 'DateRange2[1] < Date1' },
    fixture: { vars: { DateRange2: [new Date(2023, 0, 7), new Date(2023, 0, 9)], Date1: SAMPLE.Date1 }, expect: true }
  },
  // ── List ───────────────────────────────────────────────────────────────────
  {
    id: '166', bubble: ':unique elements', type: 'List',
    example: 'List1 merged with List2 :unique elements', bubbleResult: 'pink, blue, purple, red, white, cherry/deep-red, apples, bananas, blueberries, yellow',
    answer: { kind: 'expression', node: 'Expression', code: '[...new Set([...List1, ...List2])]' },
    fixture: { vars: { List1: SAMPLE.List1, List2: SAMPLE.List2 }, expect: ['pink', 'blue', 'purple', 'red', 'white', 'cherry/deep-red', 'apples', 'bananas', 'yellow', 'blueberries'] },
    corpusOriginal: {
      kind: 'function',
      code: [
        "const array1 = Inputs.Array1 || [];",
        "const array2 = Inputs.Array2 || [];",
        "",
        "let result = [];",
        "",
        "try {",
        "  const combinedArray = [...array1, ...array2];",
        "  const ids = new Set();",
        "",
        "  combinedArray.forEach(item => {",
        "    if (!ids.has(item.id)) { // Check if id has not been seen before",
        "      ids.add(item.id); // Add id to the set",
        "      result.push(item); // Add item to the result",
        "    }",
        "  });",
        "",
        "  Outputs.Result = result;",
        "  Outputs.Success();",
        "} catch (error) {",
        "  Outputs.error = error;",
        "  Outputs.Failure();",
        "}"
      ].join('\n'),
      inputs: { Array1: SAMPLE.List1, Array2: SAMPLE.List2 }
    },
    corpusBugKind: 'code',
    corpusBug: 'The corpus deduplicated by `item.id` — on a list of colour STRINGS, which have no `.id`. Every item’s id reads `undefined`, the Set sees `undefined` once, and the function returns a single-element array where the row says ten. It is the right code for a list of records and the wrong code for the example beside it.',
    note: 'For a list of RECORDS, dedupe on the key you mean: `[...new Map(items.map((i) => [i.id, i])).values()]` keeps the LAST of each id, and reversing the array first keeps the first.'
  },
  {
    id: '167', bubble: ':count', type: 'List',
    example: 'List1 :count', bubbleResult: '6',
    answer: { kind: 'expression', node: 'Expression', code: 'List1.length' },
    fixture: { vars: { List1: SAMPLE.List1 }, expect: 6 }
  },
  {
    id: '168', bubble: 'contains (a value)', type: 'List',
    example: 'List1 contains "apples"', bubbleResult: 'FALSE',
    answer: { kind: 'expression', node: 'Expression', code: 'List1.includes(Value)' },
    fixture: { vars: { List1: SAMPLE.List1, Value: 'apples' }, expect: false },
    note_corpus: 'The corpus hard-coded the needle as the singular "apple" under an example asking about "apples". Executed, it still answers FALSE and so agrees with the row — it agrees for the wrong reason, and a literal buried inside the expression is a value nobody can wire.',
    note: '`includes` says it more plainly than `some` when you are comparing whole values.'
  },
  {
    id: '169', bubble: 'contains (a record)', type: 'List',
    example: 'List3 contains { "name": "Frank" }', bubbleResult: 'TRUE',
    answer: { kind: 'expression', node: 'Expression', code: 'List3.some((item) => item.name === Name)' },
    fixture: { vars: { List3: SAMPLE.List3, Name: 'Frank' }, expect: true },
    note: '🔴 `List3.includes({name: "Frank"})` is always FALSE — two objects with the same contents are different objects. Comparing records means naming the field you are comparing, which is what `some` does here.'
  },
  {
    id: '170', bubble: "doesn't contain", type: 'List',
    example: 'List3 doesn’t contain { "name": "John" }', bubbleResult: 'TRUE',
    answer: { kind: 'expression', node: 'Expression', code: '!List3.some((item) => item.name === Name)' },
    fixture: { vars: { List3: SAMPLE.List3, Name: 'John' }, expect: true },
    note: 'The corpus answered this with a fifteen-line Function and a `for` loop. It worked; this is the same thing.'
  },
  {
    id: '171', bubble: ':first item', type: 'List',
    example: 'List1 :first item', bubbleResult: 'pink',
    answer: { kind: 'expression', node: 'Expression', code: 'List1[0]' },
    fixture: { vars: { List1: SAMPLE.List1 }, expect: 'pink' }
  },
  {
    id: '172', bubble: ':last item', type: 'List',
    example: 'List1 :last item', bubbleResult: 'cherry/deep-red',
    answer: { kind: 'expression', node: 'Expression', code: 'List1[List1.length - 1]' },
    fixture: { vars: { List1: SAMPLE.List1 }, expect: 'cherry/deep-red' },
    note: '`List1.at(-1)` is the same thing and reads better; both runtimes have it.'
  },
  {
    id: '173', bubble: ':random item', type: 'List',
    example: 'List1 :random', bubbleResult: 'white',
    answer: { kind: 'expression', node: 'Expression', code: 'List1[floor(random() * List1.length)]' },
    fixture: { vars: { List1: SAMPLE.List1 }, expectOneOf: SAMPLE.List1 },
    note: '`random` and `floor` are both pre-defined by the Expression node. ⚠️ `Math.random()` is not cryptographically random — for a token or an id somebody might guess, use the **Random Bytes** or **UUID** node instead.',
    example_link: 'bubble-mint-an-id-and-an-invite-token'
  },
  {
    id: '174', bubble: ':item #', type: 'List',
    example: 'List1 :item #2', bubbleResult: 'blue',
    answer: { kind: 'expression', node: 'Expression', code: 'List1[1]' },
    fixture: { vars: { List1: SAMPLE.List1 }, expect: 'blue' },
    corpusOriginal: {
      kind: 'expression',
      code: [
        "list.slice(1,2) // Slice out item index 1 (2nd item) up to but not including item index 2 (3rd item)"
      ].join('\n'),
      vars: { list: SAMPLE.List1 }
    },
    corpusBugKind: 'code',
    corpusBug: 'The corpus wrote `list.slice(1,2)`, which returns the one-element ARRAY `["blue"]` where Bubble’s `:item #2` returns the item `"blue"`. Wired into a Text it draws `blue` anyway, which is exactly why the mistake survives — it shows up later, when something compares it to a string.',
    note: '⚠️ Bubble counts list items from 1 and JavaScript indexes from 0, so `:item #2` is `[1]`. That off-by-one is the single most common migration bug in this table.'
  },
  {
    id: '175', bubble: ':items until #', type: 'List',
    example: 'List1 :items until 2', bubbleResult: 'pink, blue',
    answer: { kind: 'expression', node: 'Expression', code: 'List1.slice(0, 2)' },
    fixture: { vars: { List1: SAMPLE.List1 }, expect: ['pink', 'blue'] },
    note: '⚠️ The corpus’s version of this row carries a trailing `//` comment and therefore does not compile — see [the warning above](#expression-comments).'
  },
  {
    id: '176', bubble: ':items from #', type: 'List',
    example: 'List1 :items from 5', bubbleResult: 'white, cherry/deep-red',
    answer: { kind: 'expression', node: 'Expression', code: 'List1.slice(4)' },
    fixture: { vars: { List1: SAMPLE.List1 }, expect: ['white', 'cherry/deep-red'] },
    note: 'The same off-by-one as `:item #`: Bubble’s "from 5" is index 4. ⚠️ The corpus’s version carries a trailing `//` comment and does not compile either.'
  },
  {
    id: '177', bubble: 'contains list', type: 'List',
    example: 'List1 contains list List2', bubbleResult: 'FALSE',
    answer: { kind: 'expression', node: 'Expression', code: 'List2.every((value) => List1.includes(value))' },
    fixture: { vars: { List1: SAMPLE.List1, List2: SAMPLE.List2 }, expect: false },
    note: '⚠️ `[].every(...)` is `true` — an empty second list is "contained" by anything. That is usually what you want and occasionally a surprise.'
  },
  {
    id: '178', bubble: ":each item's [value]", type: 'List',
    example: 'List3 :each item’s location', bubbleResult: 'New York, New York, Boston',
    answer: { kind: 'expression', node: 'Expression', code: 'List3.map((item) => item.location)' },
    fixture: { vars: { List3: SAMPLE.List3 }, expect: ['New York', 'New York', 'Boston'] },
    note: 'To render one component per item, do not map at all — that is the **Repeater** node with a template component.'
  },
  {
    id: '179', bubble: ':plus item', type: 'List',
    example: 'List1 :plus item "mauve"', bubbleResult: 'pink, blue, purple, red, white, cherry/deep-red, mauve',
    answer: { kind: 'expression', node: 'Expression', code: '[...List1, Item]' },
    fixture: { vars: { List1: SAMPLE.List1, Item: 'mauve' }, expect: ['pink', 'blue', 'purple', 'red', 'white', 'cherry/deep-red', 'mauve'] },
    corpusOriginal: {
      kind: 'function',
      code: [
        "const list = Inputs.list",
        "",
        "list.push(\"mauve\")"
      ].join('\n'),
      inputs: { list: [...SAMPLE.List1] }
    },
    corpusBugKind: 'code',
    corpusBug: 'The corpus wrote `list.push("mauve")` and assigned nothing to `Outputs`. Executed, the node produces no output at all — and it mutates the array it was handed, so whatever else holds that array is changed underneath it without a change being published.',
    note: '🔴 Build a NEW array rather than pushing. A node that mutates its input in place changes a value nobody was told about, and the nodes watching that array do not re-render because, as far as they can tell, nothing was assigned.'
  },
  {
    id: '180', bubble: ':plus item (into an Array node)', type: 'List',
    example: 'List1 :plus item "mauve"', bubbleResult: 'pink, blue, purple, red, white, cherry/deep-red, mauve',
    answer: { kind: 'function', node: 'Function', code: 'Noodl.Arrays.List1 = Noodl.Arrays.List1.concat(Inputs.Item);\nOutputs.Success();' },
    fixture: { inputs: { Item: 'mauve' }, arrays: { List1: SAMPLE.List1 }, expectArrays: { List1: ['pink', 'blue', 'purple', 'red', 'white', 'cherry/deep-red', 'mauve'] }, signals: ['Success'] },
    note: '`Noodl.Arrays.<id>` reaches a named **Array** node by its id, and assigning a NEW array to it is what publishes the change — `concat` returns one, `push` does not. This is the corpus’s own answer and it is correct; it is here beside the expression because the two solve different problems: one computes a list, this one updates a list the graph already owns.'
  },
  {
    id: '181', bubble: ':minus item', type: 'List',
    example: 'List1 :minus item "pink"', bubbleResult: 'blue, purple, red, white, cherry/deep-red',
    answer: { kind: 'expression', node: 'Expression', code: 'List1.filter((value) => value !== Item)' },
    fixture: { vars: { List1: SAMPLE.List1, Item: 'pink' }, expect: ['blue', 'purple', 'red', 'white', 'cherry/deep-red'] },
    note: '⚠️ `filter` removes EVERY match; Bubble’s `:minus item` removes the item. If duplicates matter, splice by index instead. The corpus answered this with an eighteen-line index-and-rebuild against `Noodl.Arrays`, which does remove only the first.'
  },
  {
    id: '182', bubble: ':minus list', type: 'List',
    example: 'List1 :minus list "pink", "blue"', bubbleResult: 'purple, red, white, cherry/deep-red',
    answer: { kind: 'expression', node: 'Expression', code: 'List1.filter((value) => !Remove.includes(value))' },
    fixture: { vars: { List1: SAMPLE.List1, Remove: ['pink', 'blue'] }, expect: ['purple', 'red', 'white', 'cherry/deep-red'] },
    note: 'The corpus hard-coded both colours into the filter. Taking them on a port is the difference between a node you can reuse and a node you rewrite.'
  },
  {
    id: '183', bubble: 'merged with', type: 'List',
    example: 'List1 merged with List2', bubbleResult: 'pink, blue, purple, red, white, cherry/deep-red, apples, bananas, yellow, blueberries',
    answer: { kind: 'expression', node: 'Expression', code: '[...List1, ...List2]' },
    fixture: { vars: { List1: SAMPLE.List1, List2: SAMPLE.List2 }, expect: ['pink', 'blue', 'purple', 'red', 'white', 'cherry/deep-red', 'apples', 'bananas', 'yellow', 'blueberries'] },
    note: 'Duplicates survive. To drop them, see `:unique elements`.'
  },
  {
    id: '184', bubble: 'intersects with', type: 'List',
    example: 'List1 intersects with List2', bubbleResult: 'blue, red',
    answer: { kind: 'expression', node: 'Expression', code: 'List1.filter((value) => List2.includes(value))' },
    fixture: { vars: { List1: SAMPLE.List1, List2: ['blue', 'red', 'teal'] }, expect: ['blue', 'red'] },
    corpusBugKind: 'result',
    corpusBug: 'The corpus’s stated RESULT is impossible against its own data. It says `List1 intersects with List2` is `blue, red`, but the List2 it defines everywhere else is `apples, bananas, yellow, blueberries` — which shares nothing with List1. The fixture here uses a List2 that actually intersects, because a row whose example cannot produce its own answer teaches nothing.',
    note: 'For records rather than primitives, compare on a key — `List1.filter((a) => List2.some((b) => a.id === b.id))`. The corpus reached for a recursive deep-equal, which is slow and answers a different question than "the same record".'
  },
  {
    id: '185', bubble: ':group by...', type: 'List',
    example: 'List3 grouped by "location" (aggregation: count)', bubbleResult: '2, 1',
    answer: {
      kind: 'function', node: 'Function',
      code: [
        'const items = Inputs.Items || [];',
        'const key = Inputs.Key;',
        'const counts = new Map();',
        '',
        'for (const item of items) {',
        '  counts.set(item[key], (counts.get(item[key]) || 0) + 1);',
        '}',
        '',
        'Outputs.Groups = [...counts].map(([value, count]) => ({ value, count }));',
        'Outputs.Success();'
      ].join('\n')
    },
    fixture: {
      inputs: { Items: SAMPLE.List3, Key: 'location' },
      expect: { Groups: [{ value: 'New York', count: 2 }, { value: 'Boston', count: 1 }] },
      signals: ['Success']
    },
    corpusBugKind: 'missing',
    corpusBug: 'This row is the table’s quietest hole. Its "Noodl node" cell says **Function / Script**, so it does not count among the 32 rows blank in both columns — but its code cell is EMPTY. A reader scanning the node column sees an answered row; the answer was never written.',
    note: 'A `Map` keeps insertion order, so the groups come out in the order the values were first seen — which is what `2, 1` in Bubble’s own result column means.'
  },
  {
    id: '186', bubble: ':filtered', type: 'List',
    example: 'List3 :filtered (name is not Frank)', bubbleResult: 'Jim, Jane',
    answer: { kind: 'expression', node: 'Expression', code: 'List3.filter((item) => item.name !== Name)' },
    fixture: { vars: { List3: SAMPLE.List3, Name: 'Frank' }, expect: [{ name: 'Jim', location: 'New York' }, { name: 'Jane', location: 'Boston' }] },
    answer_alt: 'Array Filter',
    note: 'For a list you are about to render, the **Array Filter** node does this without code, and filters, sorts and limits in one pass. For a list that lives in the database, filter in the **Query Records** node instead — filtering after fetching means fetching everything first.'
  },
  {
    id: '187', bubble: ':sorted', type: 'List',
    example: 'List3 :sorted by name (descending)', bubbleResult: 'Jim, Jane, Frank',
    answer: { kind: 'expression', node: 'Expression', code: '[...List3].sort((a, b) => b.name.localeCompare(a.name))' },
    fixture: { vars: { List3: SAMPLE.List3 }, expect: [{ name: 'Jim', location: 'New York' }, { name: 'Jane', location: 'Boston' }, { name: 'Frank', location: 'New York' }] },
    answer_alt: 'Array Filter',
    note: '🔴 Blank in the corpus, but NodeGX does sort: **Array Filter** sorts in memory as part of its filter settings, and **Query Records** sorts at the query, which is where anything not already in memory should be sorted. ⚠️ `sort` MUTATES — `[...List3]` copies first. And the default comparator sorts as TEXT, so `[10, 9]` sorts to `[10, 9]`; pass a comparator for numbers. `localeCompare` is the one that gets accented names right.'
  },
  {
    id: '188', bubble: ':ranked by', type: 'List',
    example: 'List3 :ranked by numerical similarity to Jane', bubbleResult: 'Jane, Frank, Jim',
    answer: {
      kind: 'none', node: null,
      prose: '**NodeGX has no equivalent and none is invented here.** Bubble’s operator ranks a list by similarity to a value — its own example is *"ranked by numerical similarity to Jane"* — and nothing in the node library does that, nor is there an honest one-liner for it. What to do instead: if you can state the ranking as a NUMBER per item, you have a `:sorted` with a computed key and the row above answers it. If you cannot, the thing you want is a search index or a similarity function, and that is a decision to make deliberately rather than a translation.'
    },
    note: 'Recorded as a product gap by COM-001 AC4, and left as one here rather than filled with something that looks close.'
  },
  {
    id: '189', bubble: ':format as text', type: 'List',
    example: 'List3 :format as text (per item: name) (delimiter: " & ")', bubbleResult: 'Frank & Jim & Jane',
    answer: { kind: 'expression', node: 'Expression', code: 'List3.map((item) => item.name).join(Delimiter)' },
    fixture: { vars: { List3: SAMPLE.List3, Delimiter: ' & ' }, expect: 'Frank & Jim & Jane' },
    answer_alt: 'To CSV',
    example_link: 'bubble-write-a-list-out-as-csv',
    note: '🔴 For a sentence, this is right. For a FILE, it is the version that breaks — a name containing your delimiter, or a note containing a newline, silently produces a file with the wrong number of columns and no error anywhere. Use the **To CSV** node, which quotes any cell that needs it so the output reads back through **Parse CSV** unchanged.'
  }
];

module.exports = { SAMPLE, rows };

