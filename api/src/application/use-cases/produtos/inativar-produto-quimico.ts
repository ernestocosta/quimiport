import { RecursoNaoEncontradoError } from "../../../domain/errors/domain-errors";
import { ProdutoQuimicoRepository } from "../../../domain/repositories";
import { ProdutoQuimicoDTO, produtoParaDTO } from "../../dtos";
import { Logger } from "../../ports";

/** Inativação lógica: o produto continua no banco, mas não entra em novas cargas. */
export class InativarProdutoQuimico {
  constructor(
    private readonly produtos: ProdutoQuimicoRepository,
    private readonly logger: Logger,
  ) {}

  async executar(id: string): Promise<ProdutoQuimicoDTO> {
    const produto = await this.produtos.buscarPorId(id);
    if (!produto) throw new RecursoNaoEncontradoError("Produto químico", id);
    produto.inativar();
    await this.produtos.salvar(produto);
    this.logger.info({ evento: "produto.inativado", produtoId: id }, "Produto químico inativado");
    return produtoParaDTO(produto);
  }
}
