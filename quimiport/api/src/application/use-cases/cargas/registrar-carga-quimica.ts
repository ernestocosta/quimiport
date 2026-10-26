import { CargaQuimica } from "../../../domain/aggregates/carga-quimica";
import { ConflitoError, RegraDeNegocioError } from "../../../domain/errors/domain-errors";
import { CargaQuimicaRepository, ProdutoQuimicoRepository } from "../../../domain/repositories";
import { CargaQuimicaDTO, RegistrarCargaInput, cargaParaDTO } from "../../dtos";
import { Logger, Metricas } from "../../ports";
import { paraDocumentos } from "./mapear-documentos";

export class RegistrarCargaQuimica {
  constructor(
    private readonly cargas: CargaQuimicaRepository,
    private readonly produtos: ProdutoQuimicoRepository,
    private readonly logger: Logger,
    private readonly metricas: Metricas,
  ) {}

  async executar(input: RegistrarCargaInput): Promise<CargaQuimicaDTO> {
    const produto = input.produtoId ? await this.produtos.buscarPorId(input.produtoId) : null;
    if (input.produtoId && !produto) {
      throw new RegraDeNegocioError(
        "PRODUTO_NAO_ENCONTRADO",
        `Produto químico ${input.produtoId} não existe — a carga precisa de um produto associado válido.`,
        { produtoId: input.produtoId },
      );
    }

    const carga = CargaQuimica.registrar({
      codigo: input.codigo,
      produto,
      quantidade: input.quantidade,
      unidade: input.unidade,
      origem: input.origem,
      destino: input.destino,
      responsavelTecnico: input.responsavelTecnico,
      documentos: paraDocumentos(input.documentos),
      dataEntrada: input.dataEntrada ? new Date(input.dataEntrada) : undefined,
    });

    if (await this.cargas.existeCodigo(carga.codigo)) {
      throw new ConflitoError(`Já existe uma carga com o código ${carga.codigo}.`, { codigo: carga.codigo });
    }

    await this.cargas.salvar(carga);
    this.metricas.registrarTransicao(null, carga.status);
    this.logger.info(
      {
        evento: "carga.registrada",
        cargaId: carga.id,
        codigo: carga.codigo,
        produtoId: carga.produtoId,
        quantidade: carga.quantidade.valor,
        unidade: carga.quantidade.unidade,
      },
      "Carga química registrada",
    );
    return cargaParaDTO(carga, produto);
  }
}
