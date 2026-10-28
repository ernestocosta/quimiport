/**
 * Modelagem relacional do QuimiPort (PostgreSQL + Drizzle ORM).
 * Documentação: docs/modelagem-dados.md
 */
import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const statusProdutoEnum = pgEnum("status_produto", ["ATIVO", "INATIVO"]);

export const statusCargaEnum = pgEnum("status_carga", [
  "REGISTRADA",
  "EM_ANALISE",
  "EM_INSPECAO",
  "LIBERADA",
  "BLOQUEADA",
  "EM_MOVIMENTACAO",
  "FINALIZADA",
  "CANCELADA",
]);

export const unidadeMedidaEnum = pgEnum("unidade_medida", ["KG", "TONELADA", "LITRO", "METRO_CUBICO"]);

export const tipoDocumentoEnum = pgEnum("tipo_documento", [
  "FISPQ",
  "CERTIFICADO_ANALISE",
  "LICENCA_IMPORTACAO",
  "NOTA_FISCAL",
  "DOCUMENTO_TRANSPORTE",
  "OUTRO",
]);

export const situacaoDocumentoEnum = pgEnum("situacao_documento", ["PENDENTE", "VALIDO"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
};

export const produtosQuimicos = pgTable(
  "produtos_quimicos",
  {
    id: uuid("id").primaryKey(),
    nome: varchar("nome", { length: 150 }).notNull(),
    descricao: text("descricao"),
    numeroOnu: varchar("numero_onu", { length: 10 }).notNull(),
    classeRisco: varchar("classe_risco", { length: 5 }).notNull(),
    grupoCompatibilidade: varchar("grupo_compatibilidade", { length: 50 }).notNull(),
    status: statusProdutoEnum("status").notNull().default("ATIVO"),
    ...timestamps,
  },
  (t) => [index("produtos_quimicos_status_idx").on(t.status), index("produtos_quimicos_nome_idx").on(t.nome)],
);

export const cargasQuimicas = pgTable(
  "cargas_quimicas",
  {
    id: uuid("id").primaryKey(),
    codigo: varchar("codigo", { length: 30 }).notNull().unique(),
    produtoId: uuid("produto_id")
      .notNull()
      .references(() => produtosQuimicos.id, { onDelete: "restrict" }),
    quantidade: numeric("quantidade", { precision: 14, scale: 3, mode: "number" }).notNull(),
    unidade: unidadeMedidaEnum("unidade").notNull(),
    origem: varchar("origem", { length: 150 }).notNull(),
    destino: varchar("destino", { length: 150 }).notNull(),
    responsavelTecnicoNome: varchar("responsavel_tecnico_nome", { length: 150 }).notNull(),
    responsavelTecnicoRegistro: varchar("responsavel_tecnico_registro", { length: 50 }),
    status: statusCargaEnum("status").notNull().default("REGISTRADA"),
    motivoBloqueio: text("motivo_bloqueio"),
    motivoCancelamento: text("motivo_cancelamento"),
    dataEntrada: timestamp("data_entrada", { withTimezone: true, precision: 3 }).notNull(),
    ...timestamps,
  },
  (t) => [
    index("cargas_quimicas_status_idx").on(t.status),
    index("cargas_quimicas_produto_idx").on(t.produtoId),
    check("cargas_quimicas_quantidade_positiva", sql`${t.quantidade} > 0`),
  ],
);

export const documentosCarga = pgTable(
  "documentos_carga",
  {
    id: uuid("id").primaryKey(),
    cargaId: uuid("carga_id")
      .notNull()
      .references(() => cargasQuimicas.id, { onDelete: "cascade" }),
    tipo: tipoDocumentoEnum("tipo").notNull(),
    numero: varchar("numero", { length: 60 }),
    validade: date("validade", { mode: "date" }),
    situacao: situacaoDocumentoEnum("situacao").notNull().default("PENDENTE"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [index("documentos_carga_carga_idx").on(t.cargaId)],
);

export const historicoStatusCarga = pgTable(
  "historico_status_carga",
  {
    id: uuid("id").primaryKey(),
    cargaId: uuid("carga_id")
      .notNull()
      .references(() => cargasQuimicas.id, { onDelete: "cascade" }),
    statusAnterior: statusCargaEnum("status_anterior"),
    statusNovo: statusCargaEnum("status_novo").notNull(),
    motivo: text("motivo"),
    ocorridoEm: timestamp("ocorrido_em", { withTimezone: true, precision: 3 }).notNull(),
  },
  (t) => [
    index("historico_carga_idx").on(t.cargaId, t.ocorridoEm),
    index("historico_ocorrido_idx").on(t.ocorridoEm),
  ],
);

export const produtosRelations = relations(produtosQuimicos, ({ many }) => ({
  cargas: many(cargasQuimicas),
}));

export const cargasRelations = relations(cargasQuimicas, ({ one, many }) => ({
  produto: one(produtosQuimicos, { fields: [cargasQuimicas.produtoId], references: [produtosQuimicos.id] }),
  documentos: many(documentosCarga),
  historico: many(historicoStatusCarga),
}));

export const documentosRelations = relations(documentosCarga, ({ one }) => ({
  carga: one(cargasQuimicas, { fields: [documentosCarga.cargaId], references: [cargasQuimicas.id] }),
}));

export const historicoRelations = relations(historicoStatusCarga, ({ one }) => ({
  carga: one(cargasQuimicas, { fields: [historicoStatusCarga.cargaId], references: [cargasQuimicas.id] }),
}));
