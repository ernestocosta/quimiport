import { RegraDeNegocioError } from "../errors/domain-errors";

/**
 * Classes e subclasses de risco da ONU (Orange Book / Resolução ANTT 5.998).
 * Objeto de valor imutável: só existe se for válido.
 */
const CLASSES: Record<string, string> = {
  "1": "Explosivos",
  "1.1": "Explosivos com risco de explosão em massa",
  "1.2": "Explosivos com risco de projeção",
  "1.3": "Explosivos com risco de fogo",
  "1.4": "Explosivos de risco baixo",
  "1.5": "Explosivos muito insensíveis",
  "1.6": "Artigos extremamente insensíveis",
  "2.1": "Gases inflamáveis",
  "2.2": "Gases não inflamáveis e não tóxicos",
  "2.3": "Gases tóxicos",
  "3": "Líquidos inflamáveis",
  "4.1": "Sólidos inflamáveis",
  "4.2": "Substâncias sujeitas a combustão espontânea",
  "4.3": "Substâncias que emitem gases inflamáveis em contato com água",
  "5.1": "Substâncias oxidantes",
  "5.2": "Peróxidos orgânicos",
  "6.1": "Substâncias tóxicas",
  "6.2": "Substâncias infectantes",
  "7": "Materiais radioativos",
  "8": "Substâncias corrosivas",
  "9": "Substâncias e artigos perigosos diversos",
};

export class ClasseRisco {
  private constructor(readonly codigo: string) {}

  static criar(valor: string | null | undefined): ClasseRisco {
    const codigo = (valor ?? "").trim();
    if (!codigo) {
      throw new RegraDeNegocioError(
        "PRODUTO_SEM_CLASSE_RISCO",
        "Produto químico não pode ser cadastrado sem classe de risco.",
      );
    }
    if (!(codigo in CLASSES)) {
      throw new RegraDeNegocioError(
        "CLASSE_RISCO_INVALIDA",
        `Classe de risco inválida: "${codigo}". Use uma classe ONU (ex.: 3, 6.1, 8).`,
        { classesValidas: Object.keys(CLASSES) },
      );
    }
    return new ClasseRisco(codigo);
  }

  get descricao(): string {
    return CLASSES[this.codigo];
  }

  static classesValidas(): string[] {
    return Object.keys(CLASSES);
  }

  equals(outra: ClasseRisco): boolean {
    return this.codigo === outra.codigo;
  }
}
