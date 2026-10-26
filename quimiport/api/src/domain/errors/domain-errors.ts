/**
 * Erros de domínio. Nenhum deles conhece HTTP: a tradução para status code
 * acontece apenas na camada de interface (middleware de erro).
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Violação de uma regra de negócio (ex.: produto inativo, quantidade <= 0). */
export class RegraDeNegocioError extends DomainError {
  readonly code: string;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message, details);
    this.code = code;
  }
}

/** Tentativa de transição de status não permitida pela máquina de estados. */
export class TransicaoDeStatusInvalidaError extends DomainError {
  readonly code = "TRANSICAO_DE_STATUS_INVALIDA";

  constructor(
    readonly de: string,
    readonly para: string,
    message?: string,
  ) {
    super(message ?? `Transição de status não permitida: ${de} → ${para}.`, { de, para });
  }
}

/** Recurso inexistente (produto ou carga não encontrados). */
export class RecursoNaoEncontradoError extends DomainError {
  readonly code = "RECURSO_NAO_ENCONTRADO";

  constructor(recurso: string, id: string) {
    super(`${recurso} não encontrado(a): ${id}.`, { recurso, id });
  }
}

/** Conflito de unicidade (ex.: código de carga duplicado). */
export class ConflitoError extends DomainError {
  readonly code = "CONFLITO";
}
