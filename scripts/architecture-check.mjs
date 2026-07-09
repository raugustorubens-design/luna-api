// Constituição executável do Guardian — mesma disciplina já usada em
// architecture-check.mjs no monorepo `luna` (Convergia, Context Hub):
// verifica invariantes reais via leitura de código-fonte, não por inspeção
// manual.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");

function listFilesRecursive(relativeDir) {
  const absoluteDir = join(root, relativeDir);
  const entries = readdirSync(absoluteDir);
  const files = [];

  for (const entry of entries) {
    if (entry === "__tests__" || entry === "node_modules") continue;
    const entryRelativePath = join(relativeDir, entry);
    const absoluteEntryPath = join(root, entryRelativePath);

    if (statSync(absoluteEntryPath).isDirectory()) {
      files.push(...listFilesRecursive(entryRelativePath));
    } else if (entry.endsWith(".js")) {
      files.push(entryRelativePath);
    }
  }

  return files;
}

// ---- Only the Supabase adapter may import the storage driver ----
const guardianFiles = listFilesRecursive("src/guardian");
assert.ok(guardianFiles.length > 0, "Guardian must exist");

const driverImporters = guardianFiles.filter(
  (path) => /@supabase\/supabase-js/.test(read(path)) && !path.endsWith("adapters/supabase-adapter.js"),
);
assert.deepEqual(
  driverImporters,
  [],
  `Only adapters/supabase-adapter.js may import the storage driver — found in: ${driverImporters.join(", ")}`,
);

// ---- guardian.js never decides, infers, or consolidates ----
const guardianSource = read("src/guardian/guardian.js");
assert.doesNotMatch(
  guardianSource,
  /decideAndConsolidate\(|\binfer\w*\(|\bconsolidat\w*\(/i,
  "Guardian must only execute physical storage operations — never decide/infer/consolidate",
);

// ---- guardian.js never knows table/collection names — only the caller does ----
assert.doesNotMatch(
  guardianSource,
  /memoria_luna|memoria_eventos/,
  "Guardian must stay collection-agnostic — table names are the caller's business, not Guardian's",
);

// ---- The legacy routes (/, /api/github/file, /chat) must stay intact ----
const indexSource = read("index.js");
for (const legacyRoute of ['app.get("/"', 'app.get("/api/github/file"', 'app.post("/chat"']) {
  assert.match(indexSource, new RegExp(legacyRoute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Legacy route must be preserved: ${legacyRoute}`);
}

// ---- index.js must not have the duplicate `const pool` bug again ----
const poolDeclarations = indexSource.match(/const pool = new Pool/g) ?? [];
assert.equal(poolDeclarations.length, 1, "index.js must declare `pool` exactly once (regression guard for the duplicate-declaration bug)");

console.log(`Guardian architecture checks passed (${guardianFiles.length} files scanned).`);
