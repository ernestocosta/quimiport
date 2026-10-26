import { Logger, Metricas, ConsultasQuimiPort } from "./application/ports";
import { AlterarStatusCarga } from "./application/use-cases/cargas/alterar-status-carga";
import { AtualizarDocumentosCarga } from "./application/use-cases/cargas/atualizar-documentos-carga";
import { BuscarCargaQuimica } from "./application/use-cases/cargas/buscar-carga-quimica";
import { ListarCargasQuimicas } from "./application/use-cases/cargas/listar-cargas-quimicas";
import { RegistrarCargaQuimica } from "./application/use-cases/cargas/registrar-carga-quimica";
import { HistoricoCarga } from "./application/use-cases/consultas/historico-carga";
import { ResumoOperacional } from "./application/use-cases/consultas/resumo-operacional";
import { AtualizarProdutoQuimico } from "./application/use-cases/produtos/atualizar-produto-quimico";
import { BuscarProdutoQuimico } from "./application/use-cases/produtos/buscar-produto-quimico";
import { CriarProdutoQuimico } from "./application/use-cases/produtos/criar-produto-quimico";
import { InativarProdutoQuimico } from "./application/use-cases/produtos/inativar-produto-quimico";
import { ListarProdutosQuimicos } from "./application/use-cases/produtos/listar-produtos-quimicos";
import { CargaQuimicaRepository, ProdutoQuimicoRepository } from "./domain/repositories";

export interface Infraestrutura {
  produtos: ProdutoQuimicoRepository;
  cargas: CargaQuimicaRepository;
  consultas: ConsultasQuimiPort;
  logger: Logger;
  metricas: Metricas;
}

/** Composition root: instancia os casos de uso com as dependências concretas. */
export function criarCasosDeUso({ produtos, cargas, consultas, logger, metricas }: Infraestrutura) {
  return {
    criarProduto: new CriarProdutoQuimico(produtos, logger),
    listarProdutos: new ListarProdutosQuimicos(produtos),
    buscarProduto: new BuscarProdutoQuimico(produtos),
    atualizarProduto: new AtualizarProdutoQuimico(produtos, logger),
    inativarProduto: new InativarProdutoQuimico(produtos, logger),
    registrarCarga: new RegistrarCargaQuimica(cargas, produtos, logger, metricas),
    listarCargas: new ListarCargasQuimicas(cargas, produtos),
    buscarCarga: new BuscarCargaQuimica(cargas, produtos),
    alterarStatusCarga: new AlterarStatusCarga(cargas, produtos, logger, metricas),
    atualizarDocumentos: new AtualizarDocumentosCarga(cargas, produtos, logger),
    historicoCarga: new HistoricoCarga(cargas, consultas),
    resumoOperacional: new ResumoOperacional(consultas),
  };
}

export type CasosDeUso = ReturnType<typeof criarCasosDeUso>;
