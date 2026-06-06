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

let progressActive = false;
let progressCount = 0;

function flushProgress(): void {
  if (progressActive) {
    process.stderr.write("\n");
    progressActive = false;
  }
}

export const log = {
  info: (msg: string) => {
    flushProgress();
    console.log(msg);
  },
  step: (msg: string) => {
    flushProgress();
    console.log(`${color.cyan("›")} ${msg}`);
  },
  ok: (msg: string) => {
    flushProgress();
    console.log(`${color.green("✔")} ${msg}`);
  },
  warn: (msg: string) => {
    flushProgress();
    console.warn(`${color.yellow("!")} ${msg}`);
  },
  error: (msg: string) => {
    flushProgress();
    console.error(`${color.red("✗")} ${msg}`);
  },
  debug: (msg: string) => {
    if (verbose) console.error(color.dim(`  ${msg}`));
  },
  /** Lightweight inline progress: a dim dot per agent tool call, on one line. */
  progress: (label: string) => {
    if (verbose) {
      console.error(color.dim(`  · ${label}`));
      return;
    }
    if (!progressActive) {
      process.stderr.write(color.dim("  working "));
      progressActive = true;
      progressCount = 0;
    }
    progressCount++;
    process.stderr.write(color.dim("."));
    if (progressCount % 50 === 0) process.stderr.write(color.dim("\n  working "));
  },
};
