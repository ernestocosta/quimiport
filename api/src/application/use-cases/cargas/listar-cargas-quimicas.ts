import { StatusCarga } from "../../../domain/enums";
import { CargaQuimicaRepository, ProdutoQuimicoRepository } from "../../../domain/repositories";
import { CargaQuimicaDTO, ListagemInput, PaginaDTO, cargaParaDTO, normalizarPaginacao, paginar } from "../../dtos";

export class ListarCargasQuimicas {
  constructor(
    private readonly cargas: CargaQuimicaRepository,
    private readonly produtos: ProdutoQuimicoRepository,
  ) {}

  async executar(
    input: ListagemInput & { status?: StatusCarga; produtoId?: string },
  ): Promise<PaginaDTO<CargaQuimicaDTO>> {
    const { pagina, limite } = normalizarPaginacao(input);
    const { itens, total } = await this.cargas.listar({
      pagina,
      limite,
      status: input.status,
      produtoId: input.produtoId,
      busca: input.busca?.trim() || undefined,
    });
    const produtos = await this.produtos.buscarPorIds([...new Set(itens.map((c) => c.produtoId))]);
    const porId = new Map(produtos.map((p) => [p.id, p]));
    return paginar(
      itens.map((c) => cargaParaDTO(c, porId.get(c.produtoId) ?? null)),
      total,
      pagina,
      limite,
    );
  }
}
