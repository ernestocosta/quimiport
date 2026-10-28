# QuimiPort — API de gestão de cargas químicas portuárias

> Tech Challenge — **Fase 2** · Pós Tech Full Stack Development
> Continuação da [Fase 1 (modelagem DDD)](https://github.com/ernestocosta/quimiport-tech-challenge)

![CI](https://github.com/ernestocosta/quimiport/actions/workflows/ci.yml/badge.svg)

## Sumário

- [Descrição da solução](#descrição-da-solução)
- [Contexto do problema](#contexto-do-problema)
- [Tecnologias utilizadas](#tecnologias-utilizadas)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Como executar com Docker](#como-executar-com-docker-recomendado)
- [Como executar localmente (sem Docker)](#como-executar-localmente-sem-docker)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Como executar os testes](#como-executar-os-testes)
- [Documentação da API](#documentação-da-api)
- [Principais endpoints](#principais-endpoints)
- [Regras de negócio implementadas](#regras-de-negócio-implementadas)
- [Banco de dados](#banco-de-dados)
- [Logs e observabilidade](#logs-e-observabilidade)
- [CI/CD](#cicd-com-github-actions)
- [Decisões arquiteturais](#decisões-arquiteturais)
- [Diferenciais implementados](#diferenciais-implementados)
- [Integrantes](#integrantes)

---

## Descrição da solução

O **QuimiPort** é uma API REST em Node.js que gerencia **produtos químicos** e **cargas químicas** em um porto (inspirado no Porto de Santos). Com ela é possível:

- cadastrar, listar, atualizar e inativar produtos químicos (com classe de risco ONU, número ONU e grupo de compatibilidade);
- registrar cargas, controlar a **documentação obrigatória** e conduzir cada carga por uma **máquina de estados** que impede transições inválidas;
- bloquear, liberar e cancelar cargas aplicando as regras de segurança do domínio;
- consultar o histórico de status de cada carga e um resumo operacional consolidado.

O repositório também traz um **painel web** (TanStack Start + React) que consome a API em tempo real e permite mover cargas entre status. Isso deixa as regras visíveis na prática: quando a API recusa uma ação, o painel mostra a mensagem de erro dela.

## Contexto do problema

Hoje o controle de cargas químicas em ambiente portuário costuma ser manual ou espalhado em planilhas. Isso dificulta saber o status de cada carga e permite que uma carga perigosa seja liberada sem a documentação correta. A Fase 1 modelou esse domínio com DDD (entidades, agregados, regras e fluxo de status). Esta Fase 2 transforma essa modelagem em uma API funcionando, com banco de dados, testes automatizados, containers e pipeline de CI.

## Tecnologias utilizadas

| Camada | Tecnologia | Por quê |
|---|---|---|
| Runtime | **Node.js 22** + **TypeScript 5.9** | Exigência da lauda; tipagem forte para o domínio |
| HTTP | **Express 5** | Maduro e simples. O Express 5 trata erros de handlers `async` nativamente |
| Validação | **Zod 4** | Valida o formato da entrada na borda HTTP |
| Banco | **PostgreSQL 16** | Dados relacionais com integridade referencial (ver [Banco de dados](#banco-de-dados)) |
| ORM / migrations | **Drizzle ORM** + drizzle-kit | Tipado, sem engine binário, migrations em SQL versionado |
| Docs da API | **OpenAPI 3 + Swagger UI** | `/docs` interativo |
| Logs | **pino** + pino-http | JSON estruturado com `requestId` |
| Métricas | **prom-client** (+ Prometheus/Grafana opcionais) | Diferencial da lauda |
| GraphQL | **graphql** + graphql-http | Diferencial opcional (somente leitura) |
| Testes | **Vitest** + **Supertest** | Unitários e integração (memória e PostgreSQL real) |
| Containers | **Docker** + **Docker Compose** | Ambiente padronizado |
| CI | **GitHub Actions** | Lint, tipos, build, testes e smoke test Docker |
| Painel web | TanStack Start, React 19, Tailwind 4, TanStack Query | Consome a API |

## Estrutura do repositório

```
quimiport/
├── api/                          # API backend (entrega principal da Fase 2)
│   ├── src/
│   │   ├── domain/               # Regras de negócio — não depende de nada externo
│   │   │   ├── aggregates/       # CargaQuimica (raiz de agregado)
│   │   │   ├── entities/         # ProdutoQuimico, DocumentoCarga
│   │   │   ├── value-objects/    # ClasseRisco, Quantidade, ResponsavelTecnico, máquina de estados
│   │   │   ├── enums/            # StatusCarga, StatusProduto, UnidadeMedida...
│   │   │   ├── errors/           # RegraDeNegocioError, TransicaoDeStatusInvalidaError...
│   │   │   └── repositories/     # Contratos (interfaces) dos repositórios
│   │   ├── application/
│   │   │   ├── use-cases/        # CriarProdutoQuimico, RegistrarCargaQuimica, AlterarStatusCarga...
│   │   │   ├── dtos/             # Contratos de entrada/saída + mapeadores
│   │   │   └── ports/            # Logger, Métricas, Consultas (leitura)
│   │   ├── infrastructure/
│   │   │   ├── persistence/      # Schema Drizzle, conexão, migrations, seed
│   │   │   ├── repositories/     # Implementações Drizzle (PostgreSQL) e em memória
│   │   │   ├── logging/          # pino
│   │   │   ├── metrics/          # Prometheus
│   │   │   └── config/           # Variáveis de ambiente validadas
│   │   ├── interfaces/
│   │   │   ├── http/             # controllers, rotas, schemas Zod, middlewares, OpenAPI
│   │   │   └── graphql/          # schema GraphQL (diferencial)
│   │   ├── container.ts          # Composition root (injeção de dependências)
│   │   ├── app.ts                # Montagem do Express
│   │   └── main.ts               # Bootstrap: migrations → seed → servidor
│   ├── drizzle/                  # Migrations SQL versionadas
│   ├── tests/                    # unit/ (domínio e casos de uso) + integration/ (HTTP)
│   └── Dockerfile
├── web/                          # Painel operacional que consome a API
├── docs/                         # Modelagem de dados, fluxo de status, ADRs, hospedagem
├── observabilidade/              # Prometheus + Grafana (perfil opcional)
├── .github/workflows/ci.yml      # Pipeline de CI
├── docker-compose.yml
└── render.yaml                   # Blueprint de hospedagem (opcional)
```

## Como executar com Docker (recomendado)

Pré-requisito: Docker com Compose v2.

```bash
git clone https://github.com/ernestocosta/quimiport.git
cd quimiport
docker compose up --build
```

| Serviço | URL |
|---|---|
| API | http://localhost:3333 |
| Swagger (documentação) | http://localhost:3333/docs |
| Painel web | http://localhost:3000 |
| PostgreSQL | localhost:5432 (usuário/senha `quimiport`) |

Ao subir, a API **aplica as migrations automaticamente** e, como `SEED_ON_START=true`, popula o banco com produtos e cargas de exemplo em vários status. O seed só roda se o banco estiver vazio.

Com Prometheus e Grafana:

```bash
docker compose --profile observabilidade up --build
```

Prometheus em http://localhost:9090 e Grafana em http://localhost:3001 (dashboard **QuimiPort API** já provisionado).

Para derrubar tudo e apagar os dados:

```bash
docker compose down -v
```

## Como executar localmente (sem Docker)

Pré-requisitos: Node.js ≥ 20.12 e um PostgreSQL acessível. Se quiser, suba só o banco: `docker compose up -d db`.

```bash
# API
cd api
cp .env.example .env          # ajuste DATABASE_URL se necessário
npm install
npm run db:migrate            # aplica as migrations
npm run db:seed               # (opcional) dados de exemplo
npm run dev                   # http://localhost:3333 com hot reload
```

```bash
# Painel web (outro terminal)
cd web
cp .env.example .env
npm install
npm run dev                   # http://localhost:3000
```

Build de produção da API: `npm run build && npm start`.

## Variáveis de ambiente

**API (`api/.env`)**

| Variável | Padrão | Descrição |
|---|---|---|
| `DATABASE_URL` | `postgresql://quimiport:quimiport@localhost:5432/quimiport` | Conexão PostgreSQL |
| `PORT` | `3333` | Porta HTTP |
| `NODE_ENV` | `development` | `development` (logs legíveis), `production` (JSON) ou `test` (silencioso) |
| `LOG_LEVEL` | `info` | `fatal` · `error` · `warn` · `info` · `debug` · `trace` · `silent` |
| `CORS_ORIGIN` | `*` | Origens permitidas, separadas por vírgula |
| `SEED_ON_START` | `false` | `true` popula o banco vazio ao iniciar |

As variáveis são validadas com Zod na inicialização: se uma delas for inválida, a API nem sobe e mostra o problema.

**Painel (`web/.env`)**: `VITE_API_URL`, o endereço da API que o navegador usa. É embutido no build.

**Compose (`.env` na raiz)**: veja `.env.example`. Todas as variáveis são opcionais.

## Como executar os testes

```bash
cd api
npm test                      # unitários + integração (repositórios em memória)
npm run test:coverage         # idem, com relatório de cobertura em coverage/
```

Para rodar **a mesma suíte de integração contra PostgreSQL real**:

```bash
docker compose up -d db
docker compose exec db createdb -U quimiport quimiport_test
DATABASE_URL_TEST=postgresql://quimiport:quimiport@localhost:5432/quimiport_test npm test
```

No CI essa variável já vem configurada, então os testes sempre rodam também contra o PostgreSQL.

**Resultado atual: 190 testes passando e ~91% de cobertura de linhas.**

### Cenários obrigatórios da lauda × testes

| Cenário (seção 12 da lauda) | Unitário (domínio) | Integração (HTTP) |
|---|---|---|
| Cadastro de produto químico | `produto-quimico.test.ts` › cria produto válido | `[lauda] cadastra produto químico` |
| Bloqueio de produto sem nome | › bloqueia cadastro sem nome | `[lauda] bloqueia cadastro de produto sem nome` |
| Bloqueio de produto sem classe de risco | › bloqueia cadastro sem classe de risco | `[lauda] bloqueia cadastro de produto sem classe de risco` |
| Registro de carga química | `carga-quimica.test.ts` › registra carga válida | `[lauda] registra carga química` |
| Bloqueio de carga com produto inativo | › bloqueia registro com produto inativo | `[lauda] bloqueia carga com produto químico inativo` |
| Bloqueio de carga com quantidade ≤ 0 | › bloqueia quantidade menor ou igual a zero (5 casos) | `[lauda] bloqueia carga com quantidade ≤ 0` (2 casos) |
| Bloqueio de liberação sem documentação | › bloqueia liberação sem documento / pendente / vencido | `[lauda] bloqueia liberação sem documentação obrigatória` |
| Atualização de status da carga | `maquina-status-carga.test.ts` › percorre o fluxo principal | `[lauda] atualiza status pelo fluxo principal até FINALIZADA` |
| Validação das transições permitidas | › todas as 11 transições permitidas da tabela | `[lauda] valida transições permitidas` |
| Bloqueio das transições proibidas | › matriz completa: 53 transições proibidas | `[lauda] bloqueia transição proibida` (3 casos) |
| Cancelamento de carga | › cancela carga registrando o motivo | `[lauda] cancela carga (motivo obrigatório)` |
| Tentativa de movimentar carga bloqueada | › carga bloqueada não pode entrar em movimentação | `[lauda] tentativa de movimentar carga bloqueada é recusada` |

## Documentação da API

Com a API rodando:

- **Swagger UI:** http://localhost:3333/docs, com todos os endpoints, parâmetros, exemplos de request/response, códigos de erro e as regras de cada operação;
- **OpenAPI JSON:** http://localhost:3333/docs/openapi.json, que dá para importar no Insomnia ou no Postman.

### Padrão de resposta de erro

```json
{
  "erro": {
    "codigo": "DOCUMENTACAO_INCOMPLETA",
    "mensagem": "Uma carga não pode ser liberada sem documentação obrigatória completa e válida.",
    "detalhes": { "documentosPendentes": ["CERTIFICADO_ANALISE"] },
    "requestId": "8f0c1d2e-..."
  }
}
```

| HTTP | Significado |
|---|---|
| `400` | Formato inválido: JSON malformado, UUID inválido ou tipo errado |
| `404` | Produto, carga ou rota inexistente |
| `409` | Transição de status proibida ou código de carga duplicado |
| `422` | Regra de negócio violada. Cada regra tem seu próprio `codigo` |
| `500` | Erro interno, registrado no log com o mesmo `requestId` |

## Principais endpoints

### Produtos químicos

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/produtos-quimicos` | Cria produto (nasce `ATIVO`) |
| `GET` | `/produtos-quimicos` | Lista com filtros `status`, `busca`, `pagina` e `limite` |
| `GET` | `/produtos-quimicos/:id` | Busca por id |
| `PUT` | `/produtos-quimicos/:id` | Atualiza (mesmas regras da criação) |
| `PATCH` | `/produtos-quimicos/:id/inativar` | Inativação lógica |

### Cargas químicas

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/cargas-quimicas` | Registra carga (nasce `REGISTRADA`) |
| `GET` | `/cargas-quimicas` | Lista com filtros `status`, `produtoId`, `busca`, `pagina` e `limite` |
| `GET` | `/cargas-quimicas/:id` | Busca por id (inclui `transicoesPermitidas`) |
| `PATCH` | `/cargas-quimicas/:id/status` | Altera status: `{ "status": "EM_ANALISE", "motivo"?: "..." }` |
| `PATCH` | `/cargas-quimicas/:id/liberar` | Libera (exige documentação completa) |
| `PATCH` | `/cargas-quimicas/:id/bloquear` | Bloqueia: `{ "motivo": "..." }` |
| `PATCH` | `/cargas-quimicas/:id/cancelar` | Cancela: `{ "motivo": "..." }` |
| `PATCH` | `/cargas-quimicas/:id/documentos` | Substitui a lista de documentos obrigatórios |
| `GET` | `/cargas-quimicas/:id/historico` | Histórico de mudanças de status |

### Apoio

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/resumo-operacional` | Contagem por status, pendências documentais e últimas movimentações |
| `GET` | `/meta/status-carga` | Máquina de estados servida pela API |
| `GET` | `/meta/classes-risco` | Classes de risco ONU aceitas |
| `POST` | `/graphql` | GraphQL somente leitura (diferencial) |
| `GET` | `/health` | Saúde da API e do banco |
| `GET` | `/metrics` | Métricas Prometheus |

### Exemplo rápido (curl)

```bash
# 1. Cria um produto
curl -s -X POST localhost:3333/produtos-quimicos -H 'content-type: application/json' \
  -d '{"nome":"Ácido Sulfúrico 98%","numeroOnu":"1830","classeRisco":"8","grupoCompatibilidade":"ACIDOS"}'

# 2. Registra uma carga (troque PRODUTO_ID)
curl -s -X POST localhost:3333/cargas-quimicas -H 'content-type: application/json' \
  -d '{"produtoId":"PRODUTO_ID","quantidade":24000,"unidade":"KG","origem":"Berço 12","destino":"Tanques B-02","responsavelTecnico":{"nome":"Bruno Costa"},"documentos":[{"tipo":"FISPQ","situacao":"VALIDO"}]}'

# 3. Avança o status (troque CARGA_ID)
curl -s -X PATCH localhost:3333/cargas-quimicas/CARGA_ID/status -H 'content-type: application/json' -d '{"status":"EM_ANALISE"}'
```

## Regras de negócio implementadas

Todas ficam **no domínio**: na entidade `ProdutoQuimico`, no agregado `CargaQuimica` e nos objetos de valor. Nenhum controller ou caso de uso decide regra.

| Regra | Código de erro | HTTP |
|---|---|---|
| Produto não pode ser cadastrado sem nome | `PRODUTO_SEM_NOME` | 422 |
| Produto não pode ser cadastrado sem classe de risco | `PRODUTO_SEM_CLASSE_RISCO` / `CLASSE_RISCO_INVALIDA` | 422 |
| Produto não pode ser cadastrado com status inválido | `PRODUTO_STATUS_INVALIDO` | 422 |
| Produto inativo não pode ser usado em novas cargas | `PRODUTO_INATIVO` | 422 |
| Carga não pode ser registrada sem produto associado | `CARGA_SEM_PRODUTO` / `PRODUTO_NAO_ENCONTRADO` | 422 |
| Quantidade da carga deve ser maior que zero | `QUANTIDADE_INVALIDA` (+ `CHECK` no banco) | 422 |
| Toda carga deve ter responsável técnico | `CARGA_SEM_RESPONSAVEL_TECNICO` | 422 |
| Carga não pode ser liberada sem documentação obrigatória | `DOCUMENTACAO_INCOMPLETA` | 422 |
| Carga bloqueada não pode entrar em movimentação | `TRANSICAO_DE_STATUS_INVALIDA` | 409 |
| Carga cancelada não pode ser liberada | `TRANSICAO_DE_STATUS_INVALIDA` | 409 |
| Carga em inspeção não pode ser finalizada sem antes ser liberada | `TRANSICAO_DE_STATUS_INVALIDA` | 409 |
| Finalizada/Cancelada não sofrem novas alterações | `TRANSICAO_DE_STATUS_INVALIDA` | 409 |
| Bloquear/cancelar exigem motivo | `MOTIVO_OBRIGATORIO` | 422 |

Documentação só conta como entregue quando está com `situacao = VALIDO` **e** dentro da validade. A carga precisa ter pelo menos um documento.

**Fluxo de status** completo, com tabela de transições permitidas e proibidas e diagrama: [`docs/fluxo-status-carga.md`](docs/fluxo-status-carga.md).

```mermaid
stateDiagram-v2
    direction LR
    [*] --> REGISTRADA
    REGISTRADA --> EM_ANALISE
    EM_ANALISE --> EM_INSPECAO
    EM_INSPECAO --> LIBERADA: documentação completa
    LIBERADA --> EM_MOVIMENTACAO
    EM_MOVIMENTACAO --> FINALIZADA
    EM_INSPECAO --> BLOQUEADA: motivo
    REGISTRADA --> CANCELADA
    EM_ANALISE --> CANCELADA
    EM_INSPECAO --> CANCELADA
    LIBERADA --> CANCELADA
    BLOQUEADA --> CANCELADA
    FINALIZADA --> [*]
    CANCELADA --> [*]
```

## Banco de dados

**PostgreSQL 16.** O domínio é naturalmente relacional: uma carga referencia um produto, tem N documentos e N registros de histórico. As regras dependem de integridade (não apagar produto com carga, código único, quantidade positiva). Em um banco relacional isso é garantido por FK, `UNIQUE` e `CHECK`, além do domínio. Os enums nativos do Postgres impedem status fora da lista mesmo se alguém escrever direto no banco.

| Tabela | Conteúdo |
|---|---|
| `produtos_quimicos` | Produtos (status `ATIVO`/`INATIVO` = inativação lógica) |
| `cargas_quimicas` | Cargas (FK `produto_id` com `ON DELETE RESTRICT`, `codigo` único, `CHECK quantidade > 0`) |
| `documentos_carga` | Documentos obrigatórios de cada carga (FK com `ON DELETE CASCADE`) |
| `historico_status_carga` | Uma linha por transição de status (auditoria) |

Modelagem completa com diagrama ER, campos, chaves, como o status é controlado e como os dados evoluem: [`docs/modelagem-dados.md`](docs/modelagem-dados.md).

As migrations ficam versionadas em `api/drizzle/` (SQL puro) e são aplicadas automaticamente quando a API sobe.

## Logs e observabilidade

- **Toda requisição** é logada (método, rota, status e tempo) com um `requestId`, que também volta no header `x-request-id` e no corpo dos erros.
- **Eventos de negócio:** `produto.criado`, `produto.inativado`, `carga.registrada`, `carga.status_alterado`, `carga.liberada`, `carga.bloqueada`, `carga.cancelada` e `carga.documentacao_atualizada`.
- **Erros de validação** (`requisicao.invalida`) e **regras violadas** (`regra.violada`, com o código) saem em nível `warn`. **Erros internos** saem em `error`, com stack.
- Em produção os logs saem em JSON (prontos para Loki ou ELK). Em desenvolvimento saem coloridos e legíveis.
- **`/metrics`** (Prometheus) expõe: requisições por rota e status, latência (histograma), transições de status (`de` → `para`), regras violadas por código e métricas do processo Node. O perfil `observabilidade` do Compose sobe Prometheus e Grafana com um dashboard pronto.

Exemplo de log (produção):

```json
{"level":40,"time":"2026-10-26T13:20:11.482Z","servico":"quimiport-api","req":{"id":"5b1e...","method":"PATCH","url":"/cargas-quimicas/0b7e.../liberar"},"evento":"regra.violada","codigo":"DOCUMENTACAO_INCOMPLETA","msg":"Uma carga não pode ser liberada sem documentação obrigatória completa e válida."}
```

## CI/CD com GitHub Actions

`.github/workflows/ci.yml` roda a cada push e PR:

1. **API:** `npm ci` → lint (ESLint) → verificação de tipos → build → `drizzle-kit check` (migrations em sincronia com o schema) → testes com cobertura contra um **PostgreSQL de serviço** → cobertura publicada como artefato.
2. **Painel web:** `npm ci` → lint → tipos → build.
3. **Docker:** `docker compose build` das imagens, sobe banco + API, espera o healthcheck e faz um smoke test com `curl` em `/health`, `/produtos-quimicos` e `/docs/openapi.json`.

Não há deploy automático (a lauda não exige), mas o arquivo `render.yaml` deixa a hospedagem a um clique. Ver [`docs/hospedagem.md`](docs/hospedagem.md).

## Decisões arquiteturais

Resumo abaixo. Os detalhes estão em [`docs/decisoes-arquiteturais.md`](docs/decisoes-arquiteturais.md).

1. **Arquitetura em camadas com DDD**, coerente com a Fase 1: `domain` → `application` → `infrastructure` / `interfaces`. O domínio não importa nada de fora.
2. **Carga Química é o agregado raiz:** documentos e histórico só mudam através dela, e o repositório salva tudo numa transação.
3. **Express 5** em vez de NestJS: menos "mágica" e a arquitetura fica explícita no código, não no framework.
4. **PostgreSQL + Drizzle ORM:** relacional pelos motivos acima. Drizzle porque é TypeScript puro (sem engine binário, imagem Docker menor) e gera migrations em SQL legível.
5. **Validação em dois níveis:** Zod na borda valida o *formato* (400); o domínio valida as *regras* (422/409), cada uma com código próprio.
6. **Repositórios em memória + PostgreSQL** implementando o mesmo contrato: a mesma suíte de integração roda nos dois, o que prova que o domínio não depende do ORM.
7. **Histórico de status em tabela própria**, gravado na mesma transação da mudança, para auditoria e para a linha do tempo do painel.
8. **Modelo de leitura separado** (`ConsultasQuimiPort`) para consultas que cruzam agregados (resumo, histórico), sem poluir os repositórios de escrita.

### Mudanças em relação à Fase 1

- O fluxo de status foi **atualizado conforme a lauda da Fase 2**: entraram `EM_ANALISE`, `EM_MOVIMENTACAO` e `FINALIZADA`, e a transição `BLOQUEADA → EM_INSPECAO`, prevista na Fase 1, foi removida porque a lauda só permite `BLOQUEADA → CANCELADA`.
- Inspeção, Área de Armazenamento e Responsável Técnico como entidade própria ficaram para as próximas fases. Nesta fase, o responsável técnico é um objeto de valor dentro da carga.

## Diferenciais implementados

- ✅ **Prometheus + Grafana:** `/metrics` com métricas de negócio e dashboard provisionado.
- ✅ **GraphQL (somente leitura):** `cargasPorStatus(status, limite)` e `produtoQuimico(id)`, reaproveitando os mesmos casos de uso do REST. Cenário: o painel pede só os campos de que precisa numa única chamada. Exemplo:

  ```bash
  curl -s -X POST localhost:3333/graphql -H 'content-type: application/json' \
    -d '{"query":"{ cargasPorStatus(status: EM_INSPECAO) { codigo statusDescricao documentacaoCompleta produto { nome classeRisco } } }"}'
  ```

- ✅ **Painel web** consumindo a API, com ações de status que respeitam a máquina de estados.
- ✅ **Testes contra PostgreSQL real** no CI, além dos testes em memória.

## Integrantes

| Nome | RM | GitHub |
|---|---|---|
| Ernesto Brito Costa | _preencher_ | [@ernestocosta](https://github.com/ernestocosta) |

Projeto desenvolvido individualmente.
