import { randomUUID } from "node:crypto";
import { StatusProduto, valoresDe } from "../enums";
import { RegraDeNegocioError } from "../errors/domain-errors";
import { ClasseRisco } from "../value-objects/classe-risco";

/** Dados brutos de entrada — a própria entidade valida o que é obrigatório. */
export interface DadosProdutoQuimico {
  nome?: string;
  descricao?: string | null;
  numeroOnu?: string;
  classeRisco?: string;
  grupoCompatibilidade?: string;
  status?: string;
}

export interface ProdutoQuimicoProps {
  id: string;
  nome: string;
  descricao: string | null;
  numeroOnu: string;
  classeRisco: ClasseRisco;
  grupoCompatibilidade: string;
  status: StatusProduto;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Entidade Produto Químico. Tem ciclo de vida próprio e é referenciada
 * por identidade pelo agregado Carga Química.
 */
export class ProdutoQuimico {
  private constructor(private props: ProdutoQuimicoProps) {}

  static criar(dados: DadosProdutoQuimico, agora = new Date()): ProdutoQuimico {
    const validos = ProdutoQuimico.validar(dados);
    return new ProdutoQuimico({
      id: randomUUID(),
      ...validos,
      createdAt: agora,
      updatedAt: agora,
    });
  }

  /** Reconstrói a entidade a partir da persistência (dados já válidos). */
  static restaurar(props: Omit<ProdutoQuimicoProps, "classeRisco"> & { classeRisco: string }) {
    return new ProdutoQuimico({ ...props, classeRisco: ClasseRisco.criar(props.classeRisco) });
  }

  atualizar(dados: DadosProdutoQuimico, agora = new Date()): void {
    const validos = ProdutoQuimico.validar({ ...dados, status: dados.status ?? this.props.status });
    this.props = { ...this.props, ...validos, updatedAt: agora };
  }

  inativar(agora = new Date()): void {
    if (this.props.status === StatusProduto.INATIVO) {
      throw new RegraDeNegocioError("PRODUTO_JA_INATIVO", "Produto químico já está inativo.");
    }
    this.props.status = StatusProduto.INATIVO;
    this.props.updatedAt = agora;
  }

  get ativo(): boolean {
    return this.props.status === StatusProduto.ATIVO;
  }

  get id() {
    return this.props.id;
  }
  get nome() {
    return this.props.nome;
  }
  get descricao() {
    return this.props.descricao;
  }
  get numeroOnu() {
    return this.props.numeroOnu;
  }
  get classeRisco() {
    return this.props.classeRisco;
  }
  get grupoCompatibilidade() {
    return this.props.grupoCompatibilidade;
  }
  get status() {
    return this.props.status;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  private static validar(dados: DadosProdutoQuimico) {
    const nome = (dados.nome ?? "").trim();
    if (!nome) {
      throw new RegraDeNegocioError(
        "PRODUTO_SEM_NOME",
        "Produto químico não pode ser cadastrado sem nome.",
      );
    }

    const classeRisco = ClasseRisco.criar(dados.classeRisco);

    const status = (dados.status ?? StatusProduto.ATIVO) as StatusProduto;
    if (!valoresDe(StatusProduto).includes(status)) {
      throw new RegraDeNegocioError(
        "PRODUTO_STATUS_INVALIDO",
        `Status de produto inválido: "${dados.status}". Use ATIVO ou INATIVO.`,
      );
    }

    const numeroOnu = ProdutoQuimico.normalizarNumeroOnu(dados.numeroOnu);

    const grupoCompatibilidade = (dados.grupoCompatibilidade ?? "").trim().toUpperCase();
    if (!grupoCompatibilidade) {
      throw new RegraDeNegocioError(
        "PRODUTO_SEM_GRUPO_COMPATIBILIDADE",
        "Produto químico deve informar o grupo de compatibilidade.",
      );
    }

    return {
      nome,
      descricao: dados.descricao?.trim() || null,
      numeroOnu,
      classeRisco,
      grupoCompatibilidade,
      status,
    };
  }

  /** Aceita "1830", "UN1830" ou "UN 1830" e normaliza para "UN1830". */
  private static normalizarNumeroOnu(valor: string | undefined): string {
    const limpo = (valor ?? "").toUpperCase().replace(/\s+/g, "");
    const match = /^(?:UN)?(\d{4})$/.exec(limpo);
    if (!match) {
      throw new RegraDeNegocioError(
        "NUMERO_ONU_INVALIDO",
        `Número ONU inválido: "${valor}". Informe 4 dígitos (ex.: UN1830).`,
      );
    }
    return `UN${match[1]}`;
  }
}
