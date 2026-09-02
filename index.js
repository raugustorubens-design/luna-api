import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import cors from "cors";
import { createGuardian } from "./src/guardian/guardian.js";
import { createGuardianRouter } from "./src/guardian/routes.js";
import { createMemoryRouter } from "./src/guardian/hipocampo-temp/routes.js";
import { requireGuardianToken } from "./src/guardian/auth.js";

// ==========================
// APP
// ==========================

const app = express();

// ==========================
// CONFIG BASE
// ==========================

app.use(cors());
// Default Express body limit is 100kb — base64 already inflates a binary
// file by ~33%, so any real image/certificate upload (Convergia visual
// templates included) blows past that and gets rejected with 413 before
// ever reaching the Guardian. 20mb matches `MAX_SYNC_FILE_SIZE_BYTES`
// already used in luna-core (Convergia, large-file routing) — same order
// of magnitude already adopted in the project, not a new number.
app.use(express.json({ limit: "20mb" }));

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

// ==========================
// ROOT
// ==========================

app.get("/", (req, res) => {
  res.send("🚀 Luna API online");
});

// ==========================
// GUARDIAN (MVP-01 + Arquitetura da Memória)
// ==========================
// Uma única instância do Guardian, compartilhada entre o contrato genérico
// de armazenamento (save/update/delete/get/search + auditoria) e o pipeline
// de memória (EXTRACT→FILTER→CLASSIFY→VALIDATE→PERSIST + Memory Index) —
// para que ambos falem com o mesmo adapter e a mesma trilha de auditoria.
//
// Achado de segurança 2026-09-02 (genesis_pacote_fila id 83): toda rota
// /guardian/* (contrato genérico e pipeline de memória) exige bearer token
// dedicado -- GUARDIAN_SHARED_SECRET -- antes desta etapa, qualquer um na
// internet podia ler/escrever/apagar qualquer coleção. Fail-closed: 503 se
// o segredo não estiver configurado no servidor, 401 se o token estiver
// ausente/errado. Montado antes dos dois routers para interceptar as duas
// famílias de rota (ambas começam em /guardian/); GET / continua público.
const guardian = createGuardian();
app.use("/guardian", requireGuardianToken());
app.use(createGuardianRouter(guardian));
app.use(createMemoryRouter(guardian));

// ==========================
// START
// ==========================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Luna rodando na porta " + PORT);
});
