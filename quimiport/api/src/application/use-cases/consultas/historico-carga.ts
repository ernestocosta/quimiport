import { RecursoNaoEncontradoError } from "../../../domain/errors/domain-errors";
import { CargaQuimicaRepository } from "../../../domain/repositories";
import { ConsultasQuimiPort, HistoricoStatusView } from "../../ports";

export class HistoricoCarga {
  constructor(
    private readonly cargas: CargaQuimicaRepository,
    private readonly consultas: ConsultasQuimiPort,
  ) {}

  async executar(cargaId: string): Promise<HistoricoStatusView[]> {
    const carga = await this.cargas.buscarPorId(cargaId);
    if (!carga) throw new RecursoNaoEncontradoError("Carga química", cargaId);
    return this.consultas.historicoDaCarga(cargaId);
  }
}
