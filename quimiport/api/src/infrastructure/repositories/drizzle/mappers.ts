import { CargaQuimica } from "../../../domain/aggregates/carga-quimica";
import { DocumentoCarga } from "../../../domain/entities/documento-carga";
import { ProdutoQuimico } from "../../../domain/entities/produto-quimico";
import { Quantidade } from "../../../domain/value-objects/quantidade";
import { ResponsavelTecnico } from "../../../domain/value-objects/responsavel-tecnico";
import { cargasQuimicas, documentosCarga, produtosQuimicos } from "../../persistence/schema";

type ProdutoRow = typeof produtosQuimicos.$inferSelect;
type CargaRow = typeof cargasQuimicas.$inferSelect;
type DocumentoRow = typeof documentosCarga.$inferSelect;

/** Tradução entre linhas do banco e objetos de domínio (anti-corruption layer). */
export const ProdutoMapper = {
  paraDominio(row: ProdutoRow): ProdutoQuimico {
    return ProdutoQuimico.restaurar({
      id: row.id,
      nome: row.nome,
      descricao: row.descricao,
      numeroOnu: row.numeroOnu,
      classeRisco: row.classeRisco,
      grupoCompatibilidade: row.grupoCompatibilidade,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  paraBanco(p: ProdutoQuimico): typeof produtosQuimicos.$inferInsert {
    return {
      id: p.id,
      nome: p.nome,
      descricao: p.descricao,
      numeroOnu: p.numeroOnu,
      classeRisco: p.classeRisco.codigo,
      grupoCompatibilidade: p.grupoCompatibilidade,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  },
};

export const CargaMapper = {
  paraDominio(row: CargaRow, documentos: DocumentoRow[]): CargaQuimica {
    return CargaQuimica.restaurar({
      id: row.id,
      codigo: row.codigo,
      produtoId: row.produtoId,
      quantidade: Quantidade.criar(Number(row.quantidade), row.unidade),
      origem: row.origem,
      destino: row.destino,
      responsavelTecnico: ResponsavelTecnico.criar(row.responsavelTecnicoNome, row.responsavelTecnicoRegistro),
      documentos: documentos.map((d) =>
        DocumentoCarga.criar({
          id: d.id,
          tipo: d.tipo,
          numero: d.numero,
          validade: d.validade,
          situacao: d.situacao,
        }),
      ),
      status: row.status,
      motivoBloqueio: row.motivoBloqueio,
      motivoCancelamento: row.motivoCancelamento,
      dataEntrada: row.dataEntrada,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  paraBanco(c: CargaQuimica): typeof cargasQuimicas.$inferInsert {
    return {
      id: c.id,
      codigo: c.codigo,
      produtoId: c.produtoId,
      quantidade: c.quantidade.valor,
      unidade: c.quantidade.unidade,
      origem: c.origem,
      destino: c.destino,
      responsavelTecnicoNome: c.responsavelTecnico.nome,
      responsavelTecnicoRegistro: c.responsavelTecnico.registroProfissional,
      status: c.status,
      motivoBloqueio: c.motivoBloqueio,
      motivoCancelamento: c.motivoCancelamento,
      dataEntrada: c.dataEntrada,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  },

  documentosParaBanco(c: CargaQuimica): (typeof documentosCarga.$inferInsert)[] {
    return c.documentos.map((d) => ({
      id: d.id,
      cargaId: c.id,
      tipo: d.tipo,
      numero: d.numero,
      validade: d.validade,
      situacao: d.situacao,
    }));
  },
};
