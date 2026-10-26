import { UnidadeMedida, valoresDe } from "../enums";
import { RegraDeNegocioError } from "../errors/domain-errors";

/** Objeto de valor: quantidade sempre > 0 e com unidade de medida válida. */
export class Quantidade {
  private constructor(
    readonly valor: number,
    readonly unidade: UnidadeMedida,
  ) {}

  static criar(valor: number | undefined, unidade: string | undefined): Quantidade {
    if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
      throw new RegraDeNegocioError(
        "QUANTIDADE_INVALIDA",
        "A quantidade da carga deve ser maior que zero.",
        { valor },
      );
    }
    if (!valoresDe(UnidadeMedida).includes(unidade as UnidadeMedida)) {
      throw new RegraDeNegocioError(
        "UNIDADE_MEDIDA_INVALIDA",
        `Unidade de medida inválida: "${unidade}".`,
        { unidadesValidas: valoresDe(UnidadeMedida) },
      );
    }
    return new Quantidade(Math.round(valor * 1000) / 1000, unidade as UnidadeMedida);
  }
}
