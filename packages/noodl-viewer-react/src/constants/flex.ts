/**
 * The values a `flex-direction` enum port offers.
 *
 * Both the four real directions and the four CSS-wide keywords, because these are
 * fed straight into an editor enum whose options are whatever CSS accepts.
 */
export const flexDirectionValues = [
  'row',
  'row-reverse',
  'column',
  'column-reverse',
  'inherit',
  'initial',
  'revert',
  'unset'
] as const;

export type FlexDirectionValue = (typeof flexDirectionValues)[number];
