import { and, count, desc, eq, ilike, inArray, or, SQL } from "drizzle-orm";
import { ProdutoQuimico } from "../../../domain/entities/produto-quimico";
import { FiltroProdutos, Pagina, ProdutoQuimicoRepository } from "../../../domain/repositories";
import { Database } from "../../persistence/database";
import { produtosQuimicos } from "../../persistence/schema";
import { ProdutoMapper } from "./mappers";

export class DrizzleProdutoQuimicoRepository implements ProdutoQuimicoRepository {
  constructor(private readonly db: Database) {}

  async salvar(produto: ProdutoQuimico): Promise<void> {
    const dados = ProdutoMapper.paraBanco(produto);
    await this.db
      .insert(produtosQuimicos)
      .values(dados)
      .onConflictDoUpdate({ target: produtosQuimicos.id, set: { ...dados, id: undefined } });
  }

  async buscarPorId(id: string): Promise<ProdutoQuimico | null> {
    const [row] = await this.db.select().from(produtosQuimicos).where(eq(produtosQuimicos.id, id)).limit(1);
    return row ? ProdutoMapper.paraDominio(row) : null;
  }

  async buscarPorIds(ids: string[]): Promise<ProdutoQuimico[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.select().from(produtosQuimicos).where(inArray(produtosQuimicos.id, ids));
    return rows.map(ProdutoMapper.paraDominio);
  }

  async listar(filtro: FiltroProdutos): Promise<Pagina<ProdutoQuimico>> {
    const condicoes: SQL[] = [];
    if (filtro.status) condicoes.push(eq(produtosQuimicos.status, filtro.status));
    if (filtro.busca) {
      const termo = `%${filtro.busca}%`;
      condicoes.push(or(ilike(produtosQuimicos.nome, termo), ilike(produtosQuimicos.numeroOnu, termo))!);
    }
    const where = condicoes.length ? and(...condicoes) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(produtosQuimicos)
        .where(where)
        .orderBy(desc(produtosQuimicos.createdAt))
        .limit(filtro.limite)
        .offset((filtro.pagina - 1) * filtro.limite),
      this.db.select({ total: count() }).from(produtosQuimicos).where(where),
    ]);

    return { itens: rows.map(ProdutoMapper.paraDominio), total };
  }
}
