import { CargaQuimica } from "../../../src/domain/aggregates/carga-quimica";
import { ProdutoQuimico } from "../../../src/domain/entities/produto-quimico";
import { RegraDeNegocioError, TransicaoDeStatusInvalidaError } from "../../../src/domain/errors/domain-errors";
import { avancarAte, novaCarga, produtoValido } from "../../helpers/fabricas";

const erroDe = (fn: () => unknown): RegraDeNegocioError | TransicaoDeStatusInvalidaError => {
  try {
    fn();
  } catch (e) {
    if (e instanceof RegraDeNegocioError || e instanceof TransicaoDeStatusInvalidaError) return e;
    throw e;
  }
  throw new Error("Era esperado um erro de domínio");
};

describe("CargaQuimica (agregado)", () => {
  describe("registro", () => {
    it("registra carga válida com status REGISTRADA, código gerado e histórico inicial", () => {
      const carga = novaCarga();
      expect(carga.status).toBe("REGISTRADA");
      expect(carga.codigo).toMatch(/^QPA-\d{4}-[0-9A-F]{4}$/);
      expect(carga.quantidade.valor).toBe(1000);
      expect(carga.transicoesPermitidas()).toEqual(["EM_ANALISE", "CANCELADA"]);
      expect(carga.mudancasNaoPersistidas()).toEqual([
        expect.objectContaining({ statusAnterior: null, statusNovo: "REGISTRADA" }),
      ]);
    });

    it("bloqueia registro sem produto químico associado", () => {
      expect(erroDe(() => novaCarga({ produto: null })).code).toBe("CARGA_SEM_PRODUTO");
    });

    it("bloqueia registro com produto químico inativo", () => {
      const inativo = ProdutoQuimico.criar(produtoValido());
      inativo.inativar();
      expect(erroDe(() => novaCarga({ produto: inativo })).code).toBe("PRODUTO_INATIVO");
    });

    it.each([0, -1, -0.5, Number.NaN, undefined])("bloqueia quantidade menor ou igual a zero (%s)", (quantidade) => {
      expect(erroDe(() => novaCarga({ quantidade })).code).toBe("QUANTIDADE_INVALIDA");
    });

    it("bloqueia unidade de medida desconhecida", () => {
      expect(erroDe(() => novaCarga({ unidade: "BARRIL" })).code).toBe("UNIDADE_MEDIDA_INVALIDA");
    });

    it.each([null, { nome: "" }, { nome: "  " }])("exige responsável técnico informado (%j)", (responsavelTecnico) => {
      expect(erroDe(() => novaCarga({ responsavelTecnico })).code).toBe("CARGA_SEM_RESPONSAVEL_TECNICO");
    });

    it("exige origem e destino", () => {
      expect(erroDe(() => novaCarga({ origem: "" })).code).toBe("CAMPO_OBRIGATORIO");
      expect(erroDe(() => novaCarga({ destino: undefined })).code).toBe("CAMPO_OBRIGATORIO");
    });
  });

  describe("liberação e documentação", () => {
    it("libera carga em inspeção com documentação completa e válida", () => {
      const carga = avancarAte(novaCarga(), "EM_INSPECAO");
      carga.liberar();
      expect(carga.status).toBe("LIBERADA");
    });

    it("bloqueia liberação sem nenhum documento", () => {
      const carga = avancarAte(novaCarga({ documentos: [] }), "EM_INSPECAO");
      const erro = erroDe(() => carga.liberar());
      expect(erro.code).toBe("DOCUMENTACAO_INCOMPLETA");
      expect(carga.status).toBe("EM_INSPECAO");
    });

    it("bloqueia liberação com documento pendente e informa quais faltam", () => {
      const carga = avancarAte(
        novaCarga({ documentos: [{ tipo: "FISPQ", situacao: "VALIDO" }, { tipo: "CERTIFICADO_ANALISE" }] }),
        "EM_INSPECAO",
      );
      const erro = erroDe(() => carga.liberar());
      expect(erro.code).toBe("DOCUMENTACAO_INCOMPLETA");
      expect(erro.details).toEqual({ documentosPendentes: ["CERTIFICADO_ANALISE"] });
    });

    it("bloqueia liberação com documento vencido", () => {
      const carga = avancarAte(
        novaCarga({ documentos: [{ tipo: "FISPQ", situacao: "VALIDO", validade: new Date("2020-01-01T00:00:00Z") }] }),
        "EM_INSPECAO",
      );
      expect(erroDe(() => carga.liberar()).code).toBe("DOCUMENTACAO_INCOMPLETA");
    });

    it("permite completar a documentação e então liberar", () => {
      const carga = avancarAte(novaCarga({ documentos: [{ tipo: "FISPQ" }] }), "EM_INSPECAO");
      carga.atualizarDocumentos([{ tipo: "FISPQ", situacao: "VALIDO" }]);
      carga.liberar();
      expect(carga.status).toBe("LIBERADA");
    });

    it("não permite alterar documentação de carga encerrada", () => {
      const carga = novaCarga();
      carga.cancelar("Operação desistida");
      expect(erroDe(() => carga.atualizarDocumentos([])).code).toBe("CARGA_ENCERRADA");
    });
  });

  describe("bloqueio e cancelamento", () => {
    it("bloqueia carga em inspeção registrando o motivo", () => {
      const carga = avancarAte(novaCarga(), "EM_INSPECAO");
      carga.bloquear("Lacre violado");
      expect(carga.status).toBe("BLOQUEADA");
      expect(carga.motivoBloqueio).toBe("Lacre violado");
    });

    it("exige motivo para bloquear e para cancelar", () => {
      const carga = avancarAte(novaCarga(), "EM_INSPECAO");
      expect(erroDe(() => carga.bloquear("")).code).toBe("MOTIVO_OBRIGATORIO");
      expect(erroDe(() => carga.cancelar(" ")).code).toBe("MOTIVO_OBRIGATORIO");
      expect(carga.status).toBe("EM_INSPECAO");
    });

    it("cancela carga registrando o motivo", () => {
      const carga = novaCarga();
      carga.cancelar("Importador desistiu");
      expect(carga.status).toBe("CANCELADA");
      expect(carga.motivoCancelamento).toBe("Importador desistiu");
      expect(carga.transicoesPermitidas()).toEqual([]);
    });

    it("carga bloqueada não pode entrar em movimentação", () => {
      const carga = avancarAte(novaCarga(), "EM_INSPECAO");
      carga.bloquear("Lacre violado");
      const erro = erroDe(() => carga.alterarStatus("EM_MOVIMENTACAO"));
      expect(erro).toBeInstanceOf(TransicaoDeStatusInvalidaError);
      expect(erro.message).toBe("Uma carga bloqueada não pode entrar em movimentação.");
    });

    it("carga cancelada não pode ser liberada", () => {
      const carga = novaCarga();
      carga.cancelar("Desistência");
      expect(erroDe(() => carga.liberar()).message).toBe("Uma carga cancelada não pode ser liberada.");
    });

    it("carga em inspeção não pode ser finalizada sem antes ser liberada", () => {
      const carga = avancarAte(novaCarga(), "EM_INSPECAO");
      expect(erroDe(() => carga.alterarStatus("FINALIZADA")).message).toBe(
        "Uma carga em inspeção não pode ser finalizada sem antes ser liberada.",
      );
    });
  });

  describe("histórico", () => {
    it("acumula uma entrada por transição até ser persistido", () => {
      const carga = avancarAte(novaCarga(), "FINALIZADA");
      expect(carga.mudancasNaoPersistidas().map((m) => m.statusNovo)).toEqual([
        "REGISTRADA",
        "EM_ANALISE",
        "EM_INSPECAO",
        "LIBERADA",
        "EM_MOVIMENTACAO",
        "FINALIZADA",
      ]);
      carga.confirmarPersistencia();
      expect(carga.mudancasNaoPersistidas()).toEqual([]);
    });

    it("não registra histórico quando a transição é recusada", () => {
      const carga = novaCarga();
      carga.confirmarPersistencia();
      expect(() => carga.alterarStatus("FINALIZADA")).toThrow();
      expect(carga.mudancasNaoPersistidas()).toEqual([]);
      expect(carga.status).toBe("REGISTRADA");
    });
  });

  it("restaurar() reconstrói o agregado sem gerar histórico", () => {
    const original = novaCarga();
    const restaurada = CargaQuimica.restaurar({
      id: original.id,
      codigo: original.codigo,
      produtoId: original.produtoId,
      quantidade: original.quantidade,
      origem: original.origem,
      destino: original.destino,
      responsavelTecnico: original.responsavelTecnico,
      documentos: [...original.documentos],
      status: "EM_INSPECAO",
      motivoBloqueio: null,
      motivoCancelamento: null,
      dataEntrada: original.dataEntrada,
      createdAt: original.createdAt,
      updatedAt: original.updatedAt,
    });
    expect(restaurada.status).toBe("EM_INSPECAO");
    expect(restaurada.mudancasNaoPersistidas()).toEqual([]);
  });
});
