# Módulos e funções

O código é organizado nas áreas [`controller/`](../controller/),
[`model/`](../model/) e [`GUI/`](../GUI/). Esta separação representa a arquitetura
MVC simples do projeto; o frontend previsto em `GUI` usará Vite.

O catálogo descreve as responsabilidades previstas para a organização MVC. O
desenho do sistema está em [Arquitetura](architecture.md) e inclui suporte a
Linux Mint, Ubuntu e Windows.

Este guia reúne as funções, os tipos e os dados usados nesses arquivos. Para uma
visão de como eles se conectam, veja [Organização do projeto](architecture.md).

## `createApp`

Na área [`controller/`](../controller/), a função de criação da aplicação
Express cria e
devolve uma aplicação Express. Não recebe argumentos e executa imediatamente,
sem retornar uma `Promise`.

Ela chama `express()` e desabilita `x-powered-by`, o cabeçalho que identificaria
o Express nas respostas. Ainda não registra rotas, processamento de corpos de
requisição ou uma porta para receber conexões. Importar esse arquivo não cria
a aplicação: é preciso chamar a função.

Cada chamada cria seu próprio objeto `app`. Quem recebe o objeto pode alterá-lo,
por exemplo, registrando rotas. A função depende apenas do pacote `express` e
de seu tipo `Express`; não recebe `AppConfig` nem lê a configuração. Se Express
lançar um erro, a função o deixa chegar a quem a chamou.

**Onde é usada:** na camada de controle do projeto.
O teste importa o código compilado em outro processo, chama a função e confere
que nenhum servidor foi aberto. Ainda não há outro código de produção chamando-a.

## Comando `check-config`

O comando de configuração pertence à área [`controller/`](../controller/) e é a entrada do comando
`npm run check:config`. Depois de compilar o projeto, esse script executa
`node dist/check-config.js`.

O código roda assim que o arquivo é carregado; ele não exporta uma função `main`.
Obtém os argumentos de `process.argv.slice(2)` e as variáveis de ambiente de
`process.env`, chama `loadConfig` e mostra o resultado. O objeto retornado pela
função é descartado, porque o comando só precisa conferir as opções.

| Resultado | Mensagem e código de saída |
| --- | --- |
| Configuração válida | Informa na saída comum (`stdout`) que os valores são válidos, mas que diretórios, certificados e tokens não foram verificados e nenhum servidor foi iniciado. Termina com código `0`. |
| `ConfigurationError` | Escreve na saída de erros (`stderr`) uma mensagem geral e cada problema no formato `option: message`. Define `process.exitCode = 2`. |
| Outro erro | Escreve uma mensagem genérica em `stderr`, sem detalhes internos. Define `process.exitCode = 1`. |

O comando não usa `process.exit()` para interromper imediatamente a execução.
Também não imprime os valores recebidos nem a lista de chamadas que levou ao
erro (*stack trace*). Não guarda uma configuração global e não cria aplicação
Express, pastas, tokens, certificados ou servidor.

Suas dependências são `loadConfig`, `ConfigurationError` e as informações do
processo Node.js. Dentro do `catch`, o erro começa com o tipo `unknown`: o código
confere se é `ConfigurationError` antes de ler seus problemas. A variável local
`issue` representa cada item mostrado na saída.

**Onde é usado:** pelo comando de configuração e pelos testes do projeto. Os testes
usam `spawnSync` para executar o comando em outro processo e observar mensagens,
código de saída e se algum arquivo foi criado.

## Módulo `config/index`

O módulo de configuração da área [`controller/`](../controller/) exporta a função `loadConfig`, a
classe `ConfigurationError` e as interfaces `AppConfig` e `ConfigIssue`.

Usa Zod para conferir os valores, `isIP` de `node:net` para reconhecer IPs e as
funções POSIX de `node:path` para tratar caminhos no formato usado pelo Linux.
Usa também `URL` para analisar texto, sem fazer conexões ou consultas DNS.

Ao importar o módulo, são criadas as tabelas de opções e as regras de validação.
Ele não lê argumentos, variáveis de ambiente ou arquivos por conta própria.
Esses dados precisam ser passados para `loadConfig`. O módulo não depende de Express.

### Interface `AppConfig`

`AppConfig` descreve o objeto que `loadConfig` devolve. Uma interface é uma
descrição de tipos para o TypeScript; ela não cria objetos durante a execução.
Todos os campos são `readonly`, e `loadConfig` também congela o objeto e suas
listas com `Object.freeze` para impedir alterações durante a execução.

| Campo | Tipo | Para que serve |
| --- | --- | --- |
| `root` | `string` | Caminho absoluto da pasta compartilhada, com o texto do caminho normalizado. |
| `host` | `string` | IP em que o servidor deverá receber conexões; IPv6 é convertido para uma forma padronizada. |
| `port` | `number` | Porta do servidor. |
| `stateDir` | `string` | Caminho da pasta privada que guardará os dados do servidor. |
| `stagingDir` | `string` | Caminho da área privada usada para preparar arquivos antes de colocá-los no destino. |
| `tlsMode` | `'self-signed' \| 'provided'` | Indica se o certificado deverá ser gerado pelo servidor ou fornecido pelo operador. |
| `tlsSans` | `readonly string[]` | Nomes DNS e IPs que o certificado deverá identificar; a lista não pode ser vazia nem ter repetições. |
| `tlsCertFile` | `string` | Caminho do certificado ou da cadeia de certificados. |
| `tlsKeyFile` | `string` | Caminho da chave privada do certificado. |
| `tokensFile` | `string` opcional | Campo legado de configuração; os certificados dos peers são as credenciais usadas nas transferências. |
| `corsOrigins` | `readonly string[]` | Origens permitidas para acesso pelo navegador, no formato aceito pela configuração; pode incluir a string `null`. |
| `uploadMaxBytes` | `number` | Tamanho máximo de um arquivo enviado, em bytes. |
| `zipMaxEntries` | `number` | Quantidade máxima de itens incluídos em um ZIP. |
| `zipMaxBytes` | `number` | Tamanho máximo do conteúdo do ZIP antes da compressão, em bytes. |
| `jsonMaxBytes` | `number` | Tamanho máximo de um corpo JSON, em bytes. |
| `shutdownTimeoutMs` | `number` | Tempo máximo para aguardar o encerramento, em milissegundos. |

Somente `tokensFile` pode estar ausente. Os valores padrão e limites aceitos estão
em [Configuração](configuration.md).

**Onde é usada:** no retorno de `loadConfig` e na definição da tabela `optionNames`.
Os testes de configuração conferem o objeto retornado.
Ainda não há um servidor usando esses campos para atender requisições ou aplicar
limites às transferências.

### Interface `ConfigIssue`

Descreve um problema de configuração com dois campos obrigatórios e `readonly`:

| Campo | Tipo | Significado |
| --- | --- | --- |
| `option` | `string` | Nome público da opção, como `--port`, ou categoria do problema. |
| `message` | `string` | Explicação do problema, sem repetir o valor recebido. |

**Onde é usada:** na lista `issues` de `ConfigurationError`. As funções `fail`
e `loadConfig` criam esses itens; `check-config` os mostra no terminal. Nos testes,
`expectConfigurationError` confere os campos e verifica se os valores privados
usados como exemplo ficaram fora das mensagens.

### Classe `ConfigurationError`

Representa uma falha ao ler ou validar a configuração. Herda de `Error` e não
depende de status HTTP. Seu construtor recebe a lista de problemas:

```ts
constructor(issues: readonly ConfigIssue[])
```

O construtor define a mensagem geral como `Configuração inválida.`, atribui o nome
`ConfigurationError` e faz uma cópia da lista e de seus itens. Em seguida,
congela essas cópias para impedir alterações.

| Atributo | Tipo | Comportamento |
| --- | --- | --- |
| `issues` | `readonly ConfigIssue[]` | Lista obrigatória de problemas; lista e itens são congelados. |
| `name` | `string` | Recebe `ConfigurationError` para identificar o tipo de erro. |
| `message` | `string` | Contém a mensagem geral definida pelo construtor. |
| `stack` | `string \| undefined` | Informação de depuração criada pelo JavaScript; o comando não a imprime. |

O objeto de erro inteiro não é congelado: `name`, `message` e `stack` podem mudar.
A classe não limpa mensagens arbitrárias recebidas no construtor. As funções
que a usam, `fail` e `loadConfig`, são responsáveis por fornecer mensagens que
não revelem os valores informados.

Não há outros métodos próprios além do construtor. Criar esse erro não escreve
mensagens nem termina o processo; essas tarefas pertencem ao comando que o captura.

**Onde é usada:** `fail` e `loadConfig` criam e lançam o erro; `check-config`
identifica-o com `instanceof`. Os testes do projeto o importam
e usa `expectConfigurationError` para inspecioná-lo. Os testes de `bootstrap`
observam as mensagens e o código de saída do comando.

### Função `loadConfig`

```ts
loadConfig(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): AppConfig
```

Os dois argumentos são obrigatórios e não são alterados pela função. `argv`
contém somente as opções da aplicação, sem o nome do executável ou do arquivo.
`env` contém as variáveis de ambiente escolhidas por quem faz a chamada.

A função segue esta ordem:

1. Lê os argumentos e rejeita variáveis desconhecidas que começam com `PASSA_`.
2. Para cada opção, escolhe o argumento do terminal, a variável de ambiente ou
   o valor padrão, nessa ordem.
3. Em `self-signed`, calcula os caminhos padrão do certificado e da chave a
   partir de `stateDir`, caso não tenham sido informados.
4. Chama `configSchema.safeParse` para conferir os valores e suas combinações.
5. Se houver falhas, lança `ConfigurationError`. Caso contrário, copia e congela
   o objeto de configuração e suas listas antes de devolvê-lo.

Uma variável conhecida substituída por um argumento do terminal não tem seu valor
validado. Já um valor vazio escolhido é inválido: a função não o troca pelo padrão.
As listas são substituídas por inteiro, sem juntar valores de fontes diferentes.

Há 16 campos conhecidos. `tokensFile` é omitido do resultado quando não foi
informado. Os números precisam ser inteiros positivos dentro dos limites, as
listas precisam respeitar suas regras e o IP específico de escuta precisa constar
nos nomes e IPs do certificado. A função também confere a separação dos caminhos
de pastas, certificado, chave e tokens.

Essa separação considera somente o texto dos caminhos, incluindo a normalização
de `.` e `..`. A função não abre arquivos nem confere existência, links, permissões,
dispositivos, relação com o repositório ou conteúdo de tokens e certificados.
Também não valida caminhos recebidos por uma rota da API. Ela executa de forma
síncrona, sem retornar uma `Promise`.

Argumentos inválidos, variáveis desconhecidas e falhas nas regras produzem
`ConfigurationError`, sem incluir os valores recebidos. Outros erros chegam a
quem chamou a função. Nenhuma resposta HTTP é criada aqui.

**Onde é usada:** no comando de configuração, com os argumentos
e o ambiente do processo, e nos testes do projeto, com
dados de teste para conferir valores padrão, prioridade, validação e proteção
contra alterações do resultado.

### Tipos e tabelas internos

Os itens abaixo pertencem ao módulo de configuração e não
são exportados. Outros arquivos usam as funções públicas, sem acessar essas tabelas.

| Nome | Tipo | Função dentro do módulo |
| --- | --- | --- |
| `ConfigKey` | `keyof typeof optionNames` | Conjunto dos nomes de campos conhecidos; usado em `RawConfig`, tabelas, validações entre campos e mensagens de `loadConfig`. |
| `RawConfig` | `Partial<Record<ConfigKey, string>>` | Objeto de valores ainda em texto, possivelmente incompleto; usado em `defaults`, `parseArguments` e `raw`, dentro de `loadConfig`. |
| `optionNames` | Objeto `as const` que satisfaz `Record<keyof AppConfig, string>` | Liga os 16 campos aos nomes de opções do terminal; usado em `optionEntries` e nas mensagens de `parseArguments` e `loadConfig`. |
| `defaults` | `RawConfig` | Valores padrão em texto para dez campos, usados por `loadConfig`. As três pastas são obrigatórias; os caminhos TLS padrão são calculados à parte. |
| `optionEntries` | `[ConfigKey, string][]` | Lista dos pares de `optionNames`; usada para criar `cliKeys` e `envKeys` e escolher os valores em `loadConfig`. |
| `cliKeys` | `Map<string, ConfigKey>` | Liga uma opção como `--state-dir` ao campo correspondente; consultada por `parseArguments`. |
| `envKeys` | `Set<string>` | Conjunto das variáveis `PASSA_*` aceitas; consultado por `loadConfig`. |

Essas tabelas são criadas quando o módulo é carregado. Embora suas referências
sejam declaradas com `const`, os objetos, listas, `Map` e `Set` não são congelados.
O código apenas os consulta depois de criá-los. O congelamento explícito é usado
no resultado público de `loadConfig` e na lista de problemas do erro.

### Funções auxiliares internas

Essas funções também ficam em `src/config/index.ts`. Usam apenas valores em
memória, sem ler arquivos ou abrir conexões. Suas variáveis de trabalho são locais.

| Função | Assinatura | O que faz e quem a usa |
| --- | --- | --- |
| `environmentName` | `(name: string): string` | Converte `state-dir` em `PASSA_STATE_DIR`, por exemplo. Usada ao criar `envKeys` e em `loadConfig`. |
| `fail` | `(option: string, message: string): never` | Lança `ConfigurationError` com um problema. Usada por `parseArguments` e `loadConfig`; `never` indica que a função não retorna normalmente. |
| `parseArguments` | `(argv: readonly string[]): RawConfig` | Lê `--nome valor` e `--nome=valor`, preservando sinais `=` dentro do valor. Rejeita opções desconhecidas, repetidas, argumentos sem opção e opções sem valor separado; lança erros por `fail`. Usada por `loadConfig`. |
| `canonicalIp` | `(value: string): string` | Padroniza a escrita de IPv6 por meio de `URL` e mantém IPv4. Recebe IP já validado. Usada por `validSan`, `sans` e `configSchema`. |
| `isIpLiteral` | `(value: string): boolean` | Reconhece IPv4 ou IPv6 sem identificador de zona `%`. Usada por `validSan`, `sans` e a regra de `host`. |
| `isUnspecifiedIp` | `(value: string): boolean` | Reconhece `0.0.0.0`, `::` e `::ffff:0:0`, endereços que não identificam uma interface específica. Usada por `validSan` e na comparação entre `host` e `tlsSans`. |
| `validSan` | `(value: string): boolean` | Confere um nome DNS ASCII ou IP para o certificado. Rejeita IP não específico, `*`, URL, porta e textos numéricos com pontos que não são IPv4 válido. Usada por `sans`. |
| `validOrigin` | `(value: string): boolean` | Aceita a string `null` ou uma origem HTTP exatamente igual a `URL.origin`. Rejeita `*` e textos que não formam uma URL válida. Usada por `origins`. |
| `contains` | `(parent: string, candidate: string): boolean` | Usa `path.relative` para saber se os caminhos são iguais ou se um está abaixo do outro, considerando o texto. Usada por `overlaps` e pelas regras de caminhos dos arquivos privados. |
| `overlaps` | `(first: string, second: string): boolean` | Aplica `contains` nos dois sentidos para detectar igualdade ou se um caminho contém o outro. Usada nas regras de pastas e arquivos privados. |

### Regras de validação do Zod

Um esquema Zod reúne regras para conferir e, quando necessário, transformar um
valor. Os esquemas abaixo são internos. `loadConfig` converte os problemas
encontrados neles em `ConfigurationError`.

| Nome | Entrada → saída | Regras e uso |
| --- | --- | --- |
| `absolutePath` | `string` → `string` | Exige caminho absoluto POSIX sem byte nulo. Normaliza o texto e remove a barra final, exceto em `/`. Usado nos seis campos de caminho de `configSchema`. |
| `decimalInteger(maximum: number)` | Cria um esquema de `string` → `number` | Aceita apenas dígitos e converte para inteiro positivo que JavaScript consegue representar com precisão, até `maximum`. Usado em porta, limites e prazo. |
| `jsonInput` | `string` → `unknown` | Converte JSON com `JSON.parse`. Se falhar, registra um problema e retorna `z.NEVER`, interrompendo aquela transformação. Usado como base de `sans` e `origins`. |
| `sans` | Texto JSON → `string[]` | Exige lista não vazia de nomes DNS e IPs. Converte DNS para minúsculas e padroniza IPv6; verifica repetições depois dessas mudanças. Usado em `tlsSans`. |
| `origins` | Texto JSON → `string[]` | Exige origens válidas e sem repetições; aceita lista vazia. Usado em `corsOrigins`. |
| `configSchema` | Objeto de valores em texto → objeto com os tipos esperados | Combina os 16 campos e confere as relações entre eles com `superRefine`. Usado em `configSchema.safeParse(raw)` por `loadConfig`. |

Dentro de `superRefine`, a função local
`addIssue(key: ConfigKey, message: string): void` associa cada problema à opção
correspondente. Essa validação compara as três pastas entre si, exige que o IP
específico de escuta apareça em `tlsSans` e mantém certificado e chave autoassinados
dentro de `stateDir`.

Ela também impede que certificado, chave e tokens tenham caminhos iguais ou que
um contenha o outro. Esses arquivos precisam ficar fora de `root` e `stagingDir`
e não podem ter um caminho igual ou acima de `stateDir`. Sem `tokensFile`, a
comparação usa `stateDir/tokens.json`; esse arquivo não é criado pela validação.

## Bibliotecas e arquivos de compilação

| Item | Uso no projeto |
| --- | --- |
| Express | Organiza as rotas da API de arquivos (HTTPS, porta padrão 8443) e da entrada temporária de descoberta e pareamento (8444). |
| Node.js | Executa o backend e fornece os módulos nativos usados pelo model, descritos abaixo. |
| TypeScript e pacotes de tipos | Conferem tipos e compilam o código. Essa conferência não substitui a validação dos dados em execução. |
| `tsconfig.json` | Compila `model` e `controller` para `dist` na raiz, com `npm run build:backend`. |
| `package-lock.json` | Registra as versões resolvidas das dependências. |

As descrições anteriores de `createApp`, configuração com Zod e suíte em
`.test-build` pertencem ao desenho anterior e não comprovam a existência desses
componentes na estrutura atual. O manifesto atual não inclui Zod nem uma suíte
automatizada: `npm test` ainda informa que nenhum teste foi especificado.

### Bibliotecas utilizadas pelo model

Ao selecionar uma pasta na aplicação, o controller poderá chamar `fileService`,
que delega o acesso ao disco a `File` e `Directory`. Para preparar a identidade
local e os registros de dispositivos conhecidos, poderá chamar `peerService`.
Essas chamadas do controller ainda precisam de integração; os usos abaixo
descrevem o código do model, sem afirmar que o fluxo completo da interface funciona.

| Biblioteca ou módulo | Onde e como é utilizado |
| --- | --- |
| `node-forge` | Em `model/peer/peerService.ts`, `generateIdentity` gera o par RSA de 2048 bits, monta um certificado X.509 autoassinado, assina com SHA-256 e converte certificado e chave para PEM. |
| `node:crypto` | No model, gera aleatoriedade para a identidade, interpreta certificados e confere a correspondência da chave privada. No controller, `randomUUID` identifica sessões, `X509Certificate.fingerprint256` fornece a impressão digital completa e o certificado DER permite comparar a identidade exata. As chaves privadas são usadas pelo TLS nativo e não entram em respostas. |
| `node:net` | No model, `isIP` confere o formato do endereço. Na descoberta, `BlockList` confere sub-redes IPv4/IPv6 obtidas das interfaces reais do sistema. Um IP é localização, não prova de identidade. |
| `node:https` e `node:tls` | Servem os dois contextos HTTPS e trocam mensagens de pareamento. O transporte confere o certificado esperado; o backend recarrega certificados confiáveis com `setSecureContext`, preservando TLS 1.3 e mTLS. |
| `node:stream` | `Directory.archive`, em `model/file/Directory.ts`, usa `Readable.from` para fornecer os bytes de cada arquivo ao ZIP por partes. Durante a leitura, conta os bytes não comprimidos e interrompe ao exceder o limite. O fechamento da saída destrói os streams ativos. |
| `yazl` | `Directory.archive` usa `ZipFile`, `addReadStreamLazy`, `addEmptyDirectory` e `end` para produzir um ZIP em stream, com nomes relativos e pastas vazias. Os arquivos são lidos pelos objetos `File`; o ZIP não é salvo como resultado permanente. |

`node-forge` e `yazl` são pacotes instalados pelo npm, acompanhados por
`@types/node-forge` e `@types/yazl` para a compilação TypeScript. Os módulos com
prefixo `node:` pertencem ao próprio Node.js. O nome de importação é
`node-forge`, não `node:forge`. **YAML não é utilizado**: `yazl` é uma biblioteca
de ZIP e não um leitor ou escritor de YAML. O índice dos peers usa CSV.

### Identidade e persistência local

`peerService.initialize` recebe explicitamente os caminhos das áreas de estado,
compartilhamento, staging e repositório. Na primeira execução, prepara a identidade
em `<stateDir>/tls/server.crt` e `<stateDir>/tls/server.key`. O certificado vale
por 365 dias, permite uso como cliente e servidor TLS e tem um nome único que
não depende do IP. Reinícios reutilizam esses arquivos. Identidade incompleta,
expirada ou incompatível causa erro, sem regeneração automática.

Cada peer ocupa uma pasta de `01` a `99` diretamente em `<stateDir>`, contendo
`certificado.cert`. O arquivo `index.csv` relaciona `directory`, `displayName`,
`ipAddress`, `firstConnectedAt`, `lastConnectedAt`, `pairingId` e `status`. Por exemplo, `directory`
igual a `01` aponta para `<stateDir>/01`. O menor número livre pode ser
reutilizado após exclusão; com 99 registros, um novo peer é recusado.

O certificado identifica o peer; apelido e IP podem mudar. `savePeer` pressupõe
pareamento bilateral concluído pelo controller, e `recordConnection` pressupõe
autenticação mTLS já confirmada. Comparar certificados ou validar um IP no model
não substitui a prova de posse da chave nem implementa comunicação de rede.
`localIdentity` fornece certificado e chave somente para uso pelo transporte
local; a chave não deve ser enviada à GUI ou a outro peer.

`preparePeer`, `confirmPeer` e `discardPreparedPeer` mantêm preparações separadas
da confiança. `listPeers` e `findPeer` devolvem somente registros confiáveis.
O CSV antigo é aceito e os peers já confiáveis são preservados. O fluxo de
`paringService.ts` e suas funções locais estão em [Conexão](connection.md).

`File` e `Directory` realizam a persistência. Os dados privados ficam fora da
raiz compartilhada. Os padrões são `model/peer` para estado e `tmp` para staging;
somente essas duas áreas específicas são permitidas dentro do repositório e seus
dados de execução são ignorados pelo Git. A implementação atual verifica permissões
POSIX; a abertura do armazenamento privado no Windows é recusada enquanto a
proteção por ACL não estiver definida.

Essas funcionalidades têm implementação, mas sua validação ainda está incompleta.
O estado das verificações está em [Testes](testing.md#estado-atual-do-model).
