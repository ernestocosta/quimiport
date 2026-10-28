import { Request, Response } from "express";
import { CasosDeUso } from "../../../container";
import { idParamSchema, listarProdutosQuerySchema, produtoBodySchema } from "../schemas";

export class ProdutosQuimicosController {
  constructor(private readonly casos: CasosDeUso) {}

  criar = async (req: Request, res: Response) => {
    const body = produtoBodySchema.parse(req.body ?? {});
    const produto = await this.casos.criarProduto.executar(body);
    res.status(201).location(`/produtos-quimicos/${produto.id}`).json(produto);
  };

  listar = async (req: Request, res: Response) => {
    const query = listarProdutosQuerySchema.parse(req.query);
    res.json(await this.casos.listarProdutos.executar(query));
  };

  buscar = async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    res.json(await this.casos.buscarProduto.executar(id));
  };

  atualizar = async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    const body = produtoBodySchema.parse(req.body ?? {});
    res.json(await this.casos.atualizarProduto.executar(id, body));
  };

  inativar = async (req: Request, res: Response) => {
    const { id } = idParamSchema.parse(req.params);
    res.json(await this.casos.inativarProduto.executar(id));
  };
}
