# Módulos e funções

O código está dividido em `controller`, `model` e `GUI`. Este catálogo descreve
os módulos existentes; os comentários JSDoc de cada função detalham parâmetros,
retornos e condições de uso. A relação entre as camadas está em [Arquitetura](architecture.md).

## `createApp`

`controller/api/app.ts` exporta estas funções:

| Função | Responsabilidade |
| --- | --- |
| `createApp(limits?)` | Cria e devolve a aplicação Express com autenticação, rotas e tratamento de erros. Não abre uma porta nem prepara pastas ou identidade. |
| `prepareSharedRoot(configuredRoot?)` | Mantém uma raiz explícita ou cria uma pasta com nome disponível no diretório do usuário. A conferência da raiz pertence a `Directory.open`. |
| `startBackend()` | Lê a configuração, inicializa o model e abre o servidor HTTPS. Devolve o servidor para permitir seu encerramento pelo código local. |

`createApp` recebe os limites de JSON e ZIP e, opcionalmente, o limite de upload.
Quando o argumento inteiro é omitido, usa os padrões documentados. Todas as rotas,
inclusive `/health`, exigem mTLS com certificado confiável. Não há uma aplicação
HTTP local separada para a GUI. Importar o arquivo não inicia o servidor.

O auxiliar privado `backendOptions` lê os argumentos e o ambiente; não é uma
camada de configuração separada. `loadConfig`, `ConfigurationError` e o comando
`check:config` descritos em versões anteriores deste guia não existem no código
atual. As opções disponíveis estão em [Configuração](configuration.md).

## Rotas do controller

Cada arquivo registra suas rotas em um Router criado por `createApp`:

| Arquivo e função | Responsabilidade |
| --- | --- |
| `api/routes/health.ts` — `registerHealth` | Consultar a saúde da aplicação autenticada. |
| `api/routes/navigate.ts` — `registerNavigation` | Consultar metadados e listar filhos de uma pasta. |
| `api/routes/download.ts` — `registerDownloads` | Enviar arquivo regular ou ZIP produzido pelo model. |
| `api/routes/upload.ts` — `registerChanges` | Receber multipart e encaminhar upload, cópia, criação, exclusão e movimentação. |

Os caminhos dessa tabela partem de `controller/`. Os contratos HTTP completos
estão em [Rotas da API](endpoints.md). Por exemplo, enviar `nota.txt` passa pela
validação multipart em `registerChanges`, pela operação `fileService.write`
e pela preparação e publicação em `File.write`.

## Serviços de conexão

| Arquivo em `controller/connection` | Funções e responsabilidade |
| --- | --- |
| `sharingService.ts` | `query`, `jsonObject`, `stringField`, `overwriteField` e `noBody` validam dados HTTP; `metadataLocation` monta a URL de metadados; `sendStream` envia bytes; `handleError` traduz falhas. Não há notificações de alterações de arquivos. |
| `discoveryService.ts` | `resolveTargets` e `isLocalTarget` delimitam a rede; `activateDiscovery`, `deactivateDiscovery`, `isDiscoveryActive` e `getDiscoveryWindow` controlam a janela; `discover` procura candidatos; `validateCandidateCertificate` confere certificados sem conceder confiança. |
| `paringService.ts` | Mantém pedidos, aceites, preparação e confirmação. As funções públicas e o fluxo bilateral estão em [Conexão](connection.md). `setTrustUpdater` recebe a operação de atualização TLS registrada pelo backend. |

`controller/api/routes/connect.ts` exporta `openDiscovery` e `closeDiscovery`.
Essas chamadas locais abrem ou encerram a entrada temporária na porta 8444.
A entrada recebe somente anúncios e mensagens de pareamento; não libera arquivos
nem oferece uma rota remota de aceite humano.

## Model de arquivos

| Arquivo em `model/file` | Responsabilidade |
| --- | --- |
| `File.ts` | `File` encapsula metadados, leitura, gravação, cópia, movimentação e exclusão de arquivo regular. `EntryMetadata` define os metadados públicos; `FileContent` define o conteúdo aceito. `modelError` e `errorCode` permitem tratar falhas sem depender de HTTP. |
| `Directory.ts` | `Directory` encapsula diretórios e a inspeção física dos caminhos. Também oferece criação, listagem, cópia de árvore, ZIP e exclusão. `validatePath` confere caminhos da API; `configuredPath` resolve configurações locais; `containsPath` compara contenção por componentes. |
| `fileService.ts` | `setSharedDirectory` seleciona a raiz; `metadata`, `list`, `read`, `createDirectory`, `remove`, `write`, `move`, `copy` e `archive` oferecem suas operações ao controller usando os objetos encapsulados. |

Esses módulos não recebem `Request` ou `Response` nem fazem comunicação de rede.
As regras de acesso, preparação e concorrência estão em [Arquivos e pastas](filesystem.md).

## GUI e instalação

`GUI/src/App.jsx` contém `App`, a tela inicial do Vite com um contador local.
`main.jsx` monta essa tela em `root`, e os arquivos CSS definem sua aparência.
`GUI/api.js` ainda contém somente comentários. Os scripts em `installation`
também não têm comandos implementados; seus resumos descrevem a finalidade prevista.

## Bibliotecas e arquivos de compilação

| Item | Uso no projeto |
| --- | --- |
| Express | Organiza as rotas da API de arquivos (HTTPS, porta padrão 8443) e da entrada temporária de descoberta e pareamento (8444). |
| Node.js | Executa o backend e fornece os módulos nativos usados pelo model, descritos abaixo. |
| TypeScript e pacotes de tipos | Conferem tipos e compilam o código. Essa conferência não substitui a validação dos dados em execução. |
| `tsconfig.json` | Compila `model` e `controller` para `dist` na raiz, com `npm run build:backend`. |
| `package-lock.json` | Registra as versões resolvidas das dependências. |

O manifesto não inclui Zod nem uma suíte automatizada. `npm test` é um
placeholder que informa que nenhum teste foi especificado.

### Bibliotecas utilizadas pelo model

Na inicialização e nas rotas, o controller chama `fileService`, que delega o
acesso ao disco a `File` e `Directory`. `peerService` prepara a identidade local
e mantém os registros. Essa integração existe no backend; a GUI ainda não a usa.

| Biblioteca ou módulo | Onde e como é utilizado |
| --- | --- |
| `node-forge` | Em `model/peer/peerService.ts`, `generateIdentity` gera o par RSA de 2048 bits, monta um certificado X.509 autoassinado, assina com SHA-256 e converte certificado e chave para PEM. |
| `node:crypto` | No model, gera aleatoriedade para a identidade, interpreta certificados e confere a correspondência da chave privada. No controller, `randomUUID` identifica sessões, `X509Certificate.fingerprint256` fornece a impressão digital completa e o certificado DER permite comparar a identidade exata. As chaves privadas são usadas pelo TLS nativo e não entram em respostas. |
| `node:net` | No model, `isIP` confere o formato do endereço. Na descoberta, `BlockList` confere sub-redes IPv4/IPv6 obtidas das interfaces reais do sistema. Um IP é localização, não prova de identidade. |
| `node:https` e `node:tls` | Servem os dois contextos HTTPS e trocam mensagens de pareamento. O transporte confere o certificado esperado; o backend recarrega certificados confiáveis com `setSecureContext`, preservando TLS 1.3 e mTLS. |
| `node:stream` | `Directory.archive`, em `model/file/Directory.ts`, usa `Readable.from` para fornecer os bytes de cada arquivo ao ZIP por partes. Durante a leitura, conta os bytes não comprimidos e interrompe ao exceder o limite. O fechamento da saída destrói os streams ativos. |
| `busboy` | Em `controller/api/routes/upload.ts`, separa o multipart em partes. O controller aceita somente uma parte de arquivo chamada `file`; o model confere o limite de bytes antes da publicação. |
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
