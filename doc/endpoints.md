# Contrato dos endpoints

## Estado e alcance

**PLANEJADO — NÃO IMPLEMENTADO.** Nenhum endpoint está exposto. Este documento registra o contrato solicitado para implementação nas etapas posteriores. Não existe arquivo de handler, símbolo de handler, serviço de aplicação, schema Zod ou mecanismo de transferência implementado para qualquer endpoint abaixo. Não há especificação OpenAPI nesta etapa.

TypeScript, Express e Zod são escolhas **aprovadas pelo usuário**. Na etapa 2 estão instalados, com uma fábrica Express sem rotas e esquemas Zod somente para configuração local; roteamento e validação de requisições destes endpoints continuam planejados. Bibliotecas e APIs concretas de multipart, streaming e ZIP ainda serão escolhidas e registradas antes da respectiva implementação. As escolhas adicionais identificadas como **PROPOSTA** não representam comportamento já testado ou aprovação explícita do usuário.

O pedido original está preservado em [requirements.md](requirements.md). Consulte [filesystem.md](filesystem.md) para as regras de arquivos, [security.md](security.md) para autenticação/TLS/CORS e [errors.md](errors.md) para o catálogo de erros. Os caminhos dos recursos permanecem em query nas rotas de recursos; isso não transforma essas rotas em RPC.

## Regras comuns

- Transporte obrigatório: HTTPS, TLS 1.2 ou superior, sem listener HTTP de fallback.
- Autenticação de **todos os dez endpoints**, inclusive `/health`: header `Authorization`, string obrigatória, sem padrão, no formato `Bearer TOKEN`. Credenciais são verificadas antes das operações e, quando possível, antes do processamento integral de uploads. Falha: `401 authentication_required`, com `WWW-Authenticate: Bearer`.
- Não há parâmetros de rota. Os únicos parâmetros de query aceitos são os declarados em cada endpoint. **PROPOSTA:** parâmetros repetidos, desconhecidos ou com estrutura de array/objeto são `422 validation_failed`; headers HTTP usuais não são campos desconhecidos do schema.
- JSON usa campos camelCase. **PROPOSTA:** objetos JSON rejeitam campos desconhecidos, arrays, valores primitivos e `null` onde um objeto é esperado. JSON malformado ou ausente quando obrigatório: `400 malformed_request`; objeto válido fora do schema: `422 validation_failed`.
- Endpoints sem corpo não aceitam payload. **PROPOSTA:** payload indevido produz `400 malformed_request`; corpo de comprimento zero é ausência de payload e não exige `Content-Type`.
- Os headers `Content-Type` dos corpos JSON e multipart são obrigatórios; JSON aceita `application/json` com charset UTF-8 opcional. Um tipo de mídia incompatível produz `415 unsupported_media_type`. O boundary multipart deve ser gerado pelo cliente; boundary ausente ou framing inválido é `400 malformed_request`. **PROPOSTA:** corpos JSON excedendo `PASSA_JSON_MAX_BYTES` produzem `413 payload_too_large`, conforme [configuration.md](configuration.md).
- Respostas JSON de sucesso usam `application/json`. Erros anteriores ao início da resposta usam `application/problem+json`. Respostas `204` não têm corpo nem representação JSON. Um `Content-Type` de sucesso nunca deve ser usado para descrever um erro JSON.
- **PROPOSTA:** `Location` de uma criação identifica os metadados da entrada, na forma `/api/v2/entries?path=<caminho codificado como valor de query>`. Exemplo: `/api/v2/entries?path=documentos%2Fnota.txt`. A URI não contém o caminho absoluto local.
- CORS permite preflight sem Bearer para as origens configuradas, preservando autenticação na requisição efetiva; não constitui um endpoint adicional de arquivos. `Location` e `Content-Disposition` precisam ser expostos ao cliente web quando aplicável.
- Exemplos de transferência não prometem `Content-Length`, suporte a Range, ETags, paginação, jobs ou compatibilidade com uma API anterior. Esses recursos não fazem parte deste contrato inicial.

### Tipo `RelativePath`

String de caminho relativo à raiz configurada, com `/` como separador e `.` representando exatamente a raiz. Não recebe trim nem decodificações percentuais sucessivas. A validação ocorre após uma única decodificação normal da URL para query; strings recebidas em JSON não são decodificadas como URL.

São requisitos: rejeitar caminhos absolutos, segmentos `..`, bytes nulos, formatos ambíguos e qualquer travessia por links simbólicos. **PROPOSTA:** rejeitar string vazia, barras repetidas ou finais, segmento `.` interno e `\` com `400 invalid_path`; absolutos e segmentos `..` resultam em `403 path_forbidden`. Formatos reconhecidos como absolutos, inclusive unidade Windows e UNC, têm precedência sobre a regra de barra invertida. Symlinks e entradas que não sejam arquivo regular ou diretório resultam em `403 entry_forbidden`. **Propostas adicionais de filesystem:** arquivos com `nlink > 1` resultam em `403 entry_forbidden`; travessia detectada para dispositivo diferente resulta em `409 cross_device_operation`. Isso não comprova detecção completa de montagens. O tratamento de nomes da plataforma e limites reais de concorrência constam em [filesystem.md](filesystem.md).

Campo obrigatório ausente é `422 validation_failed`; campo presente com sintaxe de caminho inválida é `400 invalid_path`. Um parâmetro opcional usa seu padrão somente quando omitido, nunca quando contém `""` ou `null`.

### Representação comum `EntryMetadata`

Nome de contrato documental, **não um tipo TypeScript já definido**.

| Campo | Tipo JSON | Obrigatoriedade/padrão | Significado e restrições |
| --- | --- | --- | --- |
| `name` | string | Sempre presente; sem padrão | Nome da entrada, sem caminho pai. **PROPOSTA:** para a raiz, `"."`. |
| `path` | string (`RelativePath`) | Sempre presente; sem padrão | Caminho relativo; raiz `"."`; nunca caminho absoluto local. |
| `type` | string enum | Sempre presente; sem padrão | Somente `"file"` ou `"directory"`. |
| `size` | integer ou null | Sempre presente; sem padrão | Arquivo: quantidade não negativa de bytes. Diretório: `null`, sem cálculo recursivo. |
| `modifiedAt` | string temporal | Sempre presente; sem padrão | Instante UTC padronizado. **PROPOSTA:** RFC 3339/ISO 8601 com sufixo `Z` e milissegundos. |

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

Exemplo de metadados da raiz, conforme a proposta de nome estável:

```json
{
  "name": ".",
  "path": ".",
  "type": "directory",
  "size": null,
  "modifiedAt": "2026-09-05T12:00:00.000Z"
}
```

### Erros compartilhados e interpretação

Todas as seções abaixo herdam `400 malformed_request`, `401 authentication_required`, `422 validation_failed` e `500 internal_error` quando suas condições concretas se aplicarem. Rotas com caminhos herdam `400 invalid_path`, `403 path_forbidden`, `403 entry_forbidden` e a proposta `409 cross_device_operation` para travessia detectada entre dispositivos. Rotas com corpo herdam `415 unsupported_media_type`; rotas JSON também herdam a proposta `413 payload_too_large` para excesso do limite de corpo JSON. Os erros específicos são informados por endpoint e definidos em [errors.md](errors.md).

Status e códigos adicionais são **propostas de mapeamento** a confirmar com implementação e testes, respeitando os status obrigatórios do pedido. Um erro listado não significa que exista código capaz de produzi-lo nesta etapa.

### Preparação dos exemplos técnicos

Exemplos de shell/curl para execução **futura**, após a etapa que disponibilizar servidor, certificados e tokens. Nenhum foi executado contra uma API nesta etapa. Substitua os valores de exemplo; o nome do host deve constar no SAN do certificado. `CA_CERT` indica o certificado confiável ou CA no cliente; nunca a chave privada.

```sh
BASE_URL='https://localhost:8443'
CA_CERT='/caminho/no/cliente/certificado-confiavel.pem'
: "${API_TOKEN:?Defina API_TOKEN com um token válido do servidor}"
```

Os comandos usam confiança explícita com `--cacert`, não desabilitam validação TLS e codificam os valores de query. Nomes que contêm espaço devem ser transmitidos com `--data-urlencode` ou `%20`; `+` literal deve ser codificado como `%2B`.

## E01 — Verificação de saúde

**Método/rota:** `GET /health`. **Classificação:** recurso HTTP de saúde. A nomenclatura identifica a saúde mínima do processo, separada dos recursos de arquivos versionados.

**Estado:** NÃO IMPLEMENTADO. **Handler:** arquivo e símbolo inexistentes. **Operação de aplicação:** checagem mínima de saúde planejada, sem serviço/símbolo definido. **Tecnologia:** roteamento Express e validação estrutural Zod planejados; resposta JSON, sem transferência de arquivo. **Autenticação:** Bearer obrigatório.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Headers: `Authorization` | string | Sim; sem padrão | Bearer válido, conforme regras comuns. |
| Rota/query/corpo | Ausentes | Não aplicável | Não recebe parâmetros nem corpo. |

**Content-Type aceito:** não aplicável, sem corpo. **Resposta:** `200 application/json`, objeto `{ "status": "ok" }`; **PROPOSTA:** `status` é literal obrigatório `"ok"`, sem outros campos. Não expõe configuração, tokens ou caminhos. Não verifica nem afirma disponibilidade de todas as operações de arquivos.

**Erros previstos:** compartilhados; nenhuma falha específica de arquivos. Não há `503` planejado sem uma condição temporária concreta identificada.

**Regras e efeitos:** não seleciona arquivo, diretório, raiz ou destino; não modifica o filesystem. Repetição consulta novamente a saúde mínima, sem mutação deliberada.

**Exemplo técnico executável após implementação:**

```sh
curl --cacert "$CA_CERT" --header "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/health"
```

### Exemplo em linguagem humana

Você confirma que o servidor respondeu à sua credencial e à consulta básica de saúde.

## E02 — Consulta de metadados

**Método/rota:** `GET /api/v2/entries`. **Classificação:** recurso HTTP. `entries` representa arquivos e diretórios; `path` identifica uma entrada sem confundir seus segmentos com a rota.

**Estado:** NÃO IMPLEMENTADO. **Handler:** arquivo e símbolo inexistentes. **Operação de aplicação:** leitura de metadados planejada, sem serviço/símbolo definido. **Tecnologia:** Express + Zod planejados; resposta JSON. **Autenticação:** Bearer obrigatório.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Query: `path` | `RelativePath` | Sim; sem padrão | Entrada existente; `.` permitido. |
| Headers: `Authorization` | string | Sim; sem padrão | Bearer válido. |
| Rota/corpo | Ausentes | Não aplicável | Não recebe corpo. |

**Content-Type aceito:** não aplicável. **Resposta:** `200 application/json` com `EntryMetadata` diretamente, sem wrapper.

**Erros previstos:** compartilhados de caminhos; `404 entry_not_found` se a entrada ou um componente necessário não existir; `409 entry_conflict` se um componente intermediário for arquivo em vez de diretório.

**Regras e efeitos:** aceita arquivo regular, diretório e raiz; proíbe symlinks. Não há destino. Não modifica conteúdo deliberadamente. Repetição lê o estado atual; alterações externas podem modificar os metadados entre chamadas.

**Exemplo técnico executável após implementação:**

```sh
curl --cacert "$CA_CERT" --header "Authorization: Bearer $API_TOKEN" \
  --get --data-urlencode 'path=documentos/nota.txt' \
  "$BASE_URL/api/v2/entries"
```

### Exemplo em linguagem humana

Você escolhe um arquivo e consulta seu nome, tamanho e data de modificação.

## E03 — Listagem dos filhos de um diretório

**Método/rota:** `GET /api/v2/directories/entries`. **Classificação:** recurso HTTP. A rota identifica a coleção de entradas imediatamente contidas no diretório selecionado.

**Estado:** NÃO IMPLEMENTADO. **Handler:** arquivo e símbolo inexistentes. **Operação de aplicação:** listagem imediata planejada, sem serviço/símbolo definido. **Tecnologia:** Express + Zod planejados; resposta JSON. **Autenticação:** Bearer obrigatório.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Query: `path` | `RelativePath` | Não; `"."` | Deve identificar diretório existente. |
| Headers: `Authorization` | string | Sim; sem padrão | Bearer válido. |
| Rota/corpo | Ausentes | Não aplicável | Não recebe corpo. |

**Content-Type aceito:** não aplicável. **Resposta:** `200 application/json`, objeto com `path: RelativePath` e `entries: EntryMetadata[]`, ambos obrigatórios. Cada `entries[i].path` permanece relativo à raiz compartilhada, não ao diretório listado. Diretório vazio produz `entries: []`.

```json
{ "path": "documentos", "entries": [] }
```

Diretórios precedem arquivos; nomes são ordenados deterministicamente dentro de cada grupo. **PROPOSTA:** comparação lexicográfica dos bytes UTF-8, sensível a maiúsculas/minúsculas, sem locale e sem normalização Unicode. Não inclui paginação nem recursão.

**Erros previstos:** compartilhados de caminhos; `404 entry_not_found` para diretório ausente; `409 entry_conflict` se `path` for arquivo ou componente intermediário incompatível. **PROPOSTA:** symlink ou entrada especial entre os filhos examinados faz a listagem inteira falhar com `403 entry_forbidden`, sem ocultar seletivamente a entrada.

**Regras e efeitos:** aceita diretório e raiz; arquivos não são listáveis. Não há destino. Configuração, credenciais e staging são privados e inacessíveis à API; não pertencem à listagem. Não modifica conteúdo deliberadamente. Repetição reflete os filhos e metadados atuais; não oferece snapshot contra alterações externas.

**Exemplo técnico executável após implementação:**

```sh
curl --cacert "$CA_CERT" --header "Authorization: Bearer $API_TOKEN" \
  --get --data-urlencode 'path=documentos' \
  "$BASE_URL/api/v2/directories/entries"
```

### Exemplo em linguagem humana

Você seleciona a pasta documentos e recebe a lista do que existe diretamente dentro dela.

## E04 — Download de arquivo

**Método/rota:** `GET /api/v2/files`. **Classificação:** recurso HTTP. A rota entrega a representação binária do arquivo identificado por `path`.

**Estado:** NÃO IMPLEMENTADO. **Handler:** arquivo e símbolo inexistentes. **Operação de aplicação:** abertura segura e leitura de arquivo planejadas, sem serviço/símbolo definido. **Tecnologia:** Express + Zod planejados; streaming obrigatório, mecanismo concreto pendente. **Autenticação:** Bearer obrigatório.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Query: `path` | `RelativePath` | Sim; sem padrão | Arquivo regular existente. |
| Headers: `Authorization` | string | Sim; sem padrão | Bearer válido. |
| Rota/corpo | Ausentes | Não aplicável | Não recebe corpo. |

**Content-Type aceito:** não aplicável. **Resposta:** `200`, bytes do arquivo, MIME apropriado com fallback `application/octet-stream`. `Content-Disposition` entrega um nome seguro; **PROPOSTA:** `attachment` com nome base protegido contra injeção de headers e extensão `filename*` para nomes Unicode. Não há envelope JSON nem compactação implícita. Não carrega o arquivo completo na memória.

**Erros previstos:** compartilhados de caminhos; `404 entry_not_found` para arquivo ausente; `409 entry_conflict` para diretório, inclusive raiz, ou intermediário incompatível. Falha após os headers interrompe a transferência; não troca o corpo por JSON de erro, conforme [errors.md](errors.md#transferência-já-iniciada).

**Regras e efeitos:** somente arquivo regular. Não há destino no servidor nem alteração deliberada de conteúdo. Repetição lê os bytes atuais; modificações externas podem produzir conteúdos distintos. A API não promete snapshot durante leitura concorrente por outros processos.

**Exemplo técnico executável após implementação:** grava a resposta no diretório atual do cliente.

```sh
curl --cacert "$CA_CERT" --header "Authorization: Bearer $API_TOKEN" \
  --get --data-urlencode 'path=documentos/nota.txt' \
  --output 'nota-baixada.txt' "$BASE_URL/api/v2/files"
```

### Exemplo em linguagem humana

Você baixa o conteúdo de nota.txt para o seu computador.

## E05 — Upload ou substituição de arquivo

**Método/rota:** `PUT /api/v2/files`. **Classificação:** recurso HTTP. `PUT` estabelece o conteúdo do arquivo no caminho final completo escolhido pelo cliente.

**Estado:** NÃO IMPLEMENTADO. **Handler:** arquivo e símbolo inexistentes. **Operação de aplicação:** recebimento em staging e publicação de arquivo planejados, sem serviço/símbolo definido. **Tecnologia:** Express + Zod planejados; parser multipart e mecanismo de streaming pendentes. **Autenticação:** Bearer obrigatório, validado antes do processamento integral quando possível.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Query: `path` | `RelativePath` | Sim; sem padrão | Destino final completo; pai deve existir como diretório. |
| Headers: `Authorization` | string | Sim; sem padrão | Bearer válido. |
| Headers: `Content-Type` | string | Sim; sem padrão | `multipart/form-data; boundary=...`, gerado pelo cliente. |
| Corpo multipart: `file` | Parte de arquivo binária | Sim; exatamente uma | Conteúdo sujeito ao limite configurável; nome multipart não escolhe o destino. |
| Rota/outros campos do corpo | Ausentes | Não aplicável | Nenhum campo textual ou segundo arquivo permitido. |

**Content-Type aceito:** `multipart/form-data`. O MIME declarado pela parte não estabelece o destino nem concede permissões adicionais. **PROPOSTA:** arquivo de zero bytes é válido dentro do limite; ausência da parte não equivale a arquivo vazio.

**Resposta:** criação: `201 application/json`, `EntryMetadata`, header `Location`. Substituição de arquivo regular existente: `204`, sem corpo. O padrão numérico e o nome da opção de limite serão registrados em [configuration.md](configuration.md); não existe valor implementado nesta etapa.

**Erros previstos:** compartilhados de caminhos/corpos; `404 entry_not_found` para pai ausente; `409 entry_conflict` para destino diretório, inclusive raiz, ou intermediário não diretório; `413 payload_too_large` ao exceder limite; `422 validation_failed` para campo inesperado, parte ausente ou quantidade de arquivos diferente de um; `400 malformed_request` para framing multipart inválido; `409 cross_device_operation` se a publicação não puder manter as garantias entre filesystems.

**Regras e efeitos:** não cria pais. Recebe por streaming em staging privado e publica somente após recebimento completo e validações. Falha ou desconexão anterior à publicação preserva o arquivo anterior e exige limpeza dos temporários da operação. Não existe opção `overwrite`: substituir um arquivo regular é deliberadamente permitido pelo `PUT`.

Repetir o mesmo conteúdo converge para o conteúdo solicitado; a primeira criação pode retornar `201` e as seguintes `204`. Isso não exige metadados temporais idênticos. Após publicação, perda da resposta não desfaz automaticamente o upload; o cliente pode consultar os metadados ou repetir o `PUT`.

**Exemplo técnico executável após implementação:** exige arquivo local `nota.txt` no cliente e diretório `documentos` já existente no servidor. O curl gera o boundary.

```sh
curl --cacert "$CA_CERT" --header "Authorization: Bearer $API_TOKEN" \
  --request PUT --form 'file=@nota.txt' \
  "$BASE_URL/api/v2/files?path=documentos%2Fnota.txt"
```

Em navegador, `FormData` produz o multipart; não definir `Content-Type` manualmente, pois o navegador precisa acrescentar o boundary. `FormData` não define a arquitetura da API.

### Exemplo em linguagem humana

Você envia nota.txt para documentos/nota.txt; se já houver um arquivo ali, seu conteúdo é substituído depois que o envio termina com sucesso.

## E06 — Criação de diretório

**Método/rota:** `PUT /api/v2/directories`. **Classificação:** recurso HTTP. O método estabelece a existência do diretório identificado por `path` e preserva seu conteúdo quando ele já existe.

**Estado:** NÃO IMPLEMENTADO. **Handler:** arquivo e símbolo inexistentes. **Operação de aplicação:** criação de diretório e pais ausentes planejada, sem serviço/símbolo definido. **Tecnologia:** Express + Zod planejados; resposta JSON. **Autenticação:** Bearer obrigatório.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Query: `path` | `RelativePath` | Sim; sem padrão | Diretório final; `.` permitido. |
| Headers: `Authorization` | string | Sim; sem padrão | Bearer válido. |
| Rota/corpo | Ausentes | Não aplicável | Não recebe corpo. |

**Content-Type aceito:** não aplicável. **Resposta:** diretório novo: `201 application/json` com `EntryMetadata` e `Location`. Diretório já existente, inclusive `.`: `200 application/json` com `EntryMetadata` atual.

**Erros previstos:** compartilhados de caminhos; `409 entry_conflict` para arquivo no destino ou em componente intermediário; falhas inesperadas são `500 internal_error`. Uma criação recursiva não é descrita como transação: pais criados antes de uma falha podem permanecer, conforme [filesystem.md](filesystem.md).

**Regras e efeitos:** cria os pais ausentes. Não transforma arquivo em diretório nem remove conteúdo existente. A raiz já preparada apenas tem seus metadados consultados. Repetição mantém o diretório e seus filhos, normalmente retornando `200` depois da primeira criação.

**Exemplo técnico executável após implementação:**

```sh
curl --cacert "$CA_CERT" --header "Authorization: Bearer $API_TOKEN" \
  --request PUT "$BASE_URL/api/v2/directories?path=documentos%2Fprojetos"
```

### Exemplo em linguagem humana

Você cria a pasta projetos dentro de documentos; repetir o pedido mantém tudo o que já estiver nela.

## E07 — Exclusão de entrada

**Método/rota:** `DELETE /api/v2/entries`. **Classificação:** recurso HTTP. Remove a entrada selecionada por identidade, com autorização explícita de recursão em query.

**Estado:** NÃO IMPLEMENTADO. **Handler:** arquivo e símbolo inexistentes. **Operação de aplicação:** exclusão simples/recursiva planejada, sem serviço/símbolo definido. **Tecnologia:** Express + Zod planejados; sucesso sem corpo. **Autenticação:** Bearer obrigatório.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Query: `path` | `RelativePath` | Sim; sem padrão | Arquivo regular ou diretório; raiz proibida. |
| Query: `recursive` | boolean no contrato | Não; `false` | **PROPOSTA:** strings exatas `true` ou `false` na URL; rejeitar `1`, `0`, vazio e variações de caixa. |
| Headers: `Authorization` | string | Sim; sem padrão | Bearer válido. |
| Rota/corpo | Ausentes | Não aplicável | Não recebe corpo. |

**Content-Type aceito:** não aplicável. **Resposta:** `204`, sem corpo e sem Content-Type de representação.

**Erros previstos:** compartilhados de caminhos; `404 entry_not_found` para entrada ausente; `409 entry_conflict` para diretório não vazio quando `recursive=false` ou intermediário incompatível; `403 entry_forbidden` para a raiz e entradas proibidas encontradas na árvore.

**Regras e efeitos:** arquivo regular ou diretório vazio pode ser excluído sem recursão. Diretório não vazio requer `recursive=true`. Não segue symlinks durante a operação. Não há destino nem lixeira. Exclusão recursiva pode falhar parcialmente; não promete rollback dos filhos já removidos. A raiz nunca pode ser removida, mesmo com `recursive=true`.

Repetição após sucesso normalmente retorna `404`; o efeito desejado permanece a ausência da entrada. Status diferentes não retiram, por si sós, a idempotência de `DELETE`.

**Exemplo técnico executável após implementação:** remove o arquivo de exemplo.

```sh
curl --cacert "$CA_CERT" --header "Authorization: Bearer $API_TOKEN" \
  --request DELETE \
  "$BASE_URL/api/v2/entries?path=documentos%2Fnota.txt&recursive=false"
```

### Exemplo em linguagem humana

Você apaga nota.txt; apagar uma pasta que contém arquivos exige marcar a exclusão recursiva explicitamente.

## E08 — Movimentação e renomeação

**Método/rota:** `PATCH /api/v2/entries`. **Classificação:** recurso HTTP. Altera nome, diretório pai ou ambos como uma única operação sobre a entrada selecionada.

**Estado:** NÃO IMPLEMENTADO. **Handler:** arquivo e símbolo inexistentes. **Operação de aplicação:** movimentação/renomeação planejada, sem serviço/símbolo definido. **Tecnologia:** Express + Zod planejados; corpo e resposta JSON. **Autenticação:** Bearer obrigatório.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Query: `path` | `RelativePath` | Sim; sem padrão | Origem existente; raiz proibida. |
| Headers: `Authorization` | string | Sim; sem padrão | Bearer válido. |
| Headers: `Content-Type` | string | Sim; sem padrão | `application/json`, charset UTF-8 opcional. |
| Corpo: `name` | string | Não; mantém nome atual | Um nome válido, sem `/` nem `\`; rejeitar vazio, `.`, `..` e NUL; preservar espaços. |
| Corpo: `parentPath` | `RelativePath` | Não; mantém pai atual | Diretório pai existente; `.` permitido. |
| Corpo: `overwrite` | boolean | Não; `false` | Só permite substituir arquivo regular por arquivo regular. |
| Rota/outros campos | Ausentes | Não aplicável | Campos desconhecidos rejeitados. |

Pelo menos `name` ou `parentPath` deve ser informado. `{}` e `{ "overwrite": true }` são inválidos. `null` não equivale a omissão. **PROPOSTA:** violações do schema de `name` são `422 validation_failed`; os campos que contêm caminhos completos seguem `RelativePath` e seu mapeamento próprio.

**Content-Type aceito:** `application/json`. **Resposta:** `200 application/json` com `EntryMetadata` da entrada no caminho resultante. Se os valores efetivos não alterarem a identidade, retorna `200` sem modificar a entrada.

**Erros previstos:** compartilhados de caminhos/corpos; `404 entry_not_found` para origem ou pai de destino ausente; `409 entry_conflict` para conflito sem `overwrite`, tipos incompatíveis, pai que não seja diretório ou tentativa de substituir/mesclar diretórios; `403 entry_forbidden` para mover/renomear a raiz; `422 validation_failed` para mover diretório a um descendente; `409 cross_device_operation` quando a operação entre filesystems não puder manter as garantias adotadas.

**Regras e efeitos:** `name` altera somente o nome; `parentPath` altera somente o pai; ambos compõem um destino final antes de uma única movimentação. Não cria pais. Não mescla nem substitui árvores. Não remove um ancestral que contenha a origem. Não executa silenciosamente cópia seguida de exclusão para contornar `EXDEV`. A plataforma e as garantias de publicação serão registradas e testadas em [filesystem.md](filesystem.md).

Repetir a mesma URL após mudança de caminho normalmente encontra a origem antiga ausente e retorna `404`. Se não houve mudança efetiva, a repetição retorna `200` enquanto a entrada existir. Não há promessa geral de idempotência de `PATCH` ou de detecção automática de tentativas repetidas.

**Exemplo técnico executável após implementação:** exige origem e diretório `documentos/finalizados` existentes.

```sh
curl --cacert "$CA_CERT" --header "Authorization: Bearer $API_TOKEN" \
  --header 'Content-Type: application/json' --request PATCH \
  --data '{"name":"nota-final.txt","parentPath":"documentos/finalizados","overwrite":false}' \
  "$BASE_URL/api/v2/entries?path=documentos%2Fnota.txt"
```

### Exemplo em linguagem humana

Você muda nota.txt para a pasta finalizados e passa a chamá-lo nota-final.txt no mesmo pedido.

## E09 — Cópia

**Método/rota:** `POST /api/v2/actions/copy`. **Classificação:** ação RPC deliberada. `actions/copy` nomeia a operação explícita escolhida por simplicidade do MVP; cópia também poderia ser modelada como recurso em outro contrato.

**Estado:** NÃO IMPLEMENTADO. **Handler:** arquivo e símbolo inexistentes. **Operação de aplicação:** cópia e publicação de arquivo/árvore planejadas, sem serviço/símbolo definido. **Tecnologia:** Express + Zod planejados; corpo e resposta JSON; mecanismo de cópia e staging pendente. **Autenticação:** Bearer obrigatório.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Headers: `Authorization` | string | Sim; sem padrão | Bearer válido. |
| Headers: `Content-Type` | string | Sim; sem padrão | `application/json`, charset UTF-8 opcional. |
| Corpo: `sourcePath` | `RelativePath` | Sim; sem padrão | Arquivo regular ou diretório existente; raiz proibida. |
| Corpo: `targetPath` | `RelativePath` | Sim; sem padrão | Caminho final completo; pai deve existir como diretório. |
| Corpo: `overwrite` | boolean | Não; `false` | Somente substituição de arquivo regular por arquivo regular. |
| Rota/query/outros campos | Ausentes | Não aplicável | Query e campos JSON desconhecidos rejeitados. |

**Content-Type aceito:** `application/json`. **Resposta:** criação: `201 application/json` com `EntryMetadata` do destino e `Location`; substituição permitida de arquivo regular: `200 application/json` com `EntryMetadata` do destino.

**Erros previstos:** compartilhados de caminhos/corpos; `404 entry_not_found` para origem ou pai de destino ausente; `409 entry_conflict` para destino existente sem sobrescrita, diretórios existentes, tipos incompatíveis ou pai não diretório; `403 entry_forbidden` para raiz como origem e entradas proibidas na árvore; `422 validation_failed` para mesma entrada como origem/destino ou cópia de diretório em um descendente; `409 cross_device_operation` para publicação incompatível com o filesystem de staging.

**Regras e efeitos:** o destino é sempre completo: `targetPath: "backup"` não significa `backup/<nome da origem>`. Não cria pais, não mescla árvores, não copia a raiz e não substitui diretório, inclusive a raiz. Origem e destino correspondentes à mesma entrada são rejeitados mesmo com `overwrite=true`. Valida links em toda a árvore. Nenhum ancestral que contém a origem pode ser removido como sobrescrita.

Constrói a cópia em staging privado antes de publicar. Não remove previamente o destino para tentar copiar depois. Falha preserva o destino anterior e remove apenas temporários pertencentes à própria operação. A cópia não promete snapshot de uma árvore alterada externamente durante a leitura.

Repetir sem sobrescrita depois de criar o destino normalmente retorna `409`. Com sobrescrita permitida entre arquivos regulares, a repetição retorna `200` e copia novamente o estado atual da origem. Não há chave de idempotência nem retenção de resultados de ações.

**Exemplo técnico executável após implementação:** exige arquivo de origem e diretório `backup` existentes.

```sh
curl --cacert "$CA_CERT" --header "Authorization: Bearer $API_TOKEN" \
  --header 'Content-Type: application/json' --request POST \
  --data '{"sourcePath":"documentos/nota.txt","targetPath":"backup/nota.txt","overwrite":false}' \
  "$BASE_URL/api/v2/actions/copy"
```

### Exemplo em linguagem humana

Você faz uma cópia de nota.txt na pasta backup e mantém o arquivo original.

## E10 — Download de diretório em ZIP

**Método/rota:** `POST /api/v2/actions/archive`. **Classificação:** ação RPC deliberada. `actions/archive` solicita explicitamente a criação e transferência transitória de um arquivo ZIP.

**Estado:** NÃO IMPLEMENTADO. **Handler:** arquivo e símbolo inexistentes. **Operação de aplicação:** compactação limitada e transferência planejadas, sem serviço/símbolo definido. **Tecnologia:** Express + Zod planejados; biblioteca ZIP e mecanismo de streaming pendentes. **Autenticação:** Bearer obrigatório.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Headers: `Authorization` | string | Sim; sem padrão | Bearer válido. |
| Headers: `Content-Type` | string | Sim; sem padrão | `application/json`, charset UTF-8 opcional. |
| Corpo | Objeto JSON | Sim; sem padrão | `{}` válido; corpo ausente ou JSON malformado inválido. |
| Corpo: `path` | `RelativePath` | Não; `"."` | Diretório existente; raiz permitida. |
| Rota/query/outros campos | Ausentes | Não aplicável | Query e campos JSON desconhecidos rejeitados. |

**Content-Type aceito:** `application/json`. **Resposta:** `200 application/zip`, bytes do ZIP, com `Content-Disposition` e nome seguro. **PROPOSTA:** disposição `attachment`, nome `<nome do diretório>.zip`; para raiz, nome estável `raiz.zip`, sem expor sua localização absoluta. Não há corpo JSON de sucesso nem arquivo ZIP permanente.

As entradas são relativas ao diretório solicitado, sem acrescentar um contêiner com seu nome: `documentos/nota.txt` solicitado com `path: "documentos"` aparece como `nota.txt`. Preserva diretórios vazios. Não inclui caminhos absolutos, segmentos de escape, links simbólicos nem arquivos internos de configuração, credenciais ou staging.

Limites configuráveis de entradas e volume são obrigatórios; nomes/padrões constarão em [configuration.md](configuration.md). **PROPOSTA:** contar arquivos e diretórios, inclusive vazios, sem contar o próprio diretório solicitado; medir volume por bytes não comprimidos efetivamente lidos. Não carregar o ZIP inteiro em memória. A implementação escolherá o momento de enviar headers e documentará a consequência para falhas descobertas durante a produção do ZIP.

**Erros previstos:** compartilhados de caminhos/corpos; `404 entry_not_found` para diretório ausente; `409 entry_conflict` para arquivo ou intermediário incompatível; `403 entry_forbidden` para symlinks/entradas proibidas na árvore. **PROPOSTA:** `413 payload_too_large` para ultrapassar quantidade de entradas ou volume permitido, quando ainda for possível responder com erro HTTP. Após headers, aplicar interrupção descrita em [errors.md](errors.md#transferência-já-iniciada).

**Regras e efeitos:** aceita diretório e raiz, não arquivo regular. Não possui destino persistente. Eventuais temporários privados são removidos após sucesso, erro ou desconexão. Repetição gera uma nova transferência com o estado então disponível; não promete bytes ZIP idênticos nem snapshot contra alterações externas. Não cria jobs, URLs de progresso ou ZIPs permanentes.

**Exemplo técnico executável após implementação:** grava o ZIP no diretório atual do cliente.

```sh
curl --cacert "$CA_CERT" --header "Authorization: Bearer $API_TOKEN" \
  --header 'Content-Type: application/json' --request POST \
  --data '{"path":"documentos"}' --output 'documentos.zip' \
  "$BASE_URL/api/v2/actions/archive"
```

Para compactar a raiz, o corpo continua obrigatório e pode ser `{}` ou `{"path":"."}`.

### Exemplo em linguagem humana

Você baixa a pasta documentos em um ZIP, incluindo as pastas vazias que existem dentro dela.

## Verificação e atualização

Esta etapa verifica apenas a consistência documental. Os exemplos não comprovam a existência do servidor. A cada implementação de endpoint, substituir a indicação de inexistência pelos arquivos e símbolos reais, registrar o mecanismo efetivo de transferência e confrontar campos, erros, efeitos e exemplos com testes observáveis. Não marcar os demais endpoints como implementados por antecipação.
