import { CargaQuimica } from "../../../src/domain/aggregates/carga-quimica";
import { StatusCarga, valoresDe } from "../../../src/domain/enums";
import { TransicaoDeStatusInvalidaError } from "../../../src/domain/errors/domain-errors";
import {
  ESTADOS_TERMINAIS,
  TRANSICOES_PERMITIDAS,
  isTerminal,
  podeTransitar,
} from "../../../src/domain/value-objects/maquina-status-carga";
import { novaCarga } from "../../helpers/fabricas";

const TODOS = valoresDe(StatusCarga);

/** Cria uma carga já no status desejado (sem passar pelo fluxo). */
function cargaEm(status: StatusCarga): CargaQuimica {
  const base = novaCarga();
  return CargaQuimica.restaurar({
    id: base.id,
    codigo: base.codigo,
    produtoId: base.produtoId,
    quantidade: base.quantidade,
    origem: base.origem,
    destino: base.destino,
    responsavelTecnico: base.responsavelTecnico,
    documentos: [...base.documentos],
    status,
    motivoBloqueio: null,
    motivoCancelamento: null,
    dataEntrada: base.dataEntrada,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
  });
}

const permitidas = TODOS.flatMap((de) => TRANSICOES_PERMITIDAS[de].map((para) => [de, para] as const));
const proibidas = TODOS.flatMap((de) =>
  TODOS.filter((para) => !TRANSICOES_PERMITIDAS[de].includes(para)).map((para) => [de, para] as const),
);

describe("Máquina de estados da carga", () => {
  it("segue exatamente a tabela da lauda", () => {
    expect(TRANSICOES_PERMITIDAS).toEqual({
      REGISTRADA: ["EM_ANALISE", "CANCELADA"],
      EM_ANALISE: ["EM_INSPECAO", "CANCELADA"],
      EM_INSPECAO: ["LIBERADA", "BLOQUEADA", "CANCELADA"],
      LIBERADA: ["EM_MOVIMENTACAO", "CANCELADA"],
      BLOQUEADA: ["CANCELADA"],
      EM_MOVIMENTACAO: ["FINALIZADA"],
      FINALIZADA: [],
      CANCELADA: [],
    });
    expect(ESTADOS_TERMINAIS).toEqual(["FINALIZADA", "CANCELADA"]);
    expect(isTerminal("FINALIZADA")).toBe(true);
    expect(isTerminal("LIBERADA")).toBe(false);
  });

  it("percorre o fluxo principal completo", () => {
    const carga = novaCarga();
    for (const status of ["EM_ANALISE", "EM_INSPECAO", "LIBERADA", "EM_MOVIMENTACAO", "FINALIZADA"] as const) {
      carga.alterarStatus(status);
      expect(carga.status).toBe(status);
    }
  });

  describe("transições permitidas", () => {
    it.each(permitidas)("%s → %s é aceita", (de, para) => {
      const carga = cargaEm(de);
      carga.alterarStatus(para, "Motivo de teste");
      expect(carga.status).toBe(para);
      expect(podeTransitar(de, para)).toBe(true);
    });
  });

  describe("transições proibidas (matriz completa)", () => {
    it.each(proibidas)("%s → %s é recusada", (de, para) => {
      const carga = cargaEm(de);
      expect(() => carga.alterarStatus(para, "Motivo de teste")).toThrow(TransicaoDeStatusInvalidaError);
      expect(carga.status).toBe(de);
    });
  });

  describe("exemplos de transições proibidas citados na lauda", () => {
    it.each([
      ["CANCELADA", "LIBERADA"],
      ["FINALIZADA", "EM_MOVIMENTACAO"],
      ["BLOQUEADA", "EM_MOVIMENTACAO"],
      ["REGISTRADA", "FINALIZADA"],
      ["EM_INSPECAO", "FINALIZADA"],
      ["LIBERADA", "REGISTRADA"],
    ] as const)("%s → %s", (de, para) => {
      expect(() => cargaEm(de).alterarStatus(para)).toThrow(TransicaoDeStatusInvalidaError);
    });
  });

  it("estados terminais não aceitam nenhuma nova alteração", () => {
    for (const terminal of ESTADOS_TERMINAIS) {
      for (const para of TODOS) {
        expect(() => cargaEm(terminal).alterarStatus(para, "x x x")).toThrow(TransicaoDeStatusInvalidaError);
      }
    }
  });

  it("recusa status desconhecido", () => {
    expect(() => novaCarga().alterarStatus("PERDIDA" as StatusCarga)).toThrow("Status de carga inválido");
  });
});
