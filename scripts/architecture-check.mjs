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

// ---- The root route must stay intact ----
const indexSource = read("index.js");
assert.match(indexSource, /app\.get\("\/"/, 'Legacy route must be preserved: app.get("/"');

// ---- ADR-012: /chat, /api/github/file e o pool `pg` cru foram
// descontinuados — o Guardian oficial (rotas /guardian/*) é o único papel
// deste serviço agora; o backend único de chat/contexto passou a ser
// luna-core (ADR-012 Decisão 1). Regression guard na direção oposta do que
// havia antes: essas rotas/dependência não devem voltar a aparecer aqui.
for (const removedRoute of ['app.get("/api/github/file"', 'app.post("/chat"']) {
  assert.doesNotMatch(
    indexSource,
    new RegExp(removedRoute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Rota legada descontinuada (ADR-012) não deve reaparecer: ${removedRoute}`,
  );
}
assert.doesNotMatch(
  indexSource,
  /\bnew Pool\(|from ["']pg["']/,
  "index.js não deve voltar a depender de `pg`/Pool diretamente (ADR-012 — descontinuado junto com /chat)",
);

// ---- hipocampo-temp/ (EXTRACT/FILTER/CLASSIFY, Memory Index) must only talk
// to storage through the Guardian's own contract, never a driver directly ----
const hipocampoTempFiles = guardianFiles.filter((path) => path.includes("hipocampo-temp/") && !path.endsWith("routes.js"));
for (const path of hipocampoTempFiles) {
  assert.doesNotMatch(
    read(path),
    /from ["'][^"']*adapters\/supabase-adapter[^"']*["']/,
    `${path} must depend only on the Guardian's contract (save/search/update), never the storage adapter directly`,
  );
}

console.log(`Guardian architecture checks passed (${guardianFiles.length} files scanned).`);
