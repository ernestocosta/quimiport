import { sql } from "drizzle-orm";
import pino from "pino";
import { criarApp } from "../../src/app";
import { criarCasosDeUso } from "../../src/container";
import { MetricasPrometheus } from "../../src/infrastructure/metrics/metricas";
import { ConexaoBanco, criarConexao } from "../../src/infrastructure/persistence/database";
import { aplicarMigrations } from "../../src/infrastructure/persistence/migrate";
import { DrizzleCargaQuimicaRepository } from "../../src/infrastructure/repositories/drizzle/drizzle-carga-quimica.repository";
import { DrizzleConsultas } from "../../src/infrastructure/repositories/drizzle/drizzle-consultas";
import { DrizzleProdutoQuimicoRepository } from "../../src/infrastructure/repositories/drizzle/drizzle-produto-quimico.repository";
import {
  InMemoryBanco,
  InMemoryCargaQuimicaRepository,
  InMemoryConsultas,
  InMemoryProdutoQuimicoRepository,
} from "../../src/infrastructure/repositories/in-memory/in-memory";

const logger = pino({ level: "silent" });

/** App com repositórios em memória — sem banco, roda em qualquer lugar. */
export function appEmMemoria() {
  const banco = new InMemoryBanco();
  const metricas = new MetricasPrometheus(false);
  const casos = criarCasosDeUso({
    produtos: new InMemoryProdutoQuimicoRepository(banco),
    cargas: new InMemoryCargaQuimicaRepository(banco),
    consultas: new InMemoryConsultas(banco),
    logger,
    metricas,
  });
  return { app: criarApp({ casos, logger, metricas }), limpar: async () => {
    banco.produtos.clear();
    banco.cargas.clear();
    banco.historico.length = 0;
  }, fechar: async () => undefined };
}

/** App com PostgreSQL real (usado quando DATABASE_URL_TEST está definida). */
export async function appComPostgres(databaseUrl: string) {
  await aplicarMigrations(databaseUrl);
  const conexao: ConexaoBanco = criarConexao(databaseUrl);
  const metricas = new MetricasPrometheus(false);
  const casos = criarCasosDeUso({
    produtos: new DrizzleProdutoQuimicoRepository(conexao.db),
    cargas: new DrizzleCargaQuimicaRepository(conexao.db),
    consultas: new DrizzleConsultas(conexao.db),
    logger,
    metricas,
  });
  return {
    app: criarApp({ casos, logger, metricas, verificarBanco: conexao.verificar }),
    limpar: async () => {
      await conexao.db.execute(
        sql`TRUNCATE historico_status_carga, documentos_carga, cargas_quimicas, produtos_quimicos CASCADE`,
      );
    },
    fechar: () => conexao.fechar(),
  };
}
