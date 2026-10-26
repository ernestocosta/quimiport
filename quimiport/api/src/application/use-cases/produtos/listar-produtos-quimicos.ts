import { StatusProduto } from "../../../domain/enums";
import { ProdutoQuimicoRepository } from "../../../domain/repositories";
import { ListagemInput, PaginaDTO, ProdutoQuimicoDTO, normalizarPaginacao, paginar, produtoParaDTO } from "../../dtos";

export class ListarProdutosQuimicos {
  constructor(private readonly produtos: ProdutoQuimicoRepository) {}

  async executar(input: ListagemInput & { status?: StatusProduto }): Promise<PaginaDTO<ProdutoQuimicoDTO>> {
    const { pagina, limite } = normalizarPaginacao(input);
    const { itens, total } = await this.produtos.listar({
      pagina,
      limite,
      status: input.status,
      busca: input.busca?.trim() || undefined,
    });
    return paginar(itens.map(produtoParaDTO), total, pagina, limite);
  }
}
