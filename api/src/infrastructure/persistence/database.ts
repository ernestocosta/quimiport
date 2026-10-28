import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

export interface ConexaoBanco {
  db: Database;
  pool: Pool;
  fechar(): Promise<void>;
  verificar(): Promise<boolean>;
}

export function criarConexao(databaseUrl: string): ConexaoBanco {
  const pool = new Pool({ connectionString: databaseUrl, max: 10 });
  const db = drizzle(pool, { schema });
  return {
    db,
    pool,
    fechar: () => pool.end(),
    verificar: async () => {
      try {
        await pool.query("select 1");
        return true;
      } catch {
        return false;
      }
    },
  };
}
