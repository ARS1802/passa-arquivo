# Registro de decisões

## Convenções

Estados: **aprovada**, **proposta** ou **substituída**. A aprovação de um requisito
ou escolha não significa implementação. Na etapa 2 foram implementadas a base do
projeto e a validação de configuração; os registros distinguem essas entregas dos
comportamentos ainda planejados. Decisões técnicas adotadas não são atribuídas como
escolhas explícitas do usuário.

A fonte dos requisitos aprovados é [requirements.md](requirements.md). A escolha
tecnológica foi explicitada pelo usuário posteriormente: “Linguagem: TypeScript +
Zod. Framework: Express”. Não há decisões substituídas até o momento.

## D01 — Implementação com autorização por etapa

- Estado: **aprovada pelo usuário**.
- Contexto: o desenvolvimento será acompanhado com perguntas e revisão incremental.
- Decisão: seguir as nove etapas de [progress.md](progress.md), com código,
  verificações e documentos pertinentes na mesma etapa; parar após cada etapa.
  Perguntas durante execução suspendem imediatamente o trabalho e agentes auxiliares.
- Alternativa: execução contínua de todas as funcionalidades; explicitamente excluída.
- Justificativa: preservar o controle do usuário sobre a continuidade e permitir
  revisão de resultados concretos.
- Consequência: cada “continuar” autoriza uma única retomada de etapa interrompida
  ou a próxima etapa. A etapa 1 não instala dependências nem cria aplicação.

## D02 — TypeScript, Express e Zod

- Estado: **aprovada pelo usuário**; versões efetivamente utilizadas constam em D10.
- Contexto: a linguagem/framework não estavam definidos no pedido inicial.
- Decisão: TypeScript para o código, Express para HTTP e Zod para validação em execução.
- Alternativas: nenhuma outra combinação foi escolhida; os exemplos de tecnologias
  na especificação não autorizavam adotá-las.
- Justificativa: escolha explícita do usuário. A combinação permite tipagem estática
  e validação dos dados externos, que têm responsabilidades distintas.
- Consequência: organizar os esquemas de validação junto aos limites de entrada;
  não confiar em anotações TypeScript como verificação do JSON recebido.

## D03 — Runtime, versões, módulos e dependências

- Estado: **substituída por D10** ao executar a etapa 2. O registro abaixo preserva
  a proposta técnica consultada em 2026-09-05, quando nenhum pacote estava instalado.
- Contexto: a especificação exige runtime estável/suportado e lock reproduzível.
- Decisão proposta: Node.js **24.20.0**, linha 24 LTS; npm **11.19.0** distribuído
  com essa versão; TypeScript **7.0.2**, Express **5.2.1**, Zod **4.5.4**.
  Tipagens propostas: `@types/express` **5.0.6** e `@types/node` **24.13.3**.
  Usar ESM, TypeScript estrito, compilação via `tsc` e execução do JavaScript via
  Node. `package-lock.json` será versionado com dependências exatas na etapa 2.
- Alternativas: outras linhas suportadas de Node, CommonJS ou execução TypeScript
  direta. Não são necessárias para o contrato inicial. Não adotar versões preview
  nem compiladores experimentais.
- Justificativa: a linha 24 possui cronograma LTS; a versão 7 do TypeScript consultada
  é estável, com CLI `tsc`. O fluxo explícito de compilação facilita separar análise
  estática, artefato executável e validação em execução.
- Consequências: confirmar compatibilidade e disponibilidade no ambiente da etapa 2
  antes de fechar o lock; registrar versões efetivamente instaladas. Separar Express
  e Zod como dependências de execução; compilador/tipagens como desenvolvimento.
  Dependências de multipart, ZIP, certificados e testes adicionais serão avaliadas
  somente nas etapas pertinentes, evitando instalação antecipada.
- Fontes: [agenda oficial Node.js](https://github.com/nodejs/Release#release-schedule),
  [índice oficial de distribuições](https://nodejs.org/dist/index.json),
  [TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/),
  [registro TypeScript 7.0.2](https://registry.npmjs.org/typescript/7.0.2),
  [registro Express 5.2.1](https://registry.npmjs.org/express/5.2.1),
  [registro Zod 4.5.4](https://registry.npmjs.org/zod/4.5.4).
  Fontes das tipagens e comandos propostos: [configuration.md](configuration.md).

## D04 — Contrato HTTP v2

- Estado: **aprovada pelo usuário** quanto às rotas e regras da especificação;
  complementos identificados em D05 continuam propostas.
- Contexto: administrar uma raiz exige identificar explicitamente caminhos e
  distinguir leituras, substituições, remoções e ações de cópia/compactação.
- Decisão: dez endpoints; operações de arquivos sob `/api/v2`, caminhos de recursos
  em query parameters, JSON camelCase e representação comum de metadados.
  Cópia e compactação usam as ações RPC `/actions/copy` e `/actions/archive`.
- Alternativas: recursos de tarefa para cópia/compactação e compatibilidade com API
  antiga. A primeira alternativa amplia o modelo sem necessidade; a segunda está
  fora do escopo. Cópia e ZIP não são inerentemente impossíveis de modelar como recursos.
- Justificativa: simplicidade do contrato e uso dos métodos HTTP conforme suas
  responsabilidades, inclusive PUT que preserva conteúdo de diretório já existente.
- Consequências: documentação técnica por endpoint e testes de semântica/repetição;
  query parameters não tornam as operações de recursos automaticamente RPC.
  Nenhuma rota está exposta nesta etapa. Veja [endpoints.md](endpoints.md).

## D05 — Precisões propostas para validação e representação

- Estado: **proposta técnica**, a validar nas etapas 3–7.
- Contexto: a especificação pede definir detalhes como nome da raiz, separadores
  repetidos, ordenação determinística e códigos estáveis de erro.
- Decisão proposta: nome público da raiz `.`; rejeitar caminhos vazios, barras
  repetidas/finais, segmentos `.` internos e barra invertida; preservar espaços
  e não decodificar percentuais sucessivamente. Ordenar nomes por bytes UTF-8, sem
  depender do locale do servidor. Rejeitar campos desconhecidos e `null` quando o
  contrato não o permitir; rejeitar parâmetros de query duplicados e headers de
  autenticação ambíguos. Não foi definida rejeição especial de chaves JSON repetidas.
- Alternativas: normalização silenciosa de caminhos, ordenação por locale ou descarte
  de campos desconhecidos. Podem esconder erros ou produzir resultados dependentes
  do ambiente; o pedido também exige rejeitar campos inesperados em operações indicadas.
- Justificativa: tornar o contrato verificável e previsível.
- Consequências: exemplos e testes deverão refletir exatamente a política adotada.
  [errors.md](errors.md) propõe códigos, identificadores `type` e distribuição dos
  casos entre 400/403/409/422. [filesystem.md](filesystem.md) detalha nomes e entradas.
  Esses complementos não são novas decisões atribuídas ao usuário.

## D06 — Isolamento, staging e concorrência

- Estado: requisitos centrais **aprovados pelo usuário**; mecanismos adicionais
  em [filesystem.md](filesystem.md) são **propostas técnicas**.
- Contexto: uploads/cópias com falha não podem apagar o destino anterior; validação
  textual de prefixo não protege adequadamente uma raiz compartilhada.
- Decisão aprovada: raiz efetiva resolvida no startup, caminhos relativos, proibição
  de links simbólicos e de modificar a raiz, staging privado inacessível pela API,
  publicação após validação, sem mesclagem de diretórios e sem fallback silencioso
  de movimentação entre filesystems para cópia seguida de exclusão.
- Proposta: staging externo à raiz no dispositivo compatível com a publicação;
  serialização de mutações dentro do processo quando necessária; uso das proteções
  disponíveis no Linux/Node. Política complementar de hardlinks/montagens requer
  validação técnica antes de afirmar garantias na etapa 3.
- Alternativas: sobrescrever diretamente durante upload, remover destino antes de
  copiar ou considerar um mutex proteção contra outros processos; incompatíveis com
  preservação do destino e descrição rigorosa das garantias.
- Justificativa: reduzir exposição parcial de conteúdo e evitar falsas promessas.
- Consequências: documentar operações atômicas efetivamente disponíveis versus
  operações recursivas sujeitas a falha parcial. Não prometer snapshot nem isolamento
  absoluto frente a alterações simultâneas externas. Propostas pendentes não bloqueiam
  a etapa documental, mas deverão ser resolvidas na etapa de implementação relevante.

## D07 — Autenticação, HTTPS, certificados e CORS

- Estado: requisitos **aprovados pelo usuário**; defaults complementares são propostas.
- Contexto: clientes autorizados acessarão arquivos por rede local, inclusive navegadores.
- Decisão aprovada: Bearer em todas as operações e `/health`, mesmas permissões por token;
  TLS 1.2 ou superior no modo normal, sem listener/fallback HTTP; certificados
  autoassinados para desenvolvimento ou fornecidos pelo operador; CORS por lista
  explícita, preflight sem token e operação efetiva autenticada.
- Proposta: gerar 16 tokens temporários por execução por padrão, com entrega em arquivo
  privado; aceitar tokens externos para automação; origens CORS vazias por padrão e
  `null` somente por opção explícita. Parâmetros de certificados e duração propostos
  em [configuration.md](configuration.md).
- Alternativas: usuários/perfis, OAuth, mTLS, infraestrutura de CA e instalação de
  confiança nos clientes; estão fora do escopo inicial.
- Justificativa: atender o modelo de acesso definido sem introduzir gestão de identidade.
- Consequências: confiança TLS não substitui Bearer; CORS não substitui TLS nem
  autenticação. Testes HTTPS principais usarão confiança e identidade verificadas.
  Certificados, chaves, tokens e temporários devem permanecer fora da raiz e do Git.

## D08 — Configuração explícita e processo único

- Estado: **aprovada como decisão técnica da etapa 2** para nomes/defaults,
  precedência e validação lexical. Processo único, porta padrão 8443 e inicialização
  validada são requisitos do usuário; integração do startup continua planejada.
- Contexto: o operador precisa configurar uma raiz, locais privados e parâmetros
  de transporte sem preparar serviços auxiliares nem modificar o sistema.
- Decisão adotada: argumentos CLI prevalecem sobre variáveis `PASSA_*`, que
  prevalecem sobre defaults; sem arquivo de configuração adicional obrigatório.
  Raiz, estado e staging são explícitos; escuta local padrão `127.0.0.1` pode ser
  alterada para a interface da rede local. Tokens externos são lidos de arquivo
  privado, não de argumento contendo o segredo.
- Alternativas: configuração implícita no diretório corrente ou gravação dentro da
  pasta compartilhada; aumentam o risco de exposição e surpresa no startup.
- Justificativa: manter localização de dados e segredos verificável antes da escuta.
- Consequências: validar opções cruzadas e relações entre diretórios; só anunciar
  prontidão após abertura real da porta. Não matar processos concorrentes nem alterar
  firewall. Todos os parâmetros e limites propostos estão em
  [configuration.md](configuration.md). O parser `loadConfig` está implementado;
  preparar diretórios, credenciais, TLS e escuta ainda depende de etapas futuras.

## D09 — Documentação técnica como entrega incremental

- Estado: **aprovada pelo usuário** quanto à estrutura obrigatória; preservação do
  texto original é uma organização documental adotada nesta etapa.
- Contexto: agentes futuros precisam retomar sem depender da transcrição da conversa.
- Decisão: manter `AGENTS.md`, README curto, índice, contrato, catálogo de unidades,
  arquitetura, filesystem, segurança, configuração, erros, testes, decisões e progresso.
  Preservar também o pedido literal em `requirements.md` como referência normativa.
- Alternativa: documentação somente no final ou progresso como transcrição da conversa;
  incompatíveis com atualização contínua e retomada objetiva.
- Justificativa: rastreabilidade entre requisito, decisão, comportamento e verificação.
- Consequências: etapa 1 pode ser concluída com revisão documental, sem anunciar uma
  API pronta. Cada nova etapa atualizará somente os documentos pertinentes às mudanças.

## D10 — Base efetivamente instalada e verificada

- Estado: **aprovada como decisão técnica na etapa 2**, substituindo D03 quanto
  às versões efetivamente utilizadas. Execução autorizada pelo “continuar” do usuário.
- Contexto: o terminal utilizava Node.js 20, mas Node.js 24.19.0 e npm 11.17.0
  já estavam instalados no ambiente do usuário. Node.js 24.20.0 havia sido proposto.
- Decisão: utilizar o runtime existente **24.19.0**, da linha 24 LTS, com npm
  **11.17.0**, selecionado apenas nos comandos desta etapa. Registrar `.nvmrc`,
  engines Node `>=24.19.0 <25` e npm `>=11 <12`, plataforma Linux e instalação local
  com `engine-strict`. A versão padrão do terminal não foi alterada.
- Dependências instaladas: Express **5.2.1** e Zod **4.5.4** para execução;
  TypeScript **7.0.2**, `@types/node` **24.13.3** e `@types/express` **5.0.6** para
  desenvolvimento. `package-lock.json` registra a árvore exata e integridade.
- Alternativas: instalar outro runtime ou gerenciador globalmente; desnecessário
  para verificar esta base. A versão 24.20.0 continua uma versão disponível da
  mesma linha, não a versão utilizada nestas verificações.
- Justificativa: usar uma linha LTS suportada disponível no ambiente e verificar
  compatibilidade real, sem alterar instalações globais ou o sistema operacional.
- Consequências: ESM e compilação `tsc` estrita confirmados em Linux x86_64;
  testes usam `node:test` e `node:assert/strict`, sem framework adicional.
  `npm run check` passou com 46 testes. O suporte da API completa, TLS e operações
  de arquivos permanece pendente; as versões instaladas não comprovam esses recursos.
- Fontes e comandos: [configuration.md](configuration.md); resultados em
  [testing.md](testing.md). As fontes oficiais de distribuição de D03 continuam
  referências para disponibilidade, sem substituir os números executados acima.

## D11 — Configuração pura e conferência sem inicialização

- Estado: **aprovada como decisão técnica na etapa 2**, implementada.
- Contexto: validar configuração é necessário antes de preparar filesystem,
  autenticação ou TLS, que pertencem a etapas distintas do planejamento.
- Decisão: `loadConfig(argv, env)` recebe fontes explícitas, aplica precedência,
  valida as 16 opções e retorna um objeto congelado com listas congeladas.
  A CLI `check:config` confere essa configuração e termina; não abre listener,
  lê arquivos, cria diretórios ou gera credenciais.
- Alternativas: iniciar um servidor HTTP provisório ou preparar certificados/tokens
  durante a validação; antecipariam etapas sem autorização e misturariam efeitos
  operacionais com parsing testável.
- Justificativa: permitir verificar erros de entrada e combinações de opções
  independentemente de dados reais ou de recursos de rede.
- Consequências: validar o valor efetivo depois da precedência (CLI pode substituir
  um valor inválido de ambiente conhecido); opções desconhecidas continuam erros.
  Caminhos absolutos de configuração são normalizados lexicalmente, com espaços
  preservados e remoção de barras finais salvo `/`. Isso não resolve symlinks e
  não é a política de caminhos relativos da API. SANs têm representação canônica;
  CORS exige origem já canônica. Colisões lexicais de diretórios e materiais são
  rejeitadas, inclusive o arquivo implícito de entrega de tokens.
  Existência, propriedade, permissões, raiz efetiva, relação com o repositório,
  conteúdo de credenciais/certificados e filesystem de staging ainda não são verificados.
  O resultado da CLI declara esses limites e não anuncia prontidão do servidor.
