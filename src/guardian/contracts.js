/**
 * Guardian MVP-01 — contrato público de armazenamento.
 *
 * O resto do organismo (Memory Engine, e futuramente qualquer outro
 * consumidor autorizado) depende só disto — nunca de um adapter específico,
 * nunca de um driver de banco. Guardian é o único responsável pela
 * comunicação física com mecanismos de armazenamento; ele nunca decide,
 * nunca infere, nunca consolida, nunca reconstrói contexto.
 *
 * @typedef {Object} StorageRecord
 * @property {string} [id]
 * @property {string} collection - nome lógico da coleção/tabela (ex.: "memoria_luna")
 * @property {Record<string, unknown>} data
 * @property {string} [createdAt]
 *
 * @typedef {Object} SaveInput
 * @property {string} collection
 * @property {Record<string, unknown>} data
 *
 * @typedef {Object} UpdateInput
 * @property {string} collection
 * @property {string} id
 * @property {Record<string, unknown>} data
 *
 * @typedef {Object} DeleteInput
 * @property {string} collection
 * @property {string} id
 *
 * @typedef {Object} GetInput
 * @property {string} collection
 * @property {string} id
 *
 * @typedef {Object} SearchInput
 * @property {string} collection
 * @property {Record<string, unknown>} [filter] - igualdade simples por coluna (MVP-01: sem operadores compostos)
 * @property {number} [limit]
 * @property {string} [orderBy]
 * @property {boolean} [ascending]
 *
 * @typedef {Object} CountInput
 * @property {string} collection
 * @property {Record<string, unknown>} [filter] - igualdade simples por coluna, mesma forma de SearchInput
 *
 * @typedef {Object} AuditEntry
 * @property {string} origin - quem chamou (ex.: "memory-engine", "guardian-http")
 * @property {"save"|"update"|"delete"|"get"|"search"|"count"|"saveFile"|"getFile"|"deleteFile"} operation
 * @property {string} at - ISO timestamp
 * @property {string} destination - coleção/tabela (ou bucket, para as operações de arquivo) afetada
 * @property {boolean} success
 * @property {string} [error]
 *
 * @typedef {Object} SaveFileInput
 * @property {string} bucket
 * @property {string} path
 * @property {string} content - base64, mesmo padrão de `*_data_base64` nas coleções relacionais
 * @property {string} [contentType]
 *
 * @typedef {Object} GetFileInput
 * @property {string} bucket
 * @property {string} path
 *
 * @typedef {Object} GetFileOutput
 * @property {string} bucket
 * @property {string} path
 * @property {string} content - base64
 * @property {string} contentType
 *
 * @typedef {Object} DeleteFileInput
 * @property {string} bucket
 * @property {string} path
 *
 * @typedef {Object} StorageContract
 * @property {(input: SaveInput, origin: string) => Promise<StorageRecord>} save
 * @property {(input: UpdateInput, origin: string) => Promise<StorageRecord | null>} update
 * @property {(input: DeleteInput, origin: string) => Promise<boolean>} delete
 * @property {(input: GetInput, origin: string) => Promise<StorageRecord | null>} get
 * @property {(input: SearchInput, origin: string) => Promise<StorageRecord[]>} search
 * @property {(input: CountInput, origin: string) => Promise<number>} count - ADR-012: contagem eficiente (SELECT count(*), não fetch-all), extensão pontual para /stats de chat em luna-core
 * @property {(input: SaveFileInput, origin: string) => Promise<{bucket: string, path: string}>} saveFile - GENESIS pacote 2026-08-25-foto-storage-retencao-e-memoria-obrigatoria.md (Peça 1): objeto binário em Supabase Storage
 * @property {(input: GetFileInput, origin: string) => Promise<GetFileOutput | null>} getFile
 * @property {(input: DeleteFileInput, origin: string) => Promise<boolean>} deleteFile
 */

// Este arquivo existe só para documentar o contrato via JSDoc (o repositório
// é JS puro, sem TypeScript — introduzir um build step novo só para isto
// seria maior mudança de tooling do que esta etapa pede). guardian.js é a
// implementação real do contrato acima.
export {};
