// scripts/prebuild-clean.js
// Remove any files that make Next think TypeScript is enabled.
import { existsSync, rmSync } from "node:fs";

const offenders = ["tsconfig.json", "next-env.d.ts"];
const removed = [];
for (const f of offenders) {
  if (existsSync(f)) {
    rmSync(f);
    removed.push(f);
  }
}
console.log(
  removed.length
    ? `Removed stray TS markers: ${removed.join(", ")}`
    : "No TypeScript markers found. Proceeding…"
);
