import { criarApp } from "./app";
import { criarCasosDeUso } from "./container";
import { carregarEnv } from "./infrastructure/config/env";
import { criarLogger } from "./infrastructure/logging/logger";
import { MetricasPrometheus } from "./infrastructure/metrics/metricas";
import { criarConexao } from "./infrastructure/persistence/database";
import { aplicarMigrations } from "./infrastructure/persistence/migrate";
import { popularBanco } from "./infrastructure/persistence/seed";
import { DrizzleCargaQuimicaRepository } from "./infrastructure/repositories/drizzle/drizzle-carga-quimica.repository";
import { DrizzleConsultas } from "./infrastructure/repositories/drizzle/drizzle-consultas";
import { DrizzleProdutoQuimicoRepository } from "./infrastructure/repositories/drizzle/drizzle-produto-quimico.repository";

async function iniciar() {
  const env = carregarEnv();
  const logger = criarLogger(env);

  await aplicarMigrations(env.DATABASE_URL);
  logger.info({ evento: "banco.migrations_aplicadas" }, "Migrations aplicadas");

  const conexao = criarConexao(env.DATABASE_URL);
  const metricas = new MetricasPrometheus();
  const produtos = new DrizzleProdutoQuimicoRepository(conexao.db);
  const cargas = new DrizzleCargaQuimicaRepository(conexao.db);
  const casos = criarCasosDeUso({
    produtos,
    cargas,
    consultas: new DrizzleConsultas(conexao.db),
    logger,
    metricas,
  });

  if (env.SEED_ON_START) {
    const resultado = await popularBanco(produtos, cargas);
    logger.info({ evento: "banco.seed", ...resultado }, "Seed executado");
  }

  const app = criarApp({
    casos,
    logger,
    metricas,
    corsOrigin: env.CORS_ORIGIN,
    verificarBanco: conexao.verificar,
  });

  const servidor = app.listen(env.PORT, () => {
    logger.info(
      { evento: "api.iniciada", porta: env.PORT, ambiente: env.NODE_ENV },
      `QuimiPort API em http://localhost:${env.PORT} — docs em /docs`,
    );
  });

  const encerrar = (sinal: string) => {
    logger.info({ evento: "api.encerrando", sinal }, "Encerrando API");
    servidor.close(async () => {
      await conexao.fechar();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => encerrar("SIGTERM"));
  process.on("SIGINT", () => encerrar("SIGINT"));
}

iniciar().catch((erro) => {
  console.error("Falha ao iniciar a API:", erro);
  process.exit(1);
});
