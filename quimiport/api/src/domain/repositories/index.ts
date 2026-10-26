import { CargaQuimica } from "../aggregates/carga-quimica";
import { ProdutoQuimico } from "../entities/produto-quimico";
import { StatusCarga, StatusProduto } from "../enums";

export interface Paginacao {
  pagina: number;
  limite: number;
}

export interface Pagina<T> {
  itens: T[];
  total: number;
}

export interface FiltroProdutos extends Paginacao {
  status?: StatusProduto;
  busca?: string;
}

export interface FiltroCargas extends Paginacao {
  status?: StatusCarga;
  produtoId?: string;
  busca?: string;
}

/** Contrato do repositório de produtos — implementado na infraestrutura. */
export interface ProdutoQuimicoRepository {
  salvar(produto: ProdutoQuimico): Promise<void>;
  buscarPorId(id: string): Promise<ProdutoQuimico | null>;
  buscarPorIds(ids: string[]): Promise<ProdutoQuimico[]>;
  listar(filtro: FiltroProdutos): Promise<Pagina<ProdutoQuimico>>;
}

/** Contrato do repositório do agregado Carga Química. */
export interface CargaQuimicaRepository {
  /** Persiste a carga, seus documentos e as mudanças de status pendentes (atômico). */
  salvar(carga: CargaQuimica): Promise<void>;
  buscarPorId(id: string): Promise<CargaQuimica | null>;
  existeCodigo(codigo: string): Promise<boolean>;
  listar(filtro: FiltroCargas): Promise<Pagina<CargaQuimica>>;
}
