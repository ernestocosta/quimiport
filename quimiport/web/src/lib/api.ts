/**
 * Cliente HTTP da API QuimiPort.
 * VITE_API_URL é embutida no build (ex.: https://quimiport-api.onrender.com).
 */
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:3333";

export type StatusCarga =
  | "REGISTRADA"
  | "EM_ANALISE"
  | "EM_INSPECAO"
  | "LIBERADA"
  | "BLOQUEADA"
  | "EM_MOVIMENTACAO"
  | "FINALIZADA"
  | "CANCELADA";

export interface Documento {
  id: string;
  tipo: string;
  situacao: string;
  valido: boolean;
}

export interface Carga {
  id: string;
  codigo: string;
  produto: { id: string; nome: string; numeroOnu: string; classeRisco: string } | null;
  quantidade: number;
  unidade: string;
  origem: string;
  destino: string;
  responsavelTecnico: { nome: string; registroProfissional: string | null };
  documentos: Documento[];
  documentacaoCompleta: boolean;
  status: StatusCarga;
  statusDescricao: string;
  transicoesPermitidas: StatusCarga[];
  updatedAt: string;
}

export interface Movimentacao {
  id: string;
  cargaId: string;
  codigoCarga: string;
  produtoNome: string;
  statusAnterior: StatusCarga | null;
  statusNovo: StatusCarga;
  motivo: string | null;
  ocorridoEm: string;
}

export interface Pendencia {
  cargaId: string;
  codigoCarga: string;
  produtoNome: string;
  status: StatusCarga;
  responsavelTecnico: string;
  documentosTotal: number;
  documentosValidos: number;
  tiposPendentes: string[];
}

export interface Resumo {
  geradoEm: string;
  totalProdutosAtivos: number;
  totalCargas: number;
  cargasPorStatus: Record<StatusCarga, number>;
  pendenciasDocumentacao: Pendencia[];
  ultimasMovimentacoes: Movimentacao[];
}

export class ErroApi extends Error {
  constructor(
    message: string,
    readonly codigo: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${caminho}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const corpo = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ErroApi(
      corpo?.erro?.mensagem ?? `Erro ${res.status} ao chamar a API`,
      corpo?.erro?.codigo ?? "ERRO",
      res.status,
    );
  }
  return corpo as T;
}

export const api = {
  resumo: () => chamar<Resumo>("/resumo-operacional"),
  cargas: () => chamar<{ dados: Carga[] }>("/cargas-quimicas?limite=100").then((r) => r.dados),
  alterarStatus: (id: string, status: StatusCarga, motivo?: string) =>
    chamar<Carga>(`/cargas-quimicas/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, motivo }),
    }),
};

export const ROTULO_STATUS: Record<StatusCarga, string> = {
  REGISTRADA: "Registrada",
  EM_ANALISE: "Em análise",
  EM_INSPECAO: "Em inspeção",
  LIBERADA: "Liberada",
  BLOQUEADA: "Bloqueada",
  EM_MOVIMENTACAO: "Em movimentação",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
};

export const ROTULO_DOCUMENTO: Record<string, string> = {
  FISPQ: "FISPQ",
  CERTIFICADO_ANALISE: "Certificado de análise",
  LICENCA_IMPORTACAO: "Licença de importação",
  NOTA_FISCAL: "Nota fiscal",
  DOCUMENTO_TRANSPORTE: "Documento de transporte",
  OUTRO: "Outro documento",
  NENHUM_DOCUMENTO: "Nenhum documento enviado",
};
