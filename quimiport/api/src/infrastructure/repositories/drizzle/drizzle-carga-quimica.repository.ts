import { and, asc, count, desc, eq, ilike, inArray, or, SQL } from "drizzle-orm";
import { CargaQuimica } from "../../../domain/aggregates/carga-quimica";
import { CargaQuimicaRepository, FiltroCargas, Pagina } from "../../../domain/repositories";
import { Database } from "../../persistence/database";
import { cargasQuimicas, documentosCarga, historicoStatusCarga } from "../../persistence/schema";
import { CargaMapper } from "./mappers";

export class DrizzleCargaQuimicaRepository implements CargaQuimicaRepository {
  constructor(private readonly db: Database) {}

  /**
   * Salva o agregado inteiro numa transação: carga + documentos + novas
   * entradas de histórico. Ou grava tudo, ou não grava nada.
   */
  async salvar(carga: CargaQuimica): Promise<void> {
    const dados = CargaMapper.paraBanco(carga);
    const documentos = CargaMapper.documentosParaBanco(carga);
    const mudancas = carga.mudancasNaoPersistidas();

    await this.db.transaction(async (tx) => {
      await tx
        .insert(cargasQuimicas)
        .values(dados)
        .onConflictDoUpdate({ target: cargasQuimicas.id, set: { ...dados, id: undefined } });

      await tx.delete(documentosCarga).where(eq(documentosCarga.cargaId, carga.id));
      if (documentos.length) await tx.insert(documentosCarga).values(documentos);

      if (mudancas.length) {
        await tx.insert(historicoStatusCarga).values(
          mudancas.map((m) => ({
            id: m.id,
            cargaId: carga.id,
            statusAnterior: m.statusAnterior,
            statusNovo: m.statusNovo,
            motivo: m.motivo,
            ocorridoEm: m.ocorridoEm,
          })),
        );
      }
    });

    carga.confirmarPersistencia();
  }

  async buscarPorId(id: string): Promise<CargaQuimica | null> {
    const [row] = await this.db.select().from(cargasQuimicas).where(eq(cargasQuimicas.id, id)).limit(1);
    if (!row) return null;
    const docs = await this.db
      .select()
      .from(documentosCarga)
      .where(eq(documentosCarga.cargaId, id))
      .orderBy(asc(documentosCarga.createdAt));
    return CargaMapper.paraDominio(row, docs);
  }

  async existeCodigo(codigo: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: cargasQuimicas.id })
      .from(cargasQuimicas)
      .where(eq(cargasQuimicas.codigo, codigo))
      .limit(1);
    return Boolean(row);
  }

  async listar(filtro: FiltroCargas): Promise<Pagina<CargaQuimica>> {
    const condicoes: SQL[] = [];
    if (filtro.status) condicoes.push(eq(cargasQuimicas.status, filtro.status));
    if (filtro.produtoId) condicoes.push(eq(cargasQuimicas.produtoId, filtro.produtoId));
    if (filtro.busca) {
      const termo = `%${filtro.busca}%`;
      condicoes.push(
        or(
          ilike(cargasQuimicas.codigo, termo),
          ilike(cargasQuimicas.origem, termo),
          ilike(cargasQuimicas.destino, termo),
          ilike(cargasQuimicas.responsavelTecnicoNome, termo),
        )!,
      );
    }
    const where = condicoes.length ? and(...condicoes) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(cargasQuimicas)
        .where(where)
        .orderBy(desc(cargasQuimicas.updatedAt))
        .limit(filtro.limite)
        .offset((filtro.pagina - 1) * filtro.limite),
      this.db.select({ total: count() }).from(cargasQuimicas).where(where),
    ]);

    const ids = rows.map((r) => r.id);
    const docs = ids.length
      ? await this.db
          .select()
          .from(documentosCarga)
          .where(inArray(documentosCarga.cargaId, ids))
          .orderBy(asc(documentosCarga.createdAt))
      : [];

    return {
      itens: rows.map((r) => CargaMapper.paraDominio(r, docs.filter((d) => d.cargaId === r.id))),
      total,
    };
  }
}
