# Erros e validação

A configuração já pode apontar erros no terminal. A API ainda não recebe
requisições; as respostas HTTP abaixo descrevem o funcionamento esperado.
Os nomes dos erros e alguns detalhes de validação ainda podem mudar.

## Erros de configuração no terminal

`ConfigurationError`, em [src/config/index.ts](../src/config/index.ts), representa
problemas nos argumentos e nas variáveis de ambiente. Sua mensagem é `Configuração inválida.`;
`issues` contém uma lista de objetos `{ option: string, message: string }`, sem
valores fornecidos. Cada opção reconhecida usa seu nome de argumento; nomes
arbitrários desconhecidos são substituídos por `arguments` ou `environment`.
As mensagens mostram qual opção corrigir, sem repetir o conteúdo informado.

O comando [check:config](../src/check-config.ts) escreve os problemas na saída de
erros do terminal (`stderr`). O código de saída permite que outros programas
saibam o resultado: **0** significa opções válidas, **2** significa configuração
inválida e **1** significa falha inesperada, acompanhada de uma mensagem genérica.

Esse comando confere os valores e as combinações de opções. Ele não lê pastas,
tokens ou certificados, não imprime a configuração completa e não envia
respostas HTTP.

## Formato das respostas HTTP de erro

Os erros da API usarão um objeto JSON chamado *Problem Details*. O cabeçalho
`Content-Type: application/problem+json` permite ao cliente reconhecer esse
formato.

O status HTTP e o campo `status` terão o mesmo número. Por exemplo, um arquivo
ausente retornará HTTP `404` e `"status": 404` no corpo.

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `type` | string identificadora URI | Sim | Identificador estável. `urn:passa-arquivo:problem:<code>`; não é uma URL de documentação existente. |
| `title` | string | Sim | Descrição curta e estável da categoria. |
| `status` | integer | Sim | Código HTTP efetivo. |
| `detail` | string | Sim | Explicação da ocorrência, sem segredo nem localização absoluta do servidor. |
| `code` | string | Sim | Código estável da aplicação do catálogo abaixo. |
| `errors` | array de objetos | Não | Somente quando houver falhas de campos úteis ao cliente; campos descritos abaixo. |

A resposta não mostrará tokens, chaves privadas, cabeçalhos de autenticação,
caminhos absolutos do servidor nem a lista de chamadas internas que levou ao
erro (*stack trace*). Mensagens de bibliotecas e do sistema operacional serão
traduzidas para uma explicação segura. Um caminho relativo poderá aparecer
quando ajudar a entender o problema.

```json
{
  "type": "urn:passa-arquivo:problem:entry_not_found",
  "title": "Entrada não encontrada",
  "status": 404,
  "detail": "A entrada solicitada não existe.",
  "code": "entry_not_found"
}
```

### Quando um campo está errado

O array `errors` poderá indicar exatamente o campo que precisa de correção.
Cada item terá três campos obrigatórios: `location` (`query`, `body` ou
`headers`), `field` (nome ou caminho do campo) e `message` (explicação do erro).
O valor rejeitado não será incluído por padrão. Credenciais nunca aparecerão
nessa lista; erros de autenticação usarão apenas a resposta geral.

```json
{
  "type": "urn:passa-arquivo:problem:validation_failed",
  "title": "Validação da requisição falhou",
  "status": 422,
  "detail": "Informe name ou parentPath.",
  "code": "validation_failed",
  "errors": [
    {
      "location": "body",
      "field": "name",
      "message": "Pelo menos name ou parentPath deve ser informado."
    }
  ]
}
```

Os nomes deste guia descrevem os dados trocados pela API. Eles não indicam a
existência de classes ou tipos com esses nomes no código.

## Códigos de erro

| HTTP | `code` | `title` | Condições concretas |
| --- | --- | --- | --- |
| 400 | `malformed_request` | Requisição malformada | JSON inválido ou ausente quando obrigatório; estrutura multipart inválida, incluindo boundary ausente; corpo em rota que não aceita corpo; codificação de URL inválida quando detectada pelo parser. |
| 400 | `invalid_path` | Caminho inválido | Caminho presente com string vazia, NUL, separadores repetidos/finais, segmento `.` interno, `\` ou sintaxe não suportada, após a decodificação apropriada. Formatos reconhecidos como absolutos têm precedência como `path_forbidden`. |
| 403 | `path_forbidden` | Caminho proibido | Caminho absoluto, segmento `..`, escape da raiz ou tentativa identificável de atingir estado privado/interno. |
| 403 | `entry_forbidden` | Operação proibida sobre a entrada | Symlink direto, intermediário ou encontrado em árvore; entrada especial; excluir/mover/renomear/copiar a raiz. Arquivo com mais de um hard link detectável (`nlink > 1`), conforme [arquivos e pastas](filesystem.md). |
| 404 | `entry_not_found` | Entrada não encontrada | Entrada de origem ausente, diretório consultado ausente, ou diretório pai necessário inexistente nas operações que não o criam. |
| 409 | `entry_conflict` | Conflito de entrada | Destino existente sem sobrescrita permitida; incompatibilidade entre arquivo/diretório; componente intermediário que não é diretório; tentativa de substituir ou mesclar diretórios. Ter conteúdo não impede a exclusão de uma pasta. |
| 409 | `cross_device_operation` | Operação entre filesystems não suportada | `EXDEV` ou incompatibilidade identificada de filesystem impede movimentação/publicação com as garantias adotadas; não contornar silenciosamente por cópia seguida de exclusão. Travessia detectada para dispositivo diferente, sem prometer detecção completa de montagens, conforme [arquivos e pastas](filesystem.md). |
| 413 | `payload_too_large` | Limite de tamanho excedido | Arquivo de upload excede o limite configurado. Corpo JSON excede `PASSA_JSON_MAX_BYTES`; ZIP excede volume não comprimido ou quantidade de entradas permitidos, detectado antes de enviar os headers de sucesso. |
| 415 | `unsupported_media_type` | Tipo de mídia não suportado | Endpoint JSON recebe Content-Type ausente/incompatível; upload recebe tipo diferente de multipart/form-data. Falha na estrutura de um multipart declarado pertence a `malformed_request`. |
| 422 | `validation_failed` | Validação da requisição falhou | JSON válido com campos ou tipos incorretos; campo obrigatório ausente; campo desconhecido; `null` indevido; query duplicada/desconhecida/estruturada; booleano fora do contrato; multipart com parte ausente, extra ou campo inesperado; `PATCH` sem name/parentPath; nome inválido; cópia da mesma entrada; mover/copiar diretório para descendente. |
| 500 | `internal_error` | Erro interno | Falha inesperada sem tradução segura mais específica, inclusive erro operacional de infraestrutura ainda não classificado. A resposta não fornece detalhes internos. |

Não há resposta `503` definida. As respostas para uma rota desconhecida ou um
método não aceito também ainda estão em definição.

## Exemplos de erros

O código depende do problema encontrado. Esquecer o campo `path` é diferente
de informar um caminho proibido ou de pedir um arquivo que não existe.

| Requisição ou situação | Resposta esperada | Motivo |
| --- | --- | --- |
| Certificado ausente ou não confiável no serviço de arquivos | Conexão TLS recusada; pode não haver resposta HTTP | A identidade do peer precisa ser conferida antes de acessar arquivos. |
| `GET /api/v2/entries` sem `path` | 422 `validation_failed` | Campo obrigatório ausente. |
| `GET /api/v2/entries?path=` | 400 `invalid_path` | Campo existe, mas caminho vazio tem sintaxe inválida. |
| `GET /api/v2/directories/entries` sem `path` | 200 se a operação tiver sucesso | Padrão documentado é `.`. |
| `path=a%2F..%2Fb` em query | 403 `path_forbidden` | A única decodificação normal produz segmento `..`. |
| `path=a%252Fb` em query | Tratar como nome literal `a%2Fb`, sujeito às outras regras | Não decodificar `%2F` novamente. |
| `path=a//b`, `path=a/` ou `path=a/./b` | 400 `invalid_path` | Formas ambíguas recusadas pelas regras de caminho. |
| `path=%2Fetc%2Fpasswd` | 403 `path_forbidden` | Caminho absoluto após decodificação. |
| `DELETE` com query `recursive`, inclusive `true` ou `false` | 422 `validation_failed` | Parâmetro desconhecido; a exclusão de pastas já inclui seu conteúdo. |
| `DELETE` de pasta com conteúdo, apenas com `path` | 204 se a operação tiver sucesso | Não é necessária opção adicional para percorrer e excluir o conteúdo. |
| JSON com `"overwrite": "false"` | 422 `validation_failed` | String não equivale a booleano JSON. |
| `PATCH` com `{}` ou somente `overwrite` | 422 `validation_failed` | Deve informar `name` ou `parentPath`. |
| `PATCH` com `"name": null` | 422 `validation_failed` | `null` não é omissão. |
| `PATCH` com `"name": "a/b"` | 422 `validation_failed` | Nome não pode conter separador. |
| `POST archive` com `{}` | Válido estruturalmente | `path` assume `.`. |
| `POST archive` sem bytes de corpo, com tipo JSON | 400 `malformed_request` | Corpo JSON válido é obrigatório. |
| `POST archive` com `null` | 422 `validation_failed` | JSON é válido, mas não é objeto. |
| `PUT files` sobre diretório ou raiz | 409 `entry_conflict` | O destino não é arquivo regular substituível. |
| `DELETE` da raiz | 403 `entry_forbidden` | Operação expressamente proibida sobre a raiz. |
| Download da raiz | 409 `entry_conflict` | Endpoint exige arquivo regular. |
| Symlink entre filhos da listagem | 403 `entry_forbidden` | A listagem falha inteira, sem esconder a entrada proibida. |
| `PATCH` calcula caminho final igual ao atual | 200 com metadados | Contrato exige no-op bem-sucedido. |
| Cópia tem origem e destino correspondentes à mesma entrada | 422 `validation_failed` | Contrato proíbe essa cópia, mesmo com overwrite. |
| Segunda exclusão após sucesso, entrada continua ausente | 404 `entry_not_found` | Idempotência do efeito não exige repetir o mesmo status. |

Os exemplos HTTP pressupõem uma conexão mTLS autenticada com um peer conhecido.
A linha sobre certificado descreve uma falha anterior ao HTTP. Se vários campos
estiverem errados, a ordem das validações ainda precisa ser definida. Caminhos
com `..` serão recusados sem tentar corrigi-los primeiro.

Erros do sistema operacional dependem do contexto. `ENOENT` significa que algo
não foi encontrado: se for o arquivo pedido, a resposta poderá ser `404`; se for
uma pasta interna necessária ao servidor, poderá ser `500`. `ENOTDIR` indica
que uma parte do caminho é um arquivo onde se esperava uma pasta. `EXDEV`
indica uma operação incompatível entre sistemas de arquivos; o servidor não
tentará contorná-la copiando e apagando a origem.

As permissões locais de Linux ou Windows também podem impedir uma operação.
O certificado identifica o peer, mas não muda as permissões do processo no
sistema operacional nem permite sair da raiz compartilhada.

## Pareamento, TLS e HTTP

Um certificado recusado durante o handshake pode impedir que exista qualquer
requisição HTTP. Nesse caso, o cliente recebe uma falha de conexão; a API não
promete um JSON `401` ou `403`. `WWW-Authenticate: Bearer` não faz parte da
identidade dos peers.

Depois de autenticar o peer, uma operação proibida sobre arquivos pode retornar
`403`, e parâmetros incorretos podem retornar os erros da tabela. A proteção do
controle local tem contrato próprio ainda em definição.

O pareamento deverá distinguir pedido recusado, código incorreto, expiração,
excesso de tentativas, descoberta encerrada, troca de certificado e falha ao
salvar a confiança. Nomes de códigos e respostas HTTP desses casos ainda serão
fechados com o [contrato de conexão](connection.md). Uma falha não pode revelar o
código esperado, a chave privada ou a lista de peers.

Uma falha de gravação em um dos dispositivos não permite anunciar confirmação
bilateral concluída. O tratamento de repetição e recuperação está descrito em
[Dispositivos conhecidos](peers.md).

CORS não resolve falhas de mTLS: o handshake acontece antes do preflight HTTP.
Respostas `204`, quando aplicáveis, continuam sem corpo.

## Transferência já iniciada

Antes de enviar headers, uma falha conhecida pode produzir o problema JSON correspondente. Depois de enviar headers/bytes de download ou ZIP, não é possível trocar retroativamente o status de sucesso ou concatenar um JSON de erro ao arquivo.

Nessa situação, o servidor precisará:

1. Interromper a transferência e fechar os recursos usados por ela.
2. Cancelar a leitura, escrita ou compactação quando o mecanismo usado permitir.
3. Remover os temporários da operação, preservando a origem e o destino anterior.
4. Registrar o erro sem expor tokens, chaves ou detalhes internos ao cliente.

O cliente pode receber um arquivo parcial ou detectar falha de transporte; não há garantia de um segundo status HTTP ou de recuperação automática. A mesma regra vale quando um limite de ZIP é identificado após os headers.

Upload interrompido **antes da publicação** preserva o arquivo anterior e exige remoção dos arquivos temporários da operação. Se a conexão desaparecer **depois da publicação**, a falta da resposta não significa que a alteração não foi feita. O cliente pode consultar o destino ou repetir o `PUT`; não existe acompanhamento remoto de operações.

Exclusão recursiva e criação de pais podem falhar parcialmente. O erro deve refletir a falha sem prometer desfazer alterações já realizadas; as garantias por operação constam em [filesystem.md](filesystem.md).

## Quando o servidor não consegue iniciar

Configuração inválida, certificado ou chave incorretos, problemas nas pastas
privadas ou falha ao abrir a porta impedirão a inicialização. Como ainda não há
conexão aberta com o cliente, o erro aparecerá no terminal, sem segredos, e não
como uma resposta HTTP.

O servidor não iniciará em HTTP para contornar um problema de HTTPS e não
encerrará outro processo para liberar a porta.
