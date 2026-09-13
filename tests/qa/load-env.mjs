// Load `.env.test` (repo root) into process.env for QA scripts.
// Secrets must never be hardcoded in tests/qa/*.mjs. Put them in `.env.test`
// (gitignored) instead. Import this module FIRST in any QA script that needs
// credentials, before importing modules that read process.env at load time.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envTestPath = path.resolve(here, "..", "..", ".env.test");

function loadEnvTest() {
  if (!existsSync(envTestPath)) {
    throw new Error(
      `Missing ${envTestPath}. Copy .env.test.example to .env.test and fill in the real QA credentials.`
    );
  }
  const raw = readFileSync(envTestPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(
      /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/
    );
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvTest();