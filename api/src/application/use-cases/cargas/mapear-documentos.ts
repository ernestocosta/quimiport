import { DadosDocumentoCarga } from "../../../domain/entities/documento-carga";
import { DocumentoInput } from "../../dtos";

export function paraDocumentos(documentos?: DocumentoInput[]): DadosDocumentoCarga[] {
  return (documentos ?? []).map((d) => ({
    tipo: d.tipo,
    numero: d.numero,
    situacao: d.situacao,
    validade: d.validade ? new Date(`${d.validade.slice(0, 10)}T00:00:00.000Z`) : null,
  }));
}
