/**
 * Prints the failing audits of one or more raw Lighthouse reports, with the
 * offending element selectors. Read-only.
 *
 * Usage: node tests/qa/lh-failures.mjs <report.json ...> [--audit tap-targets]
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const i = args.indexOf("--audit");
const ONLY = i >= 0 ? args[i + 1] : null;
const files = args.filter((a, idx) => !a.startsWith("--") && idx !== i + 1);

for (const file of files) {
  const report = JSON.parse(readFileSync(file, "utf8"));
  const audits = report.audits;
  const failing = Object.keys(audits).filter((key) => {
    const a = audits[key];
    return (
      a.score !== null &&
      a.score < 1 &&
      !["informative", "notApplicable", "manual", "error"].includes(
        a.scoreDisplayMode,
      )
    );
  });

  console.log(`\n=== ${file.split(/[\\/]/).pop()} ===`);
  for (const key of failing) {
    if (ONLY && !key.startsWith(ONLY)) continue;
    const a = audits[key];
    console.log(`\n[${a.score}] ${key} — ${a.title ?? ""}`);
    const items = a.details?.items ?? [];
    for (const item of items.slice(0, 10)) {
      const node = item.node ?? item.relatedNode ?? item;
      const label = String(
        item.node?.nodeLabel ?? item.nodeLabel ?? item.tapTarget?.nodeLabel ?? "",
      ).slice(0, 50);
      console.log(
        `   ${node.selector ?? "(no selector)"}  |  ${label}  ${
          item.tapTarget ? JSON.stringify(item.tapTarget).slice(0, 140) : ""
        }`,
      );
    }
  }
}
