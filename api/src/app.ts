import cors from "cors";
import express, { Express } from "express";
import { createHandler } from "graphql-http/lib/use/express";
import helmet from "helmet";
import { Logger as PinoLogger } from "pino";
import swaggerUi from "swagger-ui-express";
import { CasosDeUso } from "./container";
import { MetricasPrometheus } from "./infrastructure/metrics/metricas";
import { criarSchemaGraphQL } from "./interfaces/graphql/schema";
import { openApiDocument } from "./interfaces/http/docs/openapi";
import { logRequisicoes, medirRequisicoes } from "./interfaces/http/middlewares/observabilidade";
import { rotaNaoEncontrada, tratarErros } from "./interfaces/http/middlewares/tratar-erros";
import { rotasCargas, rotasConsultas, rotasProdutos } from "./interfaces/http/routes";

export interface OpcoesApp {
  casos: CasosDeUso;
  logger: PinoLogger;
  metricas: MetricasPrometheus;
  corsOrigin?: string;
  verificarBanco?: () => Promise<boolean>;
}

export function criarApp({ casos, logger, metricas, corsOrigin = "*", verificarBanco }: OpcoesApp): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);

  // Swagger UI usa scripts inline; o CSP fica relaxado só nessa rota.
  app.use("/docs", helmet({ contentSecurityPolicy: false }));
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigin === "*" ? true : corsOrigin.split(",").map((o) => o.trim()),
      exposedHeaders: ["x-request-id", "location"],
    }),
  );
  // Log e métricas antes do parser de JSON: assim até um corpo malformado é registrado.
  app.use(logRequisicoes(logger));
  app.use(medirRequisicoes(metricas));
  app.use(express.json({ limit: "100kb" }));

  app.get("/", (_req, res) => {
    res.json({ nome: "QuimiPort API", versao: "1.0.0", documentacao: "/docs", saude: "/health" });
  });

  app.get("/health", async (_req, res) => {
    const bancoOk = verificarBanco ? await verificarBanco() : true;
    res.status(bancoOk ? 200 : 503).json({
      status: bancoOk ? "ok" : "degradado",
      banco: bancoOk ? "ok" : "indisponivel",
      uptime: Number(process.uptime().toFixed(1)),
    });
  });

  app.get("/metrics", async (_req, res) => {
    res.type(metricas.registry.contentType).send(await metricas.registry.metrics());
  });

  app.get("/docs/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "QuimiPort API — Documentação",
      swaggerOptions: { docExpansion: "list", displayRequestDuration: true },
    }),
  );

  app.use("/produtos-quimicos", rotasProdutos(casos));
  app.use("/cargas-quimicas", rotasCargas(casos));
  app.use("/", rotasConsultas(casos));
  app.all("/graphql", createHandler({ schema: criarSchemaGraphQL(casos) }));

  app.use(rotaNaoEncontrada);
  app.use(tratarErros(metricas));
  return app;
}
