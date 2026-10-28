import { randomUUID } from "node:crypto";
import { RequestHandler } from "express";
import { Logger as PinoLogger } from "pino";
import { pinoHttp } from "pino-http";
import { MetricasPrometheus } from "../../../infrastructure/metrics/metricas";

const ROTAS_SILENCIOSAS = ["/health", "/metrics"];

/** Dentro de um Router o Express reescreve req.url; originalUrl mantém o caminho completo. */
const urlCompleta = (req: { url?: string }) => (req as { originalUrl?: string }).originalUrl ?? req.url;

/** Log de toda requisição recebida, com request-id para correlacionar erros. */
export function logRequisicoes(logger: PinoLogger) {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const recebido = req.headers["x-request-id"];
      const id = typeof recebido === "string" && recebido.length <= 100 ? recebido : randomUUID();
      res.setHeader("x-request-id", id);
      return id;
    },
    autoLogging: { ignore: (req) => ROTAS_SILENCIOSAS.includes(req.url ?? "") },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage: (req, res, tempo) => `${req.method} ${urlCompleta(req)} → ${res.statusCode} (${tempo}ms)`,
    customErrorMessage: (req, res) => `${req.method} ${urlCompleta(req)} → ${res.statusCode}`,
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: urlCompleta(req) }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  });
}

/** Contador e histograma de requisições por rota (Prometheus). */
export function medirRequisicoes(metricas: MetricasPrometheus): RequestHandler {
  return (req, res, next) => {
    if (req.path === "/metrics") return next();
    const fim = metricas.duracao.startTimer();
    res.on("finish", () => {
      const rota = req.route?.path ? `${req.baseUrl}${req.route.path}` : "nao_mapeada";
      const labels = { method: req.method, route: rota, status: String(res.statusCode) };
      metricas.requisicoes.inc(labels);
      fim(labels);
    });
    next();
  };
}
