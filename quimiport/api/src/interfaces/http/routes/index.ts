import { Router } from "express";
import { CasosDeUso } from "../../../container";
import { valoresDe, StatusCarga } from "../../../domain/enums";
import {
  ESTADOS_TERMINAIS,
  ROTULOS_STATUS,
  TRANSICOES_PERMITIDAS,
} from "../../../domain/value-objects/maquina-status-carga";
import { ClasseRisco } from "../../../domain/value-objects/classe-risco";
import { CargasQuimicasController } from "../controllers/cargas-quimicas.controller";
import { ProdutosQuimicosController } from "../controllers/produtos-quimicos.controller";

export function rotasProdutos(casos: CasosDeUso): Router {
  const c = new ProdutosQuimicosController(casos);
  return Router()
    .post("/", c.criar)
    .get("/", c.listar)
    .get("/:id", c.buscar)
    .put("/:id", c.atualizar)
    .patch("/:id/inativar", c.inativar);
}

export function rotasCargas(casos: CasosDeUso): Router {
  const c = new CargasQuimicasController(casos);
  return Router()
    .post("/", c.registrar)
    .get("/", c.listar)
    .get("/:id", c.buscar)
    .get("/:id/historico", c.historico)
    .patch("/:id/status", c.alterarStatus)
    .patch("/:id/liberar", c.liberar)
    .patch("/:id/bloquear", c.bloquear)
    .patch("/:id/cancelar", c.cancelar)
    .patch("/:id/documentos", c.atualizarDocumentos);
}

/** Endpoints de apoio: resumo para o painel e metadados de domínio. */
export function rotasConsultas(casos: CasosDeUso): Router {
  return Router()
    .get("/resumo-operacional", async (_req, res) => {
      res.json(await casos.resumoOperacional.executar());
    })
    .get("/meta/status-carga", (_req, res) => {
      res.json({
        status: valoresDe(StatusCarga).map((s) => ({
          codigo: s,
          descricao: ROTULOS_STATUS[s],
          terminal: ESTADOS_TERMINAIS.includes(s),
          transicoesPermitidas: TRANSICOES_PERMITIDAS[s],
        })),
      });
    })
    .get("/meta/classes-risco", (_req, res) => {
      res.json({
        classes: ClasseRisco.classesValidas().map((codigo) => ({
          codigo,
          descricao: ClasseRisco.criar(codigo).descricao,
        })),
      });
    });
}
