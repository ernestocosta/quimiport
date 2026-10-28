import { StatusCarga } from "../../domain/enums";

/** Porta de log usada pelos casos de uso (implementada com pino na infraestrutura). */
export interface Logger {
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
}

/** Porta de métricas (implementada com prom-client). */
export interface Metricas {
  registrarTransicao(de: StatusCarga | null, para: StatusCarga): void;
  registrarRegraViolada(codigo: string): void;
}

export const metricasNulas: Metricas = {
  registrarTransicao: () => undefined,
  registrarRegraViolada: () => undefined,
};

export interface HistoricoStatusView {
  id: string;
  cargaId: string;
  codigoCarga: string;
  produtoNome: string;
  statusAnterior: StatusCarga | null;
  statusNovo: StatusCarga;
  motivo: string | null;
  ocorridoEm: Date;
}

export interface PendenciaDocumentacaoView {
  cargaId: string;
  codigoCarga: string;
  produtoNome: string;
  status: StatusCarga;
  responsavelTecnico: string;
  documentosTotal: number;
  documentosValidos: number;
  tiposPendentes: string[];
}

/** Modelo de leitura (CQRS leve) para consultas que cruzam agregados. */
export interface ConsultasQuimiPort {
  historicoDaCarga(cargaId: string): Promise<HistoricoStatusView[]>;
  ultimasMovimentacoes(limite: number): Promise<HistoricoStatusView[]>;
  contagemPorStatus(): Promise<Record<StatusCarga, number>>;
  totalProdutosAtivos(): Promise<number>;
  pendenciasDocumentacao(limite: number, referencia: Date): Promise<PendenciaDocumentacaoView[]>;
}
