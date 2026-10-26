/**
 * Documentação OpenAPI 3.0 da API QuimiPort, servida pelo Swagger UI em /docs
 * e em JSON em /docs/openapi.json.
 */

const PRODUTO_ID = "6f1c2b8e-3a0d-4e57-9a6b-2c1f7d4e8a10";
const CARGA_ID = "0b7e9c55-1f2a-4d3b-8c6e-5a4f3e2d1c0b";

const erro = (codigo: string, mensagem: string, detalhes?: unknown) => ({
  erro: { codigo, mensagem, ...(detalhes ? { detalhes } : {}), requestId: "c0a8012e-7f3a-4b1e-9d2c-1a2b3c4d5e6f" },
});

const resposta = (descricao: string, schema: string, exemplo?: unknown) => ({
  description: descricao,
  content: {
    "application/json": {
      schema: { $ref: `#/components/schemas/${schema}` },
      ...(exemplo ? { example: exemplo } : {}),
    },
  },
});

const respostaErro = (descricao: string, exemplos: Record<string, unknown>) => ({
  description: descricao,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Erro" },
      examples: Object.fromEntries(Object.entries(exemplos).map(([k, v]) => [k, { value: v }])),
    },
  },
});

const idPath = (recurso: string) => ({
  name: "id",
  in: "path",
  required: true,
  description: `Identificador (UUID) do(a) ${recurso}`,
  schema: { type: "string", format: "uuid" },
});

const erroIdInvalido = respostaErro("Identificador malformado", {
  idInvalido: erro("REQUISICAO_INVALIDA", "Dados da requisição inválidos.", [
    { campo: "id", mensagem: "O identificador informado não é um UUID válido." },
  ]),
});

const produtoExemplo = {
  id: PRODUTO_ID,
  nome: "Ácido Sulfúrico 98%",
  descricao: "Ácido inorgânico forte, altamente corrosivo.",
  numeroOnu: "UN1830",
  classeRisco: "8",
  classeRiscoDescricao: "Substâncias corrosivas",
  grupoCompatibilidade: "ACIDOS",
  status: "ATIVO",
  createdAt: "2026-10-26T12:00:00.000Z",
  updatedAt: "2026-10-26T12:00:00.000Z",
};

const cargaExemplo = {
  id: CARGA_ID,
  codigo: "QPA-2610-0891",
  produto: { id: PRODUTO_ID, nome: "Ácido Sulfúrico 98%", numeroOnu: "UN1830", classeRisco: "8" },
  quantidade: 24000,
  unidade: "KG",
  origem: "Navio MSC Aurora — Berço 12",
  destino: "Tanques B-02",
  responsavelTecnico: { nome: "Bruno Costa", registroProfissional: "CRQ-IV 04123456" },
  documentos: [
    { id: "a1b2c3d4-0000-4000-8000-000000000001", tipo: "FISPQ", numero: "FISPQ-2026-77", validade: "2027-03-31", situacao: "VALIDO", vencido: false, valido: true },
    { id: "a1b2c3d4-0000-4000-8000-000000000002", tipo: "CERTIFICADO_ANALISE", numero: null, validade: null, situacao: "PENDENTE", vencido: false, valido: false },
  ],
  documentacaoCompleta: false,
  status: "EM_INSPECAO",
  statusDescricao: "Em inspeção",
  transicoesPermitidas: ["LIBERADA", "BLOQUEADA", "CANCELADA"],
  motivoBloqueio: null,
  motivoCancelamento: null,
  dataEntrada: "2026-10-26T09:41:00.000Z",
  createdAt: "2026-10-26T09:41:00.000Z",
  updatedAt: "2026-10-26T10:15:00.000Z",
};

const STATUS_CARGA = ["REGISTRADA", "EM_ANALISE", "EM_INSPECAO", "LIBERADA", "BLOQUEADA", "EM_MOVIMENTACAO", "FINALIZADA", "CANCELADA"];

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "QuimiPort API",
    version: "1.0.0",
    description: [
      "API backend do **QuimiPort** — gestão de produtos e cargas químicas em ambiente portuário (Tech Challenge — Fase 2).",
      "",
      "### Padrão de erros",
      "| HTTP | Quando |",
      "|---|---|",
      "| 400 | Formato inválido (JSON malformado, UUID inválido, tipo errado) — `REQUISICAO_INVALIDA` / `JSON_INVALIDO` |",
      "| 404 | Produto, carga ou rota inexistente |",
      "| 409 | Transição de status proibida (`TRANSICAO_DE_STATUS_INVALIDA`) ou código de carga duplicado (`CONFLITO`) |",
      "| 422 | Regra de negócio violada — cada regra tem seu próprio `codigo` |",
      "| 500 | Erro interno (logado com `requestId`) |",
      "",
      "### Máquina de estados da carga",
      "Fluxo principal: `REGISTRADA → EM_ANALISE → EM_INSPECAO → LIBERADA → EM_MOVIMENTACAO → FINALIZADA`.",
      "Alternativos: `REGISTRADA|EM_ANALISE|EM_INSPECAO|LIBERADA|BLOQUEADA → CANCELADA` e `EM_INSPECAO → BLOQUEADA`.",
      "Terminais: `FINALIZADA` e `CANCELADA`. A tabela completa está em `GET /meta/status-carga`.",
    ].join("\n"),
  },
  servers: [{ url: "/", description: "Servidor atual" }],
  tags: [
    { name: "Produtos químicos", description: "Cadastro e manutenção de produtos químicos" },
    { name: "Cargas químicas", description: "Registro, documentação e ciclo de vida das cargas" },
    { name: "Consultas", description: "Resumo operacional e metadados do domínio" },
    { name: "Infra", description: "Saúde e métricas" },
  ],
  paths: {
    "/produtos-quimicos": {
      post: {
        tags: ["Produtos químicos"],
        summary: "Criar produto químico",
        description:
          "Regras: nome obrigatório (`PRODUTO_SEM_NOME`), classe de risco obrigatória e válida pela ONU (`PRODUTO_SEM_CLASSE_RISCO`, `CLASSE_RISCO_INVALIDA`), status ATIVO/INATIVO (`PRODUTO_STATUS_INVALIDO`), número ONU com 4 dígitos (`NUMERO_ONU_INVALIDO`).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProdutoQuimicoInput" },
              example: {
                nome: "Ácido Sulfúrico 98%",
                descricao: "Ácido inorgânico forte, altamente corrosivo.",
                numeroOnu: "1830",
                classeRisco: "8",
                grupoCompatibilidade: "ACIDOS",
              },
            },
          },
        },
        responses: {
          201: resposta("Produto criado", "ProdutoQuimico", produtoExemplo),
          400: respostaErro("JSON malformado ou tipo inválido", {
            json: erro("JSON_INVALIDO", "O corpo da requisição não é um JSON válido."),
          }),
          422: respostaErro("Regra de negócio violada", {
            semNome: erro("PRODUTO_SEM_NOME", "Produto químico não pode ser cadastrado sem nome."),
            semClasse: erro("PRODUTO_SEM_CLASSE_RISCO", "Produto químico não pode ser cadastrado sem classe de risco."),
            statusInvalido: erro("PRODUTO_STATUS_INVALIDO", 'Status de produto inválido: "SUSPENSO". Use ATIVO ou INATIVO.'),
          }),
        },
      },
      get: {
        tags: ["Produtos químicos"],
        summary: "Listar produtos químicos",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["ATIVO", "INATIVO"] } },
          { name: "busca", in: "query", description: "Filtra por nome ou número ONU", schema: { type: "string" } },
          { $ref: "#/components/parameters/Pagina" },
          { $ref: "#/components/parameters/Limite" },
        ],
        responses: {
          200: {
            description: "Lista paginada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PaginaProdutos" },
                example: { dados: [produtoExemplo], meta: { total: 1, pagina: 1, limite: 20, totalPaginas: 1 } },
              },
            },
          },
          400: respostaErro("Filtro inválido", {
            status: erro("REQUISICAO_INVALIDA", "Dados da requisição inválidos.", [{ campo: "status", mensagem: "Invalid option" }]),
          }),
        },
      },
    },
    "/produtos-quimicos/{id}": {
      parameters: [idPath("produto")],
      get: {
        tags: ["Produtos químicos"],
        summary: "Buscar produto químico por identificador",
        responses: {
          200: resposta("Produto encontrado", "ProdutoQuimico", produtoExemplo),
          400: erroIdInvalido,
          404: respostaErro("Produto não encontrado", {
            naoEncontrado: erro("RECURSO_NAO_ENCONTRADO", `Produto químico não encontrado(a): ${PRODUTO_ID}.`),
          }),
        },
      },
      put: {
        tags: ["Produtos químicos"],
        summary: "Atualizar produto químico",
        description: "Substitui os dados do produto aplicando as mesmas regras da criação.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ProdutoQuimicoInput" } } },
        },
        responses: {
          200: resposta("Produto atualizado", "ProdutoQuimico", produtoExemplo),
          400: erroIdInvalido,
          404: respostaErro("Produto não encontrado", { naoEncontrado: erro("RECURSO_NAO_ENCONTRADO", "Produto químico não encontrado(a).") }),
          422: respostaErro("Regra de negócio violada", { semNome: erro("PRODUTO_SEM_NOME", "Produto químico não pode ser cadastrado sem nome.") }),
        },
      },
    },
    "/produtos-quimicos/{id}/inativar": {
      parameters: [idPath("produto")],
      patch: {
        tags: ["Produtos químicos"],
        summary: "Inativar produto químico (exclusão lógica)",
        description: "Produto inativo permanece no histórico, mas não pode ser usado em novas cargas (`PRODUTO_INATIVO`).",
        responses: {
          200: resposta("Produto inativado", "ProdutoQuimico", { ...produtoExemplo, status: "INATIVO" }),
          404: respostaErro("Produto não encontrado", { naoEncontrado: erro("RECURSO_NAO_ENCONTRADO", "Produto químico não encontrado(a).") }),
          422: respostaErro("Produto já inativo", { jaInativo: erro("PRODUTO_JA_INATIVO", "Produto químico já está inativo.") }),
        },
      },
    },
    "/cargas-quimicas": {
      post: {
        tags: ["Cargas químicas"],
        summary: "Registrar carga química",
        description:
          "A carga nasce com status `REGISTRADA`. Regras: produto obrigatório e existente (`CARGA_SEM_PRODUTO`, `PRODUTO_NAO_ENCONTRADO`), produto ativo (`PRODUTO_INATIVO`), quantidade > 0 (`QUANTIDADE_INVALIDA`), responsável técnico obrigatório (`CARGA_SEM_RESPONSAVEL_TECNICO`). Se `codigo` não for enviado, a API gera um no formato `QPA-AAMM-XXXX`.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegistrarCargaInput" },
              example: {
                produtoId: PRODUTO_ID,
                quantidade: 24000,
                unidade: "KG",
                origem: "Navio MSC Aurora — Berço 12",
                destino: "Tanques B-02",
                responsavelTecnico: { nome: "Bruno Costa", registroProfissional: "CRQ-IV 04123456" },
                documentos: [
                  { tipo: "FISPQ", numero: "FISPQ-2026-77", validade: "2027-03-31", situacao: "VALIDO" },
                  { tipo: "CERTIFICADO_ANALISE" },
                ],
              },
            },
          },
        },
        responses: {
          201: resposta("Carga registrada", "CargaQuimica", { ...cargaExemplo, status: "REGISTRADA", statusDescricao: "Registrada", transicoesPermitidas: ["EM_ANALISE", "CANCELADA"] }),
          400: respostaErro("Formato inválido", {
            uuid: erro("REQUISICAO_INVALIDA", "Dados da requisição inválidos.", [{ campo: "produtoId", mensagem: "produtoId deve ser um UUID válido." }]),
          }),
          409: respostaErro("Código duplicado", { duplicado: erro("CONFLITO", "Já existe uma carga com o código QPA-2610-0891.") }),
          422: respostaErro("Regra de negócio violada", {
            produtoInativo: erro("PRODUTO_INATIVO", "Carga química não pode ser registrada com produto químico inativo."),
            semProduto: erro("CARGA_SEM_PRODUTO", "Carga química não pode ser registrada sem produto químico associado."),
            quantidade: erro("QUANTIDADE_INVALIDA", "A quantidade da carga deve ser maior que zero."),
            semResponsavel: erro("CARGA_SEM_RESPONSAVEL_TECNICO", "Toda carga deve possuir responsável técnico informado."),
          }),
        },
      },
      get: {
        tags: ["Cargas químicas"],
        summary: "Listar cargas químicas",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: STATUS_CARGA } },
          { name: "produtoId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "busca", in: "query", description: "Código, origem, destino ou responsável", schema: { type: "string" } },
          { $ref: "#/components/parameters/Pagina" },
          { $ref: "#/components/parameters/Limite" },
        ],
        responses: {
          200: {
            description: "Lista paginada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PaginaCargas" },
                example: { dados: [cargaExemplo], meta: { total: 1, pagina: 1, limite: 20, totalPaginas: 1 } },
              },
            },
          },
        },
      },
    },
    "/cargas-quimicas/{id}": {
      parameters: [idPath("carga")],
      get: {
        tags: ["Cargas químicas"],
        summary: "Buscar carga química por identificador",
        responses: {
          200: resposta("Carga encontrada", "CargaQuimica", cargaExemplo),
          400: erroIdInvalido,
          404: respostaErro("Carga não encontrada", { naoEncontrada: erro("RECURSO_NAO_ENCONTRADO", `Carga química não encontrado(a): ${CARGA_ID}.`) }),
        },
      },
    },
    "/cargas-quimicas/{id}/status": {
      parameters: [idPath("carga")],
      patch: {
        tags: ["Cargas químicas"],
        summary: "Atualizar status da carga",
        description:
          "Aplica a máquina de estados. `motivo` é obrigatório para `BLOQUEADA` e `CANCELADA`. Ir para `LIBERADA` exige documentação completa e válida.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AlterarStatusInput" },
              examples: {
                avancar: { value: { status: "EM_ANALISE" } },
                bloquear: { value: { status: "BLOQUEADA", motivo: "Lacre do contêiner violado na inspeção" } },
              },
            },
          },
        },
        responses: {
          200: resposta("Status alterado", "CargaQuimica", cargaExemplo),
          400: erroIdInvalido,
          404: respostaErro("Carga não encontrada", { naoEncontrada: erro("RECURSO_NAO_ENCONTRADO", "Carga química não encontrado(a).") }),
          409: respostaErro("Transição proibida", {
            pularEtapa: erro("TRANSICAO_DE_STATUS_INVALIDA", "Transição de status não permitida: REGISTRADA → FINALIZADA.", { de: "REGISTRADA", para: "FINALIZADA" }),
            bloqueada: erro("TRANSICAO_DE_STATUS_INVALIDA", "Uma carga bloqueada não pode entrar em movimentação.", { de: "BLOQUEADA", para: "EM_MOVIMENTACAO" }),
            terminal: erro("TRANSICAO_DE_STATUS_INVALIDA", "Carga com status Finalizada não pode sofrer novas alterações de status.", { de: "FINALIZADA", para: "EM_MOVIMENTACAO" }),
          }),
          422: respostaErro("Regra de negócio violada", {
            documentacao: erro("DOCUMENTACAO_INCOMPLETA", "Uma carga não pode ser liberada sem documentação obrigatória completa e válida.", { documentosPendentes: ["CERTIFICADO_ANALISE"] }),
            motivo: erro("MOTIVO_OBRIGATORIO", "Informe o motivo para bloquear a carga."),
            statusInvalido: erro("STATUS_INVALIDO", 'Status de carga inválido: "PERDIDA".'),
          }),
        },
      },
    },
    "/cargas-quimicas/{id}/liberar": {
      parameters: [idPath("carga")],
      patch: {
        tags: ["Cargas químicas"],
        summary: "Liberar carga",
        description: "Atalho para `EM_INSPECAO → LIBERADA`. Exige documentação completa e válida; carga cancelada nunca é liberada.",
        responses: {
          200: resposta("Carga liberada", "CargaQuimica", { ...cargaExemplo, status: "LIBERADA", statusDescricao: "Liberada", documentacaoCompleta: true, transicoesPermitidas: ["EM_MOVIMENTACAO", "CANCELADA"] }),
          404: respostaErro("Carga não encontrada", { naoEncontrada: erro("RECURSO_NAO_ENCONTRADO", "Carga química não encontrado(a).") }),
          409: respostaErro("Transição proibida", {
            cancelada: erro("TRANSICAO_DE_STATUS_INVALIDA", "Uma carga cancelada não pode ser liberada.", { de: "CANCELADA", para: "LIBERADA" }),
          }),
          422: respostaErro("Documentação incompleta", {
            documentacao: erro("DOCUMENTACAO_INCOMPLETA", "Uma carga não pode ser liberada sem documentação obrigatória completa e válida."),
          }),
        },
      },
    },
    "/cargas-quimicas/{id}/bloquear": {
      parameters: [idPath("carga")],
      patch: {
        tags: ["Cargas químicas"],
        summary: "Bloquear carga",
        description: "Atalho para `EM_INSPECAO → BLOQUEADA`. Motivo obrigatório.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/MotivoInput" }, example: { motivo: "FISPQ divergente do produto declarado" } } },
        },
        responses: {
          200: resposta("Carga bloqueada", "CargaQuimica", { ...cargaExemplo, status: "BLOQUEADA", statusDescricao: "Bloqueada", motivoBloqueio: "FISPQ divergente do produto declarado", transicoesPermitidas: ["CANCELADA"] }),
          409: respostaErro("Transição proibida", { naoInspecao: erro("TRANSICAO_DE_STATUS_INVALIDA", "Transição de status não permitida: REGISTRADA → BLOQUEADA.") }),
          422: respostaErro("Motivo ausente", { motivo: erro("MOTIVO_OBRIGATORIO", "Informe o motivo para bloquear a carga.") }),
        },
      },
    },
    "/cargas-quimicas/{id}/cancelar": {
      parameters: [idPath("carga")],
      patch: {
        tags: ["Cargas químicas"],
        summary: "Cancelar carga",
        description: "Permitido a partir de REGISTRADA, EM_ANALISE, EM_INSPECAO, LIBERADA e BLOQUEADA. Motivo obrigatório. Estado terminal.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/MotivoInput" }, example: { motivo: "Importador desistiu da operação" } } },
        },
        responses: {
          200: resposta("Carga cancelada", "CargaQuimica", { ...cargaExemplo, status: "CANCELADA", statusDescricao: "Cancelada", motivoCancelamento: "Importador desistiu da operação", transicoesPermitidas: [] }),
          409: respostaErro("Transição proibida", { terminal: erro("TRANSICAO_DE_STATUS_INVALIDA", "Carga com status Finalizada não pode sofrer novas alterações de status.") }),
          422: respostaErro("Motivo ausente", { motivo: erro("MOTIVO_OBRIGATORIO", "Informe o motivo para cancelar a carga.") }),
        },
      },
    },
    "/cargas-quimicas/{id}/documentos": {
      parameters: [idPath("carga")],
      patch: {
        tags: ["Cargas químicas"],
        summary: "Atualizar documentação obrigatória",
        description: "Substitui a lista de documentos da carga. Documento só conta como entregue se `situacao = VALIDO` e não estiver vencido.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DocumentosInput" },
              example: {
                documentos: [
                  { tipo: "FISPQ", numero: "FISPQ-2026-77", validade: "2027-03-31", situacao: "VALIDO" },
                  { tipo: "CERTIFICADO_ANALISE", numero: "CA-55821", validade: "2027-01-15", situacao: "VALIDO" },
                ],
              },
            },
          },
        },
        responses: {
          200: resposta("Documentação atualizada", "CargaQuimica", { ...cargaExemplo, documentacaoCompleta: true }),
          422: respostaErro("Regra violada", {
            tipo: erro("TIPO_DOCUMENTO_INVALIDO", 'Tipo de documento inválido: "RG".'),
            encerrada: erro("CARGA_ENCERRADA", "Carga com status Cancelada não pode ter a documentação alterada."),
          }),
        },
      },
    },
    "/cargas-quimicas/{id}/historico": {
      parameters: [idPath("carga")],
      get: {
        tags: ["Cargas químicas"],
        summary: "Histórico de mudanças de status da carga",
        responses: {
          200: {
            description: "Histórico em ordem cronológica",
            content: {
              "application/json": {
                schema: { type: "object", properties: { dados: { type: "array", items: { $ref: "#/components/schemas/HistoricoStatus" } } } },
              },
            },
          },
          404: respostaErro("Carga não encontrada", { naoEncontrada: erro("RECURSO_NAO_ENCONTRADO", "Carga química não encontrado(a).") }),
        },
      },
    },
    "/resumo-operacional": {
      get: {
        tags: ["Consultas"],
        summary: "Resumo para o painel operacional",
        description: "Contagem por status, pendências de documentação e últimas movimentações.",
        responses: { 200: { description: "Resumo", content: { "application/json": { schema: { $ref: "#/components/schemas/ResumoOperacional" } } } } },
      },
    },
    "/meta/status-carga": {
      get: {
        tags: ["Consultas"],
        summary: "Tabela de status e transições permitidas",
        responses: { 200: { description: "Máquina de estados servida pela própria API" } },
      },
    },
    "/meta/classes-risco": {
      get: { tags: ["Consultas"], summary: "Classes de risco ONU aceitas", responses: { 200: { description: "Lista de classes" } } },
    },
    "/health": {
      get: {
        tags: ["Infra"],
        summary: "Saúde da API e do banco",
        responses: {
          200: { description: "API e banco OK", content: { "application/json": { example: { status: "ok", banco: "ok", uptime: 123.4 } } } },
          503: { description: "Banco indisponível", content: { "application/json": { example: { status: "degradado", banco: "indisponivel", uptime: 123.4 } } } },
        },
      },
    },
    "/metrics": {
      get: { tags: ["Infra"], summary: "Métricas no formato Prometheus", responses: { 200: { description: "text/plain; version=0.0.4" } } },
    },
    "/graphql": {
      post: {
        tags: ["Consultas"],
        summary: "GraphQL (diferencial, somente leitura)",
        description: "Queries `cargasPorStatus(status, limite)` e `produtoQuimico(id)`.",
        requestBody: {
          content: {
            "application/json": {
              example: { query: "{ cargasPorStatus(status: EM_INSPECAO) { codigo statusDescricao produto { nome classeRisco } documentacaoCompleta } }" },
            },
          },
        },
        responses: { 200: { description: "Resultado GraphQL" } },
      },
    },
  },
  components: {
    parameters: {
      Pagina: { name: "pagina", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
      Limite: { name: "limite", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
    },
    schemas: {
      Erro: {
        type: "object",
        properties: {
          erro: {
            type: "object",
            properties: {
              codigo: { type: "string", example: "PRODUTO_INATIVO" },
              mensagem: { type: "string" },
              detalhes: { description: "Informações adicionais (campos inválidos, transição tentada...)" },
              requestId: { type: "string", description: "Mesmo valor do header x-request-id e dos logs" },
            },
          },
        },
      },
      ProdutoQuimicoInput: {
        type: "object",
        required: ["nome", "numeroOnu", "classeRisco", "grupoCompatibilidade"],
        properties: {
          nome: { type: "string", maxLength: 150 },
          descricao: { type: "string", nullable: true },
          numeroOnu: { type: "string", description: "4 dígitos, com ou sem prefixo UN", example: "UN1830" },
          classeRisco: { type: "string", description: "Classe/subclasse ONU", example: "8" },
          grupoCompatibilidade: { type: "string", maxLength: 50, example: "ACIDOS" },
          status: { type: "string", enum: ["ATIVO", "INATIVO"], default: "ATIVO" },
        },
      },
      ProdutoQuimico: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          nome: { type: "string" },
          descricao: { type: "string", nullable: true },
          numeroOnu: { type: "string" },
          classeRisco: { type: "string" },
          classeRiscoDescricao: { type: "string" },
          grupoCompatibilidade: { type: "string" },
          status: { type: "string", enum: ["ATIVO", "INATIVO"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      DocumentoInput: {
        type: "object",
        required: ["tipo"],
        properties: {
          tipo: { type: "string", enum: ["FISPQ", "CERTIFICADO_ANALISE", "LICENCA_IMPORTACAO", "NOTA_FISCAL", "DOCUMENTO_TRANSPORTE", "OUTRO"] },
          numero: { type: "string", nullable: true },
          validade: { type: "string", format: "date", nullable: true },
          situacao: { type: "string", enum: ["PENDENTE", "VALIDO"], default: "PENDENTE" },
        },
      },
      Documento: {
        allOf: [
          { $ref: "#/components/schemas/DocumentoInput" },
          {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              vencido: { type: "boolean" },
              valido: { type: "boolean", description: "VALIDO e dentro da validade" },
            },
          },
        ],
      },
      RegistrarCargaInput: {
        type: "object",
        required: ["produtoId", "quantidade", "unidade", "origem", "destino", "responsavelTecnico"],
        properties: {
          codigo: { type: "string", description: "Opcional — gerado automaticamente se ausente" },
          produtoId: { type: "string", format: "uuid" },
          quantidade: { type: "number", exclusiveMinimum: true, minimum: 0 },
          unidade: { type: "string", enum: ["KG", "TONELADA", "LITRO", "METRO_CUBICO"] },
          origem: { type: "string" },
          destino: { type: "string" },
          responsavelTecnico: {
            type: "object",
            required: ["nome"],
            properties: { nome: { type: "string" }, registroProfissional: { type: "string", nullable: true } },
          },
          documentos: { type: "array", items: { $ref: "#/components/schemas/DocumentoInput" } },
          dataEntrada: { type: "string", format: "date-time", description: "Padrão: agora" },
        },
      },
      CargaQuimica: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          codigo: { type: "string" },
          produto: {
            type: "object",
            properties: { id: { type: "string" }, nome: { type: "string" }, numeroOnu: { type: "string" }, classeRisco: { type: "string" } },
          },
          quantidade: { type: "number" },
          unidade: { type: "string" },
          origem: { type: "string" },
          destino: { type: "string" },
          responsavelTecnico: { type: "object", properties: { nome: { type: "string" }, registroProfissional: { type: "string", nullable: true } } },
          documentos: { type: "array", items: { $ref: "#/components/schemas/Documento" } },
          documentacaoCompleta: { type: "boolean" },
          status: { type: "string", enum: STATUS_CARGA },
          statusDescricao: { type: "string" },
          transicoesPermitidas: { type: "array", items: { type: "string", enum: STATUS_CARGA } },
          motivoBloqueio: { type: "string", nullable: true },
          motivoCancelamento: { type: "string", nullable: true },
          dataEntrada: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      AlterarStatusInput: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", enum: STATUS_CARGA }, motivo: { type: "string" } },
      },
      MotivoInput: { type: "object", required: ["motivo"], properties: { motivo: { type: "string", minLength: 3 } } },
      DocumentosInput: {
        type: "object",
        required: ["documentos"],
        properties: { documentos: { type: "array", items: { $ref: "#/components/schemas/DocumentoInput" } } },
      },
      HistoricoStatus: {
        type: "object",
        properties: {
          id: { type: "string" },
          cargaId: { type: "string" },
          codigoCarga: { type: "string" },
          produtoNome: { type: "string" },
          statusAnterior: { type: "string", nullable: true },
          statusNovo: { type: "string" },
          motivo: { type: "string", nullable: true },
          ocorridoEm: { type: "string", format: "date-time" },
        },
      },
      Meta: {
        type: "object",
        properties: { total: { type: "integer" }, pagina: { type: "integer" }, limite: { type: "integer" }, totalPaginas: { type: "integer" } },
      },
      PaginaProdutos: {
        type: "object",
        properties: { dados: { type: "array", items: { $ref: "#/components/schemas/ProdutoQuimico" } }, meta: { $ref: "#/components/schemas/Meta" } },
      },
      PaginaCargas: {
        type: "object",
        properties: { dados: { type: "array", items: { $ref: "#/components/schemas/CargaQuimica" } }, meta: { $ref: "#/components/schemas/Meta" } },
      },
      ResumoOperacional: {
        type: "object",
        properties: {
          geradoEm: { type: "string", format: "date-time" },
          totalProdutosAtivos: { type: "integer" },
          totalCargas: { type: "integer" },
          cargasPorStatus: { type: "object", additionalProperties: { type: "integer" } },
          pendenciasDocumentacao: { type: "array", items: { type: "object" } },
          ultimasMovimentacoes: { type: "array", items: { $ref: "#/components/schemas/HistoricoStatus" } },
        },
      },
    },
  },
} as const;
