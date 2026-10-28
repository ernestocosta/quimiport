import { asc, count, desc, eq, inArray, notInArray } from "drizzle-orm";
import { ConsultasQuimiPort, HistoricoStatusView, PendenciaDocumentacaoView } from "../../../application/ports";
import { StatusCarga, valoresDe } from "../../../domain/enums";
import { DocumentoCarga } from "../../../domain/entities/documento-carga";
import { Database } from "../../persistence/database";
import { cargasQuimicas, documentosCarga, historicoStatusCarga, produtosQuimicos } from "../../persistence/schema";

/** Modelo de leitura em SQL direto — consultas que cruzam carga, produto e histórico. */
export class DrizzleConsultas implements ConsultasQuimiPort {
  constructor(private readonly db: Database) {}

  private historicoBase() {
    return this.db
      .select({
        id: historicoStatusCarga.id,
        cargaId: historicoStatusCarga.cargaId,
        codigoCarga: cargasQuimicas.codigo,
        produtoNome: produtosQuimicos.nome,
        statusAnterior: historicoStatusCarga.statusAnterior,
        statusNovo: historicoStatusCarga.statusNovo,
        motivo: historicoStatusCarga.motivo,
        ocorridoEm: historicoStatusCarga.ocorridoEm,
      })
      .from(historicoStatusCarga)
      .innerJoin(cargasQuimicas, eq(cargasQuimicas.id, historicoStatusCarga.cargaId))
      .innerJoin(produtosQuimicos, eq(produtosQuimicos.id, cargasQuimicas.produtoId));
  }

  async historicoDaCarga(cargaId: string): Promise<HistoricoStatusView[]> {
    return this.historicoBase()
      .where(eq(historicoStatusCarga.cargaId, cargaId))
      .orderBy(asc(historicoStatusCarga.ocorridoEm));
  }

  async ultimasMovimentacoes(limite: number): Promise<HistoricoStatusView[]> {
    return this.historicoBase().orderBy(desc(historicoStatusCarga.ocorridoEm)).limit(limite);
  }

  async contagemPorStatus(): Promise<Record<StatusCarga, number>> {
    const rows = await this.db
      .select({ status: cargasQuimicas.status, total: count() })
      .from(cargasQuimicas)
      .groupBy(cargasQuimicas.status);
    const resultado = Object.fromEntries(valoresDe(StatusCarga).map((s) => [s, 0])) as Record<StatusCarga, number>;
    rows.forEach((r) => (resultado[r.status] = r.total));
    return resultado;
  }

  async totalProdutosAtivos(): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(produtosQuimicos)
      .where(eq(produtosQuimicos.status, "ATIVO"));
    return total;
  }

  async pendenciasDocumentacao(limite: number, referencia: Date): Promise<PendenciaDocumentacaoView[]> {
    // Só interessam cargas que ainda vão precisar ser liberadas.
    const cargas = await this.db
      .select({
        id: cargasQuimicas.id,
        codigo: cargasQuimicas.codigo,
        status: cargasQuimicas.status,
        responsavel: cargasQuimicas.responsavelTecnicoNome,
        produtoNome: produtosQuimicos.nome,
      })
      .from(cargasQuimicas)
      .innerJoin(produtosQuimicos, eq(produtosQuimicos.id, cargasQuimicas.produtoId))
      .where(notInArray(cargasQuimicas.status, ["LIBERADA", "BLOQUEADA", "EM_MOVIMENTACAO", "FINALIZADA", "CANCELADA"]))
      .orderBy(asc(cargasQuimicas.dataEntrada))
      .limit(200);

    if (!cargas.length) return [];
    const docs = await this.db
      .select()
      .from(documentosCarga)
      .where(inArray(documentosCarga.cargaId, cargas.map((c) => c.id)));

    return cargas
      .map((c) => {
        const daCarga = docs
          .filter((d) => d.cargaId === c.id)
          .map((d) => DocumentoCarga.criar({ id: d.id, tipo: d.tipo, validade: d.validade, situacao: d.situacao }));
        const pendentes = daCarga.filter((d) => !d.estaValido(referencia));
        return {
          cargaId: c.id,
          codigoCarga: c.codigo,
          produtoNome: c.produtoNome,
          status: c.status,
          responsavelTecnico: c.responsavel,
          documentosTotal: daCarga.length,
          documentosValidos: daCarga.length - pendentes.length,
          tiposPendentes: daCarga.length === 0 ? ["NENHUM_DOCUMENTO"] : pendentes.map((d) => d.tipo),
        };
      })
      .filter((p) => p.documentosTotal === 0 || p.documentosValidos < p.documentosTotal)
      .slice(0, limite);
  }
}
