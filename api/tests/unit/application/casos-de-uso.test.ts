import { criarCasosDeUso } from "../../../src/container";
import { ConflitoError, RecursoNaoEncontradoError, RegraDeNegocioError } from "../../../src/domain/errors/domain-errors";
import {
  InMemoryBanco,
  InMemoryCargaQuimicaRepository,
  InMemoryConsultas,
  InMemoryProdutoQuimicoRepository,
} from "../../../src/infrastructure/repositories/in-memory/in-memory";
import { VALIDADE_FUTURA, produtoValido } from "../../helpers/fabricas";

function montar() {
  const banco = new InMemoryBanco();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const metricas = { registrarTransicao: vi.fn(), registrarRegraViolada: vi.fn() };
  const casos = criarCasosDeUso({
    produtos: new InMemoryProdutoQuimicoRepository(banco),
    cargas: new InMemoryCargaQuimicaRepository(banco),
    consultas: new InMemoryConsultas(banco),
    logger,
    metricas,
  });
  return { banco, casos, logger, metricas };
}

const cargaInput = (produtoId: string) => ({
  produtoId,
  quantidade: 500,
  unidade: "KG",
  origem: "Berço 3",
  destino: "Armazém 1",
  responsavelTecnico: { nome: "Paulo Andrade" },
  documentos: [{ tipo: "FISPQ", situacao: "VALIDO", validade: VALIDADE_FUTURA }],
});

describe("Casos de uso", () => {
  it("CriarProdutoQuimico persiste e registra log de criação", async () => {
    const { casos, banco, logger } = montar();
    const dto = await casos.criarProduto.executar(produtoValido());
    expect(banco.produtos.has(dto.id)).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ evento: "produto.criado" }), expect.any(String));
  });

  it("RegistrarCargaQuimica recusa produto inexistente", async () => {
    const { casos } = montar();
    await expect(casos.registrarCarga.executar(cargaInput("00000000-0000-4000-8000-000000000000"))).rejects.toMatchObject({
      code: "PRODUTO_NAO_ENCONTRADO",
    });
  });

  it("RegistrarCargaQuimica recusa código duplicado", async () => {
    const { casos } = montar();
    const produto = await casos.criarProduto.executar(produtoValido());
    await casos.registrarCarga.executar({ ...cargaInput(produto.id), codigo: "QPA-TESTE-1" });
    await expect(casos.registrarCarga.executar({ ...cargaInput(produto.id), codigo: "qpa-teste-1" })).rejects.toBeInstanceOf(
      ConflitoError,
    );
  });

  it("RegistrarCargaQuimica grava histórico, log e métrica", async () => {
    const { casos, banco, logger, metricas } = montar();
    const produto = await casos.criarProduto.executar(produtoValido());
    const carga = await casos.registrarCarga.executar(cargaInput(produto.id));
    expect(carga.status).toBe("REGISTRADA");
    expect(carga.produto?.nome).toBe(produto.nome);
    expect(banco.historico).toHaveLength(1);
    expect(metricas.registrarTransicao).toHaveBeenCalledWith(null, "REGISTRADA");
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ evento: "carga.registrada" }), expect.any(String));
  });

  it("AlterarStatusCarga loga liberação e bloqueio com o evento correto", async () => {
    const { casos, logger } = montar();
    const produto = await casos.criarProduto.executar(produtoValido());
    const a = await casos.registrarCarga.executar(cargaInput(produto.id));
    const b = await casos.registrarCarga.executar(cargaInput(produto.id));
    for (const id of [a.id, b.id]) {
      await casos.alterarStatusCarga.executar(id, { tipo: "status", status: "EM_ANALISE" });
      await casos.alterarStatusCarga.executar(id, { tipo: "status", status: "EM_INSPECAO" });
    }
    await casos.alterarStatusCarga.executar(a.id, { tipo: "liberar" });
    await casos.alterarStatusCarga.executar(b.id, { tipo: "bloquear", motivo: "Lacre violado" });
    const eventos = logger.info.mock.calls.map(([obj]) => obj.evento);
    expect(eventos).toContain("carga.liberada");
    expect(eventos).toContain("carga.bloqueada");
  });

  it("AlterarStatusCarga não persiste nada quando a regra é violada", async () => {
    const { casos, banco } = montar();
    const produto = await casos.criarProduto.executar(produtoValido());
    const carga = await casos.registrarCarga.executar(cargaInput(produto.id));
    await expect(casos.alterarStatusCarga.executar(carga.id, { tipo: "liberar" })).rejects.toThrow();
    expect(banco.historico).toHaveLength(1);
    expect(banco.cargas.get(carga.id)?.status).toBe("REGISTRADA");
  });

  it("buscas de recurso inexistente lançam RecursoNaoEncontradoError", async () => {
    const { casos } = montar();
    const id = "00000000-0000-4000-8000-000000000000";
    await expect(casos.buscarProduto.executar(id)).rejects.toBeInstanceOf(RecursoNaoEncontradoError);
    await expect(casos.buscarCarga.executar(id)).rejects.toBeInstanceOf(RecursoNaoEncontradoError);
    await expect(casos.inativarProduto.executar(id)).rejects.toBeInstanceOf(RecursoNaoEncontradoError);
  });

  it("ListarProdutosQuimicos pagina e filtra", async () => {
    const { casos } = montar();
    for (let i = 0; i < 5; i++) await casos.criarProduto.executar(produtoValido({ nome: `Produto ${i}` }));
    const inativo = await casos.criarProduto.executar(produtoValido({ nome: "Inativo" }));
    await casos.inativarProduto.executar(inativo.id);

    const pagina = await casos.listarProdutos.executar({ pagina: 2, limite: 2 });
    expect(pagina.dados).toHaveLength(2);
    expect(pagina.meta).toEqual({ total: 6, pagina: 2, limite: 2, totalPaginas: 3 });

    const ativos = await casos.listarProdutos.executar({ status: "ATIVO" });
    expect(ativos.meta.total).toBe(5);
  });

  it("ResumoOperacional consolida contagem e pendências", async () => {
    const { casos } = montar();
    const produto = await casos.criarProduto.executar(produtoValido());
    await casos.registrarCarga.executar({ ...cargaInput(produto.id), documentos: [] });
    const resumo = await casos.resumoOperacional.executar();
    expect(resumo.totalCargas).toBe(1);
    expect(resumo.cargasPorStatus.REGISTRADA).toBe(1);
    expect(resumo.pendenciasDocumentacao[0].tiposPendentes).toEqual(["NENHUM_DOCUMENTO"]);
    expect(resumo.ultimasMovimentacoes).toHaveLength(1);
  });

  it("inativar produto já inativo é regra de negócio", async () => {
    const { casos } = montar();
    const produto = await casos.criarProduto.executar(produtoValido());
    await casos.inativarProduto.executar(produto.id);
    await expect(casos.inativarProduto.executar(produto.id)).rejects.toBeInstanceOf(RegraDeNegocioError);
  });
});
