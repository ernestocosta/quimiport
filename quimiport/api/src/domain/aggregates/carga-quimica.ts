import { randomUUID } from "node:crypto";
import { StatusCarga } from "../enums";
import {
  RegraDeNegocioError,
  TransicaoDeStatusInvalidaError,
} from "../errors/domain-errors";
import { DadosDocumentoCarga, DocumentoCarga } from "../entities/documento-carga";
import { ProdutoQuimico } from "../entities/produto-quimico";
import {
  ROTULOS_STATUS,
  TRANSICOES_PERMITIDAS,
  isTerminal,
  podeTransitar,
} from "../value-objects/maquina-status-carga";
import { Quantidade } from "../value-objects/quantidade";
import { ResponsavelTecnico } from "../value-objects/responsavel-tecnico";

export interface RegistrarCargaDados {
  codigo?: string;
  produto: ProdutoQuimico | null | undefined;
  quantidade?: number;
  unidade?: string;
  origem?: string;
  destino?: string;
  responsavelTecnico?: { nome?: string; registroProfissional?: string | null } | null;
  documentos?: DadosDocumentoCarga[];
  dataEntrada?: Date;
}

/** Registro de uma mudança de status, ainda não persistido. */
export interface MudancaDeStatus {
  id: string;
  statusAnterior: StatusCarga | null;
  statusNovo: StatusCarga;
  motivo: string | null;
  ocorridoEm: Date;
}

export interface CargaQuimicaProps {
  id: string;
  codigo: string;
  produtoId: string;
  quantidade: Quantidade;
  origem: string;
  destino: string;
  responsavelTecnico: ResponsavelTecnico;
  documentos: DocumentoCarga[];
  status: StatusCarga;
  motivoBloqueio: string | null;
  motivoCancelamento: string | null;
  dataEntrada: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agregado raiz Carga Química. Concentra todas as regras de registro,
 * documentação e transição de status — nenhuma camada externa altera o
 * estado da carga sem passar por aqui.
 */
export class CargaQuimica {
  private mudancasPendentes: MudancaDeStatus[] = [];

  private constructor(private props: CargaQuimicaProps) {}

  static registrar(dados: RegistrarCargaDados, agora = new Date()): CargaQuimica {
    if (!dados.produto) {
      throw new RegraDeNegocioError(
        "CARGA_SEM_PRODUTO",
        "Carga química não pode ser registrada sem produto químico associado.",
      );
    }
    if (!dados.produto.ativo) {
      throw new RegraDeNegocioError(
        "PRODUTO_INATIVO",
        "Carga química não pode ser registrada com produto químico inativo.",
        { produtoId: dados.produto.id },
      );
    }

    const quantidade = Quantidade.criar(dados.quantidade, dados.unidade);
    const responsavelTecnico = ResponsavelTecnico.criar(
      dados.responsavelTecnico?.nome,
      dados.responsavelTecnico?.registroProfissional,
    );
    const origem = CargaQuimica.textoObrigatorio(dados.origem, "origem");
    const destino = CargaQuimica.textoObrigatorio(dados.destino, "destino");

    const carga = new CargaQuimica({
      id: randomUUID(),
      codigo: (dados.codigo?.trim().toUpperCase() || CargaQuimica.gerarCodigo(agora)),
      produtoId: dados.produto.id,
      quantidade,
      origem,
      destino,
      responsavelTecnico,
      documentos: (dados.documentos ?? []).map((d) => DocumentoCarga.criar(d)),
      status: StatusCarga.REGISTRADA,
      motivoBloqueio: null,
      motivoCancelamento: null,
      dataEntrada: dados.dataEntrada ?? agora,
      createdAt: agora,
      updatedAt: agora,
    });

    carga.registrarMudanca(null, StatusCarga.REGISTRADA, null, agora);
    return carga;
  }

  /** Reconstrói a carga a partir da persistência. */
  static restaurar(props: CargaQuimicaProps): CargaQuimica {
    return new CargaQuimica({ ...props, documentos: [...props.documentos] });
  }

  // ---------------------------------------------------------------- status

  alterarStatus(novoStatus: StatusCarga, motivo?: string | null, agora = new Date()): void {
    const atual = this.props.status;

    if (!(novoStatus in TRANSICOES_PERMITIDAS)) {
      throw new RegraDeNegocioError("STATUS_INVALIDO", `Status de carga inválido: "${novoStatus}".`);
    }

    if (atual === novoStatus) {
      throw new TransicaoDeStatusInvalidaError(
        atual,
        novoStatus,
        `A carga já está com status ${ROTULOS_STATUS[atual]}.`,
      );
    }

    // Mensagens específicas para as regras explícitas da lauda.
    if (atual === StatusCarga.CANCELADA && novoStatus === StatusCarga.LIBERADA) {
      throw new TransicaoDeStatusInvalidaError(atual, novoStatus, "Uma carga cancelada não pode ser liberada.");
    }
    if (isTerminal(atual)) {
      throw new TransicaoDeStatusInvalidaError(
        atual,
        novoStatus,
        `Carga com status ${ROTULOS_STATUS[atual]} não pode sofrer novas alterações de status.`,
      );
    }
    if (atual === StatusCarga.BLOQUEADA && novoStatus === StatusCarga.EM_MOVIMENTACAO) {
      throw new TransicaoDeStatusInvalidaError(
        atual,
        novoStatus,
        "Uma carga bloqueada não pode entrar em movimentação.",
      );
    }
    if (atual === StatusCarga.EM_INSPECAO && novoStatus === StatusCarga.FINALIZADA) {
      throw new TransicaoDeStatusInvalidaError(
        atual,
        novoStatus,
        "Uma carga em inspeção não pode ser finalizada sem antes ser liberada.",
      );
    }
    if (!podeTransitar(atual, novoStatus)) {
      throw new TransicaoDeStatusInvalidaError(atual, novoStatus);
    }

    // Regras que dependem do estado do agregado.
    if (novoStatus === StatusCarga.LIBERADA && !this.documentacaoCompleta(agora)) {
      throw new RegraDeNegocioError(
        "DOCUMENTACAO_INCOMPLETA",
        "Uma carga não pode ser liberada sem documentação obrigatória completa e válida.",
        { documentosPendentes: this.documentosPendentes(agora).map((d) => d.tipo) },
      );
    }

    const motivoLimpo = motivo?.trim() || null;
    if (
      (novoStatus === StatusCarga.BLOQUEADA || novoStatus === StatusCarga.CANCELADA) &&
      (!motivoLimpo || motivoLimpo.length < 3)
    ) {
      throw new RegraDeNegocioError(
        "MOTIVO_OBRIGATORIO",
        `Informe o motivo para ${novoStatus === StatusCarga.BLOQUEADA ? "bloquear" : "cancelar"} a carga.`,
      );
    }

    if (novoStatus === StatusCarga.BLOQUEADA) this.props.motivoBloqueio = motivoLimpo;
    if (novoStatus === StatusCarga.CANCELADA) this.props.motivoCancelamento = motivoLimpo;

    this.props.status = novoStatus;
    this.props.updatedAt = agora;
    this.registrarMudanca(atual, novoStatus, motivoLimpo, agora);
  }

  liberar(agora = new Date()): void {
    this.alterarStatus(StatusCarga.LIBERADA, null, agora);
  }

  bloquear(motivo: string, agora = new Date()): void {
    this.alterarStatus(StatusCarga.BLOQUEADA, motivo, agora);
  }

  cancelar(motivo: string, agora = new Date()): void {
    this.alterarStatus(StatusCarga.CANCELADA, motivo, agora);
  }

  // ---------------------------------------------------------- documentação

  /** Substitui a lista de documentos da carga (enquanto ela não estiver encerrada). */
  atualizarDocumentos(documentos: DadosDocumentoCarga[], agora = new Date()): void {
    if (isTerminal(this.props.status)) {
      throw new RegraDeNegocioError(
        "CARGA_ENCERRADA",
        `Carga com status ${ROTULOS_STATUS[this.props.status]} não pode ter a documentação alterada.`,
      );
    }
    this.props.documentos = documentos.map((d) => DocumentoCarga.criar(d));
    this.props.updatedAt = agora;
  }

  documentacaoCompleta(referencia = new Date()): boolean {
    return (
      this.props.documentos.length > 0 &&
      this.props.documentos.every((d) => d.estaValido(referencia))
    );
  }

  documentosPendentes(referencia = new Date()): DocumentoCarga[] {
    return this.props.documentos.filter((d) => !d.estaValido(referencia));
  }

  // --------------------------------------------------------------- helpers

  transicoesPermitidas(): readonly StatusCarga[] {
    return TRANSICOES_PERMITIDAS[this.props.status];
  }

  /** Mudanças de status geradas desde o último salvamento (para o histórico). */
  mudancasNaoPersistidas(): readonly MudancaDeStatus[] {
    return [...this.mudancasPendentes];
  }

  /** Chamado pelo repositório depois que a transação foi confirmada. */
  confirmarPersistencia(): void {
    this.mudancasPendentes = [];
  }

  private registrarMudanca(
    de: StatusCarga | null,
    para: StatusCarga,
    motivo: string | null,
    ocorridoEm: Date,
  ): void {
    this.mudancasPendentes.push({
      id: randomUUID(),
      statusAnterior: de,
      statusNovo: para,
      motivo,
      ocorridoEm,
    });
  }

  private static textoObrigatorio(valor: string | undefined | null, campo: string): string {
    const limpo = (valor ?? "").trim();
    if (!limpo) {
      throw new RegraDeNegocioError("CAMPO_OBRIGATORIO", `O campo "${campo}" é obrigatório.`, {
        campo,
      });
    }
    return limpo;
  }

  /** Código legível no formato QPA-AAMM-XXXX. */
  private static gerarCodigo(agora: Date): string {
    const aa = String(agora.getUTCFullYear()).slice(-2);
    const mm = String(agora.getUTCMonth() + 1).padStart(2, "0");
    const sufixo = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
    return `QPA-${aa}${mm}-${sufixo}`;
  }

  get id() {
    return this.props.id;
  }
  get codigo() {
    return this.props.codigo;
  }
  get produtoId() {
    return this.props.produtoId;
  }
  get quantidade() {
    return this.props.quantidade;
  }
  get origem() {
    return this.props.origem;
  }
  get destino() {
    return this.props.destino;
  }
  get responsavelTecnico() {
    return this.props.responsavelTecnico;
  }
  get documentos(): readonly DocumentoCarga[] {
    return this.props.documentos;
  }
  get status() {
    return this.props.status;
  }
  get motivoBloqueio() {
    return this.props.motivoBloqueio;
  }
  get motivoCancelamento() {
    return this.props.motivoCancelamento;
  }
  get dataEntrada() {
    return this.props.dataEntrada;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
