/**
 * Relative timestamp formatting for the history list.
 *
 * Was written out three times — twice in this folder and once in the editor's
 * `CodeHistoryManager` — with three slightly different sets of thresholds.
 *
 * @module code-editor/CodeHistory
 */

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

function time(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Turn an ISO 8601 timestamp into "5 minutes ago", "yesterday at 14:03", and so on.
 */
export function formatTimestamp(timestamp: string): string {
  const then = new Date(timestamp);
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);

  if (seconds < MINUTE) {
    return 'just now';
  }

  if (seconds < HOUR) {
    const minutes = Math.floor(seconds / MINUTE);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  if (seconds < DAY) {
    const hours = Math.floor(seconds / HOUR);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  if (seconds < 2 * DAY) {
    return `yesterday at ${time(then)}`;
  }

  if (seconds < WEEK) {
    return `${Math.floor(seconds / DAY)} days ago`;
  }

  return `${then.toLocaleDateString()} at ${time(then)}`;
}
