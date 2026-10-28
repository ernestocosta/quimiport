CREATE TYPE "public"."situacao_documento" AS ENUM('PENDENTE', 'VALIDO');--> statement-breakpoint
CREATE TYPE "public"."status_carga" AS ENUM('REGISTRADA', 'EM_ANALISE', 'EM_INSPECAO', 'LIBERADA', 'BLOQUEADA', 'EM_MOVIMENTACAO', 'FINALIZADA', 'CANCELADA');--> statement-breakpoint
CREATE TYPE "public"."status_produto" AS ENUM('ATIVO', 'INATIVO');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('FISPQ', 'CERTIFICADO_ANALISE', 'LICENCA_IMPORTACAO', 'NOTA_FISCAL', 'DOCUMENTO_TRANSPORTE', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."unidade_medida" AS ENUM('KG', 'TONELADA', 'LITRO', 'METRO_CUBICO');--> statement-breakpoint
CREATE TABLE "cargas_quimicas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"codigo" varchar(30) NOT NULL,
	"produto_id" uuid NOT NULL,
	"quantidade" numeric(14, 3) NOT NULL,
	"unidade" "unidade_medida" NOT NULL,
	"origem" varchar(150) NOT NULL,
	"destino" varchar(150) NOT NULL,
	"responsavel_tecnico_nome" varchar(150) NOT NULL,
	"responsavel_tecnico_registro" varchar(50),
	"status" "status_carga" DEFAULT 'REGISTRADA' NOT NULL,
	"motivo_bloqueio" text,
	"motivo_cancelamento" text,
	"data_entrada" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cargas_quimicas_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "cargas_quimicas_quantidade_positiva" CHECK ("cargas_quimicas"."quantidade" > 0)
);
--> statement-breakpoint
CREATE TABLE "documentos_carga" (
	"id" uuid PRIMARY KEY NOT NULL,
	"carga_id" uuid NOT NULL,
	"tipo" "tipo_documento" NOT NULL,
	"numero" varchar(60),
	"validade" date,
	"situacao" "situacao_documento" DEFAULT 'PENDENTE' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historico_status_carga" (
	"id" uuid PRIMARY KEY NOT NULL,
	"carga_id" uuid NOT NULL,
	"status_anterior" "status_carga",
	"status_novo" "status_carga" NOT NULL,
	"motivo" text,
	"ocorrido_em" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produtos_quimicos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nome" varchar(150) NOT NULL,
	"descricao" text,
	"numero_onu" varchar(10) NOT NULL,
	"classe_risco" varchar(5) NOT NULL,
	"grupo_compatibilidade" varchar(50) NOT NULL,
	"status" "status_produto" DEFAULT 'ATIVO' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cargas_quimicas" ADD CONSTRAINT "cargas_quimicas_produto_id_produtos_quimicos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos_quimicos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_carga" ADD CONSTRAINT "documentos_carga_carga_id_cargas_quimicas_id_fk" FOREIGN KEY ("carga_id") REFERENCES "public"."cargas_quimicas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historico_status_carga" ADD CONSTRAINT "historico_status_carga_carga_id_cargas_quimicas_id_fk" FOREIGN KEY ("carga_id") REFERENCES "public"."cargas_quimicas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cargas_quimicas_status_idx" ON "cargas_quimicas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cargas_quimicas_produto_idx" ON "cargas_quimicas" USING btree ("produto_id");--> statement-breakpoint
CREATE INDEX "documentos_carga_carga_idx" ON "documentos_carga" USING btree ("carga_id");--> statement-breakpoint
CREATE INDEX "historico_carga_idx" ON "historico_status_carga" USING btree ("carga_id","ocorrido_em");--> statement-breakpoint
CREATE INDEX "historico_ocorrido_idx" ON "historico_status_carga" USING btree ("ocorrido_em");--> statement-breakpoint
CREATE INDEX "produtos_quimicos_status_idx" ON "produtos_quimicos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "produtos_quimicos_nome_idx" ON "produtos_quimicos" USING btree ("nome");