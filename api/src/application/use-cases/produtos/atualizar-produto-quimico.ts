import { RecursoNaoEncontradoError } from "../../../domain/errors/domain-errors";
import { ProdutoQuimicoRepository } from "../../../domain/repositories";
import { ProdutoQuimicoDTO, ProdutoQuimicoInput, produtoParaDTO } from "../../dtos";
import { Logger } from "../../ports";

export class AtualizarProdutoQuimico {
  constructor(
    private readonly produtos: ProdutoQuimicoRepository,
    private readonly logger: Logger,
  ) {}

  async executar(id: string, input: ProdutoQuimicoInput): Promise<ProdutoQuimicoDTO> {
    const produto = await this.produtos.buscarPorId(id);
    if (!produto) throw new RecursoNaoEncontradoError("Produto químico", id);
    produto.atualizar(input);
    await this.produtos.salvar(produto);
    this.logger.info({ evento: "produto.atualizado", produtoId: id }, "Produto químico atualizado");
    return produtoParaDTO(produto);
  }
}
