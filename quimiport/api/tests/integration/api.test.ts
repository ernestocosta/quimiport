import request from "supertest";
import type { Express } from "express";
import { appComPostgres, appEmMemoria } from "../helpers/app-de-teste";
import { VALIDADE_FUTURA } from "../helpers/fabricas";

/**
 * Testes de integração HTTP (Supertest). A mesma suíte roda:
 *  - sempre com repositórios em memória;
 *  - com PostgreSQL real quando DATABASE_URL_TEST está definida (CI e local).
 */
const backends: [string, () => Promise<{ app: Express; limpar: () => Promise<void>; fechar: () => Promise<void> }>][] = [
  ["memória", async () => appEmMemoria()],
];
if (process.env.DATABASE_URL_TEST) {
  backends.push(["PostgreSQL", () => appComPostgres(process.env.DATABASE_URL_TEST!)]);
}

const ID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";

const produtoBody = (extra: Record<string, unknown> = {}) => ({
  nome: "Ácido Sulfúrico 98%",
  descricao: "Ácido inorgânico forte",
  numeroOnu: "1830",
  classeRisco: "8",
  grupoCompatibilidade: "ACIDOS",
  ...extra,
});

const documentosOk = [
  { tipo: "FISPQ", numero: "F-1", validade: VALIDADE_FUTURA, situacao: "VALIDO" },
  { tipo: "CERTIFICADO_ANALISE", numero: "C-1", validade: VALIDADE_FUTURA, situacao: "VALIDO" },
];

describe.each(backends)("API QuimiPort — backend %s", (_nome, montar) => {
  let app: Express;
  let limpar: () => Promise<void>;
  let fechar: () => Promise<void>;

  beforeAll(async () => {
    ({ app, limpar, fechar } = await montar());
  });
  beforeEach(async () => {
    await limpar();
  });
  afterAll(async () => {
    await fechar();
  });

  const criarProduto = async (extra: Record<string, unknown> = {}) => {
    const res = await request(app).post("/produtos-quimicos").send(produtoBody(extra)).expect(201);
    return res.body as { id: string; status: string };
  };

  const registrarCarga = (produtoId: string, extra: Record<string, unknown> = {}) =>
    request(app)
      .post("/cargas-quimicas")
      .send({
        produtoId,
        quantidade: 24000,
        unidade: "KG",
        origem: "Navio MSC Aurora — Berço 12",
        destino: "Tanques B-02",
        responsavelTecnico: { nome: "Bruno Costa", registroProfissional: "CRQ-IV 0412" },
        documentos: documentosOk,
        ...extra,
      });

  const cargaNoStatus = async (alvo: "EM_ANALISE" | "EM_INSPECAO" | "LIBERADA", extra: Record<string, unknown> = {}) => {
    const produto = await criarProduto();
    const { body: carga } = await registrarCarga(produto.id, extra).expect(201);
    for (const status of ["EM_ANALISE", "EM_INSPECAO", "LIBERADA"]) {
      await request(app).patch(`/cargas-quimicas/${carga.id}/status`).send({ status }).expect(200);
      if (status === alvo) break;
    }
    return carga as { id: string };
  };

  // ------------------------------------------------------------- produtos

  describe("Produtos químicos", () => {
    it("[lauda] cadastra produto químico", async () => {
      const res = await request(app).post("/produtos-quimicos").send(produtoBody()).expect(201);
      expect(res.headers.location).toBe(`/produtos-quimicos/${res.body.id}`);
      expect(res.body).toMatchObject({
        nome: "Ácido Sulfúrico 98%",
        numeroOnu: "UN1830",
        classeRisco: "8",
        classeRiscoDescricao: "Substâncias corrosivas",
        status: "ATIVO",
      });
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.updatedAt).toBeDefined();
    });

    it("[lauda] bloqueia cadastro de produto sem nome", async () => {
      const res = await request(app).post("/produtos-quimicos").send(produtoBody({ nome: undefined })).expect(422);
      expect(res.body.erro.codigo).toBe("PRODUTO_SEM_NOME");
      expect(res.body.erro.requestId).toBeTruthy();
    });

    it("[lauda] bloqueia cadastro de produto sem classe de risco", async () => {
      const res = await request(app).post("/produtos-quimicos").send(produtoBody({ classeRisco: "" })).expect(422);
      expect(res.body.erro.codigo).toBe("PRODUTO_SEM_CLASSE_RISCO");
    });

    it("bloqueia cadastro com status inválido", async () => {
      const res = await request(app).post("/produtos-quimicos").send(produtoBody({ status: "SUSPENSO" })).expect(422);
      expect(res.body.erro.codigo).toBe("PRODUTO_STATUS_INVALIDO");
    });

    it("lista, busca, atualiza e inativa produto", async () => {
      const produto = await criarProduto();
      await criarProduto({ nome: "Etanol Anidro", numeroOnu: "1170", classeRisco: "3" });

      const lista = await request(app).get("/produtos-quimicos?busca=etanol").expect(200);
      expect(lista.body.dados).toHaveLength(1);
      expect(lista.body.meta.total).toBe(1);

      await request(app).get(`/produtos-quimicos/${produto.id}`).expect(200);

      const atualizado = await request(app)
        .put(`/produtos-quimicos/${produto.id}`)
        .send(produtoBody({ nome: "Ácido Sulfúrico 96%" }))
        .expect(200);
      expect(atualizado.body.nome).toBe("Ácido Sulfúrico 96%");

      const inativado = await request(app).patch(`/produtos-quimicos/${produto.id}/inativar`).expect(200);
      expect(inativado.body.status).toBe("INATIVO");

      const ativos = await request(app).get("/produtos-quimicos?status=ATIVO").expect(200);
      expect(ativos.body.meta.total).toBe(1);
    });

    it("retorna 404 para produto inexistente e 400 para id malformado", async () => {
      const r404 = await request(app).get(`/produtos-quimicos/${ID_INEXISTENTE}`).expect(404);
      expect(r404.body.erro.codigo).toBe("RECURSO_NAO_ENCONTRADO");
      const r400 = await request(app).get("/produtos-quimicos/abc").expect(400);
      expect(r400.body.erro.codigo).toBe("REQUISICAO_INVALIDA");
    });

    it("retorna 400 para JSON malformado", async () => {
      const res = await request(app)
        .post("/produtos-quimicos")
        .set("content-type", "application/json")
        .send('{"nome": ')
        .expect(400);
      expect(res.body.erro.codigo).toBe("JSON_INVALIDO");
    });
  });

  // --------------------------------------------------------------- cargas

  describe("Cargas químicas", () => {
    it("[lauda] registra carga química", async () => {
      const produto = await criarProduto();
      const res = await registrarCarga(produto.id).expect(201);
      expect(res.body).toMatchObject({
        status: "REGISTRADA",
        quantidade: 24000,
        unidade: "KG",
        documentacaoCompleta: true,
        transicoesPermitidas: ["EM_ANALISE", "CANCELADA"],
        produto: { id: produto.id, numeroOnu: "UN1830" },
      });
      expect(res.body.codigo).toMatch(/^QPA-/);
    });

    it("bloqueia registro sem produto associado", async () => {
      const res = await registrarCarga(undefined as unknown as string).expect(422);
      expect(res.body.erro.codigo).toBe("CARGA_SEM_PRODUTO");
    });

    it("[lauda] bloqueia carga com produto químico inativo", async () => {
      const produto = await criarProduto();
      await request(app).patch(`/produtos-quimicos/${produto.id}/inativar`).expect(200);
      const res = await registrarCarga(produto.id).expect(422);
      expect(res.body.erro.codigo).toBe("PRODUTO_INATIVO");
    });

    it.each([0, -10])("[lauda] bloqueia carga com quantidade menor ou igual a zero (%d)", async (quantidade) => {
      const produto = await criarProduto();
      const res = await registrarCarga(produto.id, { quantidade }).expect(422);
      expect(res.body.erro.codigo).toBe("QUANTIDADE_INVALIDA");
    });

    it("bloqueia carga sem responsável técnico", async () => {
      const produto = await criarProduto();
      const res = await registrarCarga(produto.id, { responsavelTecnico: null }).expect(422);
      expect(res.body.erro.codigo).toBe("CARGA_SEM_RESPONSAVEL_TECNICO");
    });

    it("recusa código de carga duplicado com 409", async () => {
      const produto = await criarProduto();
      await registrarCarga(produto.id, { codigo: "QPA-DUP-01" }).expect(201);
      const res = await registrarCarga(produto.id, { codigo: "QPA-DUP-01" }).expect(409);
      expect(res.body.erro.codigo).toBe("CONFLITO");
    });

    it("lista com filtro por status e busca por id", async () => {
      const carga = await cargaNoStatus("EM_ANALISE");
      const produto = await criarProduto({ nome: "Etanol", numeroOnu: "1170", classeRisco: "3" });
      await registrarCarga(produto.id).expect(201);

      const emAnalise = await request(app).get("/cargas-quimicas?status=EM_ANALISE").expect(200);
      expect(emAnalise.body.dados.map((c: { id: string }) => c.id)).toEqual([carga.id]);

      const todas = await request(app).get("/cargas-quimicas").expect(200);
      expect(todas.body.meta.total).toBe(2);

      const detalhe = await request(app).get(`/cargas-quimicas/${carga.id}`).expect(200);
      expect(detalhe.body.statusDescricao).toBe("Em análise");
    });
  });

  // --------------------------------------------------------------- status

  describe("Status da carga", () => {
    it("[lauda] atualiza status pelo fluxo principal até FINALIZADA e grava histórico", async () => {
      const carga = await cargaNoStatus("LIBERADA");
      await request(app).patch(`/cargas-quimicas/${carga.id}/status`).send({ status: "EM_MOVIMENTACAO" }).expect(200);
      const fim = await request(app).patch(`/cargas-quimicas/${carga.id}/status`).send({ status: "FINALIZADA" }).expect(200);
      expect(fim.body.status).toBe("FINALIZADA");
      expect(fim.body.transicoesPermitidas).toEqual([]);

      const historico = await request(app).get(`/cargas-quimicas/${carga.id}/historico`).expect(200);
      expect(historico.body.dados.map((h: { statusNovo: string }) => h.statusNovo)).toEqual([
        "REGISTRADA",
        "EM_ANALISE",
        "EM_INSPECAO",
        "LIBERADA",
        "EM_MOVIMENTACAO",
        "FINALIZADA",
      ]);
    });

    it("[lauda] valida transições permitidas (fluxos alternativos)", async () => {
      const a = await cargaNoStatus("EM_INSPECAO");
      const bloqueada = await request(app)
        .patch(`/cargas-quimicas/${a.id}/status`)
        .send({ status: "BLOQUEADA", motivo: "Lacre violado" })
        .expect(200);
      expect(bloqueada.body.motivoBloqueio).toBe("Lacre violado");
      await request(app).patch(`/cargas-quimicas/${a.id}/status`).send({ status: "CANCELADA", motivo: "Descarte" }).expect(200);
    });

    it.each([
      ["REGISTRADA", "FINALIZADA"],
      ["REGISTRADA", "LIBERADA"],
      ["REGISTRADA", "EM_MOVIMENTACAO"],
    ])("[lauda] bloqueia transição proibida %s → %s com 409", async (_de, para) => {
      const produto = await criarProduto();
      const { body: carga } = await registrarCarga(produto.id).expect(201);
      const res = await request(app).patch(`/cargas-quimicas/${carga.id}/status`).send({ status: para }).expect(409);
      expect(res.body.erro.codigo).toBe("TRANSICAO_DE_STATUS_INVALIDA");
      expect(res.body.erro.detalhes).toEqual({ de: "REGISTRADA", para });
    });

    it("bloqueia EM_INSPECAO → FINALIZADA sem passar por LIBERADA", async () => {
      const carga = await cargaNoStatus("EM_INSPECAO");
      const res = await request(app).patch(`/cargas-quimicas/${carga.id}/status`).send({ status: "FINALIZADA" }).expect(409);
      expect(res.body.erro.mensagem).toBe("Uma carga em inspeção não pode ser finalizada sem antes ser liberada.");
    });

    it("recusa status desconhecido com 422 e status ausente com 400", async () => {
      const carga = await cargaNoStatus("EM_ANALISE");
      const r422 = await request(app).patch(`/cargas-quimicas/${carga.id}/status`).send({ status: "PERDIDA" }).expect(422);
      expect(r422.body.erro.codigo).toBe("STATUS_INVALIDO");
      await request(app).patch(`/cargas-quimicas/${carga.id}/status`).send({}).expect(400);
    });

    it("[lauda] bloqueia liberação de carga sem documentação obrigatória", async () => {
      const carga = await cargaNoStatus("EM_INSPECAO", {
        documentos: [{ tipo: "FISPQ", situacao: "VALIDO" }, { tipo: "CERTIFICADO_ANALISE" }],
      });
      const res = await request(app).patch(`/cargas-quimicas/${carga.id}/liberar`).expect(422);
      expect(res.body.erro.codigo).toBe("DOCUMENTACAO_INCOMPLETA");
      expect(res.body.erro.detalhes.documentosPendentes).toEqual(["CERTIFICADO_ANALISE"]);

      // Após completar a documentação, a liberação passa.
      await request(app).patch(`/cargas-quimicas/${carga.id}/documentos`).send({ documentos: documentosOk }).expect(200);
      const liberada = await request(app).patch(`/cargas-quimicas/${carga.id}/liberar`).expect(200);
      expect(liberada.body.status).toBe("LIBERADA");
    });

    it("[lauda] cancela carga (motivo obrigatório)", async () => {
      const produto = await criarProduto();
      const { body: carga } = await registrarCarga(produto.id).expect(201);
      const semMotivo = await request(app).patch(`/cargas-quimicas/${carga.id}/cancelar`).send({}).expect(422);
      expect(semMotivo.body.erro.codigo).toBe("MOTIVO_OBRIGATORIO");

      const res = await request(app)
        .patch(`/cargas-quimicas/${carga.id}/cancelar`)
        .send({ motivo: "Importador desistiu" })
        .expect(200);
      expect(res.body).toMatchObject({ status: "CANCELADA", motivoCancelamento: "Importador desistiu" });

      const liberar = await request(app).patch(`/cargas-quimicas/${carga.id}/liberar`).expect(409);
      expect(liberar.body.erro.mensagem).toBe("Uma carga cancelada não pode ser liberada.");
    });

    it("[lauda] tentativa de movimentar carga bloqueada é recusada", async () => {
      const carga = await cargaNoStatus("EM_INSPECAO");
      await request(app).patch(`/cargas-quimicas/${carga.id}/bloquear`).send({ motivo: "FISPQ divergente" }).expect(200);
      const res = await request(app)
        .patch(`/cargas-quimicas/${carga.id}/status`)
        .send({ status: "EM_MOVIMENTACAO" })
        .expect(409);
      expect(res.body.erro.mensagem).toBe("Uma carga bloqueada não pode entrar em movimentação.");
    });

    it("retorna 404 ao alterar status de carga inexistente", async () => {
      await request(app).patch(`/cargas-quimicas/${ID_INEXISTENTE}/liberar`).expect(404);
    });
  });

  // ------------------------------------------------------- apoio / infra

  describe("Consultas, documentação e observabilidade", () => {
    it("resumo operacional reflete as cargas cadastradas", async () => {
      await cargaNoStatus("EM_INSPECAO");
      const res = await request(app).get("/resumo-operacional").expect(200);
      expect(res.body.totalCargas).toBe(1);
      expect(res.body.cargasPorStatus.EM_INSPECAO).toBe(1);
      expect(res.body.ultimasMovimentacoes[0].statusNovo).toBe("EM_INSPECAO");
    });

    it("expõe a máquina de estados em /meta/status-carga", async () => {
      const res = await request(app).get("/meta/status-carga").expect(200);
      const bloqueada = res.body.status.find((s: { codigo: string }) => s.codigo === "BLOQUEADA");
      expect(bloqueada).toEqual({ codigo: "BLOQUEADA", descricao: "Bloqueada", terminal: false, transicoesPermitidas: ["CANCELADA"] });
    });

    it("GraphQL: consulta cargas por status e detalhes de produto", async () => {
      const carga = await cargaNoStatus("EM_ANALISE");
      const res = await request(app)
        .post("/graphql")
        .send({ query: "{ cargasPorStatus(status: EM_ANALISE) { id status produto { nome } } }" })
        .expect(200);
      expect(res.body.data.cargasPorStatus).toEqual([
        { id: carga.id, status: "EM_ANALISE", produto: { nome: "Ácido Sulfúrico 98%" } },
      ]);

      const vazio = await request(app)
        .post("/graphql")
        .send({ query: `{ produtoQuimico(id: "${ID_INEXISTENTE}") { nome } }` })
        .expect(200);
      expect(vazio.body.data.produtoQuimico).toBeNull();
    });

    it("health, métricas, Swagger e request-id", async () => {
      const health = await request(app).get("/health").expect(200);
      expect(health.body.status).toBe("ok");

      await criarProduto();
      const metrics = await request(app).get("/metrics").expect(200);
      expect(metrics.text).toContain("quimiport_http_requests_total");

      const spec = await request(app).get("/docs/openapi.json").expect(200);
      expect(Object.keys(spec.body.paths)).toEqual(
        expect.arrayContaining(["/produtos-quimicos", "/cargas-quimicas/{id}/status", "/cargas-quimicas/{id}/liberar"]),
      );
      await request(app).get("/docs/").expect(200);

      const comId = await request(app).get("/").set("x-request-id", "teste-123").expect(200);
      expect(comId.headers["x-request-id"]).toBe("teste-123");
    });

    it("rota inexistente retorna 404 padronizado", async () => {
      const res = await request(app).get("/nao-existe").expect(404);
      expect(res.body.erro.codigo).toBe("ROTA_NAO_ENCONTRADA");
    });
  });
});
