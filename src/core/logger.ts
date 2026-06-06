const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: string, s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const color = {
  bold: (s: string) => c("1", s),
  dim: (s: string) => c("2", s),
  red: (s: string) => c("31", s),
  green: (s: string) => c("32", s),
  yellow: (s: string) => c("33", s),
  cyan: (s: string) => c("36", s),
};

let verbose = false;
export function setVerbose(v: boolean): void {
  verbose = v;
}
export function isVerbose(): boolean {
  return verbose;
}

export const log = {
  info: (msg: string) => console.log(msg),
  step: (msg: string) => console.log(`${color.cyan("›")} ${msg}`),
  ok: (msg: string) => console.log(`${color.green("✔")} ${msg}`),
  warn: (msg: string) => console.warn(`${color.yellow("!")} ${msg}`),
  error: (msg: string) => console.error(`${color.red("✗")} ${msg}`),
  debug: (msg: string) => {
    if (verbose) console.error(color.dim(`  ${msg}`));
  },
  /** A dim, indented activity line (written to stderr so it doesn't pollute --json stdout). */
  activity: (msg: string) => console.error(color.dim(`  ${msg}`)),
};
