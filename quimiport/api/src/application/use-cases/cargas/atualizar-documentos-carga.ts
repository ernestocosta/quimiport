import { RecursoNaoEncontradoError } from "../../../domain/errors/domain-errors";
import { CargaQuimicaRepository, ProdutoQuimicoRepository } from "../../../domain/repositories";
import { CargaQuimicaDTO, DocumentoInput, cargaParaDTO } from "../../dtos";
import { Logger } from "../../ports";
import { paraDocumentos } from "./mapear-documentos";

export class AtualizarDocumentosCarga {
  constructor(
    private readonly cargas: CargaQuimicaRepository,
    private readonly produtos: ProdutoQuimicoRepository,
    private readonly logger: Logger,
  ) {}

  async executar(id: string, documentos: DocumentoInput[]): Promise<CargaQuimicaDTO> {
    const carga = await this.cargas.buscarPorId(id);
    if (!carga) throw new RecursoNaoEncontradoError("Carga química", id);
    carga.atualizarDocumentos(paraDocumentos(documentos));
    await this.cargas.salvar(carga);
    this.logger.info(
      {
        evento: "carga.documentacao_atualizada",
        cargaId: carga.id,
        codigo: carga.codigo,
        documentos: carga.documentos.length,
        completa: carga.documentacaoCompleta(),
      },
      "Documentação da carga atualizada",
    );
    const produto = await this.produtos.buscarPorId(carga.produtoId);
    return cargaParaDTO(carga, produto);
  }
}
