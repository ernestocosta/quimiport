import { StatusCarga } from "../../../domain/enums";
import { RecursoNaoEncontradoError } from "../../../domain/errors/domain-errors";
import { CargaQuimicaRepository, ProdutoQuimicoRepository } from "../../../domain/repositories";
import { CargaQuimicaDTO, cargaParaDTO } from "../../dtos";
import { Logger, Metricas } from "../../ports";

export type AcaoStatus =
  | { tipo: "status"; status: StatusCarga; motivo?: string | null }
  | { tipo: "liberar" }
  | { tipo: "bloquear"; motivo: string }
  | { tipo: "cancelar"; motivo: string };

const EVENTOS: Partial<Record<StatusCarga, string>> = {
  LIBERADA: "carga.liberada",
  BLOQUEADA: "carga.bloqueada",
  CANCELADA: "carga.cancelada",
};

/**
 * Caso de uso único para toda mudança de status: genérica (PATCH /status)
 * ou pelas ações nomeadas (liberar, bloquear, cancelar). As regras ficam
 * no agregado — aqui só há orquestração, log e métrica.
 */
export class AlterarStatusCarga {
  constructor(
    private readonly cargas: CargaQuimicaRepository,
    private readonly produtos: ProdutoQuimicoRepository,
    private readonly logger: Logger,
    private readonly metricas: Metricas,
  ) {}

  async executar(id: string, acao: AcaoStatus): Promise<CargaQuimicaDTO> {
    const carga = await this.cargas.buscarPorId(id);
    if (!carga) throw new RecursoNaoEncontradoError("Carga química", id);

    const anterior = carga.status;
    switch (acao.tipo) {
      case "liberar":
        carga.liberar();
        break;
      case "bloquear":
        carga.bloquear(acao.motivo);
        break;
      case "cancelar":
        carga.cancelar(acao.motivo);
        break;
      case "status":
        carga.alterarStatus(acao.status, acao.motivo);
        break;
    }

    await this.cargas.salvar(carga);
    this.metricas.registrarTransicao(anterior, carga.status);
    this.logger.info(
      {
        evento: EVENTOS[carga.status] ?? "carga.status_alterado",
        cargaId: carga.id,
        codigo: carga.codigo,
        de: anterior,
        para: carga.status,
        motivo: carga.status === StatusCarga.BLOQUEADA ? carga.motivoBloqueio : carga.status === StatusCarga.CANCELADA ? carga.motivoCancelamento : undefined,
      },
      `Status da carga alterado: ${anterior} → ${carga.status}`,
    );

    const produto = await this.produtos.buscarPorId(carga.produtoId);
    return cargaParaDTO(carga, produto);
  }
}
