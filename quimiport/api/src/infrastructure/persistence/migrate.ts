import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { carregarEnv } from "../config/env";
import { criarConexao } from "./database";

/** Pasta com os .sql gerados pelo drizzle-kit (funciona em src/ e em dist/). */
export const PASTA_MIGRATIONS = path.resolve(__dirname, "../../../drizzle");

export async function aplicarMigrations(databaseUrl: string): Promise<void> {
  const conexao = criarConexao(databaseUrl);
  try {
    await migrate(conexao.db, { migrationsFolder: PASTA_MIGRATIONS });
  } finally {
    await conexao.fechar();
  }
}

if (require.main === module) {
  const env = carregarEnv();
  aplicarMigrations(env.DATABASE_URL)
    .then(() => {
      console.log("Migrations aplicadas com sucesso.");
    })
    .catch((erro) => {
      console.error("Falha ao aplicar migrations:", erro);
      process.exit(1);
    });
}
