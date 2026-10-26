import { ProdutoQuimico } from "../../../src/domain/entities/produto-quimico";
import { RegraDeNegocioError } from "../../../src/domain/errors/domain-errors";
import { produtoValido } from "../../helpers/fabricas";

const codigoDoErro = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof RegraDeNegocioError) return e.code;
    throw e;
  }
  throw new Error("Era esperado um RegraDeNegocioError");
};

describe("ProdutoQuimico (entidade)", () => {
  describe("cadastro", () => {
    it("cria produto válido como ATIVO e normaliza o número ONU", () => {
      const produto = ProdutoQuimico.criar(produtoValido({ numeroOnu: "un 1830" }));
      expect(produto.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(produto.status).toBe("ATIVO");
      expect(produto.ativo).toBe(true);
      expect(produto.numeroOnu).toBe("UN1830");
      expect(produto.classeRisco.codigo).toBe("8");
      expect(produto.classeRisco.descricao).toBe("Substâncias corrosivas");
    });

    it.each([undefined, "", "   "])("bloqueia cadastro sem nome (%j)", (nome) => {
      expect(codigoDoErro(() => ProdutoQuimico.criar(produtoValido({ nome })))).toBe("PRODUTO_SEM_NOME");
    });

    it.each([undefined, "", "  "])("bloqueia cadastro sem classe de risco (%j)", (classeRisco) => {
      expect(codigoDoErro(() => ProdutoQuimico.criar(produtoValido({ classeRisco })))).toBe(
        "PRODUTO_SEM_CLASSE_RISCO",
      );
    });

    it("bloqueia classe de risco que não existe na tabela ONU", () => {
      expect(codigoDoErro(() => ProdutoQuimico.criar(produtoValido({ classeRisco: "10" })))).toBe(
        "CLASSE_RISCO_INVALIDA",
      );
    });

    it("bloqueia cadastro com status inválido", () => {
      expect(codigoDoErro(() => ProdutoQuimico.criar(produtoValido({ status: "SUSPENSO" })))).toBe(
        "PRODUTO_STATUS_INVALIDO",
      );
    });

    it("aceita cadastro já INATIVO quando informado explicitamente", () => {
      expect(ProdutoQuimico.criar(produtoValido({ status: "INATIVO" })).ativo).toBe(false);
    });

    it.each(["183", "ABC1", "UN18300"])("bloqueia número ONU inválido (%s)", (numeroOnu) => {
      expect(codigoDoErro(() => ProdutoQuimico.criar(produtoValido({ numeroOnu })))).toBe("NUMERO_ONU_INVALIDO");
    });

    it("exige grupo de compatibilidade", () => {
      expect(codigoDoErro(() => ProdutoQuimico.criar(produtoValido({ grupoCompatibilidade: " " })))).toBe(
        "PRODUTO_SEM_GRUPO_COMPATIBILIDADE",
      );
    });
  });

  describe("manutenção", () => {
    it("atualiza dados aplicando as mesmas regras e mantém o status atual", () => {
      const produto = ProdutoQuimico.criar(produtoValido());
      produto.atualizar(produtoValido({ nome: "Ácido Sulfúrico 96%", classeRisco: "8" }));
      expect(produto.nome).toBe("Ácido Sulfúrico 96%");
      expect(produto.status).toBe("ATIVO");
      expect(() => produto.atualizar(produtoValido({ nome: "" }))).toThrow(RegraDeNegocioError);
    });

    it("inativa logicamente e não permite inativar duas vezes", () => {
      const produto = ProdutoQuimico.criar(produtoValido());
      produto.inativar();
      expect(produto.status).toBe("INATIVO");
      expect(codigoDoErro(() => produto.inativar())).toBe("PRODUTO_JA_INATIVO");
    });
  });
});
