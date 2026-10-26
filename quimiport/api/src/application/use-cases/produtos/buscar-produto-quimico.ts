import { RecursoNaoEncontradoError } from "../../../domain/errors/domain-errors";
import { ProdutoQuimicoRepository } from "../../../domain/repositories";
import { ProdutoQuimicoDTO, produtoParaDTO } from "../../dtos";

export class BuscarProdutoQuimico {
  constructor(private readonly produtos: ProdutoQuimicoRepository) {}

  async executar(id: string): Promise<ProdutoQuimicoDTO> {
    const produto = await this.produtos.buscarPorId(id);
    if (!produto) throw new RecursoNaoEncontradoError("Produto químico", id);
    return produtoParaDTO(produto);
  }
}
