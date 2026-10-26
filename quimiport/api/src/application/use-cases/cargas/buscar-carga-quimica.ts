import { RecursoNaoEncontradoError } from "../../../domain/errors/domain-errors";
import { CargaQuimicaRepository, ProdutoQuimicoRepository } from "../../../domain/repositories";
import { CargaQuimicaDTO, cargaParaDTO } from "../../dtos";

export class BuscarCargaQuimica {
  constructor(
    private readonly cargas: CargaQuimicaRepository,
    private readonly produtos: ProdutoQuimicoRepository,
  ) {}

  async executar(id: string): Promise<CargaQuimicaDTO> {
    const carga = await this.cargas.buscarPorId(id);
    if (!carga) throw new RecursoNaoEncontradoError("Carga química", id);
    const produto = await this.produtos.buscarPorId(carga.produtoId);
    return cargaParaDTO(carga, produto);
  }
}
