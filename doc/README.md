# Índice da documentação

**Estado da etapa 2:** estrutura TypeScript/Express, parser de configuração com Zod,
comando de conferência e testes implementados. Endpoints, autenticação, isolamento do
filesystem e transporte HTTPS continuam planejados. “Aprovado” identifica requisito
ou decisão adotada, distinguindo escolha do usuário de decisão técnica; “proposta”
identifica escolha pendente. “Implementado” exige código e verificação correspondentes.

Antes de qualquer tarefa, consulte [AGENTS.md](../AGENTS.md), o
[README principal](../README.md) e [progress.md](progress.md).

| Documento | Responsabilidade e momento de consulta |
| --- | --- |
| [requirements.md](requirements.md) | Cópia literal do pedido original; consultar para requisitos normativos, escopo, autorizações e critérios de conclusão. A escolha tecnológica posterior está em `decisions.md`. |
| [endpoints.md](endpoints.md) | Contrato HTTP, parâmetros, esquemas, status, efeitos, repetição e exemplos; consultar antes de alterar rotas, validação ou respostas. |
| [classes.md](classes.md) | Catálogo das unidades de produção e seus consumidores; consultar antes de criar, mover, renomear ou excluir classes, funções, módulos e interfaces. |
| [architecture.md](architecture.md) | Responsabilidades, dependências e fluxo de requisição; consultar para organização interna e ciclo de vida. |
| [filesystem.md](filesystem.md) | Caminhos, raiz, links, operações, staging e limites de concorrência; consultar antes de qualquer operação de arquivos. |
| [security.md](security.md) | Bearer tokens, TLS, certificados, CORS e fronteiras de confiança; consultar para autenticação, transporte e exposição de dados. |
| [configuration.md](configuration.md) | Versões e fontes oficiais, preparação, opções, precedência, startup e encerramento; consultar para configuração e execução. |
| [errors.md](errors.md) | Problem Details, códigos e tradução de falhas, inclusive transferências iniciadas; consultar antes de adicionar ou alterar erros. |
| [testing.md](testing.md) | Plano e procedimentos de verificação, testes executados e cobertura pendente; consultar antes de verificar uma etapa. |
| [decisions.md](decisions.md) | Contexto, alternativas, justificativa, consequências e estado das decisões; consultar antes de escolher ou substituir uma abordagem. |
| [progress.md](progress.md) | Plano por etapas, trabalho concluído/restante, verificações, bloqueios e autorização; consultar antes de começar ou retomar qualquer trabalho. |

## Manutenção

A especificação preservada registra o pedido recebido; não deve ser reescrita como
se decisões posteriores já fizessem parte dele. Registre alterações explicitamente
aprovadas em `decisions.md` e atualize o contrato e o progresso correspondentes.
Os demais documentos descrevem o estado corrente e devem evoluir com cada etapa.

As unidades existentes e seus consumidores estão em `classes.md`. Referências a
handlers e serviços futuros serão adicionadas quando os símbolos existirem.
Comandos e exemplos marcados como planejados não comprovam execução.
OpenAPI, se vier a existir por decisão posterior, não substituirá `endpoints.md`.

Após perguntas sem mudança de comportamento, altere documentos somente quando houver
decisão explícita, esclarecimento relevante ou correção factual. Documentação durante
uma pausa não autoriza retomar código, configuração, dependências ou testes.
