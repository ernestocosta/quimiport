import { z } from "zod";
import { StatusCarga, StatusProduto, valoresDe } from "../../../domain/enums";

/**
 * Schemas de entrada da camada HTTP.
 * Aqui validamos apenas FORMATO (tipos, UUID, datas). Regras de negócio
 * (nome obrigatório, quantidade > 0, produto ativo...) ficam no domínio e
 * retornam 422 — assim cada regra da lauda tem um código de erro próprio.
 */

const textoOpcional = z.string().max(500).optional().nullable();

export const idParamSchema = z.object({
  id: z.uuid({ error: "O identificador informado não é um UUID válido." }),
});

export const produtoBodySchema = z.object({
  nome: z.string().max(150).optional(),
  descricao: textoOpcional,
  numeroOnu: z.union([z.string(), z.number()]).transform(String).optional(),
  classeRisco: z.union([z.string(), z.number()]).transform(String).optional(),
  grupoCompatibilidade: z.string().max(50).optional(),
  status: z.string().optional(),
});

const documentoSchema = z.object({
  tipo: z.string({ error: "Informe o tipo do documento." }),
  numero: z.string().max(60).optional().nullable(),
  validade: z.iso.date({ error: "Validade deve estar no formato AAAA-MM-DD." }).optional().nullable(),
  situacao: z.string().optional(),
});

export const registrarCargaBodySchema = z.object({
  codigo: z.string().max(30).optional(),
  produtoId: z.uuid({ error: "produtoId deve ser um UUID válido." }).optional(),
  quantidade: z.number({ error: "quantidade deve ser numérica." }).optional(),
  unidade: z.string().optional(),
  origem: z.string().max(150).optional(),
  destino: z.string().max(150).optional(),
  responsavelTecnico: z
    .object({
      nome: z.string().max(150).optional(),
      registroProfissional: z.string().max(50).optional().nullable(),
    })
    .optional()
    .nullable(),
  documentos: z.array(documentoSchema).max(20).optional(),
  dataEntrada: z.iso.datetime({ offset: true, error: "dataEntrada deve ser ISO 8601." }).optional(),
});

export const alterarStatusBodySchema = z.object({
  status: z.string({ error: "Informe o novo status da carga." }),
  motivo: z.string().max(500).optional().nullable(),
});

export const motivoBodySchema = z.object({
  motivo: z.string().max(500).optional(),
});

export const documentosBodySchema = z.object({
  documentos: z.array(documentoSchema, { error: "Informe a lista de documentos." }).max(20),
});

const paginacao = {
  pagina: z.coerce.number().int().positive().optional(),
  limite: z.coerce.number().int().positive().max(100).optional(),
  busca: z.string().max(100).optional(),
};

export const listarProdutosQuerySchema = z.object({
  ...paginacao,
  status: z.enum(valoresDe(StatusProduto)).optional(),
});

export const listarCargasQuerySchema = z.object({
  ...paginacao,
  status: z.enum(valoresDe(StatusCarga)).optional(),
  produtoId: z.uuid().optional(),
});
