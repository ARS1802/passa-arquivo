# Configuração e inicialização

## Estado e versões

**Etapa 2: estrutura TypeScript e validação de configuração implementadas.**
`loadConfig`, em [src/config/index.ts](../src/config/index.ts), valida valores e
relações lexicais. O comando `check:config`, implementado em
[src/check-config.ts](../src/check-config.ts), faz essa conferência e termina.
Não lê nem cria diretórios, tokens ou certificados e não inicia servidor.
Filesystem real, autenticação e ciclo HTTPS continuam pendentes nas etapas 3 e 8,
conforme [progress.md](progress.md).

Versões efetivamente utilizadas na preparação da etapa 2, em **2026-09-06**:

| Componente | Versão utilizada | Estado e papel |
| --- | --- | --- |
| Node.js | `24.19.0` | Runtime LTS já instalado no ambiente; nenhum runtime novo instalado |
| npm | `11.17.0` | Já disponível com esse runtime; preparação de dependências e lock |
| TypeScript | `7.0.2` | Instalado em desenvolvimento; compilador local `tsc` |
| Express | `5.2.1` | Instalado em execução; estrutura HTTP mínima, sem endpoints do contrato |
| Zod | `4.5.4` | Instalado em execução; validação da configuração |
| `@types/node` | `24.13.3` | Instalado em desenvolvimento; tipos da linha Node.js 24 |
| `@types/express` | `5.0.6` | Instalado em desenvolvimento; tipos da linha Express 5 |

O manifesto exige Node.js `>=24.19.0 <25` e npm `>=11 <12`; `.nvmrc` registra
`24.19.0` e `packageManager` registra `npm@11.17.0`. O Node.js 24 existente foi
selecionado por `PATH` somente nos comandos da etapa. O Node.js 20 padrão do ambiente
não foi alterado e não atende ao requisito do projeto.

A consulta upstream de **2026-09-05** encontrou Node.js `24.20.0` disponível com
npm `11.19.0`; essas duas versões não foram instaladas ou executadas aqui. Os pacotes
npm usados coincidem com as versões consultadas: TypeScript `7.0.2` (2026-07-08),
Express `5.2.1` (2025-12-01), Zod `4.5.4` (2026-08-29), `@types/node` `24.13.3`
(2026-07-08) e `@types/express` `5.0.6` (2025-12-01). Fontes:
[índice de distribuições Node.js](https://nodejs.org/dist/index.json),
[registro TypeScript](https://registry.npmjs.org/typescript),
[registro Express](https://registry.npmjs.org/express),
[registro Zod](https://registry.npmjs.org/zod),
[registro @types/node](https://registry.npmjs.org/@types/node) e
[registro @types/express](https://registry.npmjs.org/@types/express).

Node.js 24 está em Active LTS na data da consulta; o calendário prevê manutenção
a partir de 2026-10-20 e fim de suporte em 2028-04-30. As datas podem mudar.
Express 5 requer Node.js 18 ou superior e suporta a versão mais recente da linha.
O projeto utiliza a linha 24 LTS. Fontes:
[calendário Node.js](https://github.com/nodejs/Release),
[releases Node.js](https://nodejs.org/en/about/previous-releases) e
[suporte Express](https://expressjs.com/en/support/).

## Preparação e comandos disponíveis

A estrutura utiliza ESM, `module`/`moduleResolution: NodeNext`, alvo `ES2023`,
`strict`, `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`. O `tsc` local
compila `src/` para `dist/`; Node.js executa o JavaScript gerado. Não há carregador
TypeScript ou integração com a API interna do compilador. Zod valida dados em
execução: tipos TypeScript não validam automaticamente JSON ou variáveis de
ambiente. Fontes: [requisitos Zod](https://zod.dev/) e
[API de esquemas Zod](https://zod.dev/api).

Antes de 2025, o compilador TypeScript era implementado em TypeScript/JavaScript.
O TypeScript 7, lançado em julho de 2026, usa implementação nativa em Go, mantendo
`tsc`. A mudança busca reduzir o tempo de análise e compilação; a aplicação continua
escrita em TypeScript e compilada para JavaScript. O compilador local foi executado
nesta etapa. Fonte:
[anúncio oficial TypeScript 7](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

A preparação inicial executou `npm install` com versões exatas em `package.json`:
82 pacotes instalados, `package-lock.json` gerado e zero vulnerabilidades informadas
pelo npm nessa execução. Esse resultado pontual não garante ausência de
vulnerabilidades. `npm ls` e a versão do compilador local foram conferidos.

Para reproduzir o ambiente, selecione antes Node.js e npm compatíveis. Se utiliza
nvm com a versão já instalada, `nvm use` lê `.nvmrc`. Depois:

```sh
npm ci
npm run build
npm run check
```

`npm ci` instala a árvore do lock; não faz parte de cada execução do programa.
O lock acompanha também dependências transitivas e deve ser versionado junto ao
manifesto. Fonte:
[documentação npm sobre package-lock.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json/).

Na etapa 2, `npm ci` foi executado com sucesso: 82 pacotes instalados, 83 auditados
e zero vulnerabilidades relatadas. O SHA-256 do lock permaneceu idêntico antes e
depois da reinstalação; o valor e os resultados estão em [testing.md](testing.md).

| Comando existente | Comportamento |
| --- | --- |
| `npm run build` | Compila produção para `dist/`; não inicia listener |
| `npm run typecheck` | Verifica tipos de produção e testes, sem emitir JavaScript |
| `npm test` | Compila produção/testes para `.test-build/` e executa `node --test` |
| `npm run check` | Executa verificação de tipos, build e testes, nessa ordem |
| `npm run check:config -- ...` | Executa `dist/check-config.js`; requer build prévio; verifica configuração e termina |

Exemplo executável após o build:

```sh
npm run check:config -- \
  --root /srv/passa-arquivo/shared \
  --state-dir /srv/passa-arquivo/state \
  --staging-dir /srv/passa-arquivo/staging
```

Os caminhos são argumentos de exemplo: o comando não precisa que existam e não
os cria. Saída `0`: sintaxe e relações lexicais aceitas; `2`: `ConfigurationError`;
`1`: falha inesperada. Os diagnósticos identificam opções conhecidas e mensagens
fixas, sem valores de entrada, nomes arbitrários, tokens ou caminhos. O comando
não imprime o objeto de configuração e não comprova que o servidor poderá iniciar.

O exemplo acima foi executado na etapa 2 e retornou `0`, sem criar os diretórios
informados ou iniciar servidor.

**`npm start` ainda não existe.** O comando de inicialização HTTPS pertence à etapa 8.
Bibliotecas de multipart, ZIP e emissão de certificado serão avaliadas nas etapas
correspondentes, sem instalação antecipada.

## Fontes e precedência implementadas

Para cada opção: **argumento CLI > variável de ambiente > padrão**. Não há arquivo
de configuração obrigatório nem carregamento implícito de `.env`. Os arquivos
futuros de tokens e certificados não são uma fonte geral de opções.

CLI aceita `--nome valor` ou `--nome=valor`. Argumentos duplicados, desconhecidos,
posicionais, abreviações e opções sem valor são rejeitados. Não há terminador `--`
dentro dos argumentos do parser; o primeiro `--` nos exemplos é consumido pelo npm
para encaminhar argumentos. Valores depois de `=` preservam outros caracteres `=`.

Variáveis próprias usam `PASSA_`; qualquer nome desconhecido com esse prefixo causa
erro, sem repetir no diagnóstico o nome ou valor enviados. Variáveis de outros
programas são ignoradas. Uma variável conhecida é ignorada quando a CLI fornece a
mesma opção, mesmo se o ambiente contiver um valor inválido. O valor efetivo vazio
ou inválido sempre causa erro, sem recorrer ao padrão. CLI substitui listas
inteiras; não concatena listas do ambiente.

Números usam somente dígitos decimais, sem unidade, notação exponencial, fração,
sinal ou espaços. Zeros à esquerda são aceitos; o retorno é numérico. Arrays são
JSON de strings em ambas as fontes; vírgulas sem um array JSON não são aceitas.
A configuração e seus arrays são congelados. `tokensFile` é propriedade ausente
quando não configurada, não uma propriedade com valor `undefined`.

## Opções: validação atual e utilização futura

São **16 opções**. Tipos, padrões, obrigatoriedade e validações lexicais das tabelas
estão implementados. A utilização futura não é executada por `check:config`;
nenhuma conferência atual acessa o filesystem.

### Rede e diretórios

| Variável / argumento CLI | Tipo retornado | Padrão | Obrigatoriedade | Validação implementada | Utilização futura |
| --- | --- | --- | --- | --- | --- |
| `PASSA_ROOT` / `--root` | string de caminho | Nenhum | Obrigatória | Absoluto POSIX sem NUL; normalização e separação lexical | Resolver raiz efetiva existente/acessível; não criar a pasta compartilhada automaticamente |
| `PASSA_HOST` / `--host` | string IP | `127.0.0.1` | Opcional | IPv4/IPv6 literal sem zona; IPv6 normalizado; bind concreto precisa constar no SAN | Endereço de escuta; ainda não há bind |
| `PASSA_PORT` / `--port` | inteiro | `8443` | Opcional | 1 a 65535 | Porta HTTPS; tratar falha real de bind, sem matar outros processos |
| `PASSA_STATE_DIR` / `--state-dir` | string de caminho | Nenhum | Obrigatória | Absoluto POSIX sem NUL; separado lexicalmente de raiz/staging | Estado privado externo à raiz/repositório; criar `0700` sob pai existente controlado |
| `PASSA_STAGING_DIR` / `--staging-dir` | string de caminho | Nenhum | Obrigatória | Absoluto POSIX sem NUL; separado lexicalmente de raiz/estado | Staging privado `0700`, externo à raiz/repositório; filesystem compatível com publicação |

### TLS e localização dos tokens

| Variável / argumento CLI | Tipo retornado | Padrão | Obrigatoriedade | Validação implementada | Utilização futura |
| --- | --- | --- | --- | --- | --- |
| `PASSA_TLS_MODE` / `--tls-mode` | enum `self-signed` ou `provided` | `self-signed` | Opcional | Somente os dois valores exatos | Define administração da emissão/renovação; ambos usam HTTPS |
| `PASSA_TLS_SANS` / `--tls-sans` | array de strings | `["localhost","127.0.0.1"]` | Opcional | Não vazio; DNS/IP normalizados, sem duplicatas equivalentes; regras abaixo | Identidades SAN que o certificado deve cobrir |
| `PASSA_TLS_CERT_FILE` / `--tls-cert-file` | string de caminho | `<state-dir>/tls/server.crt` em `self-signed` | Obrigatória em `provided` | Absoluto sem NUL; em `self-signed`, descendente do estado; sem colisões lexicais | Ler/preparar certificado ou cadeia PEM; material público pode ser entregue ao cliente |
| `PASSA_TLS_KEY_FILE` / `--tls-key-file` | string de caminho | `<state-dir>/tls/server.key` em `self-signed` | Obrigatória em `provided` | Absoluto sem NUL; em `self-signed`, descendente do estado; sem colisões lexicais | Ler/preparar chave PEM correspondente, regular `0600`, de seu usuário, em diretório privado |
| `PASSA_TOKENS_FILE` / `--tokens-file` | string de caminho opcional | Ausente | Opcional | Se presente, absoluto sem NUL e sem colisões lexicais | Ler tokens externos de arquivo JSON privado; se ausente, gerar tokens por execução |

Os padrões de certificado/chave derivam do `stateDir` efetivo depois da precedência.
Em `provided`, não há fallback para esses caminhos. Nenhum arquivo é aberto ou
verificado quanto a existência, conteúdo PEM, validade ou permissões nesta etapa.

### CORS, limites e encerramento

| Variável / argumento CLI | Tipo retornado | Padrão | Obrigatoriedade | Validação implementada | Utilização futura |
| --- | --- | --- | --- | --- | --- |
| `PASSA_CORS_ORIGINS` / `--cors-origins` | array de strings | `[]` | Opcional | Sem duplicatas; origens HTTP(S) canônicas ou literal `"null"`; sem wildcard | Lista CORS; sem autorização geral por padrão |
| `PASSA_UPLOAD_MAX_BYTES` / `--upload-max-bytes` | inteiro | `1073741824` (1 GiB) | Opcional | 1 a `Number.MAX_SAFE_INTEGER` | Contar bytes do único arquivo durante leitura, mesmo sem `Content-Length` |
| `PASSA_ZIP_MAX_ENTRIES` / `--zip-max-entries` | inteiro | `10000` | Opcional | 1 a `Number.MAX_SAFE_INTEGER` | Contar arquivos/diretórios incluídos, inclusive vazios, sem o diretório contêiner |
| `PASSA_ZIP_MAX_BYTES` / `--zip-max-bytes` | inteiro | `10737418240` (10 GiB) | Opcional | 1 a `Number.MAX_SAFE_INTEGER` | Somar bytes não comprimidos efetivamente lidos, não o tamanho final do ZIP |
| `PASSA_JSON_MAX_BYTES` / `--json-max-bytes` | inteiro | `16384` (16 KiB) | Opcional | 1 a `Number.MAX_SAFE_INTEGER` | Limitar corpos JSON estruturados; multipart terá seus próprios limites |
| `PASSA_SHUTDOWN_TIMEOUT_MS` / `--shutdown-timeout-ms` | inteiro | `10000` | Opcional | 1 a `2147483647` | Prazo em milissegundos para requisições em andamento antes do cancelamento |

Esses números estão adotados como defaults de configuração; não são medições de
capacidade nem limites já aplicados a transferências. Não há uploads, ZIP, parser
HTTP de corpos ou encerramento de servidor implementados nesta etapa.

## Normalização e validações cruzadas implementadas

### Caminhos de configuração

Caminhos locais são absolutos POSIX; a convenção relativa dos caminhos da API não
se aplica a eles. O parser normaliza lexicalmente separadores repetidos e segmentos
`.`/`..`, remove a barra final exceto em `/` e preserva espaços legítimos. Por exemplo,
`/srv/dados/../pasta com espaço/` torna-se `/srv/pasta com espaço`. Isso não resolve
links simbólicos, não equivale a `realpath` e não autoriza caminhos da API.

As relações são conferidas por componentes relativos entre caminhos normalizados,
sem usar prefixo textual como única comparação:

- Raiz, estado e staging são distintos, sem conter uns aos outros.
- Materiais de certificado/chave/tokens ficam fora da raiz e do staging; também não
  podem ser iguais ou ancestrais de diretórios configurados.
- Os três caminhos de materiais são distintos e não podem conter uns aos outros.
- Na ausência de `tokensFile`, a verificação de colisões reserva
  `<state-dir>/tokens.json` para a futura entrega dos tokens gerados.
- Certificado e chave autoassinados são descendentes do estado; o próprio diretório
  de estado não serve como caminho de arquivo.

Essas conferências não conhecem o diretório efetivo do repositório nem inspecionam
arquivos. Existência, tipo, propriedade, permissões, links, hard links, `realpath`,
isolamento físico do repositório e dispositivos serão verificados nas etapas 3 e 8.
Uma configuração lexicalmente aceita ainda pode ser fisicamente inválida.

### Identidades TLS

DNS usa labels ASCII de 1 a 63 caracteres, com letras, dígitos e hífen interno,
e nome completo de até 253 caracteres, sem ponto final. Letras são convertidas para
minúsculas. Não há conversão IDNA; nomes internacionais precisam de representação
ASCII adequada, como labels punycode. Strings formadas só por dígitos e pontos não
são aceitas como DNS alternativo a IPv4 malformado.

IPs são literais válidos; IPv6 é normalizado para a representação canônica, inclusive
para detectar duplicatas equivalentes. Zonas, como `%eth0`, não são aceitas. URLs,
portas, espaços e wildcards não são SANs. Endereços não especificados `0.0.0.0`, `::`
e o caso IPv4 mapeado `::ffff:0:0` podem ser bind, mas não identidade SAN; equivalentes
IPv6 são comparados após normalização. Todo IP de bind concreto precisa estar na lista.

Escuta em todas as interfaces não determina quais identidades os clientes usarão.
O operador precisa listar os nomes/IPs das URLs esperadas. Na etapa 8, o certificado
fornecido deverá cobrir as identidades, ser temporalmente válido e corresponder à
chave. Esses materiais ainda não são lidos pelo parser.

### Origens CORS

A origem deve ser exatamente igual a `new URL(valor).origin`, ter esquema `http:`
ou `https:` e não conter wildcard. Isso rejeita credenciais, path, query, fragmento,
barra final e formas não canônicas, como porta padrão explícita ou hostname em
maiúsculas. Exemplo aceito: `http://localhost:5173`. Não há normalização silenciosa
das origens; duplicatas são rejeitadas.

O literal `"null"` só é aceito quando listado explicitamente; JSON `null` não é origem
válida. Essa origem pode representar `file://` e outros contextos opacos; liberá-la
não autoriza somente um arquivo local específico. A lista vazia não substitui o
token nem impede clientes que não aplicam CORS. Preflight, headers e métodos serão
integrados na etapa 8: [security.md](security.md).

## Preparação física e tokens: comportamento futuro

**Ainda não implementado.** A inicialização exigirá raiz existente e acessível,
resolvendo-a e verificando a separação física de raiz, estado, staging e repositório.
O caminho inicial da raiz poderá ser resolvido por link configurado pelo operador;
links dentro da raiz não serão aceitos nas operações da API.

Estado e staging deverão pertencer ao usuário do processo, sem acesso de grupo/outros
e sem links nos componentes privados. Poderão ser criados com `0700` sob pais
existentes controlados. Não corrigir permissões existentes automaticamente:
configuração insegura deverá impedir a inicialização.

Staging exigirá filesystem compatível com a publicação no destino, com conferência
de dispositivos e tratamento das falhas reais, inclusive montagens incompatíveis.
Não substituir movimentação indisponível por cópia e remoção silenciosas. Comparar
dispositivos não detecta todas as montagens bind nem oferece isolamento contra
mudanças externas: [filesystem.md](filesystem.md).

O formato de tokens externos continua **proposto**: array JSON não vazio, sem
repetição, com até 256 strings, cada uma com 32 bytes em base64url canônico sem
padding (43 caracteres). O operador deverá usar gerador criptográfico; validação
de formato não comprova qualidade da aleatoriedade. A fonte será arquivo regular
privado `0600`, do usuário do processo, fora da raiz/repositório e sem links; o
servidor não modificará essa fonte externa.

Na ausência de fonte externa, a proposta é gerar 16 tokens de 32 bytes por execução
e entregá-los em `<state-dir>/tokens.json`, privado `0600`, sem log ou argumento
contendo os segredos. O arquivo de entrega não será relido como persistência;
reiniciar com geração invalidará os anteriores. Tokens externos poderão permanecer
iguais. Nenhum token é gerado pelo parser ou comando de conferência.
Comparação, entrega e confiança: [security.md](security.md).

## Certificados: ciclo de vida futuro

**Ainda não implementado; etapa 8.** Em `self-signed`, preparar chave/certificado na
primeira inicialização. Proposta: validade de 30 dias; renovar na inicialização
quando faltarem no máximo 7 dias, após expiração, mudança de SANs ou invalidade do
par. Publicar um par coerente antes da escuta; falha de geração/validação impedirá
startup. Reaproveitar materiais válidos fora dessas condições. Não gerar por
requisição nem renovar automaticamente durante a execução; o operador deverá
reiniciar antes do vencimento. Renovação de autoassinado exigirá redistribuir
confiança aos clientes por canal apropriado.

Em `provided`, o operador fornecerá certificado/cadeia PEM e chave privada, ambos
regulares, existentes e legíveis. Verificar correspondência, validade e identidades
antes da escuta. O servidor não sobrescreverá os arquivos. O operador renovará com
sua CA pública ou privada e reiniciará para carregar o novo par; não há proposta de
reload implícito. Uma cadeia carregável não garante que os clientes confiem no emissor.

TLS mínimo 1.2, permitindo 1.3 quando suportado, sem fallback HTTP. A ferramenta de
emissão ainda será escolhida; nenhuma dependência de OpenSSL CLI, mkcert, step-ca
ou serviço de CA foi instalada para essa finalidade. Papéis do certificado público,
chave privada e confiança: [security.md](security.md).

## Inicialização e encerramento do servidor: futuros

O parser da etapa 2 será componente deste startup, ainda não integrado:

1. Ler CLI/ambiente, aplicar precedência e validar configuração com Zod.
2. Resolver raiz existente e verificar diretório, acesso e separação dos privados.
3. Preparar estado/staging privados, verificando propriedade e filesystem.
4. Validar ou preparar certificado/chave conforme o modo.
5. Carregar ou gerar credenciais, sem expô-las em logs ou respostas.
6. Criar servidor HTTPS e tratar o resultado real de bind, inclusive porta ocupada.
7. Informar prontidão após escuta efetiva, sem afirmar disponibilidade de todas as
   operações do filesystem com base apenas nesse evento.

Falha de preparação deverá impedir escuta e produzir diagnóstico local sem segredos,
com término diferente de zero. Não instalar dependências, alterar firewall, instalar
confiança nos clientes ou liberar porta encerrando processos de terceiros.

Em `SIGINT`/`SIGTERM`, a proposta é parar novas requisições, aguardar operações até
o prazo configurado e cancelar as restantes, fechando streams e removendo somente
temporários do processo. Interrupção antes da publicação deverá preservar o destino
anterior; publicação concluída não deverá ser desfeita. Sinais não capturáveis e
queda de energia poderão deixar temporários; não há promessa de limpeza nesses
casos. O comando atual termina imediatamente e não implementa esse encerramento.

## Plataforma e verificações

A etapa 2 foi preparada em Linux x86_64, Node.js 24.19.0 e npm 11.17.0. O manifesto
limita a plataforma a Linux. Isso não anuncia disponibilidade ou verificação da API
de arquivos e do transporte HTTPS. Windows e macOS não têm suporte neste MVP;
não inferir compatibilidade da portabilidade das dependências.

`npm run check` executou verificação de tipos, build e 46 testes: 46 aprovados,
nenhuma falha e nenhum teste ignorado. A suíte cobre configuração e estrutura mínima,
não autenticação, isolamento físico ou HTTPS. Procedimentos e resultados completos,
inclusive reprodução do lock e comandos de conferência, ficam em
[testing.md](testing.md).
