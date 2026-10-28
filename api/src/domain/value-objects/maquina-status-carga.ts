import { StatusCarga } from "../enums";

/**
 * Máquina de estados da carga química — fonte única da verdade sobre
 * quais transições são permitidas (seção 4 da lauda da Fase 2).
 *
 * Fluxo principal:
 *   REGISTRADA → EM_ANALISE → EM_INSPECAO → LIBERADA → EM_MOVIMENTACAO → FINALIZADA
 * Fluxos alternativos:
 *   REGISTRADA → CANCELADA | EM_ANALISE → CANCELADA | EM_INSPECAO → BLOQUEADA
 *   EM_INSPECAO → CANCELADA | LIBERADA → CANCELADA | BLOQUEADA → CANCELADA
 * Estados terminais: FINALIZADA, CANCELADA
 */
export const TRANSICOES_PERMITIDAS: Readonly<Record<StatusCarga, readonly StatusCarga[]>> = {
  REGISTRADA: [StatusCarga.EM_ANALISE, StatusCarga.CANCELADA],
  EM_ANALISE: [StatusCarga.EM_INSPECAO, StatusCarga.CANCELADA],
  EM_INSPECAO: [StatusCarga.LIBERADA, StatusCarga.BLOQUEADA, StatusCarga.CANCELADA],
  LIBERADA: [StatusCarga.EM_MOVIMENTACAO, StatusCarga.CANCELADA],
  BLOQUEADA: [StatusCarga.CANCELADA],
  EM_MOVIMENTACAO: [StatusCarga.FINALIZADA],
  FINALIZADA: [],
  CANCELADA: [],
};

export const ESTADOS_TERMINAIS: readonly StatusCarga[] = [
  StatusCarga.FINALIZADA,
  StatusCarga.CANCELADA,
];

export const ROTULOS_STATUS: Readonly<Record<StatusCarga, string>> = {
  REGISTRADA: "Registrada",
  EM_ANALISE: "Em análise",
  EM_INSPECAO: "Em inspeção",
  LIBERADA: "Liberada",
  BLOQUEADA: "Bloqueada",
  EM_MOVIMENTACAO: "Em movimentação",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
};

export function podeTransitar(de: StatusCarga, para: StatusCarga): boolean {
  return TRANSICOES_PERMITIDAS[de].includes(para);
}

export function isTerminal(status: StatusCarga): boolean {
  return ESTADOS_TERMINAIS.includes(status);
}
