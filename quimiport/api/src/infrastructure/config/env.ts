import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z
    .string()
    .default("postgresql://quimiport:quimiport@localhost:5432/quimiport"),
  CORS_ORIGIN: z.string().default("*"),
  SEED_ON_START: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof schema>;

/** Lê o arquivo .env da pasta atual, se existir (Node >= 20.12, sem dependências). */
function carregarArquivoEnv() {
  try {
    process.loadEnvFile();
  } catch {
    // Sem .env: segue com as variáveis do ambiente (Docker, CI, hospedagem).
  }
}

export function carregarEnv(fonte: NodeJS.ProcessEnv = process.env): Env {
  if (fonte === process.env) carregarArquivoEnv();
  const resultado = schema.safeParse(fonte);
  if (!resultado.success) {
    const problemas = resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Variáveis de ambiente inválidas:\n${problemas.join("\n")}`);
  }
  return resultado.data;
}
