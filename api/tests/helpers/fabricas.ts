import { CargaQuimica, RegistrarCargaDados } from "../../src/domain/aggregates/carga-quimica";
import { DadosProdutoQuimico, ProdutoQuimico } from "../../src/domain/entities/produto-quimico";

export const VALIDADE_FUTURA = "2099-12-31";

export const produtoValido = (sobrescrever: Partial<DadosProdutoQuimico> = {}): DadosProdutoQuimico => ({
  nome: "Ácido Sulfúrico 98%",
  descricao: "Ácido inorgânico forte",
  numeroOnu: "1830",
  classeRisco: "8",
  grupoCompatibilidade: "ACIDOS",
  ...sobrescrever,
});

export const documentosCompletos = () => [
  { tipo: "FISPQ", numero: "FISPQ-1", validade: new Date(`${VALIDADE_FUTURA}T00:00:00Z`), situacao: "VALIDO" },
  { tipo: "CERTIFICADO_ANALISE", numero: "CA-1", validade: new Date(`${VALIDADE_FUTURA}T00:00:00Z`), situacao: "VALIDO" },
];

export const novaCarga = (sobrescrever: Partial<RegistrarCargaDados> = {}): CargaQuimica =>
  CargaQuimica.registrar({
    produto: ProdutoQuimico.criar(produtoValido()),
    quantidade: 1000,
    unidade: "KG",
    origem: "Berço 12",
    destino: "Tanques B-02",
    responsavelTecnico: { nome: "Bruno Costa", registroProfissional: "CRQ-IV 123" },
    documentos: documentosCompletos(),
    ...sobrescrever,
  });

/** Leva uma carga recém-registrada até o status desejado pelo fluxo principal. */
export function avancarAte(carga: CargaQuimica, alvo: "EM_ANALISE" | "EM_INSPECAO" | "LIBERADA" | "EM_MOVIMENTACAO" | "FINALIZADA") {
  const caminho = ["EM_ANALISE", "EM_INSPECAO", "LIBERADA", "EM_MOVIMENTACAO", "FINALIZADA"] as const;
  for (const status of caminho) {
    carga.alterarStatus(status);
    if (status === alvo) return carga;
  }
  return carga;
}
