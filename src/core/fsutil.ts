import { readFileSync, existsSync, statSync, readdirSync, mkdirSync, copyFileSync, chmodSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

/** Copy a file or directory tree from `src` to `dest`, creating parent dirs. */
export function copyPath(src: string, dest: string, mode?: string): void {
  if (!existsSync(src)) throw new Error(`source path does not exist: ${src}`);
  if (statSync(src).isDirectory()) {
    ensureDir(dest);
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      copyPath(join(src, entry.name), join(dest, entry.name), entry.isFile() ? mode : undefined);
    }
  } else {
    ensureDir(dirname(dest));
    copyFileSync(src, dest);
    if (mode) chmodSync(dest, parseInt(mode, 8));
  }
}

export function readText(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

/** Replace `{{KEY}}` placeholders. Unknown placeholders are left untouched for the agent to fill. */
export function substitute(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key]! : whole,
  );
}

export { resolve, join };
