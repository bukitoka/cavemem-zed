import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

/**
 * Read a JSON file that may contain JavaScript-style comments (JSONC).
 * Strips comments (preserving strings that contain `//` or `/*` like URLs)
 * and removes trailing commas before parsing.
 */
export function readJsonc<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    const raw = readFileSync(path, 'utf8');

    // Capture JSON strings first so we don't mangle content inside them.
    // A JSON string starts with " and ends with an unescaped ".
    const strings: string[] = [];
    const placeholders = raw.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
      strings.push(match);
      return `__JSONC_STR_${strings.length - 1}__`;
    });

    // Strip line and block comments from the non-string parts.
    const noComments = placeholders
      .replace(/\/\/.*$/gm, '') // line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // block comments

    // Strip trailing commas before } and ] (valid in JSONC, invalid in JSON).
    const noTrailingCommas = noComments.replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']');

    // Restore strings.
    const restored = noTrailingCommas.replace(
      /__JSONC_STR_(\d+)__/g,
      (_, idx) => strings[Number(idx)] ?? '',
    );

    return JSON.parse(restored) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/**
 * Write a JSON file, backing up any existing file first.
 * The backup is written as `<path>.pre-cavemem-<unix-ts>` so the user
 * can always recover if something goes wrong.
 */
export function writeJsonWithBackup(path: string, data: unknown): void {
  if (existsSync(path)) {
    const backup = join(dirname(path), `${basename(path)}.pre-cavemem-${Date.now()}`);
    copyFileSync(path, backup);
  }
  writeJson(path, data);
}

/**
 * Quote a path for embedding into a shell command string (e.g., Claude
 * Code hook `command` fields). Wraps in double quotes unless the path is
 * already a bare token with no whitespace, shell metacharacters, or
 * backslashes. Backslashes are excluded from the bare-token whitelist
 * because MSYS-bash (the shell Claude Code uses on Windows when launched
 * from the desktop app) treats unquoted backslashes as escape introducers
 * and strips them. Double-quoted, both cmd.exe and MSYS-bash preserve
 * backslashes verbatim.
 */
export function shellQuote(p: string): string {
  if (/^[\w@%+=:,./-]+$/.test(p)) return p;
  return `"${p.replace(/"/g, '\\"')}"`;
}

export function deepMerge<T>(base: T, add: Partial<T>): T {
  const out = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(add as Record<string, unknown>)) {
    const existing = out[k];
    if (
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing) &&
      v &&
      typeof v === 'object' &&
      !Array.isArray(v)
    ) {
      out[k] = deepMerge(existing as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
