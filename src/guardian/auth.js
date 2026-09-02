import { timingSafeEqual } from "node:crypto";

/**
 * Guarda de autenticação do Guardian -- achado de segurança 2026-09-02
 * (genesis_pacote_fila id 83): a API de escrita do Guardian estava
 * implantada em produção, pública na internet (Railway "strong-celebration"),
 * sem nenhuma verificação de identidade -- qualquer um na internet podia
 * ler/escrever/atualizar/apagar qualquer coleção do banco que sustenta a
 * memória inteira da LUNA.
 *
 * Bearer token dedicado (nunca a service key do Supabase), mesmo padrão já
 * registrado para o MCP da LUNA (GENESIS/pacotes/
 * 2026-08-31-divergencia-vx-grafico-e-mcp.md, Parte 3: "Auth: bearer token
 * dedicado (variável de ambiente própria...), nunca a service key do
 * Supabase. Sem token válido, 401 -- o MCP nunca é rota aberta").
 *
 * Fail-closed por desenho: se `GUARDIAN_SHARED_SECRET` não estiver
 * configurado, TODA requisição às rotas protegidas é recusada (503) -- a
 * ausência da variável nunca reabre a porta por omissão. Isto é o oposto
 * do tratamento tolerante de GUARDIAN_BASE_URL do lado cliente (ADR-005,
 * luna-core/src/gateway/organs/guardian-config.ts): lá, ausência = a
 * capability cliente falha quando executada; aqui, ausência = o servidor
 * nunca aceita nenhuma requisição às rotas protegidas.
 */
export function requireGuardianToken(secret = process.env.GUARDIAN_SHARED_SECRET) {
  return function guardianAuth(req, res, next) {
    if (!secret) {
      res.status(503).json({
        error:
          "GUARDIAN_SHARED_SECRET não está configurado -- Guardian recusa toda requisição às rotas protegidas até ser configurado (fail-closed, nunca aberto por omissão)",
      });
      return;
    }

    const header = req.headers["authorization"];
    const provided =
      typeof header === "string" && header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

    if (!provided || !constantTimeEqual(provided, secret)) {
      res.status(401).json({ error: "Token de autenticação do Guardian ausente ou inválido" });
      return;
    }

    next();
  };
}

function constantTimeEqual(a, b) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  // timingSafeEqual exige buffers do mesmo tamanho -- comparar tamanho antes
  // já vaza 1 bit (o comprimento), aceitável: o que importa é não vazar o
  // conteúdo do segredo por tempo de comparação byte a byte.
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
