# Histórico anterior ao modelo P2P

O plano de implementação deste registro foi abandonado por pedido explícito do
usuário. As indicações de retomada abaixo são históricas e não autorizam trabalho.
O registro atual está em [progress.md](progress.md).

# Progresso da implementação

## Tarefa atual — revisão da documentação

- Data: 2026-09-17.
- Pedido: usar linguagem simples nos guias, retirar relatos de execução da
  documentação principal, preservar o histórico em `doc/ai/` e acrescentar um
  fluxograma para cada um dos dez endpoints.
- Etapa atual: **correção da linguagem de todos os guias públicos — concluída**.
- Estado: **aguardando “continuar”**.
- Autorização: em 2026-09-17, após a primeira parte, o usuário apontou que os
  outros guias ainda continham linguagem de prompt e pediu explicitamente
  “Corrija”. Essa correção abrange todos os guias, incluindo segurança e catálogo
  de módulos. A pausa da implementação da API continua vigente.
- Decisões essenciais pendentes: nenhuma. Bloqueios: nenhum identificado.
- Decisões essenciais para a correção: nenhuma pendente.
- Motivo da pausa: correção solicitada concluída; aguardar autorização para os
  fluxogramas dos endpoints.

| Parte | Objetivo e resultado | Verificações | Documentos afetados |
| --- | --- | --- | --- |
| 1 | Separar os registros em `doc/ai/`, simplificar o README e o índice e registrar as novas regras de escrita | Links locais, preservação do pedido original e do histórico, comandos compatíveis com o código | `AGENTS.md`, README, índice, registros movidos e referências a eles |
| 2 | Corrigir agora a linguagem dos oito guias públicos, retirar instruções e relatos de trabalho e preservar as regras técnicas | Leitura completa, busca de linguagem de prompt, links, exemplos, catálogo de opções e símbolos; preservação dos registros em `doc/ai/` | Todos os guias em `doc/`, README e registros em `doc/ai/` |
| 3 | Acrescentar um fluxograma por endpoint e conferir sua correspondência com o texto | Dez rotas cobertas, diagramas renderizados e inspecionados, consistência entre fluxos e parâmetros/respostas | `doc/endpoints.md`, registros em `doc/ai/` |

O pedido de correção mudou a ordem da revisão: os textos de todos os guias serão
corrigidos agora. Os dez fluxogramas continuam como próxima parte, a autorizar com
“continuar”. A implementação da API não será retomada por esta correção.

### Correção concluída

- Objetivo: eliminar dos guias públicos números de etapas, rótulos de aprovação,
  instruções para agentes e relatos de execução; explicar o comportamento em
  linguagem simples, sem ocultar o que ainda não funciona ou está em definição.
- Documentos afetados: os oito guias técnicos de `doc/`, com revisão do README e
  índice; registros retirados serão preservados em `doc/ai/`.
- Reescritos os oito guias: configuração, testes, arquitetura, módulos e funções,
  segurança, arquivos, rotas e erros. README e índice foram revisados.
- Retiradas referências a etapas, aprovações, agentes e instruções de manutenção
  dirigidas à IA. Termos técnicos necessários ganharam explicações simples.
- Mantida a distinção entre código disponível e comportamento futuro. Detalhes
  ainda não decididos continuam indicados como sujeitos a definição ou mudança.
- Histórico de versões, preparação e execuções preservado em
  `verification-history.md`. Notas e detalhes provisórios do contrato HTTP estão
  em `http-notes.md`; notas de segurança e arquivos em `security-filesystem-notes.md`.
- Corrigidas referências antigas do contrato a limites ainda sem valor: as
  opções de upload e ZIP já têm valores padrão na configuração, embora essas
  transferências ainda não estejam implementadas.
- Nenhum código, dependência, configuração executável ou teste foi alterado.

### Verificações da correção

- Revisão por leitura dos oito guias e comparação dos catálogos com o código.
- Busca em dez páginas públicas, incluindo README e índice: nenhuma ocorrência
  dos padrões de linguagem de prompt conferidos, como etapas, rótulos de aprovação
  ou proposta, agentes, prompt, estado atual e instruções de espera por continuar.
- Dezessete documentos autorais: 146 links e âncoras locais válidos; blocos de
  código e formatação conferidos. A especificação original continua idêntica
  byte a byte à cópia do commit anterior.
- Dezoito blocos shell públicos conferidos com `sh -n`, sem executar os comandos;
  cinco exemplos JSON válidos.
- Dez rotas, doze códigos de erro, 16 opções/campos de configuração e 27 símbolos
  do módulo de configuração conferidos nos catálogos. Revisão adicional confirmou
  os pontos de entrada e auxiliares locais descritos em `classes.md`.
- Diagrama Mermaid existente preservado byte a byte. Nenhum diagrama novo criado.
- `git diff --check` sem problemas. Nenhuma instalação ou teste de aplicação
  executado nesta correção documental.

### Trabalho restante e próxima ação

- Nada restante na correção de linguagem solicitada.
- A próxima parte documental é criar, renderizar e revisar os dez fluxogramas de
  endpoints. Ela depende de “continuar”.
- A implementação da API permanece pausada após sua etapa 2. Essa correção não
  autorizou novos recursos, instalações, commit ou push.

### Histórico — organização e apresentação concluídas

- Lidos os guias obrigatórios, o histórico, o manifesto e os pontos de entrada.
- Confirmados: árvore Git limpa, aplicação sem rotas e comando de configuração
  sem acesso a arquivos ou abertura de servidor.
- Movidos `progress.md`, `decisions.md` e `requirements.md` de `doc/` para
  `doc/ai/`, com preservação do histórico; criado o índice desta pasta.
- Reescritos o README e o índice público com linguagem simples, foco no leitor,
  comandos existentes e indicação de que a API ainda não recebe requisições.
- Atualizadas as referências aos arquivos movidos. Nos demais guias, somente
  essas referências foram alteradas; a reescrita deles pertence às partes 2 e 3.
- Atualizado `AGENTS.md` com o novo local dos registros, linguagem simples em
  todos os guias e exigência de fluxograma por endpoint. D12 registra o pedido.

### Verificações da organização e apresentação

- Pedido original comparado com a cópia do commit anterior: bytes idênticos.
  SHA-256: `1841d9cc079a1654acfa1216c2517d59757a62ea2cd9fd63b65d16d96edbfd80`.
- Revisados 14 documentos autorais, além da cópia literal do pedido: 124 links e
  âncoras locais válidos; blocos de código fechados e formatação conferida.
- Os dois exemplos shell do README passaram em `sh -n`, sem execução dos comandos.
  Scripts e versões foram conferidos com `package.json` e `.nvmrc`.
- `git diff --check` sem problemas. Código, testes, dependências e configuração do
  projeto não foram alterados. Nenhuma instalação ou teste de aplicação executado.

Nenhum fluxograma novo foi criado na organização inicial. As pendências atuais
e a ordem revista estão no plano no início deste arquivo.

## Histórico da implementação da API

Os registros abaixo preservam o trabalho anterior. A tarefa em andamento e a
próxima ação autorizável estão na seção de revisão da documentação acima.

### Situação da API em 2026-09-06

- Data de referência: 2026-09-06.
- Etapa atual: **2 — estrutura mínima e configuração — concluída**.
- Estado: **aguardando “continuar”**.
- Autorização: “continuar” explícito do usuário após a conclusão da etapa 1.
- Inspeção inicial: repositório contendo somente `.git`, sem commits, arquivos de
  aplicação ou instruções locais adicionais. Nenhum trabalho anterior a preservar.
- Limite desta autorização: estrutura mínima TypeScript/Express/Zod, dependências
  locais com lock, parsing/validação de configuração, verificações e documentação.
- Decisões essenciais pendentes para esta etapa: nenhuma.
- Bloqueios técnicos para esta etapa: nenhum identificado.
- Motivo da pausa: etapa 2 concluída; pausa obrigatória antes da etapa 3,
  conforme a autorização por etapa do pedido e `AGENTS.md`.

## Planejamento por etapas

Cada etapa inclui as verificações pertinentes e a atualização de todos os documentos
afetados. As etapas 1 e 2 estão concluídas.
As etapas 3–9 estão **planejadas e não autorizadas**. Cada uma exige um novo
“continuar”; a conclusão da etapa 9 encerra a implementação inicial.

| Etapa | Objetivo e resultado verificável | Verificações previstas | Documentos principais |
| --- | --- | --- | --- |
| 1 | Criar instruções permanentes, índice, contrato e decisões com estado planejado | Inventário obrigatório, links locais, cobertura do pedido e consistência documental | `AGENTS.md`, `README.md`, todos os arquivos de `doc/` |
| 2 | Preparar estrutura mínima TypeScript/Express/Zod, dependências com lock e configuração validada, sem listener HTTP normal | Instalação local reproduzível, compilação/tipos, configuração válida/inválida e precedência | `configuration.md`, `architecture.md`, `classes.md`, `decisions.md`, `testing.md`, README |
| 3 | Implementar autenticação e política de caminhos isoladas do HTTP | Tokens ausentes/inválidos/válidos, geração; raiz, traversal, absolutos, nulos, espaços, codificação, links e diretórios privados | `security.md`, `filesystem.md`, `errors.md`, `classes.md`, `testing.md` |
| 4 | Expor saúde, metadados, listagem e download no aplicativo testável internamente | Contrato e autenticação de cada rota, representação comum, ordenação, streaming e erros | `endpoints.md`, `classes.md`, `errors.md`, `filesystem.md`, `testing.md` |
| 5 | Implementar criação de diretórios e upload com publicação após recebimento completo | PUT repetido, pais, conflitos, multipart estrito, limites, interrupção preservando destino e limpeza | `endpoints.md`, `filesystem.md`, `configuration.md`, `classes.md`, `testing.md` |
| 6 | Implementar exclusão, movimentação e renomeação | Raiz protegida, recursividade explícita, PATCH parcial, conflitos, no-op, descendentes e filesystems distintos | `endpoints.md`, `filesystem.md`, `errors.md`, `classes.md`, `testing.md` |
| 7 | Implementar cópia e download ZIP como ações RPC | Staging/publicação, falhas preservando destino, links em árvores, conflitos, limites, diretórios vazios e limpeza | `endpoints.md`, `filesystem.md`, `configuration.md`, `classes.md`, `testing.md` |
| 8 | Integrar inicialização HTTPS obrigatória, ciclo de certificados e CORS configurável | TLS real com confiança, identidade incorreta, certificados/chaves inválidos, reutilização/renovação, ausência de fallback HTTP, preflight e operação autenticada | `security.md`, `configuration.md`, `architecture.md`, `classes.md`, `testing.md`, README |
| 9 | Revisar código, contrato, documentação e testes, conferindo critérios finais | Executar verificações finais existentes, fluxo completo de inicialização/HTTPS e auditoria de consistência/segredos/escopo | Toda a documentação e relatório final neste registro |

TLS e CORS são requisitos desde o planejamento; a etapa 8 integra o transporte real.
Até lá, verificações HTTP podem usar mecanismos internos de teste, sem disponibilizar
um modo normal inseguro. Bibliotecas de multipart, ZIP e certificados serão escolhidas
e documentadas na etapa em que forem necessárias, sem instalação antecipada.

## Trabalho concluído

### Etapa 1

- Leitura do pedido original e inspeção do repositório.
- Definição de TypeScript, Express e Zod pelo usuário.
- Apresentação das nove etapas, resultados esperados e verificações.
- Criação de `AGENTS.md`, README principal e dos 11 documentos obrigatórios de `doc/`.
- Preservação literal do pedido em `doc/requirements.md`, adicional ao inventário
  obrigatório; movido depois para [requirements.md](requirements.md).
- Registro dos dez endpoints e metadados comuns, autenticação, HTTPS/CORS,
  caminhos/links, operações, erros, configuração proposta e plano de testes.
- Registro de versões e fontes oficiais, requisitos aprovados e escolhas técnicas
  propostas; indicação explícita de inexistência de implementação e símbolos.
- Revisão cruzada independente e correção de divergências documentais sobre limite
  JSON/413, duplicatas e sobrescrita. Nenhum código de aplicação ou dependência criado.

### Etapa 2

- Seleção do Node.js 24.19.0/npm 11.17.0 já instalados, apenas nos comandos;
  versão padrão do terminal e instalações globais preservadas.
- Manifesto privado, lock, `.nvmrc`, restrições de runtime/plataforma, exclusões Git
  e compilação ESM com TypeScript 7.0.2 estrito. Express 5.2.1/Zod 4.5.4 e tipagens
  instalados localmente nas versões exatas.
- `src/app.ts`: fábrica Express sem rotas ou listener.
- `src/config/index.ts`: `loadConfig`, `ConfigurationError`, `AppConfig` e
  `ConfigIssue`; 16 opções, precedência CLI/ambiente/defaults, validação Zod,
  relações lexicais e diagnóstico sanitizado, com retorno imutável.
- `src/check-config.ts`: comando de conferência que termina sem preparar recursos
  ou servir arquivos. Erro conhecido retorna 2; sucesso sintático retorna 0.
- Testes de configuração e bootstrap, compilação e execução integradas aprovadas.
- Atualização da documentação do estado real, decisões técnicas e limites;
  revisão documental final concluída.

## Trabalho restante

- Nesta etapa: nenhum trabalho restante. Código, testes, reprodução da instalação
  e revisão documental concluídos.
- A configuração desta etapa valida sintaxe, tipos, defaults, precedência e relações
  lexicais entre opções. Não verifica filesystem real, tokens, chaves ou certificados;
  esses aspectos dependem das etapas 3 e 8, sem antecipação de implementação.
- No projeto: etapas 3–9 pendentes, sem autorização antecipada.

## Verificações executadas

### Etapa 1 — registro histórico

- Inspeção somente de leitura: `git status --short --branch`, listagem do diretório
  e busca de instruções locais. Resultado: repositório vazio, somente `.git`.
- Naquela etapa não existiam aplicação, dependências instaladas ou testes automatizados.
- Revisão documental: 13 documentos obrigatórios presentes, mais a especificação
  preservada byte a byte; links/âncoras válidos, dez métodos/rotas e nove etapas conferidos.
- Sintaxe de 14 blocos shell validada com `sh -n`, sem executar comandos dos exemplos;
  cinco blocos JSON analisados com sucesso. UTF-8, formatação e diff dos documentos
  autorais aprovados; a cópia original conserva sua formatação literal.
- Consultas de versões/fontes oficiais e revisão cruzada dos documentos concluídas.
  Procedimentos em [testing.md](../testing.md); resultados preservados em
  [verification-history.md](verification-history.md).
- Na etapa 1 não foram executados testes funcionais ou HTTPS: aplicação e suítes
  ainda não existiam. Naquele momento não houve afirmação de compatibilidade em execução.

### Etapa 2 — 2026-09-06

- Linux x86_64, Node.js 24.19.0, npm 11.17.0: compilador TypeScript 7.0.2
  executado e versões diretas conferidas com `npm ls --depth=0`.
- `npm run check`: typecheck, build e **46 testes aprovados, zero falhas e zero
  ignorados** (42 de configuração e 4 de bootstrap).
- `npm ci`: instalação reproduzida sem mudar o SHA-256 do lock. A consulta de
  auditoria npm relatou zero vulnerabilidades naquele momento.
- Comando `npm run check:config` do README executado com saída 0 e mensagem que
  distingue validação sintática/lexical de verificação real de recursos.
- Nenhum teste de endpoint, autenticação, operação de arquivos ou HTTPS real
  executado; funcionalidades e conjuntos pertencem às próximas etapas.
- Resultados em [verification-history.md](verification-history.md); procedimentos
  e limites atuais em [testing.md](../testing.md).
- Revisão final: 26 arquivos autorais, 14 documentos, 125 links/âncoras locais,
  18 exemplos shell e cinco JSON válidos; 16 opções e cinco exports conferidos
  com seus catálogos; manifesto/lock coerentes; especificação original preservada.
- Exclusões Git de dependências, builds e materiais privados conferidas.
  Revisão de código não deixou falhas confirmadas pendentes nesta etapa.

## Decisões e próxima ação

Escolha tecnológica aprovada pelo usuário: TypeScript + Express + Zod. As escolhas
técnicas da etapa 2 foram adotadas e verificadas; D10 registra as versões reais e
substitui a proposta D03, e D11 delimita a configuração pura. Ver
[decisions.md](decisions.md). Não há decisão essencial do usuário pendente nesta etapa.

Pendências das etapas futuras: mecanismos de contenção, preparação/verificação
física de diretórios privados e política de hardlinks/montagens na etapa 3;
primitivas de publicação, multipart, ZIP e emissão de certificados nas etapas
pertinentes. Existência/permissões dos caminhos, relação física com o repositório,
tokens, chave/certificado, TLS e listener não são verificados por `check:config`.

A autorização de implementação encerrou-se com a etapa 2; nenhuma implementação
ou preparação da etapa 3 foi iniciada. A próxima etapa da API será autenticação e
política de caminhos. Sua retomada depende de nova autorização após a revisão
documental; o próximo “continuar” agora pertence à documentação, conforme o plano
no início deste arquivo.

## Versionamento

Em 2026-09-06, o usuário autorizou explicitamente commit e push do estado das
etapas 1 e 2 para [ARS1802/passa-arquivo](https://github.com/ARS1802/passa-arquivo),
na branch padrão `main`. O inventário revisado contém 26 arquivos de documentação,
fontes, testes, configuração e lock; dependências e builds são ignorados pelo Git.
Essa autorização de versionamento não inicia a etapa 3 nem encerra a espera por
um novo “continuar” para implementação.
