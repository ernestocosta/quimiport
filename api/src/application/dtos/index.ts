import { CargaQuimica } from "../../domain/aggregates/carga-quimica";
import { DadosProdutoQuimico, ProdutoQuimico } from "../../domain/entities/produto-quimico";
import { StatusCarga, StatusProduto } from "../../domain/enums";
import { ROTULOS_STATUS } from "../../domain/value-objects/maquina-status-carga";

// ------------------------------------------------------------------ entrada

export type ProdutoQuimicoInput = DadosProdutoQuimico;

export interface DocumentoInput {
  tipo: string;
  numero?: string | null;
  validade?: string | null;
  situacao?: string;
}

export interface RegistrarCargaInput {
  codigo?: string;
  produtoId?: string;
  quantidade?: number;
  unidade?: string;
  origem?: string;
  destino?: string;
  responsavelTecnico?: { nome?: string; registroProfissional?: string | null } | null;
  documentos?: DocumentoInput[];
  dataEntrada?: string;
}

export interface ListagemInput {
  pagina?: number;
  limite?: number;
  busca?: string;
}

// -------------------------------------------------------------------- saída

export interface PaginaDTO<T> {
  dados: T[];
  meta: { total: number; pagina: number; limite: number; totalPaginas: number };
}

export interface ProdutoQuimicoDTO {
  id: string;
  nome: string;
  descricao: string | null;
  numeroOnu: string;
  classeRisco: string;
  classeRiscoDescricao: string;
  grupoCompatibilidade: string;
  status: StatusProduto;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentoDTO {
  id: string;
  tipo: string;
  numero: string | null;
  validade: string | null;
  situacao: string;
  vencido: boolean;
  valido: boolean;
}

export interface CargaQuimicaDTO {
  id: string;
  codigo: string;
  produto: { id: string; nome: string; numeroOnu: string; classeRisco: string } | null;
  quantidade: number;
  unidade: string;
  origem: string;
  destino: string;
  responsavelTecnico: { nome: string; registroProfissional: string | null };
  documentos: DocumentoDTO[];
  documentacaoCompleta: boolean;
  status: StatusCarga;
  statusDescricao: string;
  transicoesPermitidas: StatusCarga[];
  motivoBloqueio: string | null;
  motivoCancelamento: string | null;
  dataEntrada: string;
  createdAt: string;
  updatedAt: string;
}

const dataISO = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function produtoParaDTO(p: ProdutoQuimico): ProdutoQuimicoDTO {
  return {
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    numeroOnu: p.numeroOnu,
    classeRisco: p.classeRisco.codigo,
    classeRiscoDescricao: p.classeRisco.descricao,
    grupoCompatibilidade: p.grupoCompatibilidade,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function cargaParaDTO(c: CargaQuimica, produto: ProdutoQuimico | null, agora = new Date()): CargaQuimicaDTO {
  return {
    id: c.id,
    codigo: c.codigo,
    produto: produto
      ? {
          id: produto.id,
          nome: produto.nome,
          numeroOnu: produto.numeroOnu,
          classeRisco: produto.classeRisco.codigo,
        }
      : null,
    quantidade: c.quantidade.valor,
    unidade: c.quantidade.unidade,
    origem: c.origem,
    destino: c.destino,
    responsavelTecnico: {
      nome: c.responsavelTecnico.nome,
      registroProfissional: c.responsavelTecnico.registroProfissional,
    },
    documentos: c.documentos.map((d) => ({
      id: d.id,
      tipo: d.tipo,
      numero: d.numero,
      validade: dataISO(d.validade),
      situacao: d.situacao,
      vencido: d.estaVencido(agora),
      valido: d.estaValido(agora),
    })),
    documentacaoCompleta: c.documentacaoCompleta(agora),
    status: c.status,
    statusDescricao: ROTULOS_STATUS[c.status],
    transicoesPermitidas: [...c.transicoesPermitidas()],
    motivoBloqueio: c.motivoBloqueio,
    motivoCancelamento: c.motivoCancelamento,
    dataEntrada: c.dataEntrada.toISOString(),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function paginar<T>(itens: T[], total: number, pagina: number, limite: number): PaginaDTO<T> {
  return {
    dados: itens,
    meta: { total, pagina, limite, totalPaginas: Math.max(1, Math.ceil(total / limite)) },
  };
}

export function normalizarPaginacao(input: ListagemInput) {
  const pagina = Math.max(1, Math.floor(input.pagina ?? 1));
  const limite = Math.min(100, Math.max(1, Math.floor(input.limite ?? 20)));
  return { pagina, limite };
}
