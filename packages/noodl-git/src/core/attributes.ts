import path from 'path';
import fs from 'fs';

export interface AppendGitAttributesOptions {
  /**
   * Lines an entry in `newItems` replaces. A line listed here is rewritten in
   * place rather than left behind as a duplicate — see
   * `NOODL_SUPERSEDED_GRAPH_ATTRIBUTES`, where LEG-004 turns `merge=noodl` into
   * `merge=noodl diff=noodl` in every repository the editor has ever set up.
   *
   * Matching is on the leading pattern (everything before the first space), so
   * an entry only ever replaces a line about the same paths.
   */
  supersedes?: string[];
}

function patternOf(line: string): string {
  const trimmed = line.trim();
  const space = trimmed.search(/\s/);
  return space === -1 ? trimmed : trimmed.slice(0, space);
}

export async function appendGitAttributes(
  repositoryDir: string,
  newItems: string[],
  options: AppendGitAttributesOptions = {}
) {
  const gitAttributesPath = path.join(repositoryDir, '.gitattributes');
  const content = fs.existsSync(gitAttributesPath)
    ? await fs.promises.readFile(gitAttributesPath, { encoding: 'utf-8' })
    : '';

  const endsWithNewline = content.length === 0 || /\r?\n$/.test(content);
  const lines = content.replace(/\r?\n$/, '').split('\n').map((x) => x.trim());
  const existing = content.length === 0 ? [] : lines;

  const superseded = new Set((options.supersedes ?? []).map((x) => x.trim()));
  const wanted = newItems.map((x) => x.trim());

  // A superseded line is replaced by whichever new item declares the same
  // pattern; anything else keeps its position and its text.
  const replacement = new Map<string, string>();
  for (const item of wanted) {
    if (item.startsWith('#') || item.length === 0) continue; // comments own no pattern
    replacement.set(patternOf(item), item);
  }

  let rewritten = false;
  const upgraded = existing.map((line) => {
    if (!superseded.has(line)) return line;
    const next = replacement.get(patternOf(line));
    if (!next || next === line) return line;
    rewritten = true;
    return next;
  });

  const present = new Set(upgraded);
  const missing = wanted.filter((text) => !present.has(text));

  if (rewritten) {
    // One write, so a rewrite plus an append cannot leave a half-updated file.
    const all = upgraded.concat(missing);
    await fs.promises.writeFile(gitAttributesPath, all.join('\r\n') + '\r\n', { encoding: 'utf-8' });
    return;
  }

  if (missing.length > 0) {
    // A file whose last line has no terminator would otherwise absorb the first
    // appended line into it.
    const prefix = endsWithNewline ? '' : '\r\n';
    await fs.promises.appendFile(gitAttributesPath, prefix + missing.join('\r\n') + '\r\n');
  }
}
