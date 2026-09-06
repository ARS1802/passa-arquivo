# Catálogo de unidades de produção

## Estado e organização

**Etapa 2:** existem três módulos de produção: [app.ts](../src/app.ts),
[check-config.ts](../src/check-config.ts) e [config/index.ts](../src/config/index.ts).
O projeto utiliza funções, interfaces e esquemas Zod; sua única classe própria é
`ConfigurationError`. O nome `classes.md` não exige transformar responsabilidades
em classes. Este catálogo descreve o código existente; execução e resultados dos
testes estão em [testing.md](testing.md).

Não existem handlers das rotas contratadas, autenticação, operações de arquivos,
resolução real de caminhos, leitor de tokens ou preparação TLS. Seus campos de
configuração já podem ser analisados, mas não executam essas funcionalidades.

## `createApp`

- **Arquivo e camada:** [src/app.ts](../src/app.ts), composição inicial do HTTP.
- **Assinatura exportada:** `createApp(): Express`, síncrona, sem parâmetros.
- **Responsabilidade:** criar uma instância nova de Express, desabilitar a opção
  `x-powered-by` e retornar a instância.
- **Dependências:** fábrica `express` e tipo externo `Express`, do pacote `express`.
  Não recebe `AppConfig` nem importa o módulo de configuração.
- **Estado/ciclo de vida:** variável local `app: Express` por chamada; a instância
  retornada é mutável e pertence ao consumidor. Não há singleton, atributos de
  classe, herança ou interface própria implementada.
- **Efeitos:** aloca/configura o objeto Express; não registra rotas ou parsers e
  não chama `listen`. Importar o módulo não cria uma instância automaticamente.
- **Erros:** não captura ou traduz erros; uma falha da dependência propagaria ao
  chamador. Não existe resposta HTTP de erro implementada aqui.
- **Consumidor real:** [tests/bootstrap.test.ts](../tests/bootstrap.test.ts), teste
  `importar configuração e criar a aplicação Express não abre listeners nem mantém o processo ativo`,
  importa o módulo compilado em subprocesso e chama `createApp()` para verificar
  seu ciclo de vida. Ainda não há consumidor de produção nem listener.

## Módulo executável `check-config`

- **Arquivo e camada:** [src/check-config.ts](../src/check-config.ts), entrada CLI.
- **Execução:** `node dist/check-config.js`, pelo script npm `check:config` em
  [package.json](../package.json), depois da compilação. Não exporta `main`, classe
  ou objeto.
- **Dependências:** `loadConfig` e `ConfigurationError` de `./config/index.js`;
  APIs globais do processo para argumentos, ambiente, saída e código de término.
- **Entradas:** `process.argv.slice(2)` e `process.env`; a configuração retornada
  por `loadConfig` é descartada, pois o comando apenas confere sua validade.
- **Estado:** erro capturado como `unknown`; variável local `issue: ConfigIssue`
  no laço de diagnóstico. Não mantém configuração global ou recurso persistente.
- **Ciclo de vida/efeitos:** o bloco principal `try/catch` executa ao avaliar o
  módulo. Esta é uma entrada com efeitos de saída, não um módulo de importação
  pura. Não cria Express, diretórios, credenciais, certificados ou listener.

| Resultado | Comportamento implementado |
| --- | --- |
| Configuração válida | Escreve em stdout que sintaxe/relações são válidas, que diretórios/certificados/tokens não foram verificados e que nenhum servidor foi iniciado; o comando termina normalmente com código `0` |
| `ConfigurationError` | Escreve mensagem geral e cada `option: message` em stderr; define `process.exitCode = 2` |
| Outro erro | Escreve diagnóstico genérico em stderr sem detalhes internos; define `process.exitCode = 1` |

Não chama `process.exit()` nem imprime configuração, valores fornecidos, stack trace
ou material secreto. O código de término indica somente o resultado da conferência,
não a possibilidade de inicializar um servidor real.

**Consumidores reais:** script `check:config` de `package.json`; testes de
[tests/bootstrap.test.ts](../tests/bootstrap.test.ts) identificados pelos prefixos
`conferência válida termina`, `CLI aceita argumentos` e `CLI rejeita opções desconhecidas`.
Eles usam `spawnSync` para executar a entrada compilada e observar status,
stdout/stderr e ausência de arquivos criados, sem importá-la no processo do runner.

## Módulo `config/index`

**Arquivo/camada:** [src/config/index.ts](../src/config/index.ts), configuração.
Exporta interfaces `AppConfig`/`ConfigIssue`, classe `ConfigurationError` e função
`loadConfig`. Importa `isIP` de `node:net`, operações POSIX de `node:path` e `z` do
Zod. Usa `URL` somente para análise textual, sem conexão ou consulta DNS.

Na avaliação, cria tabelas de opções e esquemas. Não lê `process.env`, argumentos
reais, diretório corrente ou filesystem; não abre listeners. Cada chamada de
`loadConfig` recebe entradas explícitas e aloca resultado ou erro. Não há dependência
de Express nem tipos HTTP.

### Interface `AppConfig`

Contrato estático de saída de `loadConfig`; não possui construtor, métodos, herança,
instância própria ou efeitos em execução. Todas as propriedades são `readonly` em
TypeScript; os objetos retornados por `loadConfig` são também congelados em runtime,
incluindo os arrays. Defaults/limites públicos estão em [configuration.md](configuration.md).

| Propriedade | Tipo | Ausência | Finalidade |
| --- | --- | --- | --- |
| `root` | `string` | Não | Caminho absoluto normalizado lexicalmente da raiz configurada |
| `host` | `string` | Não | IP literal de bind, IPv6 canônico |
| `port` | `number` | Não | Porta inteira validada |
| `stateDir` | `string` | Não | Caminho lexical do estado privado |
| `stagingDir` | `string` | Não | Caminho lexical do staging privado |
| `tlsMode` | `'self-signed' \| 'provided'` | Não | Modo futuro de preparação do certificado |
| `tlsSans` | `readonly string[]` | Não | Identidades DNS/IP normalizadas, não vazias e sem duplicatas |
| `tlsCertFile` | `string` | Não | Caminho lexical do certificado/cadeia |
| `tlsKeyFile` | `string` | Não | Caminho lexical da chave privada |
| `tokensFile` | `string` opcional | Sim | Caminho de futura leitura de tokens externos; ausência indica futura geração |
| `corsOrigins` | `readonly string[]` | Não | Origens canônicas e eventual literal `null` |
| `uploadMaxBytes` | `number` | Não | Limite configurado do arquivo enviado |
| `zipMaxEntries` | `number` | Não | Limite configurado de entradas do ZIP |
| `zipMaxBytes` | `number` | Não | Limite configurado do volume não comprimido |
| `jsonMaxBytes` | `number` | Não | Limite configurado de corpos JSON |
| `shutdownTimeoutMs` | `number` | Não | Prazo configurado de encerramento |

**Consumidores:** assinatura de retorno de `loadConfig` e definição de `optionNames`
no mesmo módulo; testes de [tests/config.test.ts](../tests/config.test.ts) inspecionam
a saída com tipo inferido. Nenhum servidor consome esses campos na etapa 2. Sua
presença não significa aplicação do limite ou operação a uma requisição HTTP.

### Interface `ConfigIssue`

Contrato estático com duas propriedades obrigatórias e `readonly`: `option: string`,
identificador público da opção ou categoria; `message: string`, diagnóstico
controlado. Não possui métodos, herança, instância própria ou efeitos em execução.

**Consumidores:** argumento/atributo `issues` de `ConfigurationError`; produtores
`fail` e `loadConfig`; laço de stderr em `check-config`; helper
`expectConfigurationError` de [tests/config.test.ts](../tests/config.test.ts), que
verifica campos e ausência dos valores sensíveis usados nos testes.

### Classe `ConfigurationError`

- **Responsabilidade:** representar falhas de parsing/validação sem acoplamento
  a códigos HTTP ou emissão de valores rejeitados.
- **Herança:** `extends Error`; não implementa interface própria.
- **Construtor:** `constructor(issues: readonly ConfigIssue[])`. Chama
  `super('Configuração inválida.')`, define `name` e copia/congela cada item e o
  array `issues`. Não recebe serviços.
- **Criação/ciclo de vida:** criada por `fail` e `loadConfig` a cada ocorrência e
  propagada ao chamador; a CLI captura por `instanceof`.
- **Métodos:** nenhum próprio além do construtor; mantém métodos herdados de
  `Error`. Não há comportamento assíncrono nem recursos a fechar.
- **Efeitos:** aloca erro e copia diagnósticos; não escreve logs ou define término.

| Atributo | Tipo/ausência | Mutabilidade e finalidade |
| --- | --- | --- |
| `issues` | `readonly ConfigIssue[]`, obrigatório | Referência readonly em TypeScript; array e itens congelados em runtime; diagnósticos copiados |
| `name` | `string`, definido como `ConfigurationError` | Propriedade herdada atribuída pelo construtor, não congelada |
| `message` | `string`, definida pelo construtor | Mensagem geral de `Error`, não congelada |
| `stack` | `string \| undefined`, herdado | Depuração produzida pelo runtime; não emitida pela CLI |

A instância inteira de `Error` não é congelada. O construtor não sanitiza conteúdo
arbitrário: os produtores atuais `fail`/`loadConfig` fornecem mensagens controladas.
Preservar essa responsabilidade ao adicionar consumidores.

**Consumidores reais:** `fail`/`loadConfig` no módulo; `catch` em
[check-config.ts](../src/check-config.ts); importação e helper
`expectConfigurationError` em [tests/config.test.ts](../tests/config.test.ts).
Testes de subprocesso em `bootstrap.test.ts` observam a tradução CLI, sem receber
diretamente a instância.

### Função `loadConfig`

Assinatura exportada, síncrona:

```ts
loadConfig(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): AppConfig
```

Argumentos obrigatórios, sem defaults; a função não os modifica. `argv` contém
somente opções da aplicação, sem executável/arquivo. `env` é fornecido pelo
consumidor, sem leitura global interna.

**Fluxo:** analisar argumentos; rejeitar nomes desconhecidos `PASSA_`; selecionar
CLI > ambiente > defaults; derivar caminhos TLS de `stateDir` em `self-signed`
quando ausentes; executar `configSchema.safeParse`; converter falhas em
`ConfigurationError`; copiar/congelar objeto e arrays. Variável de ambiente conhecida
sobrescrita pela CLI não é validada como valor efetivo. Valor vazio escolhido não
volta ao default.

**Invariantes:** 16 campos conhecidos, `tokensFile` opcional e omitido quando
ausente; inteiros positivos nos limites; listas coerentes; bind concreto nos SANs;
separação lexical dos diretórios/materiais. Não retorna Promise nem executa I/O,
autenticação, operações de arquivos ou preparação TLS.

**Limites:** normalização lexical inclui `.`/`..` e separadores; não é `realpath`,
prova de contenção real ou validação de caminhos da API. Não verifica existência,
links, permissões, dispositivos, relação com repositório, conteúdo dos tokens ou
validade de chave/certificado. Essas verificações pertencem às próximas etapas.

**Erros:** `ConfigurationError` por argumentos, variável desconhecida ou esquema;
diagnósticos não incluem valores recebidos. Erro inesperado propaga ao chamador.
Não produz resposta HTTP.

**Consumidores:** bloco principal de [check-config.ts](../src/check-config.ts), com
argumentos/ambiente reais; testes registrados em
[tests/config.test.ts](../tests/config.test.ts), com entradas isoladas para defaults,
precedência, validação, relações e imutabilidade.

### Tipos, tabelas e helpers internos

Todos estão em [src/config/index.ts](../src/config/index.ts), sem exportação. Helpers
síncronos, sem I/O, atributos de instância, herança ou interfaces próprias; estado
por chamada é local. Tabelas/esquemas vivem durante a avaliação do módulo.

| Símbolo | Tipo ou assinatura | Responsabilidade e consumidores reais |
| --- | --- | --- |
| `ConfigKey` | `keyof typeof optionNames` | União estática de chaves; usada por `RawConfig`, tabelas, validação cruzada e tradução em `loadConfig` |
| `RawConfig` | `Partial<Record<ConfigKey, string>>` | Valores textuais não validados; usado em `defaults`, `parseArguments` e variável `raw` de `loadConfig` |
| `optionNames` | Objeto `as const`, satisfazendo `Record<keyof AppConfig, string>` | Liga 16 campos aos nomes CLI; gera `optionEntries` e identifica diagnósticos em `parseArguments`/`loadConfig` |
| `defaults` | `RawConfig` | Defaults textuais de dez campos, lidos por `loadConfig`; raiz/estado/staging são explícitos e TLS derivado é separado |
| `optionEntries` | `[ConfigKey, string][]` | Pares de `optionNames`; usados para gerar `cliKeys`/`envKeys` e selecionar valores em `loadConfig` |
| `cliKeys` | `Map<string, ConfigKey>` | Liga `--nome` à chave; consultado por `parseArguments` |
| `envKeys` | `Set<string>` | Nomes `PASSA_*` aceitos; consultado por `loadConfig` |
| `environmentName` | `(name: string): string` | Converte kebab-case em variável `PASSA_` maiúscula; usado por `envKeys` e `loadConfig` |
| `fail` | `(option: string, message: string): never` | Cria/lança erro de um item; chamado por `parseArguments`/`loadConfig` |
| `parseArguments` | `(argv: readonly string[]): RawConfig` | Aceita `--nome valor`/`--nome=valor`, preserva `=` posterior no valor; rejeita desconhecidos/repetidos/posicionais/valor separado ausente; cria objeto local e lança via `fail` |
| `canonicalIp` | `(value: string): string` | Canonicaliza IPv6 por `URL`, preserva IPv4; usado em `validSan` e transforms de `sans`/`configSchema`; fluxo interno pressupõe IP validado |
| `isIpLiteral` | `(value: string): boolean` | Reconhece IPv4/IPv6 sem zona `%`; usado por `validSan`, `sans` e campo `host` |
| `isUnspecifiedIp` | `(value: string): boolean` | Reconhece IPs não especificados canônicos considerados pelo código; usado por `validSan` e relação bind/SAN |
| `validSan` | `(value: string): boolean` | Valida IP ou DNS ASCII com limites; rejeita IP não especificado/wildcard/URL/porta e forma numérica pontuada inválida; usado por `sans` |
| `validOrigin` | `(value: string): boolean` | Literal `null` ou HTTP(S) idêntico a `URL.origin`; rejeita wildcard/falha de parsing; usado por `origins` |
| `contains` | `(parent: string, candidate: string): boolean` | Igualdade/descendência lexical por `path.relative`, não prefixo parcial; chamado por `overlaps` e relações de materiais no esquema |
| `overlaps` | `(first: string, second: string): boolean` | Aplica `contains` nos dois sentidos; usado nas relações de diretórios/materiais |

Referências das tabelas são `const`, mas objetos, arrays, `Map` e `Set` internos não
estão congelados. O código atual os lê após criar o módulo; isso difere do
congelamento explícito da saída pública.

### Esquemas Zod internos

Tipos genéricos são inferidos pelo TypeScript; a tabela registra entrada/saída
relevantes sem catalogar classes internas do Zod. Falhas tornam-se issues traduzidas
por `loadConfig`; nenhum esquema produz HTTP.

| Símbolo | Entrada → saída | Regras e consumidores |
| --- | --- | --- |
| `absolutePath` | string → string | Absoluto POSIX sem NUL; normalização lexical e remoção de barra final exceto `/`; usado nos seis campos de caminho de `configSchema` |
| `decimalInteger(maximum: number)` | Esquema string → number | Exige dígitos, converte para inteiro positivo representável até `maximum`; cria esquemas de porta/limites/prazo em `configSchema` |
| `jsonInput` | string → unknown | `JSON.parse`; falha acrescenta issue e retorna `z.NEVER`; base de `sans`/`origins` |
| `sans` | string JSON → string[] | Array não vazio de identidades; DNS minúsculo/IPv6 canônico; duplicatas verificadas após normalização; usado em `tlsSans` |
| `origins` | string JSON → string[] | Array de origens válidas/distintas; vazio permitido; usado em `corsOrigins` |
| `configSchema` | Objeto textual → objeto tipado | Combina 16 campos e callback `superRefine`; consumido por `configSchema.safeParse(raw)` em `loadConfig` |

O callback `superRefine` usa o helper local
`addIssue(key: ConfigKey, message: string): void` para associar falhas à opção.
Compara três diretórios aos pares; exige SAN para bind concreto; mantém materiais
autoassinados sob `stateDir`; impede colisões de certificado/chave/tokens entre si,
com raiz/staging e como ancestrais do estado. Sem `tokensFile`, considera o futuro
`stateDir/tokens.json` somente para detectar colisões; não cria esse arquivo.

## Dependências e artefatos

| Dependência/artefato | Papel usado nesta etapa |
| --- | --- |
| Express | Fábrica da instância em `createApp`, sem funcionalidades/listener |
| Zod | Esquemas, transforms e validação cruzada de configuração |
| Node.js | Runtime CLI, `isIP`, caminhos POSIX, `URL` e APIs do processo; módulos de teste somente na suíte |
| TypeScript e tipagens | Análise estática/compilação ESM e tipos externos; não substituem validação em execução |
| `tsconfig.json` | Compila `src` para `dist`, com `strict`, `NodeNext`, verificações adicionais e source maps |
| `tsconfig.test.json` | Compila fontes e testes em `.test-build`, estendendo configuração principal |
| `package-lock.json` | Registra resolução das dependências; versões e comandos em `configuration.md` |

JavaScript emitido repete a implementação TypeScript e não constitui nova unidade
autoral. Testes não são unidades de produção; [testing.md](testing.md) registra
escopo e resultados. Não há biblioteca instalada de multipart, ZIP ou certificados.
