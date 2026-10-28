import { RegraDeNegocioError } from "../errors/domain-errors";

/** Objeto de valor: toda carga precisa de um responsável técnico informado. */
export class ResponsavelTecnico {
  private constructor(
    readonly nome: string,
    readonly registroProfissional: string | null,
  ) {}

  static criar(nome: string | null | undefined, registro?: string | null): ResponsavelTecnico {
    const nomeLimpo = (nome ?? "").trim();
    if (nomeLimpo.length < 3) {
      throw new RegraDeNegocioError(
        "CARGA_SEM_RESPONSAVEL_TECNICO",
        "Toda carga deve possuir responsável técnico informado.",
      );
    }
    const registroLimpo = registro?.trim() || null;
    return new ResponsavelTecnico(nomeLimpo, registroLimpo);
  }
}
