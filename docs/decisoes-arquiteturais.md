# Decisões arquiteturais (ADRs)

Formato curto: contexto → decisão → consequências.

---

## ADR-01: Arquitetura em camadas orientada ao domínio

**Contexto.** A lauda pede separação entre rotas, controllers, casos de uso, repositórios, modelos e configurações, mantendo coerência com a Fase 1, que modelou o domínio com DDD.

**Decisão.** Quatro camadas, com dependências apontando sempre para dentro:

```
interfaces (HTTP, GraphQL) ─┐
                            ├─► application (casos de uso, DTOs, portas) ─► domain
infrastructure (DB, logs) ──┘                                               ▲
            └───────────── implementa contratos definidos em ───────────────┘
```

- `domain/`: entidades, agregado, objetos de valor, enums, erros e **interfaces** de repositório. Não importa Express, Drizzle, Zod nem pino.
- `application/`: um caso de uso por arquivo (`RegistrarCargaQuimica`, `AlterarStatusCarga`...). Orquestra: busca, chama o domínio, salva, loga.
- `infrastructure/`: implementações concretas (Drizzle, em memória, pino, prom-client, env).
- `interfaces/`: tradução HTTP/GraphQL ↔ casos de uso.
- `container.ts`: *composition root*. É o único lugar que sabe qual implementação vai em cada contrato.

**Consequências.** As regras são testáveis sem banco e sem HTTP (118 testes de domínio rodam em ~40 ms). Trocar de ORM ou de framework não toca no domínio. O custo é ter mais arquivos que um CRUD direto.

---

## ADR-02: Carga Química como agregado raiz

**Contexto.** A Fase 1 escolheu a Carga Química como agregado: documentação, status e histórico mudam juntos e precisam ficar consistentes.

**Decisão.** `DocumentoCarga` e o histórico só mudam através de métodos de `CargaQuimica` (`alterarStatus`, `liberar`, `bloquear`, `cancelar`, `atualizarDocumentos`). Cada mudança de status gera uma `MudancaDeStatus` pendente. O repositório grava carga, documentos e mudanças pendentes **numa transação** e só então confirma (`confirmarPersistencia`). Produto Químico fica fora do agregado e é referenciado por id.

**Consequências.** É impossível liberar sem documentação ou mudar status sem histórico, porque nenhum caminho do código contorna o agregado. Ao salvar, os documentos são regravados (delete + insert), o que é aceitável para listas pequenas (até 20 documentos por carga).

---

## ADR-03: Express 5 como framework HTTP

**Contexto.** A lauda permite Express, Fastify, NestJS ou outro, desde que a escolha seja justificada.

**Decisão.** Express 5.

- A arquitetura (camadas, injeção de dependência) fica **explícita no código**, sem depender de decorators e módulos do NestJS. Para um trabalho que avalia organização, é mais fácil de explicar e de corrigir.
- O Express 5 propaga erros de handlers `async` para o middleware de erro sem `try/catch` e sem wrappers.
- Tem o ecossistema mais amplo (swagger-ui-express, pino-http, graphql-http) e é o framework que o autor usa no dia a dia.

**Alternativas.** O Fastify teria melhor desempenho e validação por JSON Schema nativa, mas desempenho não é critério desta fase. O NestJS traria muita estrutura pronta, mas esconderia parte da arquitetura que a lauda quer ver.

---

## ADR-04: PostgreSQL

**Decisão e justificativa:** ver [`modelagem-dados.md`](modelagem-dados.md#por-que-um-banco-relacional). Em resumo: dados relacionais, integridade garantida também no banco (FK, CHECK, UNIQUE, ENUM) e transações ACID para status + histórico.

---

## ADR-05: Drizzle ORM e migrations em SQL

**Contexto.** É preciso mapear o domínio para tabelas e versionar o schema.

**Decisão.** Drizzle ORM + drizzle-kit.

- Schema em TypeScript, com tipos inferidos (`$inferSelect` / `$inferInsert`) usados nos mappers.
- **Sem engine binário**: só JavaScript, então a imagem Docker fica menor e não depende de baixar binários no build ou na CI.
- O `drizzle-kit generate` gera **SQL puro e legível** em `api/drizzle/`, revisável em code review. A CI roda `drizzle-kit check` para garantir que as migrations batem com o schema.
- Migrations aplicadas pela própria API ao iniciar (`migrate()`), o que funciona igual no Compose, no Render e na CI.

**Consequências.** Os mappers (`ProdutoMapper`, `CargaMapper`) fazem a tradução linha ↔ entidade. É mais código que um ORM que devolve "entidades" prontas, mas o domínio não fica acoplado ao ORM.

---

## ADR-06: Validação em dois níveis e semântica dos códigos HTTP

**Decisão.**

| Camada | Valida | Erro |
|---|---|---|
| HTTP (Zod) | **Formato:** JSON válido, UUID, tipos, datas ISO | `400 REQUISICAO_INVALIDA` / `JSON_INVALIDO` |
| Domínio | **Regras de negócio:** nome obrigatório, quantidade > 0, produto ativo, documentação | `422 <CODIGO_DA_REGRA>` |
| Domínio | **Estado:** transição proibida | `409 TRANSICAO_DE_STATUS_INVALIDA` |
| Aplicação | Recurso inexistente | `404 RECURSO_NAO_ENCONTRADO` |

Campos obrigatórios por regra de negócio (nome, classe de risco, produto, responsável) são opcionais no schema Zod de propósito: assim, cada regra da lauda tem **um único lugar** (o domínio) e **um código próprio** no erro, em vez de virar um "campo obrigatório" genérico.

**Consequências.** O cliente diferencia "mandei errado" (400), "a regra não deixa" (422) e "o estado atual não permite" (409). O middleware de erro é o único lugar que conhece HTTP.

---

## ADR-07: Repositórios em memória + suíte de integração parametrizada

**Decisão.** Os contratos de repositório têm duas implementações: Drizzle (PostgreSQL) e em memória. A suíte de integração HTTP roda com `describe.each` nos dois backends. O PostgreSQL entra quando `DATABASE_URL_TEST` está definida, o que sempre acontece na CI.

**Consequências.** Rodar `npm test` localmente não exige banco. Na CI, as mesmas asserções rodam contra o banco real, o que pega erros de SQL, de mapeamento e de transação. E fica provado na prática que o domínio não depende do ORM.

---

## ADR-08: Modelo de leitura separado (CQRS leve)

**Contexto.** O resumo operacional e o histórico cruzam carga, produto e histórico. Pôr essas consultas nos repositórios de escrita misturaria responsabilidades.

**Decisão.** A porta `ConsultasQuimiPort` (application) é implementada com SQL direto (`DrizzleConsultas`) e em memória. Os repositórios continuam focados em carregar e salvar agregados.

---

## ADR-09: Observabilidade

**Decisão.** pino (JSON em produção, legível em dev) com `requestId` propagado (header `x-request-id` → logs → corpo do erro). Eventos de negócio com campo `evento`. Os casos de uso recebem uma **porta** `Logger`, não o pino diretamente. Métricas Prometheus via prom-client, também atrás de uma porta (`Metricas`), com Prometheus e Grafana opcionais por profile do Compose.

---

## ADR-10: GraphQL somente leitura e com escopo limitado

**Decisão.** Duas queries (`cargasPorStatus`, `produtoQuimico`) que **reaproveitam os casos de uso do REST**. Sem mutations: as mudanças de estado continuam todas pelo REST, que tem as regras documentadas no Swagger.

**Cenário de uso.** Um painel que precisa só de `codigo`, `status` e `produto.nome` de várias cargas faz uma chamada e recebe exatamente esses campos.

---

## ADR-11: Monorepo com API e painel

**Decisão.** `api/` (entrega principal) e `web/` (painel) no mesmo repositório, cada um com seu `package.json`, Dockerfile e job de CI. O `docker-compose.yml` sobe os dois junto com o banco.

**Consequências.** Um `docker compose up` mostra o sistema inteiro. O painel é opcional para a avaliação: a API funciona e é testada sozinha.
