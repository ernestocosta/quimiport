import { Request, Response } from "express";
import { StatusCarga } from "../../../domain/enums";
import { CasosDeUso } from "../../../container";
import {
  alterarStatusBodySchema,
  documentosBodySchema,
  idParamSchema,
  listarCargasQuerySchema,
  motivoBodySchema,
  registrarCargaBodySchema,
} from "../schemas";

export class CargasQuimicasController {
  constructor(private readonly casos: CasosDeUso) {}

  registrar = async (req: Request, res: Response) => {
    const body = registrarCargaBodySchema.parse(req.body ?? {});
    const carga = await this.casos.registrarCarga.executar(body);
    res.status(201).location(`/cargas-quimicas/${carga.id}`).json(carga);
  };

  listar = async (req: Request, res: Response) => {
    const query = listarCargasQuerySchema.parse(req.query);
    res.json(await this.casos.listarCargas.executar(query));
  };

  buscar = async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    res.json(await this.casos.buscarCarga.executar(id));
  };

  alterarStatus = async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const { status, motivo } = alterarStatusBodySchema.parse(req.body ?? {});
    res.json(
      await this.casos.alterarStatusCarga.executar(id, {
        tipo: "status",
        status: status.trim().toUpperCase() as StatusCarga,
        motivo,
      }),
    );
  };

  liberar = async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    res.json(await this.casos.alterarStatusCarga.executar(id, { tipo: "liberar" }));
  };

  bloquear = async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const { motivo } = motivoBodySchema.parse(req.body ?? {});
    res.json(await this.casos.alterarStatusCarga.executar(id, { tipo: "bloquear", motivo: motivo ?? "" }));
  };

  cancelar = async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const { motivo } = motivoBodySchema.parse(req.body ?? {});
    res.json(await this.casos.alterarStatusCarga.executar(id, { tipo: "cancelar", motivo: motivo ?? "" }));
  };

  atualizarDocumentos = async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const { documentos } = documentosBodySchema.parse(req.body ?? {});
    res.json(await this.casos.atualizarDocumentos.executar(id, documentos));
  };

  historico = async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    res.json({ dados: await this.casos.historicoCarga.executar(id) });
  };
}
