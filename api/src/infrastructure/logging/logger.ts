import pino, { Logger as PinoLogger } from "pino";
import { Env } from "../config/env";

/**
 * Logger estruturado (JSON) em produção e legível em desenvolvimento.
 * Campos sensíveis são mascarados automaticamente.
 */
export function criarLogger(env: Pick<Env, "NODE_ENV" | "LOG_LEVEL">): PinoLogger {
  return pino({
    level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
    base: { servico: "quimiport-api" },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: ["req.headers.authorization", "req.headers.cookie"], censor: "[oculto]" },
    transport:
      env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" } }
        : undefined,
  });
}
