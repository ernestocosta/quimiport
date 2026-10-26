import { StatusCarga } from "../../../domain/enums";
import { ConsultasQuimiPort, HistoricoStatusView, PendenciaDocumentacaoView } from "../../ports";

export interface ResumoOperacionalDTO {
  geradoEm: string;
  totalProdutosAtivos: number;
  totalCargas: number;
  cargasPorStatus: Record<StatusCarga, number>;
  pendenciasDocumentacao: PendenciaDocumentacaoView[];
  ultimasMovimentacoes: HistoricoStatusView[];
}

/** Visão consolidada usada pelo painel web (dashboard). */
export class ResumoOperacional {
  constructor(private readonly consultas: ConsultasQuimiPort) {}

  async executar(agora = new Date()): Promise<ResumoOperacionalDTO> {
    const [cargasPorStatus, totalProdutosAtivos, pendenciasDocumentacao, ultimasMovimentacoes] =
      await Promise.all([
        this.consultas.contagemPorStatus(),
        this.consultas.totalProdutosAtivos(),
        this.consultas.pendenciasDocumentacao(10, agora),
        this.consultas.ultimasMovimentacoes(10),
      ]);
    const totalCargas = Object.values(cargasPorStatus).reduce((a, b) => a + b, 0);
    return {
      geradoEm: agora.toISOString(),
      totalProdutosAtivos,
      totalCargas,
      cargasPorStatus,
      pendenciasDocumentacao,
      ultimasMovimentacoes,
    };
  }
}
