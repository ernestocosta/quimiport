import { CargaQuimica } from "../../domain/aggregates/carga-quimica";
import { ProdutoQuimico } from "../../domain/entities/produto-quimico";
import { CargaQuimicaRepository, ProdutoQuimicoRepository } from "../../domain/repositories";

/**
 * Dados de exemplo para demonstração. Tudo passa pelo domínio, então o
 * seed respeita as mesmas regras da API (inclusive a máquina de estados).
 * Idempotente: se já houver produtos, não faz nada.
 */
export async function popularBanco(produtos: ProdutoQuimicoRepository, cargas: CargaQuimicaRepository) {
  const existentes = await produtos.listar({ pagina: 1, limite: 1 });
  if (existentes.total > 0) return { produtos: 0, cargas: 0, ignorado: true };

  const p = {
    acido: ProdutoQuimico.criar({ nome: "Ácido Sulfúrico 98%", descricao: "Ácido inorgânico forte, altamente corrosivo.", numeroOnu: "1830", classeRisco: "8", grupoCompatibilidade: "ACIDOS" }),
    soda: ProdutoQuimico.criar({ nome: "Soda Cáustica (Hidróxido de Sódio) solução", numeroOnu: "1824", classeRisco: "8", grupoCompatibilidade: "ALCALIS" }),
    etanol: ProdutoQuimico.criar({ nome: "Etanol Anidro", descricao: "Combustível e solvente.", numeroOnu: "1170", classeRisco: "3", grupoCompatibilidade: "INFLAMAVEIS" }),
    hipoclorito: ProdutoQuimico.criar({ nome: "Hipoclorito de Sódio 12%", numeroOnu: "1791", classeRisco: "8", grupoCompatibilidade: "OXIDANTES" }),
    amonia: ProdutoQuimico.criar({ nome: "Amônia Anidra", numeroOnu: "1005", classeRisco: "2.3", grupoCompatibilidade: "GASES_TOXICOS" }),
    metanol: ProdutoQuimico.criar({ nome: "Metanol", numeroOnu: "1230", classeRisco: "3", grupoCompatibilidade: "INFLAMAVEIS" }),
  };
  p.metanol.inativar();
  for (const produto of Object.values(p)) await produtos.salvar(produto);

  const validade = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 2, 31));
  const docsOk = [
    { tipo: "FISPQ", numero: "FISPQ-001", validade, situacao: "VALIDO" },
    { tipo: "CERTIFICADO_ANALISE", numero: "CA-001", validade, situacao: "VALIDO" },
    { tipo: "NOTA_FISCAL", numero: "NF-4471", situacao: "VALIDO" },
  ];
  const docsPendentes = [
    { tipo: "FISPQ", numero: "FISPQ-002", validade, situacao: "VALIDO" },
    { tipo: "CERTIFICADO_ANALISE" },
    { tipo: "LICENCA_IMPORTACAO" },
  ];

  const nova = (produto: ProdutoQuimico, dados: Partial<Parameters<typeof CargaQuimica.registrar>[0]>) =>
    CargaQuimica.registrar({
      produto,
      quantidade: 10000,
      unidade: "KG",
      origem: "Navio MSC Aurora — Berço 12",
      destino: "Tanques B-02",
      responsavelTecnico: { nome: "Bruno Costa", registroProfissional: "CRQ-IV 04123456" },
      ...dados,
    });

  const lista: CargaQuimica[] = [];

  const c1 = nova(p.acido, { quantidade: 24000, documentos: docsPendentes });
  c1.alterarStatus("EM_ANALISE");
  lista.push(c1);

  const c2 = nova(p.soda, { quantidade: 18, unidade: "TONELADA", destino: "Pátio 2", responsavelTecnico: { nome: "Juliana Mendes" }, documentos: docsPendentes });
  c2.alterarStatus("EM_ANALISE");
  c2.alterarStatus("EM_INSPECAO");
  c2.bloquear("FISPQ divergente do produto declarado");
  lista.push(c2);

  const c3 = nova(p.hipoclorito, { quantidade: 32000, unidade: "LITRO", destino: "Armazém 1", responsavelTecnico: { nome: "Paulo Andrade" }, documentos: docsOk });
  c3.alterarStatus("EM_ANALISE");
  c3.alterarStatus("EM_INSPECAO");
  lista.push(c3);

  const c4 = nova(p.etanol, { quantidade: 450, unidade: "METRO_CUBICO", destino: "Tanques A-01", responsavelTecnico: { nome: "Carla Souza" }, documentos: docsOk });
  c4.alterarStatus("EM_ANALISE");
  c4.alterarStatus("EM_INSPECAO");
  c4.liberar();
  lista.push(c4);

  const c5 = nova(p.etanol, { quantidade: 300, unidade: "METRO_CUBICO", responsavelTecnico: { nome: "Ricardo Lima" }, documentos: docsOk });
  c5.alterarStatus("EM_ANALISE");
  c5.alterarStatus("EM_INSPECAO");
  c5.liberar();
  c5.alterarStatus("EM_MOVIMENTACAO");
  lista.push(c5);

  const c6 = nova(p.acido, { quantidade: 12000, documentos: docsOk });
  c6.alterarStatus("EM_ANALISE");
  c6.alterarStatus("EM_INSPECAO");
  c6.liberar();
  c6.alterarStatus("EM_MOVIMENTACAO");
  c6.alterarStatus("FINALIZADA");
  lista.push(c6);

  const c7 = nova(p.amonia, { quantidade: 8, unidade: "TONELADA", responsavelTecnico: { nome: "Carla Souza" } });
  lista.push(c7);

  const c8 = nova(p.soda, { quantidade: 5000 });
  c8.cancelar("Importador desistiu da operação");
  lista.push(c8);

  for (const carga of lista) await cargas.salvar(carga);
  return { produtos: Object.keys(p).length, cargas: lista.length, ignorado: false };
}

if (require.main === module) {
  // Execução manual: npm run db:seed
  (async () => {
    const { carregarEnv } = await import("../config/env");
    const { criarConexao } = await import("./database");
    const { DrizzleProdutoQuimicoRepository } = await import("../repositories/drizzle/drizzle-produto-quimico.repository");
    const { DrizzleCargaQuimicaRepository } = await import("../repositories/drizzle/drizzle-carga-quimica.repository");
    const conexao = criarConexao(carregarEnv().DATABASE_URL);
    try {
      const r = await popularBanco(
        new DrizzleProdutoQuimicoRepository(conexao.db),
        new DrizzleCargaQuimicaRepository(conexao.db),
      );
      console.log(r.ignorado ? "Banco já possui dados — seed ignorado." : `Seed concluído: ${r.produtos} produtos, ${r.cargas} cargas.`);
    } finally {
      await conexao.fechar();
    }
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
