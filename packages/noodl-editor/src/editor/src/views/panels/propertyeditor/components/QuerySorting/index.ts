/**
 * The Parse-family **sorting** editor.
 *
 * ⚠️ **This directory used to be `QueryEditor/`, and it used to hold a filter
 * builder too.** BCN-003b retired that half — `ByobFilterBuilder` renders for
 * both filter ports now — and the spec's instruction to "delete `QueryEditor/`"
 * could not be followed literally, because the sorting UI lives here and
 * sorting is explicitly out of that task's scope. What is left is sorting and
 * the three pieces it shared with the builder that is gone: `QueryRulePopup`,
 * `RuleDropdown` and `RuleInput`.
 *
 * Renamed rather than left, so that what it holds and what it is called are the
 * same thing.
 */

import { QuerySortingEditor } from './QuerySortingEditor/QuerySortingEditor';

require('../../../../../styles/propertyeditor/queryeditor.css');

export default {
  Sorting: QuerySortingEditor
};
