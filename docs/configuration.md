# Configuração

## Arquivo .env do backend

`npm run start:backend` carrega o `.env` da raiz do projeto antes de validar a
configuração e iniciar HTTPS. O carregamento acontece em `startBackend`, em
`controller/api/app.ts`, usando
[`loadEnvFile` do Node.js](https://nodejs.org/api/process.html#processloadenvfilepath),
sem dependência adicional. Importar o módulo ou chamar `createApp` não carrega o arquivo.

O `.env` contém endereço, porta, modo TLS, limites de upload/JSON/ZIP e prazo de
encerramento. `PASSA_HOST=127.0.0.1` atende somente à própria máquina; use
`0.0.0.0` para receber conexões IPv4 nas interfaces de rede, mantendo mTLS exigido.
Depois de editar o arquivo, reinicie o backend.

Os caminhos opcionais estão comentados para preservar os padrões: raiz em
`<diretório do usuário>/passa-arquivo`, com sufixo numérico se o nome estiver
ocupado, estado em `model/peer` e staging em `tmp`. Para substituir esses caminhos,
informe valores absolutos. Não há expansão de `$HOME` ou `~` dentro do `.env`.
Chaves privadas continuam em arquivos próprios; o `.env` contém apenas opções.

Se o arquivo não existir, continuam disponíveis o ambiente externo e os padrões
do código. Uma falha de leitura diferente de arquivo ausente impede a inicialização.

## Preparar o projeto

Instale as dependências da raiz com `npm ci` e use os scripts abaixo, sempre
na raiz do repositório. O ambiente verificado nesta revisão usa Node.js 26.10.0
e npm 11.19.1. A documentação anterior usava Node.js 24.19.0 como referência;
essa versão não foi executada nesta revisão. O manifesto atual não define
`engines` nem `packageManager`.

O backend usa TypeScript e Express. A GUI usa JavaScript, React e Vite.
As versões resolvidas ficam em `package-lock.json`; os pacotes e scripts ficam
em `package.json`. Zod não está instalado e a validação usa funções do projeto.
O uso de `String.prototype.isWellFormed()` está explicado em
[Arquitetura](architecture.md#tecnologias-e-responsabilidades).

## Comandos disponíveis

| Comando | O que faz |
| --- | --- |
| `npm run build:backend` | Compila `model` e `controller` para `dist` na raiz. |
| `npm run start:backend` | Compila o backend e inicia `dist/controller/api/app.js`. |
| `npm run watch:backend` | Recompila o backend quando as fontes mudam. |
| `npm run dev:gui` | Inicia o Vite para desenvolver a GUI. |
| `npm run build:gui` | Gera o build da GUI em `GUI/dist`. |
| `npm run preview:gui` | Serve o build da GUI para conferência local. |
| `npm run lint:gui` | Executa o Oxlint na GUI. |
| `npm test` | Placeholder que termina com erro; não executa uma suíte. |

Os comandos `check:config`, `check`, `typecheck` e `build` sem sufixo não
existem no manifesto atual. Os resultados de QA estão em [Testes](testing.md).

## Como informar os valores

A ordem de preferência é: argumento do terminal, ambiente externo, `.env` e
padrão do código. Uma opção vazia não equivale a uma opção ausente. Argumentos
repetidos, desconhecidos ou sem valor e variáveis `PASSA_` desconhecidas são
recusados. Valores numéricos devem ser inteiros decimais positivos dentro do
limite indicado; a inicialização não tenta corrigir valores inválidos.

Por exemplo, para substituir apenas a porta do `.env`:

```sh
npm run start:backend -- --port 9443
```

Esse comando inicia o servidor e pode preparar pastas e identidade; não é uma
validação sem efeitos no disco. Em uma instalação nova, a lista de peers fica
vazia até que um pareamento seja concluído. Uma chamada comum de navegador não
consegue acessar `/health`, pois a rota exige certificado de peer confiável.

## Opções

### Rede e pastas

| Variável / argumento | Padrão | Uso e restrições |
| --- | --- | --- |
| `PASSA_HOST` / `--host` | `127.0.0.1` | IP literal de escuta, IPv4 ou IPv6, sem DNS nem identificador de zona. `0.0.0.0` permite escuta nas interfaces IPv4; isso não dispensa mTLS. |
| `PASSA_PORT` / `--port` | `8443` | Porta HTTPS de 1 a 65535. |
| `PASSA_ROOT` / `--root` | Nova pasta no diretório do usuário | Quando explícita, exige caminho absoluto de uma pasta existente. Sem valor configurado, cria `passa-arquivo`, `passa-arquivo(2)`, etc., usando o primeiro nome livre sem alterar pastas existentes. |
| `PASSA_STATE_DIR` / `--state-dir` | `<repositório>/model/peer` | Área privada da identidade, índice CSV e pastas de peers `01` a `99`. |
| `PASSA_STAGING_DIR` / `--staging-dir` | `<repositório>/tmp` | Área privada para preparar uploads e cópias; permanece entre reinícios. |

Por exemplo, no Linux, uma raiz automática pode ser
`/home/arthur/passa-arquivo`. Para reutilizar uma raiz já existente, informe
seu caminho absoluto em `PASSA_ROOT`; omitir a opção procura um novo nome livre
a cada inicialização. Estado e staging continuam nos mesmos locais configurados.

### Certificados

TLS protege a conexão. O certificado é público; a chave privada demonstra a
posse da identidade e não deve ser enviada à GUI ou a outro dispositivo.

| Variável / argumento | Padrão | Uso e restrições |
| --- | --- | --- |
| `PASSA_TLS_MODE` / `--tls-mode` | `self-signed` | Aceita somente `self-signed` ou `provided`. |
| `PASSA_TLS_CERT_FILE` / `--tls-cert-file` | `<state-dir>/tls/server.crt` em `self-signed` | Caminho absoluto que deve coincidir com esse arquivo da identidade persistida. Obrigatório em `provided`. |
| `PASSA_TLS_KEY_FILE` / `--tls-key-file` | `<state-dir>/tls/server.key` em `self-signed` | Caminho absoluto que deve coincidir com esse arquivo da identidade persistida. Obrigatório em `provided`. |

`self-signed` prepara uma identidade quando o estado é novo. Uma pasta `tls`
incompleta ou uma identidade inválida não autoriza regeneração automática.
`provided` exige os dois arquivos já existentes; não aceita caminhos diferentes
dos arquivos em `state-dir/tls`. Nos dois modos, o model confere validade,
assinatura autoassinada e correspondência da chave. O perfil gerado está em
[Dispositivos conhecidos](peers.md).

Os certificados confiáveis dos peers vêm do índice persistido. O IP não é uma
identidade fixa e não é necessário incluí-lo no certificado gerado. O transporte
entre peers confere o certificado esperado, além da validação TLS.

### Limites e encerramento

| Variável / argumento | Padrão | Uso |
| --- | --- | --- |
| `PASSA_UPLOAD_MAX_BYTES` / `--upload-max-bytes` | `1073741824` (1 GiB) | Limite dos bytes do arquivo recebido, sem contar os separadores multipart. |
| `PASSA_JSON_MAX_BYTES` / `--json-max-bytes` | `16384` (16 KiB) | Limite dos corpos JSON. |
| `PASSA_ZIP_MAX_ENTRIES` / `--zip-max-entries` | `10000` | Arquivos e pastas descendentes, inclusive vazias; não conta a pasta solicitada. |
| `PASSA_ZIP_MAX_BYTES` / `--zip-max-bytes` | `10737418240` (10 GiB) | Bytes lidos dos arquivos antes da compressão. |
| `PASSA_SHUTDOWN_TIMEOUT_MS` / `--shutdown-timeout-ms` | `10000` (10 segundos) | Prazo para encerrar conexões abertas após SIGINT ou SIGTERM; máximo de 2147483647 ms. |

Os demais limites numéricos têm como teto `Number.MAX_SAFE_INTEGER`.
Eles não garantem, sozinhos, disponibilidade de memória, disco ou processamento.

## Regras dos caminhos de configuração

Os caminhos locais são absolutos e seguem o sistema operacional. Isso difere
dos caminhos relativos usados nas rotas da API. A inicialização resolve a
localização física e recusa sobreposição da raiz com o repositório, o estado
ou o staging. Estado e staging também não podem conter um ao outro.

Somente `model/peer` e `tmp` podem ser usados como áreas privadas dentro do
repositório. No Linux, essas áreas são preparadas com permissão `0700` e os
arquivos privados com `0600`. Outros diretórios privados existentes precisam
ter as permissões e o dono conferidos pelo model. No Windows, o model usa
Windows PowerShell 5.1 para criar e conferir ACLs privadas em disco local NTFS.
Ausência desse recurso, dono diferente ou permissões amplas impedem a operação.
A execução nativa ainda precisa ser validada.
Veja [Arquivos e pastas](filesystem.md) e [Linux e Windows](platforms.md).

## Opções ainda sem integração

`PASSA_TLS_SANS`, `PASSA_TOKENS_FILE` e `PASSA_CORS_ORIGINS`, assim como os
argumentos correspondentes, são reconhecidos como opções antigas e recusados
com erro de configuração. Não há arquivo de tokens em uso, política CORS
implementada ou substituição de mTLS por um token.

A descoberta usa a entrada temporária na porta 8444 e só abre por chamada local
a `openDiscovery`. Seu controle e o aceite humano ainda não estão ligados à GUI.
Os limites e as mensagens estão em [Conectar dispositivos](connection.md).
Não existe configuração que abra essa entrada automaticamente no início.
