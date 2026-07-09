import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import pkg from "pg";
import cors from "cors";
import axios from "axios";
import { createGuardianRouter } from "./src/guardian/routes.js";

const { Pool } = pkg;

// ==========================
// APP
// ==========================

const app = express();

// ==========================
// BANCO (CONFIG MANUAL - BLINDADO)
// ==========================
// (Bloco de debug duplicado — mesma configuração declarada duas vezes,
// `const pool` repetido — removido aqui. Era um `SyntaxError` real
// ("Identifier 'pool' has already been declared"), então o arquivo como
// estava commitado não conseguia nem carregar; isto é uma correção de bug,
// não uma mudança de comportamento.)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

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
// TESTE DE CONEXÃO
// ==========================

async function testarConexao() {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Conectado ao banco com sucesso");
  } catch (err) {
    console.error("❌ Erro ao conectar no banco:", err.message);
  }
}

// ==========================
// OPENAI (DESATIVADO)
// ==========================

console.log("⚠️ OpenAI desativado");

// ==========================
// GITHUB CONFIG
// ==========================

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;

// ==========================
// ROTA GITHUB
// ==========================

app.get("/api/github/file", async (req, res) => {
  try {
    const { path } = req.query;

    if (!path) {
      return res.status(400).json({ error: "path é obrigatório" });
    }

    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    const content = Buffer.from(response.data.content, "base64").toString("utf-8");

    res.json({
      path,
      content,
      sha: response.data.sha,
    });

  } catch (error) {
    console.error("🔥 ERRO GITHUB:", error.response?.data || error.message);

    res.status(500).json({
      error: "Erro ao buscar arquivo no GitHub"
    });
  }
});

// ==========================
// CRIAR TABELA
// ==========================

async function criarTabelaSeNaoExistir() {
  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS memoria_eventos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT,
        conteudo TEXT,
        tipo TEXT,
        criado_em TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("✅ Tabela memoria_eventos pronta");
  } catch (err) {
    console.error("❌ Erro ao criar tabela:", err.message);
  }
}

// ==========================
// ROTA /chat
// ==========================

app.post("/chat", async (req, res) => {
  try {
    const message = req.body.message || req.body.mensagem;
    const contexto = req.body.contexto || "sem contexto";
    const user_id = req.body.user_id || "default";

    if (!message) {
      return res.status(400).json({ erro: "message é obrigatório" });
    }

    let tipo = null;

    if (message.toLowerCase().includes("erro")) {
      tipo = "erro";
    }

    let memoriaSalva = false;

    if (tipo) {
      await pool.query(
        `INSERT INTO memoria_eventos (user_id, conteudo, tipo)
         VALUES ($1, $2, $3)`,
        [user_id, message, tipo]
      );

      memoriaSalva = true;
    }

    const resultado = await pool.query(
      `SELECT conteudo, tipo, criado_em
       FROM memoria_eventos
       WHERE user_id = $1
       ORDER BY criado_em DESC
       LIMIT 5`,
      [user_id]
    );

    const memorias = resultado.rows;

    const resposta = `
🧠 Contexto: ${contexto}

💬 Você disse: "${message}"

${memoriaSalva ? "💾 Salvei isso na memória." : ""}

📚 Últimas memórias:
${memorias.map(m => `- (${m.tipo}) ${m.conteudo}`).join("\n") || "Nenhuma"}
`;

    res.json({
      reply: resposta,
      memorias
    });

  } catch (error) {
    console.error("🔥 ERRO /chat:", error.message);

    res.status(500).json({
      erro: error.message
    });
  }
});

// ==========================
// GUARDIAN (MVP-01)
// ==========================
// Contrato HTTP público do Guardian — save/update/delete/get/search +
// auditoria. Não conhece `memoria_eventos`/`pool` acima; fala com o
// armazenamento só através do seu próprio SupabaseAdapter (ver
// src/guardian/). Preparado para consumo futuro (ex.: Memory Engine do
// monorepo `luna`, hoje ainda local) — não significa que já está em uso em
// produção nesta etapa.
app.use(createGuardianRouter());

// ==========================
// START
// ==========================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", async () => {
  console.log("🚀 Luna rodando na porta " + PORT);

  await testarConexao();
  await criarTabelaSeNaoExistir();
});
