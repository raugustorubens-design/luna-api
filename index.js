import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import cors from "cors";
import { createGuardian } from "./src/guardian/guardian.js";
import { createGuardianRouter } from "./src/guardian/routes.js";
import { createMemoryRouter } from "./src/guardian/hipocampo-temp/routes.js";

// ==========================
// APP
// ==========================

const app = express();

// ==========================
// CONFIG BASE
// ==========================

app.use(cors());
app.use(express.json());

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
const guardian = createGuardian();
app.use(createGuardianRouter(guardian));
app.use(createMemoryRouter(guardian));

// ==========================
// START
// ==========================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Luna rodando na porta " + PORT);
});
