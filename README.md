# luna-api

## ⚠️ Este repositório está se tornando o Guardian (Storage Manager) da LUNA

Por decisão registrada em `LUNA_CONTEXT.md` (repositório `luna`, §15 — Guardian
MVP-01), este repositório é a residência oficial do **Guardian**: o único
órgão do organismo LUNA autorizado a falar diretamente com mecanismos de
armazenamento. Nome do repositório mantido como `luna-api` por enquanto —
a mudança para um nome como `luna-guardian` fica para um MVP futuro de
reorganização do ecossistema, não nesta etapa.

Esta é uma evolução gradual, não uma reescrita: as rotas legadas (`GET /`,
`GET /api/github/file`, `POST /chat`) continuam funcionando exatamente como
antes, lado a lado com o Guardian novo. Nada foi removido.

## Guardian — o que existe hoje (MVP-01)

`src/guardian/`:
- `contracts.js` — contrato público de armazenamento (JSDoc): `save`,
  `update`, `delete`, `get`, `search`, mais o formato de entrada de
  auditoria (`origin`, `operation`, `at`, `destination`).
- `audit.js` — auditoria injetável (`InMemoryAuditSink` + `GuardianAuditor`),
  mesmo padrão já usado pelo Gateway no monorepo `luna`
  (`src/gateway/audit/audit.ts`).
- `auth.js` — guarda de autenticação por bearer token (`GUARDIAN_SHARED_SECRET`),
  montada em `index.js` na frente de toda rota `/guardian/*`. Achado de
  segurança 2026-09-02 (genesis_pacote_fila id 83): antes desta etapa, a API
  de escrita do Guardian estava em produção sem nenhuma verificação de
  identidade. Fail-closed por desenho — ver seção "Variáveis de ambiente".
- `adapters/supabase-adapter.js` — único módulo autorizado a importar
  `@supabase/supabase-js`. Guardian nunca conhece tabelas/drivers
  diretamente — só fala com este adapter através do contrato genérico.
- `guardian.js` — o Guardian em si: delega ao adapter, registra auditoria em
  cada operação (sucesso ou falha). Nunca decide, nunca infere, nunca
  consolida, nunca reconstrói contexto — isso é do Hipocampo/Context Hub,
  órgãos diferentes, em outro repositório.
- `routes.js` — contrato HTTP público (`POST /guardian/save`, `/update`,
  `/delete`, `GET /guardian/get`, `POST /guardian/search`,
  `GET /guardian/audit`), montado em `index.js`.

Futuros adapters (Postgres puro, Redis, Qdrant, Neo4j, MinIO) implementam o
mesmo contrato sem que o resto do organismo precise saber que a troca
aconteceu.

## Arquitetura da Memória (EXTRACT→FILTER→CLASSIFY, Memory Index)

Implementação de `ARQUITETURA-DA-MEMORIA.md` e `memory_core.alg`
(repositório `Luna-context.md`), na parte que cabe ao Guardian nesta etapa.
Três dimensões independentes por memória — Tipo (fixo na escrita), Maturação/
Camada (evolui — só Camada 1 existe nesta versão) e Estado (ativa/
substituida nesta versão; os demais valores do contrato ainda não têm
transição automática definida pelos arquitetos).

`src/guardian/hipocampo-temp/` — residência **temporária**: estas
responsabilidades pertencem arquiteturalmente ao Hipocampo/Memory Index
(órgãos ainda não implantados de forma independente); vivem aqui só até
existirem como órgãos próprios, e por isso só dependem do contrato do
Guardian (`guardian.save`/`search`/`update`), nunca de
`adapters/supabase-adapter.js` diretamente — extrair este módulo no futuro
não deve exigir reescrever o Guardian.

- `constants.js` — η, μ, τ (≈0.6) fixos; sem loop de feedback adaptativo
  nesta versão (`memory_core.alg` passo 9, adiado).
- `extract.js` — EXTRACT: normaliza sinais (relevância/impacto/entropia)
  fornecidos pelo chamador para o intervalo [0,1].
- `filter.js` — FILTER: `Score = R + ηI − μE`; descarta se `Score < τ`.
- `classify.js` — CLASSIFY: valida o Tipo (episódica/arquitetural/
  preferência/projeto/contextual).
- `memory-pipeline.js` — orquestra EXTRACT→FILTER→CLASSIFY e então chama
  VALIDATE+PERSIST do Guardian (responsabilidade permanente, não migra):
  checagem de duplicação por `chave` explícita (Replacement Policy — marca a
  memória antiga como `substituida` e persiste a nova como `ativa`), rejeita
  entrada sem `conteudo` ou com Tipo inválido.
- `memory-audit.js` — auditoria da decisão do pipeline (sinais, score, tipo,
  status de validação), distinta da auditoria genérica de operação física do
  Guardian (`audit.js`).
- `memory-index.js` — Memory Index: nunca devolve o registro completo, só a
  Impressão Cognitiva Inicial (`id`, `tipo`, `resumo`, `camada`, `estado`,
  `criadoEm`, `ref`). Busca por `tipo`/`estado` no armazenamento; por
  palavra-chave (`q`), em memória — sem busca semântica/vetorial nesta
  versão.
- `metacognicao.js` — Passo 2 (suficiência) da metacognição: como só existe
  Camada 1, é sempre suficiente por definição; não decide nada ainda.
- `routes.js` — `POST /guardian/memory` (pipeline de escrita), `GET
  /guardian/memory/index-search` (Memory Index), `GET /guardian/memory/audit`
  (auditoria de decisão), `POST /guardian/memory/deepen` (501 — contrato
  reservado para Camada 2+, ainda não implementada).

**Fora de escopo nesta versão** (não implementado): consolidação para
Camadas 2+, pesos adaptativos do Perfil Cognitivo, Sistema Imunológico
Cognitivo (CIS/Honeypot/Perícia Forense Cognitiva), busca semântica/vetorial,
extração do Hipocampo/Memory Index para um serviço próprio.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `SUPABASE_URL`, `SUPABASE_KEY` | Adapter do Guardian — usado tanto pelo contrato genérico (`/guardian/save` etc.) quanto pelo pipeline de memória (`/guardian/memory`), mesma instância |
| `GUARDIAN_SHARED_SECRET` | Bearer token exigido em toda rota `/guardian/*` (achado de segurança 2026-09-02, genesis_pacote_fila id 83). Nunca a service key do Supabase — segredo dedicado, próprio deste uso. Fail-closed: sem esta variável configurada, `src/guardian/auth.js` recusa (503) toda requisição às rotas protegidas; com ela configurada, exige `Authorization: Bearer <segredo>` em cada requisição e recusa (401) quando ausente/incorreto |
| `DATABASE_URL` | Só das rotas legadas (`/chat`, tabela `memoria_eventos`) — não usado pelo Guardian |
| `GITHUB_TOKEN`, `REPO_OWNER`, `REPO_NAME` | Só da rota legada `/api/github/file` |
| `PORT` | Porta do servidor (default 3000) |

## Rodando localmente

```bash
npm install
npm test               # testes do Guardian (node:test, sem dependências novas)
npm run test:architecture
npm start
```
