import { ProdutoQuimico } from "../../../domain/entities/produto-quimico";
import { ProdutoQuimicoRepository } from "../../../domain/repositories";
import { ProdutoQuimicoDTO, ProdutoQuimicoInput, produtoParaDTO } from "../../dtos";
import { Logger } from "../../ports";

export class CriarProdutoQuimico {
  constructor(
    private readonly produtos: ProdutoQuimicoRepository,
    private readonly logger: Logger,
  ) {}

  async executar(input: ProdutoQuimicoInput): Promise<ProdutoQuimicoDTO> {
    const produto = ProdutoQuimico.criar(input);
    await this.produtos.salvar(produto);
    this.logger.info(
      { evento: "produto.criado", produtoId: produto.id, nome: produto.nome, classeRisco: produto.classeRisco.codigo },
      "Produto químico criado",
    );
    return produtoParaDTO(produto);
  }
}
