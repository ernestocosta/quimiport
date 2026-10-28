import { randomUUID } from "node:crypto";
import { SituacaoDocumento, TipoDocumento, valoresDe } from "../enums";
import { RegraDeNegocioError } from "../errors/domain-errors";

export interface DadosDocumentoCarga {
  id?: string;
  tipo: string;
  numero?: string | null;
  validade?: Date | null;
  situacao?: string;
}

/** Item de documentação obrigatória vinculado a uma carga (parte do agregado). */
export class DocumentoCarga {
  private constructor(
    readonly id: string,
    readonly tipo: TipoDocumento,
    readonly numero: string | null,
    readonly validade: Date | null,
    readonly situacao: SituacaoDocumento,
  ) {}

  static criar(dados: DadosDocumentoCarga): DocumentoCarga {
    if (!valoresDe(TipoDocumento).includes(dados.tipo as TipoDocumento)) {
      throw new RegraDeNegocioError(
        "TIPO_DOCUMENTO_INVALIDO",
        `Tipo de documento inválido: "${dados.tipo}".`,
        { tiposValidos: valoresDe(TipoDocumento) },
      );
    }
    const situacao = (dados.situacao ?? SituacaoDocumento.PENDENTE) as SituacaoDocumento;
    if (!valoresDe(SituacaoDocumento).includes(situacao)) {
      throw new RegraDeNegocioError(
        "SITUACAO_DOCUMENTO_INVALIDA",
        `Situação de documento inválida: "${dados.situacao}".`,
      );
    }
    return new DocumentoCarga(
      dados.id ?? randomUUID(),
      dados.tipo as TipoDocumento,
      dados.numero?.trim() || null,
      dados.validade ?? null,
      situacao,
    );
  }

  estaVencido(referencia = new Date()): boolean {
    if (!this.validade) return false;
    const fimDoDia = new Date(this.validade);
    fimDoDia.setUTCHours(23, 59, 59, 999);
    return fimDoDia.getTime() < referencia.getTime();
  }

  /** Documento só conta como entregue se estiver VALIDO e dentro da validade. */
  estaValido(referencia = new Date()): boolean {
    return this.situacao === SituacaoDocumento.VALIDO && !this.estaVencido(referencia);
  }
}
