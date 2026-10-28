import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from "graphql";
import { z } from "zod";
import { CasosDeUso } from "../../container";
import { RecursoNaoEncontradoError } from "../../domain/errors/domain-errors";
import { StatusCarga, valoresDe } from "../../domain/enums";
import { ROTULOS_STATUS } from "../../domain/value-objects/maquina-status-carga";

/**
 * Diferencial opcional (seção 14 da lauda): consulta GraphQL somente leitura.
 * Reaproveita os MESMOS casos de uso do REST — nenhuma regra é duplicada.
 * Cenário: o painel pede exatamente os campos de que precisa numa única chamada.
 */
export function criarSchemaGraphQL(casos: CasosDeUso): GraphQLSchema {
  const StatusCargaEnum = new GraphQLEnumType({
    name: "StatusCarga",
    values: Object.fromEntries(
      valoresDe(StatusCarga).map((s) => [s, { value: s, description: ROTULOS_STATUS[s] }]),
    ),
  });

  const ProdutoType = new GraphQLObjectType({
    name: "ProdutoQuimico",
    fields: {
      id: { type: new GraphQLNonNull(GraphQLID) },
      nome: { type: new GraphQLNonNull(GraphQLString) },
      descricao: { type: GraphQLString },
      numeroOnu: { type: new GraphQLNonNull(GraphQLString) },
      classeRisco: { type: new GraphQLNonNull(GraphQLString) },
      classeRiscoDescricao: { type: new GraphQLNonNull(GraphQLString) },
      grupoCompatibilidade: { type: new GraphQLNonNull(GraphQLString) },
      status: { type: new GraphQLNonNull(GraphQLString) },
    },
  });

  const ResponsavelType = new GraphQLObjectType({
    name: "ResponsavelTecnico",
    fields: {
      nome: { type: new GraphQLNonNull(GraphQLString) },
      registroProfissional: { type: GraphQLString },
    },
  });

  const ProdutoResumoType = new GraphQLObjectType({
    name: "ProdutoResumo",
    fields: {
      id: { type: new GraphQLNonNull(GraphQLID) },
      nome: { type: new GraphQLNonNull(GraphQLString) },
      numeroOnu: { type: new GraphQLNonNull(GraphQLString) },
      classeRisco: { type: new GraphQLNonNull(GraphQLString) },
    },
  });

  const CargaType = new GraphQLObjectType({
    name: "CargaQuimica",
    fields: {
      id: { type: new GraphQLNonNull(GraphQLID) },
      codigo: { type: new GraphQLNonNull(GraphQLString) },
      produto: { type: ProdutoResumoType },
      quantidade: { type: new GraphQLNonNull(GraphQLFloat) },
      unidade: { type: new GraphQLNonNull(GraphQLString) },
      origem: { type: new GraphQLNonNull(GraphQLString) },
      destino: { type: new GraphQLNonNull(GraphQLString) },
      responsavelTecnico: { type: new GraphQLNonNull(ResponsavelType) },
      documentacaoCompleta: { type: new GraphQLNonNull(GraphQLBoolean) },
      status: { type: new GraphQLNonNull(StatusCargaEnum) },
      statusDescricao: { type: new GraphQLNonNull(GraphQLString) },
      transicoesPermitidas: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(StatusCargaEnum))) },
      dataEntrada: { type: new GraphQLNonNull(GraphQLString) },
      updatedAt: { type: new GraphQLNonNull(GraphQLString) },
    },
  });

  const query = new GraphQLObjectType({
    name: "Query",
    fields: {
      cargasPorStatus: {
        type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CargaType))),
        description: "Lista cargas químicas filtradas por status.",
        args: {
          status: { type: new GraphQLNonNull(StatusCargaEnum) },
          limite: { type: GraphQLInt, defaultValue: 20 },
        },
        resolve: async (_root, args: { status: StatusCarga; limite: number }) =>
          (await casos.listarCargas.executar({ status: args.status, limite: args.limite })).dados,
      },
      produtoQuimico: {
        type: ProdutoType,
        description: "Detalhes de um produto químico pelo identificador.",
        args: { id: { type: new GraphQLNonNull(GraphQLID) } },
        resolve: async (_root, args: { id: string }) => {
          if (!z.uuid().safeParse(args.id).success) return null;
          try {
            return await casos.buscarProduto.executar(args.id);
          } catch (erro) {
            if (erro instanceof RecursoNaoEncontradoError) return null;
            throw erro;
          }
        },
      },
    },
  });

  return new GraphQLSchema({ query });
}
