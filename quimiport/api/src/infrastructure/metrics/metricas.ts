import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import { Metricas } from "../../application/ports";
import { StatusCarga } from "../../domain/enums";

/** Métricas Prometheus expostas em GET /metrics (diferencial da lauda). */
export class MetricasPrometheus implements Metricas {
  readonly registry = new Registry();

  readonly requisicoes = new Counter({
    name: "quimiport_http_requests_total",
    help: "Total de requisições HTTP recebidas",
    labelNames: ["method", "route", "status"] as const,
    registers: [this.registry],
  });

  readonly duracao = new Histogram({
    name: "quimiport_http_request_duration_seconds",
    help: "Duração das requisições HTTP em segundos",
    labelNames: ["method", "route", "status"] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [this.registry],
  });

  private readonly transicoes = new Counter({
    name: "quimiport_transicoes_status_total",
    help: "Transições de status de carga realizadas",
    labelNames: ["de", "para"] as const,
    registers: [this.registry],
  });

  private readonly regrasVioladas = new Counter({
    name: "quimiport_regras_violadas_total",
    help: "Requisições barradas por regra de negócio",
    labelNames: ["codigo"] as const,
    registers: [this.registry],
  });

  constructor(coletarPadrao = true) {
    if (coletarPadrao) collectDefaultMetrics({ register: this.registry, prefix: "quimiport_" });
  }

  registrarTransicao(de: StatusCarga | null, para: StatusCarga): void {
    this.transicoes.inc({ de: de ?? "NOVA", para });
  }

  registrarRegraViolada(codigo: string): void {
    this.regrasVioladas.inc({ codigo });
  }
}
