export const StatusProduto = {
  ATIVO: "ATIVO",
  INATIVO: "INATIVO",
} as const;
export type StatusProduto = (typeof StatusProduto)[keyof typeof StatusProduto];

export const StatusCarga = {
  REGISTRADA: "REGISTRADA",
  EM_ANALISE: "EM_ANALISE",
  EM_INSPECAO: "EM_INSPECAO",
  LIBERADA: "LIBERADA",
  BLOQUEADA: "BLOQUEADA",
  EM_MOVIMENTACAO: "EM_MOVIMENTACAO",
  FINALIZADA: "FINALIZADA",
  CANCELADA: "CANCELADA",
} as const;
export type StatusCarga = (typeof StatusCarga)[keyof typeof StatusCarga];

export const UnidadeMedida = {
  KG: "KG",
  TONELADA: "TONELADA",
  LITRO: "LITRO",
  METRO_CUBICO: "METRO_CUBICO",
} as const;
export type UnidadeMedida = (typeof UnidadeMedida)[keyof typeof UnidadeMedida];

export const TipoDocumento = {
  FISPQ: "FISPQ",
  CERTIFICADO_ANALISE: "CERTIFICADO_ANALISE",
  LICENCA_IMPORTACAO: "LICENCA_IMPORTACAO",
  NOTA_FISCAL: "NOTA_FISCAL",
  DOCUMENTO_TRANSPORTE: "DOCUMENTO_TRANSPORTE",
  OUTRO: "OUTRO",
} as const;
export type TipoDocumento = (typeof TipoDocumento)[keyof typeof TipoDocumento];

export const SituacaoDocumento = {
  PENDENTE: "PENDENTE",
  VALIDO: "VALIDO",
} as const;
export type SituacaoDocumento = (typeof SituacaoDocumento)[keyof typeof SituacaoDocumento];

export const valoresDe = <T extends Record<string, string>>(obj: T) =>
  Object.values(obj) as [T[keyof T], ...T[keyof T][]];
