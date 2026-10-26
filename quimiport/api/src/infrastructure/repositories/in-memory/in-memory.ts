import { ConsultasQuimiPort, HistoricoStatusView, PendenciaDocumentacaoView } from "../../../application/ports";
import { CargaQuimica, MudancaDeStatus } from "../../../domain/aggregates/carga-quimica";
import { ProdutoQuimico } from "../../../domain/entities/produto-quimico";
import { StatusCarga, StatusProduto, valoresDe } from "../../../domain/enums";
import {
  CargaQuimicaRepository,
  FiltroCargas,
  FiltroProdutos,
  Pagina,
  ProdutoQuimicoRepository,
} from "../../../domain/repositories";

/**
 * Implementações em memória dos repositórios. Usadas nos testes
 * (rápidos, sem banco) e como prova de que o domínio não depende do ORM.
 */
export class InMemoryBanco {
  produtos = new Map<string, ProdutoQuimico>();
  cargas = new Map<string, CargaQuimica>();
  historico: (MudancaDeStatus & { cargaId: string })[] = [];
}

const paginar = <T>(itens: T[], pagina: number, limite: number): Pagina<T> => ({
  itens: itens.slice((pagina - 1) * limite, pagina * limite),
  total: itens.length,
});

const contem = (valor: string, termo: string) => valor.toLowerCase().includes(termo.toLowerCase());

export class InMemoryProdutoQuimicoRepository implements ProdutoQuimicoRepository {
  constructor(private readonly banco: InMemoryBanco) {}

  async salvar(produto: ProdutoQuimico) {
    this.banco.produtos.set(produto.id, produto);
  }

  async buscarPorId(id: string) {
    return this.banco.produtos.get(id) ?? null;
  }

  async buscarPorIds(ids: string[]) {
    return ids.map((id) => this.banco.produtos.get(id)).filter((p): p is ProdutoQuimico => Boolean(p));
  }

  async listar(filtro: FiltroProdutos) {
    const itens = [...this.banco.produtos.values()]
      .filter((p) => !filtro.status || p.status === filtro.status)
      .filter((p) => !filtro.busca || contem(p.nome, filtro.busca) || contem(p.numeroOnu, filtro.busca))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return paginar(itens, filtro.pagina, filtro.limite);
  }
}

export class InMemoryCargaQuimicaRepository implements CargaQuimicaRepository {
  constructor(private readonly banco: InMemoryBanco) {}

  async salvar(carga: CargaQuimica) {
    this.banco.cargas.set(carga.id, carga);
    carga.mudancasNaoPersistidas().forEach((m) => this.banco.historico.push({ ...m, cargaId: carga.id }));
    carga.confirmarPersistencia();
  }

  async buscarPorId(id: string) {
    return this.banco.cargas.get(id) ?? null;
  }

  async existeCodigo(codigo: string) {
    return [...this.banco.cargas.values()].some((c) => c.codigo === codigo);
  }

  async listar(filtro: FiltroCargas) {
    const itens = [...this.banco.cargas.values()]
      .filter((c) => !filtro.status || c.status === filtro.status)
      .filter((c) => !filtro.produtoId || c.produtoId === filtro.produtoId)
      .filter(
        (c) =>
          !filtro.busca ||
          [c.codigo, c.origem, c.destino, c.responsavelTecnico.nome].some((v) => contem(v, filtro.busca!)),
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return paginar(itens, filtro.pagina, filtro.limite);
  }
}

export class InMemoryConsultas implements ConsultasQuimiPort {
  constructor(private readonly banco: InMemoryBanco) {}

  private paraView(h: MudancaDeStatus & { cargaId: string }): HistoricoStatusView {
    const carga = this.banco.cargas.get(h.cargaId)!;
    return {
      id: h.id,
      cargaId: h.cargaId,
      codigoCarga: carga.codigo,
      produtoNome: this.banco.produtos.get(carga.produtoId)?.nome ?? "",
      statusAnterior: h.statusAnterior,
      statusNovo: h.statusNovo,
      motivo: h.motivo,
      ocorridoEm: h.ocorridoEm,
    };
  }

  async historicoDaCarga(cargaId: string) {
    return this.banco.historico.filter((h) => h.cargaId === cargaId).map((h) => this.paraView(h));
  }

  async ultimasMovimentacoes(limite: number) {
    return [...this.banco.historico]
      .reverse()
      .slice(0, limite)
      .map((h) => this.paraView(h));
  }

  async contagemPorStatus() {
    const resultado = Object.fromEntries(valoresDe(StatusCarga).map((s) => [s, 0])) as Record<StatusCarga, number>;
    this.banco.cargas.forEach((c) => (resultado[c.status] += 1));
    return resultado;
  }

  async totalProdutosAtivos() {
    return [...this.banco.produtos.values()].filter((p) => p.status === StatusProduto.ATIVO).length;
  }

  async pendenciasDocumentacao(limite: number, referencia: Date): Promise<PendenciaDocumentacaoView[]> {
    const encerradas: StatusCarga[] = ["LIBERADA", "BLOQUEADA", "EM_MOVIMENTACAO", "FINALIZADA", "CANCELADA"];
    return [...this.banco.cargas.values()]
      .filter((c) => !encerradas.includes(c.status) && !c.documentacaoCompleta(referencia))
      .slice(0, limite)
      .map((c) => {
        const pendentes = c.documentosPendentes(referencia);
        return {
          cargaId: c.id,
          codigoCarga: c.codigo,
          produtoNome: this.banco.produtos.get(c.produtoId)?.nome ?? "",
          status: c.status,
          responsavelTecnico: c.responsavelTecnico.nome,
          documentosTotal: c.documentos.length,
          documentosValidos: c.documentos.length - pendentes.length,
          tiposPendentes: c.documentos.length === 0 ? ["NENHUM_DOCUMENTO"] : pendentes.map((d) => d.tipo),
        };
      });
  }
}
