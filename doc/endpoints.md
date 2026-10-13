# Rotas da API

A API ainda não recebe requisições. Este guia explica como cada rota deverá
funcionar: o que enviar, qual resposta esperar e quais erros podem acontecer.
Os nomes dos códigos de erro e alguns detalhes de validação e de resposta ainda
podem mudar durante o desenvolvimento.

Uma rota, também chamada de endpoint, combina um método HTTP com um endereço.
Por exemplo, `GET /api/v2/files` servirá para baixar um arquivo e
`PUT /api/v2/files` para enviá-lo.

Nos exemplos, **query** é a parte da URL depois de `?`, **headers** são os
cabeçalhos com informações como o tipo do conteúdo, e **corpo** é o conteúdo
enviado junto da requisição. Consulte também as regras de
[arquivos e pastas](filesystem.md), [segurança](security.md) e [erros](errors.md).

## Regras comuns

- Todas as conexões usarão HTTPS, com TLS 1.2 ou superior. Não haverá modo HTTP.
- As dez rotas de arquivos e saúde descritas abaixo exigirão uma conexão mTLS
  com um peer cuja confiança bilateral esteja concluída. Certificados
  desconhecidos só poderão participar do pareamento restrito, nunca dessas rotas.
  Falhas TLS podem impedir a conexão antes de haver uma resposta HTTP.
- Os caminhos dos arquivos serão informados na query ou no corpo, conforme a
  rota. Parâmetros de query repetidos, desconhecidos ou enviados como arrays ou
  objetos retornarão `422 validation_failed`. Cabeçalhos HTTP comuns continuarão
  permitidos.
- Os nomes dos campos JSON usarão camelCase, como `parentPath`. Campos
  desconhecidos, arrays, valores simples e `null` não serão aceitos onde se espera
  um objeto. JSON inválido ou ausente quando obrigatório retornará
  `400 malformed_request`; campos com tipos ou valores incorretos retornarão
  `422 validation_failed`.
- Enviar um corpo para uma rota que não o aceita retornará `400 malformed_request`.
  Um corpo de zero bytes contará como ausente e não exigirá `Content-Type`.
- Requisições com corpo precisarão de `Content-Type`. JSON usará `application/json`,
  com `charset=UTF-8` opcional; upload usará `multipart/form-data`. Tipo incompatível
  retornará `415 unsupported_media_type`. No multipart, o cliente gera um
  separador chamado `boundary`; ausência dele ou estrutura inválida retornará
  `400 malformed_request`.
- Um corpo JSON maior que `PASSA_JSON_MAX_BYTES` retornará `413 payload_too_large`.
  O limite está em [configuração](configuration.md).
- Respostas JSON de sucesso usarão `application/json`; erros usarão
  `application/problem+json`. Respostas `204` não terão corpo, nem mesmo `null`.
- Ao criar um arquivo ou pasta, `Location` indicará onde consultar seus metadados:
  `/api/v2/entries?path=documentos%2Fnota.txt`, por exemplo. Esse endereço não
  revelará a localização absoluta no servidor.
- CORS não substitui mTLS. O acesso de uma interface local ao módulo é separado
  das conexões entre peers e ainda precisa de contrato próprio. Uma consulta
  prévia do navegador não ultrapassa uma exigência de certificado no TLS.
- Downloads não garantem o cabeçalho `Content-Length`. Downloads parciais com
  Range, ETags, paginação, tarefas em segundo plano e compatibilidade com versões
  anteriores da API ficam fora do escopo inicial.
- Durante envio, cópia e movimentação, a aplicação não deverá impor bloqueios
  que impeçam outros programas de ler ou editar os arquivos envolvidos.
  Isso não contorna restrições do sistema operacional nem garante uma versão
  fixa do conteúdo. `overwrite` controla a substituição de um destino existente,
  não o acesso simultâneo. Veja [concorrência e limites](filesystem.md#operações-ao-mesmo-tempo-e-falhas-parciais).

### Caminho relativo: `RelativePath`

`RelativePath` é o nome usado neste guia para um caminho dentro da pasta
compartilhada. Use `/` para separar pastas e `.` para indicar a própria pasta
compartilhada. Por exemplo: `documentos/nota.txt`.

Espaços no nome serão preservados. Na query, a codificação da URL será desfeita
uma única vez: `%2F` vira `/`, mas `%252F` vira o texto literal `%2F`. Caminhos
recebidos em JSON não passarão por essa conversão.

Caminhos absolutos, como `/etc/passwd`, e segmentos `..` serão recusados com
`403 path_forbidden`. Isso também vale para caminhos absolutos de Windows,
incluindo letras de unidade e caminhos de rede UNC.

Caminho vazio, caractere nulo (NUL), barras repetidas ou no fim, `.` no meio do
caminho e barra invertida (`\`) retornarão `400 invalid_path`. Se a barra
invertida fizer parte de um caminho absoluto reconhecido, prevalecerá o `403`.

Links simbólicos e entradas que não sejam arquivos comuns ou pastas retornarão
`403 entry_forbidden`. O tratamento de arquivos com vários hard links
(`nlink > 1`) e de caminhos que atravessam dispositivos ainda está em definição:
os erros considerados são `403 entry_forbidden` e `409 cross_device_operation`,
respectivamente. Veja os exemplos e os limites em [arquivos e pastas](filesystem.md).

Campo obrigatório ausente é `422 validation_failed`; campo presente com sintaxe de caminho inválida é `400 invalid_path`. Um parâmetro opcional usa seu padrão somente quando omitido, nunca quando contém `""` ou `null`.

### Informações de arquivos e pastas: `EntryMetadata`

Metadados são informações sobre um arquivo ou pasta, como nome e tamanho.
`EntryMetadata` é o nome dado ao objeto JSON abaixo; ainda não existe um tipo
TypeScript com esse nome no código.

| Campo | Tipo JSON | Obrigatoriedade/padrão | Significado e restrições |
| --- | --- | --- | --- |
| `name` | string | Sempre presente; sem padrão | Nome da entrada, sem caminho pai. Para a raiz, `"."`. |
| `path` | string (`RelativePath`) | Sempre presente; sem padrão | Caminho relativo; raiz `"."`; nunca caminho absoluto local. |
| `type` | string enum | Sempre presente; sem padrão | Somente `"file"` ou `"directory"`. |
| `size` | integer ou null | Sempre presente; sem padrão | Arquivo: quantidade não negativa de bytes. Diretório: `null`, sem somar o conteúdo das subpastas. |
| `modifiedAt` | string temporal | Sempre presente; sem padrão | Instante UTC padronizado. RFC 3339/ISO 8601 com sufixo `Z` e milissegundos. |

Exemplo de resposta de arquivo:

```json
{
  "name": "nota.txt",
  "path": "documentos/nota.txt",
  "type": "file",
  "size": 123,
  "modifiedAt": "2026-09-05T12:00:00.000Z"
}
```

Exemplo de metadados da raiz, usando `.` como nome:

```json
{
  "name": ".",
  "path": ".",
  "type": "directory",
  "size": null,
  "modifiedAt": "2026-09-05T12:00:00.000Z"
}
```

### Erros que várias rotas podem retornar

Todas as rotas poderão retornar `400 malformed_request`,
`422 validation_failed` e `500 internal_error`,
conforme o problema encontrado. As que recebem caminhos também poderão retornar
`400 invalid_path`, `403 path_forbidden`, `403 entry_forbidden` e
`409 cross_device_operation` quando detectarem travessia entre dispositivos.

Rotas com corpo poderão retornar `415 unsupported_media_type`. Nas que recebem
JSON, ultrapassar o limite do corpo retornará `413 payload_too_large`. Cada rota
lista abaixo os erros específicos da operação. O significado dos códigos está
no guia de [erros](errors.md).

### Como ler os exemplos

Os comandos abaixo ilustram chamadas depois do pareamento. Eles não realizam
busca, confirmação por código ou registro de confiança.

`LOCAL_CERT` e `LOCAL_KEY` representam o certificado e a chave privada do cliente;
`PEER_CERT`, o certificado público de destino já confirmado. São caminhos locais
do cliente. A chave privada não é enviada como arquivo ao peer: o TLS usa-a para
provar sua posse.

```sh
BASE_URL='https://dispositivo-b:8443'
LOCAL_CERT='/caminho/privado/certificado-local.pem'
LOCAL_KEY='/caminho/privado/chave-local.pem'
PEER_CERT='/caminho/privado/certificado-confirmado-de-b.pem'
```

Estes exemplos usam sintaxe de shell Linux e exigem que o nome da URL seja
compatível com o certificado. A identidade persistente quando o IP muda exige
o cliente P2P e o perfil de verificação descritos em [Segurança](security.md).
`--cacert` por si só não implementa todo esse protocolo. Não use `--insecure`
para contornar uma falha. Não há comando equivalente de produção verificado
em Windows; o suporte nativo continua requisito do projeto.

Os valores de query usam codificação de URL: espaço pode ser `%20`, e um sinal
`+` literal deve ser `%2B`.

## Descoberta e pareamento: `/connect`

O nome é provisório. A descoberta é ativada pelos usuários de ambos os
computadores e encerrada ao fim da busca. `/connect` não faz parte das dez
operações de arquivos abaixo: seu papel é encontrar candidatos e iniciar o
pareamento, sem liberar acesso a arquivos.

O [guia de conexão](connection.md) descreve os parâmetros de IP/rede, o pedido
com certificado, o código entregue fora do canal e a persistência bilateral.
A recomendação de método é `POST` para iniciar ações, mas divisão das rotas,
esquemas e respostas ainda precisam ser fechados. Não há endpoint executável.

## E01 — Verificar se o servidor responde

**GET /health**

Confere se o servidor responde. Não lê nem altera arquivos.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Conexão TLS | Certificado do peer e prova de posse da chave | Sim | Confiança bilateral concluída. |
| Rota/query/corpo | Ausentes | Não aplicável | Não recebe parâmetros nem corpo. |

**Content-Type aceito:** não aplicável, sem corpo. **Resposta:** `200 application/json`, objeto `{ "status": "ok" }`; `status` é literal obrigatório `"ok"`, sem outros campos. Não expõe configuração, segredos ou caminhos privados. Não verifica nem afirma disponibilidade de todas as operações de arquivos.

**Erros possíveis:** os erros comuns de requisição e autenticação. Não há erro
específico de arquivo nem resposta `503` definida para essa rota.

**Como funciona:** responde à consulta sem acessar ou alterar arquivos.
Repetir a chamada faz uma nova consulta básica ao servidor.

**Exemplo de requisição:**

```sh
curl --cacert "$PEER_CERT" --cert "$LOCAL_CERT" --key "$LOCAL_KEY" \
  "$BASE_URL/health"
```

### Exemplo de uso

Você confirma que o dispositivo conhecido respondeu à consulta básica de saúde.

## E02 — Consultar informações de um arquivo ou pasta

**GET /api/v2/entries**

Consulta as informações do arquivo ou pasta indicado em `path`.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Query: `path` | `RelativePath` | Sim; sem padrão | Entrada existente; `.` permitido. |
| Conexão TLS | Certificado do peer e prova de posse da chave | Sim | Confiança bilateral concluída. |
| Rota/corpo | Ausentes | Não aplicável | Não recebe corpo. |

**Content-Type aceito:** não aplicável. **Resposta:** `200 application/json` com
o objeto `EntryMetadata` diretamente, sem um campo externo envolvendo a resposta.

**Erros possíveis:** compartilhados de caminhos; `404 entry_not_found` se a entrada ou um componente necessário não existir; `409 entry_conflict` se um componente intermediário for arquivo em vez de diretório.

**Como funciona:** aceita arquivos comuns, pastas e a raiz compartilhada, mas
não links simbólicos. Apenas consulta as informações. Se outro programa alterar
a entrada entre chamadas, a próxima resposta poderá trazer dados diferentes.

**Exemplo de requisição:**

```sh
curl --cacert "$PEER_CERT" --cert "$LOCAL_CERT" --key "$LOCAL_KEY" \
  --get --data-urlencode 'path=documentos/nota.txt' \
  "$BASE_URL/api/v2/entries"
```

### Exemplo de uso

Você escolhe um arquivo e consulta seu nome, tamanho e data de modificação.

## E03 — Listar o conteúdo de uma pasta

**GET /api/v2/directories/entries**

Lista os arquivos e as pastas que estão diretamente dentro da pasta indicada.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Query: `path` | `RelativePath` | Não; `"."` | Deve identificar diretório existente. |
| Conexão TLS | Certificado do peer e prova de posse da chave | Sim | Confiança bilateral concluída. |
| Rota/corpo | Ausentes | Não aplicável | Não recebe corpo. |

**Content-Type aceito:** não aplicável. **Resposta:** `200 application/json`, objeto com `path: RelativePath` e `entries: EntryMetadata[]`, ambos obrigatórios. Cada `entries[i].path` permanece relativo à raiz compartilhada, não ao diretório listado. Diretório vazio produz `entries: []`.

```json
{ "path": "documentos", "entries": [] }
```

As pastas aparecerão antes dos arquivos. Dentro de cada grupo, a ordenação
considerada compara os bytes UTF-8 dos nomes: diferencia maiúsculas de minúsculas
e não depende do idioma do servidor nem transforma caracteres Unicode
equivalentes. Esse detalhe ainda pode mudar. A listagem não terá paginação e não
percorrerá subpastas.

**Erros possíveis:** compartilhados de caminhos; `404 entry_not_found` para diretório ausente; `409 entry_conflict` se `path` for arquivo ou componente intermediário incompatível. Link simbólico ou entrada especial entre os filhos examinados faz a listagem inteira falhar com `403 entry_forbidden`, sem ocultar seletivamente a entrada.

**Como funciona:** aceita uma pasta ou a raiz compartilhada; não aceita um
arquivo como pasta a listar. Não altera seu conteúdo. Configuração, credenciais
e arquivos temporários ficam fora da listagem. Se outro programa mudar a pasta
durante a consulta, o resultado não terá garantia de representar um único
instante.

**Exemplo de requisição:**

```sh
curl --cacert "$PEER_CERT" --cert "$LOCAL_CERT" --key "$LOCAL_KEY" \
  --get --data-urlencode 'path=documentos' \
  "$BASE_URL/api/v2/directories/entries"
```

### Exemplo de uso

Você seleciona a pasta documentos e recebe a lista do que existe diretamente dentro dela.

## E04 — Baixar um arquivo

**GET /api/v2/files**

Baixa o conteúdo do arquivo indicado em `path`.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Query: `path` | `RelativePath` | Sim; sem padrão | Arquivo regular existente. |
| Conexão TLS | Certificado do peer e prova de posse da chave | Sim | Confiança bilateral concluída. |
| Rota/corpo | Ausentes | Não aplicável | Não recebe corpo. |

**Content-Type aceito:** não aplicável. **Resposta:** `200`, com o conteúdo do
arquivo e o tipo correspondente; se o tipo não for conhecido, será
`application/octet-stream`. O cabeçalho `Content-Disposition` usará `attachment`
e um nome protegido contra caracteres que alterem os cabeçalhos. `filename*`
permitirá nomes Unicode, como nomes com acentos. O conteúdo não será envolvido
em JSON nem compactado, e o arquivo não será carregado inteiro na memória.

**Erros possíveis:** compartilhados de caminhos; `404 entry_not_found` para arquivo ausente; `409 entry_conflict` para diretório, inclusive raiz, ou intermediário incompatível. Falha após os headers interrompe a transferência; não troca o corpo por JSON de erro, conforme [errors.md](errors.md#transferência-já-iniciada).

**Como funciona:** lê somente arquivos comuns e não grava um destino no servidor.
Cada chamada lê o conteúdo disponível naquele momento. Se outro programa alterar
o arquivo durante a leitura, o download não terá garantia de conter uma versão
fixa dele.

**Exemplo de requisição:** grava a resposta no diretório atual do cliente.

```sh
curl --cacert "$PEER_CERT" --cert "$LOCAL_CERT" --key "$LOCAL_KEY" \
  --get --data-urlencode 'path=documentos/nota.txt' \
  --output 'nota-baixada.txt' "$BASE_URL/api/v2/files"
```

### Exemplo de uso

Você baixa o conteúdo de nota.txt para o seu computador.

## E05 — Enviar ou substituir um arquivo

**PUT /api/v2/files**

Envia um arquivo para o caminho completo escolhido pelo cliente.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Query: `path` | `RelativePath` | Sim; sem padrão | Destino final completo; pai deve existir como diretório. |
| Conexão TLS | Certificado do peer e prova de posse da chave | Sim | Confiança bilateral concluída. |
| Headers: `Content-Type` | string | Sim; sem padrão | `multipart/form-data; boundary=...`, gerado pelo cliente. |
| Corpo multipart: `file` | Parte de arquivo binária | Sim; exatamente uma | Conteúdo sujeito ao limite configurável; nome multipart não escolhe o destino. |
| Rota/outros campos do corpo | Ausentes | Não aplicável | Nenhum campo textual ou segundo arquivo permitido. |

**Content-Type aceito:** `multipart/form-data`. O MIME declarado pela parte não estabelece o destino nem concede permissões adicionais. Arquivo de zero bytes é válido dentro do limite; ausência da parte não equivale a arquivo vazio.

**Resposta:** arquivo novo: `201 application/json`, com `EntryMetadata` e o
cabeçalho `Location`. Substituição de um arquivo existente: `204`, sem corpo.
O limite configurado por `PASSA_UPLOAD_MAX_BYTES` tem padrão de 1 GiB
(1.073.741.824 bytes). A opção já é validada, mas a recepção do upload ainda
não existe. Veja [configuração](configuration.md).

**Erros possíveis:** compartilhados de caminhos/corpos; `404 entry_not_found` para pai ausente; `409 entry_conflict` para destino diretório, inclusive raiz, ou intermediário não diretório; `413 payload_too_large` ao exceder limite; `422 validation_failed` para campo inesperado, parte ausente ou quantidade de arquivos diferente de um; `400 malformed_request` para estrutura multipart inválida; `409 cross_device_operation` se a publicação não puder manter as garantias entre filesystems.

**Como funciona:** a pasta de destino precisa existir. O servidor receberá o
arquivo aos poucos (*streaming*) e o guardará em uma área temporária privada
(*staging*). Só depois de receber e conferir tudo colocará o arquivo no destino
final; essa passagem é chamada de publicação.

O programa que envia o arquivo também deverá permitir sua leitura e edição por
outros programas, respeitando o sistema operacional. Se houver edições durante
a leitura, os bytes enviados podem não representar uma única versão do arquivo.
Um destino já existente continua sujeito a alterações externas enquanto o upload
é preparado; a publicação substituirá o arquivo pelo conteúdo recebido, podendo
substituir também essas edições. Um arquivo novo só ficará disponível no destino
depois da publicação.

Se o envio falhar ou a conexão cair antes da publicação, o arquivo anterior será
preservado e os temporários da operação serão removidos. Não há opção `overwrite`
nessa rota: enviar um arquivo para um caminho já ocupado por outro arquivo
substituirá seu conteúdo.

Enviar novamente o mesmo arquivo manterá o conteúdo pedido: a primeira chamada
poderá retornar `201` e as seguintes, `204`. A data de modificação poderá mudar.
Se a resposta se perder depois de salvar o arquivo no destino, o upload não será
desfeito. O cliente poderá consultar os metadados ou repetir o `PUT`.

**Exemplo de requisição:** exige arquivo local `nota.txt` no cliente e diretório `documentos` já existente no servidor. O curl gera o boundary.

```sh
curl --cacert "$PEER_CERT" --cert "$LOCAL_CERT" --key "$LOCAL_KEY" \
  --request PUT --form 'file=@nota.txt' \
  "$BASE_URL/api/v2/files?path=documentos%2Fnota.txt"
```

No navegador, use `FormData` para montar o envio. Não defina `Content-Type`
manualmente: o navegador precisa acrescentar o separador `boundary` ao cabeçalho.

### Exemplo de uso

Você envia nota.txt para documentos/nota.txt; se já houver um arquivo ali, seu conteúdo é substituído depois que o envio termina com sucesso.

## E06 — Criar uma pasta

**PUT /api/v2/directories**

Cria a pasta indicada em `path`. Se ela já existe, mantém seu conteúdo.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Query: `path` | `RelativePath` | Sim; sem padrão | Diretório final; `.` permitido. |
| Conexão TLS | Certificado do peer e prova de posse da chave | Sim | Confiança bilateral concluída. |
| Rota/corpo | Ausentes | Não aplicável | Não recebe corpo. |

**Content-Type aceito:** não aplicável. **Resposta:** diretório novo: `201 application/json` com `EntryMetadata` e `Location`. Diretório já existente, inclusive `.`: `200 application/json` com `EntryMetadata` atual.

**Erros possíveis:** os erros comuns de caminhos; `409 entry_conflict` quando
houver um arquivo no destino ou no lugar de uma pasta intermediária;
`500 internal_error` para falhas inesperadas. Se a criação falhar depois de criar
algumas pastas, elas poderão permanecer. Veja [arquivos e pastas](filesystem.md).

**Como funciona:** cria os pais ausentes. Não transforma arquivo em diretório nem remove conteúdo existente. A raiz já preparada apenas tem seus metadados consultados. Repetição mantém o diretório e seus filhos, normalmente retornando `200` depois da primeira criação.

**Exemplo de requisição:**

```sh
curl --cacert "$PEER_CERT" --cert "$LOCAL_CERT" --key "$LOCAL_KEY" \
  --request PUT "$BASE_URL/api/v2/directories?path=documentos%2Fprojetos"
```

### Exemplo de uso

Você cria a pasta projetos dentro de documentos; repetir o pedido mantém tudo o que já estiver nela.

## E07 — Excluir um arquivo ou pasta

**DELETE /api/v2/entries**

Remove o arquivo ou pasta indicado em `path`, com ou sem conteúdo. Ao excluir
uma pasta, remove também seus arquivos e subpastas, sem opção adicional.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Query: `path` | `RelativePath` | Sim; sem padrão | Arquivo regular ou diretório; raiz proibida. |
| Conexão TLS | Certificado do peer e prova de posse da chave | Sim | Confiança bilateral concluída. |
| Rota/corpo | Ausentes | Não aplicável | Não recebe corpo. |

**Content-Type aceito:** não aplicável. **Resposta:** `204`, sem corpo e sem Content-Type de representação.

**Erros possíveis:** compartilhados de caminhos; `404 entry_not_found` para entrada ausente; `409 entry_conflict` para intermediário incompatível; `403 entry_forbidden` para a raiz e entradas proibidas encontradas na árvore. Uma pasta ter conteúdo não é motivo de conflito.

**Como funciona:** exclui arquivos regulares e pastas vazias ou com conteúdo.
A operação percorre subpastas automaticamente. A query aceita somente `path`;
`recursive` não faz parte do contrato e será rejeitado como parâmetro desconhecido
com `422 validation_failed`, qualquer que seja seu valor. As regras de acesso e
caminhos continuam valendo: não segue nem remove symlinks e nunca exclui a raiz
compartilhada. Não há lixeira. Uma falha durante a exclusão de uma árvore pode
deixar parte dela já removida, sem recuperação automática.

Se você repetir a exclusão e a entrada continuar ausente, receberá `404`. O efeito
final continuará o mesmo: o arquivo ou pasta não existe mais. Isso é a
idempotência de `DELETE`; ela não exige repetir o mesmo código de resposta.

**Exemplo de requisição:** remove o arquivo de exemplo.

```sh
curl --cacert "$PEER_CERT" --cert "$LOCAL_CERT" --key "$LOCAL_KEY" \
  --request DELETE \
  "$BASE_URL/api/v2/entries?path=documentos%2Fnota.txt"
```

### Exemplo de uso

Você apaga nota.txt informando seu caminho. Para apagar a pasta documentos com
tudo que ela contém, usa `DELETE /api/v2/entries?path=documentos`, sem parâmetro
adicional. As mesmas regras de proteção se aplicam aos itens dentro da pasta.

## E08 — Mover ou renomear

**PATCH /api/v2/entries**

Move um arquivo ou pasta mantendo seu nome, renomeia sem mover ou faz as duas
alterações no mesmo pedido. Mover não exige renomear.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Query: `path` | `RelativePath` | Sim; sem padrão | Origem existente; raiz proibida. |
| Conexão TLS | Certificado do peer e prova de posse da chave | Sim | Confiança bilateral concluída. |
| Headers: `Content-Type` | string | Sim; sem padrão | `application/json`, charset UTF-8 opcional. |
| Corpo: `name` | string | Não; mantém nome atual | Um nome válido, sem `/` nem `\`; rejeitar vazio, `.`, `..` e NUL; preservar espaços. |
| Corpo: `parentPath` | `RelativePath` | Não; mantém pai atual | Diretório pai existente; `.` permitido. |
| Corpo: `overwrite` | boolean | Não; `false` | Só permite substituir arquivo regular por arquivo regular. |
| Rota/outros campos | Ausentes | Não aplicável | Campos desconhecidos rejeitados. |

Informe pelo menos `name` ou `parentPath`. `{}` e `{ "overwrite": true }` são
inválidos; enviar `null` também não equivale a omitir o campo. Um `name` inválido
retornará `422 validation_failed`. Os campos com caminhos completos seguem as
regras de `RelativePath`.

**Content-Type aceito:** `application/json`. **Resposta:** `200 application/json` com `EntryMetadata` da entrada no caminho resultante. Se os valores efetivos não alterarem a identidade, retorna `200` sem modificar a entrada.

**Erros possíveis:** compartilhados de caminhos/corpos; `404 entry_not_found` para origem ou pai de destino ausente; `409 entry_conflict` para conflito sem `overwrite`, tipos incompatíveis, pai que não seja diretório ou tentativa de substituir/mesclar diretórios; `403 entry_forbidden` para mover/renomear a raiz; `422 validation_failed` para mover diretório a um descendente; `409 cross_device_operation` quando a operação entre filesystems não puder manter as garantias adotadas.

**Como funciona:** `name` muda o nome e `parentPath` muda a pasta que contém a
entrada. Enviar somente `parentPath` move mantendo o nome; enviar somente `name`
renomeia mantendo a pasta atual. Quando os dois são enviados, formam um único
destino final. A pasta de destino precisa existir. A operação não juntará nem
substituirá árvores de
pastas e não removerá uma pasta que contenha a origem.

`overwrite=true` autoriza substituir um arquivo de destino existente; não
desbloqueia arquivos. A aplicação não deverá impedir leitura ou edição por
outros programas durante a movimentação. O sistema operacional ainda poderá
recusar a operação por causa de um arquivo aberto. Mover também muda o caminho
de acesso: não há garantia de que o caminho antigo continue disponível.

Se o sistema recusar a movimentação entre sistemas de arquivos (`EXDEV`), a API
não tentará copiar e depois apagar a origem. Os limites das operações estão em
[arquivos e pastas](filesystem.md).

Depois de mover ou renomear, o caminho antigo normalmente deixará de existir.
Repetir a mesma URL retornará `404`. Se o pedido manteve o caminho original,
repeti-lo retornará `200` enquanto a entrada existir. O servidor não reconhecerá
automaticamente uma tentativa repetida como a mesma operação anterior.

**Exemplo de requisição:** move sem renomear; exige origem e diretório
`documentos/finalizados` existentes.

```sh
curl --cacert "$PEER_CERT" --cert "$LOCAL_CERT" --key "$LOCAL_KEY" \
  --header 'Content-Type: application/json' --request PATCH \
  --data '{"parentPath":"documentos/finalizados","overwrite":false}' \
  "$BASE_URL/api/v2/entries?path=documentos%2Fnota.txt"
```

### Exemplo de uso

Você move nota.txt para a pasta finalizados e mantém o nome nota.txt. Para
renomear sem mover, envia somente `{"name":"nota-final.txt"}`. Para mover e
renomear juntos, envia `name` e `parentPath` no mesmo corpo.

## E09 — Copiar um arquivo ou pasta

**POST /api/v2/actions/copy**

Copia um arquivo ou pasta para outro caminho. É uma ação RPC: a URL nomeia a operação a executar.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Conexão TLS | Certificado do peer e prova de posse da chave | Sim | Confiança bilateral concluída. |
| Headers: `Content-Type` | string | Sim; sem padrão | `application/json`, charset UTF-8 opcional. |
| Corpo: `sourcePath` | `RelativePath` | Sim; sem padrão | Arquivo regular ou diretório existente; raiz proibida. |
| Corpo: `targetPath` | `RelativePath` | Sim; sem padrão | Caminho final completo; pai deve existir como diretório. |
| Corpo: `overwrite` | boolean | Não; `false` | Somente substituição de arquivo regular por arquivo regular. |
| Rota/query/outros campos | Ausentes | Não aplicável | Query e campos JSON desconhecidos rejeitados. |

**Content-Type aceito:** `application/json`. **Resposta:** criação: `201 application/json` com `EntryMetadata` do destino e `Location`; substituição permitida de arquivo regular: `200 application/json` com `EntryMetadata` do destino.

**Erros possíveis:** compartilhados de caminhos/corpos; `404 entry_not_found` para origem ou pai de destino ausente; `409 entry_conflict` para destino existente sem sobrescrita, diretórios existentes, tipos incompatíveis ou pai não diretório; `403 entry_forbidden` para raiz como origem e entradas proibidas na árvore; `422 validation_failed` para mesma entrada como origem/destino ou cópia de diretório em um descendente; `409 cross_device_operation` para publicação incompatível com o filesystem de staging.

**Como funciona:** o destino é sempre completo: `targetPath: "backup"` não significa `backup/<nome da origem>`. Não cria pais, não mescla árvores, não copia a raiz e não substitui diretório, inclusive a raiz. Origem e destino correspondentes à mesma entrada são rejeitados mesmo com `overwrite=true`. Valida links em toda a árvore. Nenhum ancestral que contém a origem pode ser removido como sobrescrita.

A cópia será montada na área temporária privada antes de ser colocada no destino.
Se ela falhar, o destino anterior será preservado e apenas os temporários da
operação serão removidos. Se outro programa alterar os arquivos de origem
durante a leitura, o resultado não terá garantia de representar um único
instante da pasta.

Outros programas poderão ler e editar a origem e um destino existente durante
a cópia, respeitando o sistema operacional. Se houver mudanças na origem, os
bytes copiados podem não representar uma única versão do arquivo. Com
`overwrite=true`, publicar a cópia pode substituir edições feitas no destino
durante a preparação. Esse campo permite substituir o destino; não é um
comando para bloquear ou desbloquear arquivos.

Repetir a cópia sem permitir substituição normalmente retornará `409`, pois o
destino já existe. Com `overwrite=true` entre arquivos comuns, retornará `200`
e copiará novamente o conteúdo atual da origem. Não há identificador para
reconhecer tentativas repetidas nem resultados de cópias guardados pelo servidor.

**Exemplo de requisição:** exige arquivo de origem e diretório `backup` existentes.

```sh
curl --cacert "$PEER_CERT" --cert "$LOCAL_CERT" --key "$LOCAL_KEY" \
  --header 'Content-Type: application/json' --request POST \
  --data '{"sourcePath":"documentos/nota.txt","targetPath":"backup/nota.txt","overwrite":false}' \
  "$BASE_URL/api/v2/actions/copy"
```

### Exemplo de uso

Você faz uma cópia de nota.txt na pasta backup e mantém o arquivo original.

## E10 — Baixar uma pasta em ZIP

**POST /api/v2/actions/archive**

Compacta uma pasta e envia o ZIP ao cliente. É uma ação RPC, sem criar um ZIP permanente no servidor.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Conexão TLS | Certificado do peer e prova de posse da chave | Sim | Confiança bilateral concluída. |
| Headers: `Content-Type` | string | Sim; sem padrão | `application/json`, charset UTF-8 opcional. |
| Corpo | Objeto JSON | Sim; sem padrão | `{}` válido; corpo ausente ou JSON malformado inválido. |
| Corpo: `path` | `RelativePath` | Não; `"."` | Diretório existente; raiz permitida. |
| Rota/query/outros campos | Ausentes | Não aplicável | Query e campos JSON desconhecidos rejeitados. |

**Content-Type aceito:** `application/json`. **Resposta:** `200 application/zip`, bytes do ZIP, com `Content-Disposition` e nome seguro. Disposição `attachment`, nome `<nome do diretório>.zip`; para raiz, nome estável `raiz.zip`, sem expor sua localização absoluta. Não há corpo JSON de sucesso nem arquivo ZIP permanente.

As entradas são relativas ao diretório solicitado, sem acrescentar um contêiner com seu nome: `documentos/nota.txt` solicitado com `path: "documentos"` aparece como `nota.txt`. Preserva diretórios vazios. Não inclui caminhos absolutos, segmentos de escape, links simbólicos nem arquivos internos de configuração, credenciais ou staging.

Os limites de configuração são `PASSA_ZIP_MAX_ENTRIES`, com padrão de 10.000
entradas, e `PASSA_ZIP_MAX_BYTES`, com padrão de 10 GiB (10.737.418.240 bytes).
As opções já são validadas, mas a geração do ZIP ainda não existe.

A forma de contagem considerada inclui arquivos e pastas, mesmo vazias, sem
contar a própria pasta solicitada. O volume será medido pelos bytes lidos dos
arquivos antes da compressão. Esses detalhes ainda podem mudar. O ZIP não será
carregado inteiro na memória. Uma falha depois do início da resposta interromperá
o download, como explicado em [erros](errors.md#transferência-já-iniciada).

**Erros possíveis:** compartilhados de caminhos/corpos; `404 entry_not_found` para diretório ausente; `409 entry_conflict` para arquivo ou intermediário incompatível; `403 entry_forbidden` para symlinks/entradas proibidas na árvore. `413 payload_too_large` para ultrapassar quantidade de entradas ou volume permitido, quando ainda for possível responder com erro HTTP. Depois de enviar os cabeçalhos, a transferência será interrompida conforme [errors.md](errors.md#transferência-já-iniciada).

**Como funciona:** aceita uma pasta ou a raiz compartilhada, não um arquivo
comum. O ZIP será enviado diretamente ao cliente, sem ficar salvo como resultado
permanente no servidor. Temporários serão removidos após sucesso, erro ou queda
de conexão.

Cada chamada gerará um novo download. Mudanças externas nos arquivos poderão
afetar o conteúdo, e repetir a chamada não garante um ZIP idêntico. Não haverá
tarefa em segundo plano nem endereço para acompanhar a compactação.

**Exemplo de requisição:** grava o ZIP no diretório atual do cliente.

```sh
curl --cacert "$PEER_CERT" --cert "$LOCAL_CERT" --key "$LOCAL_KEY" \
  --header 'Content-Type: application/json' --request POST \
  --data '{"path":"documentos"}' --output 'documentos.zip' \
  "$BASE_URL/api/v2/actions/archive"
```

Para compactar a raiz, o corpo continua obrigatório e pode ser `{}` ou `{"path":"."}`.

### Exemplo de uso

Você baixa a pasta documentos em um ZIP, incluindo as pastas vazias que existem dentro dela.
