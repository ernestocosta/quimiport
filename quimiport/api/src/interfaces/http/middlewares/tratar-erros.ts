import { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { Metricas } from "../../../application/ports";
import {
  ConflitoError,
  DomainError,
  RecursoNaoEncontradoError,
  RegraDeNegocioError,
  TransicaoDeStatusInvalidaError,
} from "../../../domain/errors/domain-errors";

export interface CorpoErro {
  erro: {
    codigo: string;
    mensagem: string;
    detalhes?: unknown;
    requestId?: string;
  };
}

function statusDe(erro: DomainError): number {
  if (erro instanceof RecursoNaoEncontradoError) return 404;
  if (erro instanceof TransicaoDeStatusInvalidaError) return 409;
  if (erro instanceof ConflitoError) return 409;
  if (erro instanceof RegraDeNegocioError) return 422;
  return 400;
}

/** Converte qualquer erro em resposta JSON padronizada + log no nível certo. */
export function tratarErros(metricas: Metricas): ErrorRequestHandler {
  return (erro, req, res, _next) => {
    const requestId = String(req.id ?? "");
    const enviar = (status: number, corpo: CorpoErro["erro"]) =>
      res.status(status).json({ erro: { ...corpo, requestId } } satisfies CorpoErro);

    if (erro instanceof ZodError) {
      const detalhes = erro.issues.map((i) => ({ campo: i.path.join("."), mensagem: i.message }));
      req.log.warn({ evento: "requisicao.invalida", detalhes }, "Erro de validação da requisição");
      return enviar(400, { codigo: "REQUISICAO_INVALIDA", mensagem: "Dados da requisição inválidos.", detalhes });
    }

    if (erro instanceof DomainError) {
      const status = statusDe(erro);
      if (erro instanceof RegraDeNegocioError || erro instanceof TransicaoDeStatusInvalidaError) {
        metricas.registrarRegraViolada(erro.code);
      }
      req.log.warn(
        { evento: "regra.violada", codigo: erro.code, detalhes: erro.details },
        erro.message,
      );
      return enviar(status, { codigo: erro.code, mensagem: erro.message, detalhes: erro.details });
    }

    // JSON malformado no corpo da requisição.
    if (erro?.type === "entity.parse.failed") {
      req.log.warn({ evento: "requisicao.invalida" }, "JSON malformado");
      return enviar(400, { codigo: "JSON_INVALIDO", mensagem: "O corpo da requisição não é um JSON válido." });
    }

    // Violação de unicidade no PostgreSQL (corrida entre dois cadastros iguais).
    if (erro?.code === "23505") {
      req.log.warn({ evento: "conflito", constraint: erro.constraint }, "Registro duplicado");
      return enviar(409, { codigo: "CONFLITO", mensagem: "Registro duplicado." });
    }

    req.log.error({ evento: "erro.interno", err: erro }, "Erro interno não tratado");
    return enviar(500, { codigo: "ERRO_INTERNO", mensagem: "Erro interno do servidor." });
  };
}

export const rotaNaoEncontrada: RequestHandler = (req, res) => {
  res.status(404).json({
    erro: {
      codigo: "ROTA_NAO_ENCONTRADA",
      mensagem: `Rota ${req.method} ${req.path} não existe. Consulte /docs.`,
      requestId: String(req.id ?? ""),
    },
  } satisfies CorpoErro);
};
