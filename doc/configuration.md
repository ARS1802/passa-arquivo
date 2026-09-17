# Configuração

Você já pode conferir as opções do projeto pelo terminal. O comando verifica os
valores informados e se eles combinam entre si; ele não inicia um servidor, não
cria pastas e não lê certificados ou tokens. A API ainda não recebe requisições.

Esta página descreve a configuração que existe no código, ainda voltada a Linux
com caminhos POSIX. O modelo P2P exige Linux Mint, Ubuntu e Windows, identidade
persistente e mTLS; suas opções definitivas ainda serão definidas. Os campos de
tokens e de TLS abaixo não implementam esse modelo. Veja [Linux e Windows](platforms.md)
e [Segurança](security.md).

## Preparar o projeto

Use Linux, Node.js **24.19.0** e npm **11.17.0**. A versão do Node.js está em
[.nvmrc](../.nvmrc). Se você já usa nvm e tem essa versão instalada, execute
`nvm use` na pasta do projeto. Depois, instale as dependências e compile o código:

```sh
npm ci
npm run build
```

`npm ci` usa as versões salvas em [package-lock.json](../package-lock.json).
Esse arquivo inclui as dependências diretas e as dependências delas; por isso,
ele acompanha o [package.json](../package.json) no Git.

| Componente | Versão do projeto | Para que serve |
| --- | --- | --- |
| Node.js | `24.19.0` | Executa o JavaScript gerado pela compilação. |
| npm | `11.17.0` | Instala dependências e executa os comandos do projeto. |
| TypeScript | `7.0.2` | Confere tipos e compila o código para JavaScript. |
| Express | `5.2.1` | Fornece a estrutura da aplicação HTTP, ainda sem rotas. |
| Zod | `4.5.4` | Confere os valores de configuração durante a execução. |
| `@types/node` | `24.13.3` | Descreve os tipos das funções do Node.js para o TypeScript. |
| `@types/express` | `5.0.6` | Descreve os tipos do Express para o TypeScript. |

O `package.json` aceita Node.js `>=24.19.0 <25` e npm `>=11 <12`; o campo
`packageManager` registra `npm@11.17.0`. O manifesto atual aceita somente Linux; Windows é requisito do novo desenho,
mas ainda não está suportado pelo código. macOS não faz parte do alvo atual.

## Comandos disponíveis

| Comando | O que faz |
| --- | --- |
| `npm run build` | Compila os arquivos de `src/` para `dist/`. |
| `npm run typecheck` | Confere os tipos do código e dos testes, sem gerar JavaScript. |
| `npm test` | Compila código e testes em `.test-build/` e executa os testes com `node --test`. |
| `npm run check` | Executa a conferência de tipos, a compilação e os testes, nessa ordem. |
| `npm run check:config -- ...` | Confere as opções informadas e termina; precisa de uma compilação anterior. |

Nenhum desses comandos inicia um servidor. **Ainda não existe `npm start`.**
O [guia de testes](testing.md) explica o que a suíte verifica.

## Conferir suas opções

Depois de executar `npm run build`, informe os três diretórios obrigatórios:

```sh
npm run check:config -- \
  --root /srv/passa-arquivo/shared \
  --state-dir /srv/passa-arquivo/state \
  --staging-dir /srv/passa-arquivo/staging
```

Esses caminhos são exemplos e não precisam existir para esta conferência. A
pasta `shared` representa os arquivos compartilhados. `state` guarda os dados
privados do servidor. `staging` é uma área temporária para preparar arquivos antes
de colocá-los no destino. O comando atual não cria nem acessa nenhuma delas.

O código de saída informa o resultado:

| Código | Significado |
| --- | --- |
| `0` | Os valores e as relações entre as opções foram aceitos. |
| `2` | Alguma opção está inválida; o comando mostra qual regra precisa ser corrigida. |
| `1` | Ocorreu uma falha inesperada. |

As mensagens não repetem valores recebidos, caminhos ou nomes de opções
desconhecidas. O objeto completo de configuração também não é impresso.
Uma saída `0` não garante que os arquivos existam ou que o servidor possa iniciar.

A função que confere os valores é `loadConfig`, em
[src/config/index.ts](../src/config/index.ts). O comando de terminal fica em
[src/check-config.ts](../src/check-config.ts).

## Como informar os valores

Você pode usar argumentos no terminal ou variáveis de ambiente. Para cada opção,
a escolha segue esta ordem:

1. Valor passado como argumento, por exemplo `--port 9443`.
2. Variável de ambiente correspondente, como `PASSA_PORT`.
3. Valor padrão, quando a opção tem um.

Por exemplo, se `PASSA_PORT` vale `8444` e você informa `--port 9443`, a porta
escolhida é `9443`. Um argumento substitui o valor da variável antes da validação,
mesmo quando o valor da variável está errado. Um valor vazio ou inválido na fonte
escolhida causa erro: o programa não tenta usar o padrão para escondê-lo.

Os argumentos aceitam `--nome valor` e `--nome=valor`. Um `=` dentro do valor é
preservado. Não são aceitos argumentos repetidos, nomes desconhecidos, abreviações,
valores soltos ou opções sem valor. O `--` dos exemplos pertence ao npm: ele indica
que os argumentos seguintes devem chegar ao programa. O programa não aceita outro
`--` como separador.

As variáveis do projeto começam com `PASSA_`. Um nome desconhecido com esse prefixo
causa erro, inclusive quando há argumentos no terminal. Variáveis de outros
programas são ignoradas. Não há leitura automática de `.env` nem arquivo geral de
configuração. Arquivos de tokens e certificados têm finalidades próprias.

Use somente dígitos para números: `1000` é válido; `1e3`, `1.0`, `+1000`, `10MB`
e números com espaços não são. Zeros à esquerda são aceitos. Listas precisam ser
arrays JSON de strings, por exemplo `'["localhost","127.0.0.1"]'`, e não uma
sequência separada apenas por vírgulas. Uma lista passada no terminal substitui a
lista inteira da variável de ambiente.

Para quem usa `loadConfig` no código, o resultado e suas listas são protegidos
contra alteração com `Object.freeze`. Quando `tokens-file` não foi informado, o
objeto não contém a propriedade `tokensFile`; ela não é criada com `undefined`.

## Opções

As 16 opções abaixo já são conferidas pelo comando. As operações que usarão esses
valores — como HTTPS, upload e ZIP — ainda não estão disponíveis.

### Rede e pastas

Os três caminhos de pastas são obrigatórios e não têm valor padrão. Devem começar
com `/`, como os caminhos absolutos do Linux, e seguir as regras de separação
explicadas adiante.

| Variável / argumento | Tipo | Padrão | Para que serve e o que é aceito |
| --- | --- | --- | --- |
| `PASSA_ROOT` / `--root` | string | Obrigatória | Pasta dos arquivos compartilhados; caminho absoluto sem byte nulo. |
| `PASSA_HOST` / `--host` | string | `127.0.0.1` | IP em que o servidor deverá receber conexões; IPv4 ou IPv6, sem nome de domínio nem identificador de interface. Um IP específico deve aparecer em `tls-sans`. |
| `PASSA_PORT` / `--port` | inteiro | `8443` | Porta HTTPS; de `1` a `65535`. |
| `PASSA_STATE_DIR` / `--state-dir` | string | Obrigatória | Pasta privada para dados do servidor; caminho absoluto sem byte nulo. |
| `PASSA_STAGING_DIR` / `--staging-dir` | string | Obrigatória | Pasta temporária privada para preparar arquivos; caminho absoluto sem byte nulo. |

### Certificados e tokens

TLS é o protocolo que protege a conexão HTTPS. O certificado identifica o servidor;
a chave privada é o segredo usado por ele nessa conexão. SAN é a lista de nomes e
IPs que o certificado precisa cobrir.

| Variável / argumento | Tipo | Padrão | Para que serve e o que é aceito |
| --- | --- | --- | --- |
| `PASSA_TLS_MODE` / `--tls-mode` | string | `self-signed` | `self-signed` para certificado gerado pelo servidor ou `provided` para certificado fornecido por você. Somente esses valores são aceitos. |
| `PASSA_TLS_SANS` / `--tls-sans` | array de strings | `["localhost","127.0.0.1"]` | Nomes DNS e IPs do servidor, sem repetições; a lista não pode ficar vazia. |
| `PASSA_TLS_CERT_FILE` / `--tls-cert-file` | string | `<state-dir>/tls/server.crt` em `self-signed` | Caminho absoluto do certificado PEM ou da cadeia de certificados. Obrigatório em `provided`. |
| `PASSA_TLS_KEY_FILE` / `--tls-key-file` | string | `<state-dir>/tls/server.key` em `self-signed` | Caminho absoluto da chave privada PEM. Obrigatório em `provided`. |
| `PASSA_TOKENS_FILE` / `--tokens-file` | string opcional | Ausente | Caminho absoluto de um arquivo JSON com tokens externos. Campo do modelo anterior de tokens; não define a identidade P2P. |

`PEM` é o formato textual dos arquivos de certificado e chave. Os padrões desses
dois caminhos usam o `state-dir` escolhido depois da aplicação da ordem de
preferência. Em `provided`, é preciso informar ambos: não há caminho automático.
Em `self-signed`, os dois arquivos precisam ficar dentro de `state-dir`.
Nenhum certificado, chave ou token é lido pelo comando atual.

### Navegadores, limites e encerramento

CORS é a regra que informa ao navegador quais sites podem usar a API. Ela não
substitui a autenticação nem a proteção do controle local. Os números abaixo são valores de configuração;
eles ainda não são aplicados a transferências ou requisições.

| Variável / argumento | Tipo | Padrão | Para que serve e o que é aceito |
| --- | --- | --- | --- |
| `PASSA_CORS_ORIGINS` / `--cors-origins` | array de strings | `[]` | Origens HTTP(S) permitidas, sem repetições nem `*`; também aceita a string `"null"` quando informada explicitamente. |
| `PASSA_UPLOAD_MAX_BYTES` / `--upload-max-bytes` | inteiro | `1073741824` (1 GiB) | Limite dos bytes recebidos no arquivo de um upload, mesmo sem `Content-Length`. |
| `PASSA_ZIP_MAX_ENTRIES` / `--zip-max-entries` | inteiro | `10000` | Quantidade de arquivos e pastas no ZIP, incluindo pastas vazias; não conta a pasta que contém o conjunto. |
| `PASSA_ZIP_MAX_BYTES` / `--zip-max-bytes` | inteiro | `10737418240` (10 GiB) | Soma dos bytes dos arquivos lidos para o ZIP, antes da compressão. |
| `PASSA_JSON_MAX_BYTES` / `--json-max-bytes` | inteiro | `16384` (16 KiB) | Limite dos corpos JSON das requisições; os limites de multipart serão tratados separadamente. |
| `PASSA_SHUTDOWN_TIMEOUT_MS` / `--shutdown-timeout-ms` | inteiro | `10000` (10 segundos) | Tempo para esperar operações em andamento ao encerrar; de `1` a `2147483647` milissegundos. |

Todos os quatro limites de tamanho ou quantidade aceitam valores de `1` a
`Number.MAX_SAFE_INTEGER` (`9007199254740991`), o maior inteiro que o JavaScript
representa com precisão nesse tipo numérico. Esses máximos não indicam a capacidade
de memória, armazenamento ou processamento do servidor.

## Regras dos caminhos de configuração

Os caminhos desta página apontam para arquivos e pastas do computador. Eles são
absolutos e diferem dos caminhos relativos que serão usados nas requisições da API.
Nenhum deles pode conter o caractere nulo (NUL).

O programa simplifica barras repetidas e trechos `.` e `..`, retira a barra final
(exceto em `/`) e preserva espaços dos nomes. Por exemplo,
`/srv/dados/../pasta com espaço/` vira `/srv/pasta com espaço`.
Ele faz essa comparação apenas com os textos, sem procurar os arquivos no disco.

As regras de separação são:

- A raiz compartilhada, o estado e o staging devem ser pastas diferentes; nenhuma
  pode ficar dentro de outra.
- Certificado, chave e tokens devem ficar fora da raiz e do staging. Seus caminhos
  também não podem ser iguais a essas pastas nem conter essas pastas.
- Nenhum desses arquivos pode usar o caminho de `state-dir` ou de uma pasta que
  contenha `state-dir`.
- Certificado, chave e tokens não podem usar o mesmo caminho nem caminhos contidos
  uns nos outros, como `/privado/chave` e `/privado/chave/tokens.json`.
- Quando `tokens-file` está ausente, o programa reserva `<state-dir>/tokens.json`
  nessa comparação, conforme o modelo anterior. Isso não gera tokens nem
  prepara o registro de peers.
- Em `self-signed`, certificado e chave devem ficar dentro da pasta de estado.

A comparação respeita os componentes do caminho: `/srv/dados` não contém
`/srv/dados-privados`. Mesmo assim, essa conferência não verifica links simbólicos,
existência, permissões, dono dos arquivos ou em qual disco eles estão. Também não
compara os caminhos com a localização real do repositório. Aceitar o texto da
configuração não comprova que as pastas estão separadas no disco.

## Nomes e IPs do certificado

Nomes DNS aceitam letras ASCII, dígitos e hífen no meio de cada parte. Cada parte
entre pontos tem de 1 a 63 caracteres; o nome completo tem no máximo 253 e não pode
terminar em ponto. Letras maiúsculas viram minúsculas. Nomes internacionais precisam
estar na forma ASCII apropriada, como punycode; não há conversão automática.
Um texto formado apenas por dígitos e pontos não pode contornar a validação de IPv4
passando como nome DNS.

IPv4 e IPv6 devem ser endereços válidos. Formas equivalentes de IPv6 são convertidas
para uma forma única, inclusive para encontrar repetições. Não são aceitos URL,
porta, espaço, `*` nem identificadores de interface como `%eth0` na lista de SANs.
Nomes que diferem apenas por maiúsculas e minúsculas também contam como repetidos.

`0.0.0.0`, `::` e `::ffff:0:0` podem indicar onde receber conexões, mas não são
identidades de certificado. Se `host` contém um IP específico, esse IP precisa
estar na lista de SANs. Ao usar um endereço para todas as interfaces, como
`0.0.0.0`, informe na lista os nomes ou IPs que os clientes usarão nas URLs.

O comando confere a lista, mas não abre o certificado. A conferência da validade,
da chave correspondente e dos nomes cobertos pelo certificado ainda não existe.

## Origens permitidas para navegadores

Uma origem é formada pelo protocolo, pelo nome ou IP e pela porta, quando
necessária. Por exemplo, `http://localhost:5173` é válida; não coloque nela caminho,
barra final, usuário, senha, query ou fragmento.

O valor precisa ser exatamente igual ao resultado de `new URL(valor).origin`.
Isso também rejeita formas como `https://EXAMPLE.test` e
`https://example.test:443`, pois a forma esperada é `https://example.test`.
Não há correção automática das origens, e valores repetidos causam erro.

`["null"]` libera explicitamente a origem chamada `null`. Isso é diferente de usar
JSON `null`, que é inválido. A origem `null` pode representar páginas abertas como
arquivo local e outros contextos sem uma origem comum; ela não identifica um
arquivo local específico.

Uma lista vazia não libera nenhuma origem pelo CORS. Ela não impede clientes que
não aplicam CORS, como ferramentas de terminal. O tratamento das requisições do
navegador ainda não está implementado; veja [Segurança](security.md).

## Configuração do modelo P2P

A instalação deverá preparar uma identidade local persistente, um local privado
para os peers conhecidos e uma área temporária para transferências. Os nomes das
novas opções, caminhos padrão por sistema e formato de armazenamento ainda não
estão definidos. Nenhum comando atual gera essa identidade ou cadastra peers.

A descoberta terá ativação explícita, destinos locais delimitados e limites de
tempo, quantidade e concorrência. Os parâmetros pertencem ao controle local
explicado em [Conectar dispositivos](connection.md).

A política antiga de gerar tokens a cada execução e renovar certificados por
prazos fixos não define o funcionamento P2P. Reinício e mudança de IP precisam
preservar identidade. Renovação de certificado exigirá continuidade de confiança
verificável ou novo pareamento.

No Linux, os dados privados poderão usar permissões de dono. No Windows, a
proteção precisa de ACLs. Os requisitos estão em [Linux e Windows](platforms.md).
A instalação não mudará o firewall nem adicionará confiança global a certificados.
