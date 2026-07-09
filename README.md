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

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `SUPABASE_URL`, `SUPABASE_KEY` | Adapter do Guardian (mesma convenção já usada pelo Memory Engine no monorepo `luna`) |
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
