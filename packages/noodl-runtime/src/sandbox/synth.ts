/**
 * AIX-008 — Sandbox preview: value synthesis
 *
 * Turning a field *name* into a plausible value. This is the floor, not the
 * ceiling: when the authoring model supplies `sample_data` the sandbox serves
 * that instead, because "The Left Hand of Darkness" tells the user more about
 * their book list than "Title 1" ever will. What this module guarantees is that
 * the preview is never empty and never blank — every field the graph reads gets
 * *something* shaped like the thing it is.
 *
 * Everything here is deterministic (index-derived, never random) so a preview
 * looks the same on every re-render and specs can assert exact values.
 *
 * Shared by the editor (which builds the dataset) and the runtime (which serves
 * it, and fills in classes the editor did not predict).
 *
 * @module noodl-runtime/sandbox/synth
 */

import { SANDBOX_RECORD_FLAG, type SandboxRecord } from './types';

const WORDS = [
  'Northern',
  'Quiet',
  'Amber',
  'Copper',
  'Meridian',
  'Harbour',
  'Ivory',
  'Silver',
  'Hollow',
  'Marbled'
];

const NOUNS = ['Atlas', 'Signal', 'Garden', 'Compass', 'Ledger', 'Beacon', 'Orchard', 'Lantern', 'Quarry', 'Anchor'];

const FIRST_NAMES = ['Ada', 'Ines', 'Milo', 'Rune', 'Sara', 'Tomas', 'Nadia', 'Oscar', 'Lena', 'Jonas'];
const LAST_NAMES = ['Beck', 'Nour', 'Ferrer', 'Okafor', 'Lindqvist', 'Mehta', 'Duarte', 'Halvorsen', 'Roy', 'Ivanov'];

const SENTENCES = [
  'A short summary that stands in for the real copy.',
  'Written to show how the layout behaves at this length.',
  'Long enough to wrap onto a second line in a narrow column.',
  'Kept deliberately plain so the design does the talking.',
  'Sample text — replaced by whatever your data actually says.'
];

const STATUSES = ['Active', 'Pending', 'Archived', 'Draft', 'Complete'];
const CATEGORIES = ['General', 'Design', 'Finance', 'Research', 'Operations'];
const CITIES = ['Lisbon', 'Malmö', 'Kyoto', 'Bristol', 'Valparaíso'];

const PLACEHOLDER_HUES = [210, 32, 160, 280, 12, 195];

function pick<T>(list: T[], index: number): T {
  return list[((index % list.length) + list.length) % list.length];
}

/** Words in a field name, lower-cased: `coverImageUrl` → ['cover','image','url']. */
function tokens(field: string): string[] {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/** `first_name` → `First name`. Used as the last-resort value and as image captions. */
export function humanizeField(field: string): string {
  const parts = tokens(field);
  if (parts.length === 0) return field;
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + (parts.length > 1 ? ' ' + parts.slice(1).join(' ') : '');
}

function has(parts: string[], ...candidates: string[]): boolean {
  return candidates.some((c) => parts.includes(c));
}

/**
 * A soft placeholder image as an inline SVG data URI — no network, no CSP
 * surprises, and it reads as "placeholder" at a glance rather than pretending
 * to be a photograph.
 */
export function placeholderImage(label: string, index: number): string {
  const hue = pick(PLACEHOLDER_HUES, index);
  const caption = label.slice(0, 18).replace(/[<>&"]/g, '');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue} 62% 72%)"/>` +
    `<stop offset="1" stop-color="hsl(${(hue + 40) % 360} 58% 52%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="480" height="360" fill="url(#g)"/>` +
    `<text x="240" y="192" text-anchor="middle" font-family="system-ui,sans-serif" font-size="26" ` +
    `fill="rgba(255,255,255,0.92)">${caption}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function isoDate(index: number, offsetDays: number): string {
  // A fixed epoch keeps previews stable; dates march backwards from it so a
  // list sorted by date looks like a list sorted by date.
  const base = Date.UTC(2026, 0, 15, 9, 30, 0);
  return new Date(base - (index + offsetDays) * 86400000).toISOString();
}

/**
 * A plausible value for one field. `index` is the record's position, which is
 * what makes five records look like five different records.
 */
export function synthesizeValue(field: string, index: number): unknown {
  const parts = tokens(field);
  const name = field.toLowerCase();

  if (name === 'objectid' || name === 'id' || name === '_id') return `sandbox-${index + 1}`;

  // `isPublished` is a flag, `publishedAt` is a date — the prefix decides, and
  // it has to decide before the word lists get a look at "published".
  if (/^(is|has|can|should|was|are)[A-Z_]/.test(field)) return index % 3 !== 1;

  if (has(parts, 'image', 'photo', 'avatar', 'thumbnail', 'thumb', 'cover', 'picture', 'banner', 'logo', 'icon')) {
    return placeholderImage(humanizeField(field), index);
  }
  if (has(parts, 'email') || name.endsWith('mail')) {
    return `${pick(FIRST_NAMES, index).toLowerCase()}.${pick(LAST_NAMES, index).toLowerCase()}@example.com`;
  }
  if (has(parts, 'url', 'link', 'href', 'website', 'site')) return `https://example.com/${pick(NOUNS, index).toLowerCase()}`;
  if (has(parts, 'phone', 'mobile', 'tel')) return `+46 70 ${100 + index} ${40 + index} ${11 + index}`;
  if (has(parts, 'password', 'token', 'secret', 'key')) return '••••••••';
  if (has(parts, 'color', 'colour')) return `hsl(${pick(PLACEHOLDER_HUES, index)} 60% 55%)`;

  // "first"/"last" only read as name parts next to a name word — `lastLogin` is
  // not a surname.
  const nameish = has(parts, 'name', 'firstname', 'lastname', 'surname');
  if (nameish && has(parts, 'first', 'given', 'firstname')) return pick(FIRST_NAMES, index);
  if (nameish && has(parts, 'last', 'family', 'surname', 'lastname')) return pick(LAST_NAMES, index);
  if (has(parts, 'username', 'handle', 'nickname')) {
    return `${pick(FIRST_NAMES, index).toLowerCase()}${index + 1}`;
  }
  if (has(parts, 'author', 'owner', 'user', 'customer', 'member', 'contact', 'person', 'assignee')) {
    return `${pick(FIRST_NAMES, index)} ${pick(LAST_NAMES, index)}`;
  }
  if (has(parts, 'name', 'title', 'heading', 'label', 'subject')) {
    return `${pick(WORDS, index)} ${pick(NOUNS, index + 3)}`;
  }

  if (has(parts, 'description', 'summary', 'body', 'content', 'text', 'bio', 'note', 'notes', 'message', 'comment')) {
    return pick(SENTENCES, index);
  }

  if (has(parts, 'price', 'amount', 'cost', 'total', 'subtotal', 'salary', 'fee', 'balance', 'revenue')) {
    return Math.round((19.5 + index * 17.25) * 100) / 100;
  }
  if (has(parts, 'rating', 'score', 'stars')) return Math.min(5, 3 + (index % 3) * 0.5);
  if (has(parts, 'count', 'quantity', 'qty', 'stock', 'views', 'likes', 'comments', 'age', 'number', 'num')) {
    return 3 + index * 7;
  }
  if (has(parts, 'percent', 'percentage', 'progress')) return Math.min(100, 12 + index * 19);

  if (has(parts, 'date', 'time', 'at', 'deadline', 'due', 'published', 'created', 'updated', 'birthday')) {
    return isoDate(index, has(parts, 'due', 'deadline') ? -14 : 0);
  }

  if (has(parts, 'status', 'state')) return pick(STATUSES, index);
  if (has(parts, 'category', 'type', 'kind', 'group', 'tag', 'topic', 'role', 'department')) return pick(CATEGORIES, index);
  if (has(parts, 'city', 'town', 'country', 'location', 'address', 'place')) return pick(CITIES, index);

  if (has(parts, 'enabled', 'active', 'done', 'completed', 'visible', 'verified', 'featured', 'archived', 'public')) {
    return index % 3 !== 1;
  }

  return `${humanizeField(field)} ${index + 1}`;
}

/** Fields every record carries, whatever the graph asked for. */
function baseRecord(index: number): SandboxRecord {
  const id = `sandbox-${index + 1}`;
  return {
    objectId: id,
    id,
    createdAt: isoDate(index, 30),
    updatedAt: isoDate(index, 0),
    [SANDBOX_RECORD_FLAG]: true
  } as SandboxRecord;
}

/** One record for `className`, filling every field the graph reads. */
export function synthesizeRecord(fields: string[], index: number): SandboxRecord {
  const record = baseRecord(index);
  for (const field of fields) {
    if (!field || field in record) continue;
    record[field] = synthesizeValue(field, index);
  }
  return record;
}

export function synthesizeRecords(fields: string[], count: number): SandboxRecord[] {
  const records: SandboxRecord[] = [];
  for (let i = 0; i < count; i++) records.push(synthesizeRecord(fields, i));
  return records;
}

/**
 * Fill a partial record — an agent-authored one — so a field the model forgot
 * still renders. Agent values always win; nothing supplied is overwritten.
 */
export function completeRecord(partial: Record<string, unknown>, fields: string[], index: number): SandboxRecord {
  const record = synthesizeRecord(fields, index);
  for (const [key, value] of Object.entries(partial)) {
    if (value !== undefined) record[key] = value;
  }
  if (typeof record.objectId !== 'string') record.objectId = `sandbox-${index + 1}`;
  record.id = record.objectId;
  return record;
}

/** The user the sandbox is signed in as. Obviously fake, deliberately. */
export function sandboxUser(): SandboxRecord {
  return {
    ...baseRecord(0),
    objectId: 'sandbox-user',
    id: 'sandbox-user',
    username: 'sample.user@example.com',
    email: 'sample.user@example.com',
    emailVerified: true,
    name: 'Sample User',
    firstName: 'Sample',
    lastName: 'User',
    sessionToken: 'r:sandbox-session',
    profileImage: placeholderImage('Sample User', 2)
  } as SandboxRecord;
}
