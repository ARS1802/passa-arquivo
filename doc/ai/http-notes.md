# Notas internas do contrato HTTP

Registro preservado antes da correção de linguagem em 2026-09-17. Os trechos
abaixo distinguem detalhes que ainda eram propostas, sem atribuir aprovação ao
usuário nem implementação ao código. A forma de apresentação pública muda; o
estado dessas decisões continua o mesmo.

## Trechos de endpoints.md

**PLANEJADO — NÃO IMPLEMENTADO.** Nenhum endpoint está exposto. Este documento registra o contrato solicitado para implementação nas etapas posteriores. Não existe arquivo de handler, símbolo de handler, serviço de aplicação, schema Zod ou mecanismo de transferência implementado para qualquer endpoint abaixo. Não há especificação OpenAPI nesta etapa.

TypeScript, Express e Zod são escolhas **aprovadas pelo usuário**. Na etapa 2 estão instalados, com uma fábrica Express sem rotas e esquemas Zod somente para configuração local; roteamento e validação de requisições destes endpoints continuam planejados. Bibliotecas e APIs concretas de multipart, streaming e ZIP ainda serão escolhidas e registradas antes da respectiva implementação. As escolhas adicionais identificadas como **PROPOSTA** não representam comportamento já testado ou aprovação explícita do usuário.

- Transporte obrigatório: HTTPS, TLS 1.2 ou superior, sem listener HTTP de fallback.
- Autenticação de **todos os dez endpoints**, inclusive `/health`: header `Authorization`, string obrigatória, sem padrão, no formato `Bearer TOKEN`. Credenciais são verificadas antes das operações e, quando possível, antes do processamento integral de uploads. Falha: `401 authentication_required`, com `WWW-Authenticate: Bearer`.
- Não há parâmetros de rota. Os únicos parâmetros de query aceitos são os declarados em cada endpoint. **PROPOSTA:** parâmetros repetidos, desconhecidos ou com estrutura de array/objeto são `422 validation_failed`; headers HTTP usuais não são campos desconhecidos do schema.
- JSON usa campos camelCase. **PROPOSTA:** objetos JSON rejeitam campos desconhecidos, arrays, valores primitivos e `null` onde um objeto é esperado. JSON malformado ou ausente quando obrigatório: `400 malformed_request`; objeto válido fora do schema: `422 validation_failed`.
- Endpoints sem corpo não aceitam payload. **PROPOSTA:** payload indevido produz `400 malformed_request`; corpo de comprimento zero é ausência de payload e não exige `Content-Type`.
- Os headers `Content-Type` dos corpos JSON e multipart são obrigatórios; JSON aceita `application/json` com charset UTF-8 opcional. Um tipo de mídia incompatível produz `415 unsupported_media_type`. O boundary multipart deve ser gerado pelo cliente; boundary ausente ou framing inválido é `400 malformed_request`. **PROPOSTA:** corpos JSON excedendo `PASSA_JSON_MAX_BYTES` produzem `413 payload_too_large`, conforme [configuration.md](../configuration.md).
- Respostas JSON de sucesso usam `application/json`. Erros anteriores ao início da resposta usam `application/problem+json`. Respostas `204` não têm corpo nem representação JSON. Um `Content-Type` de sucesso nunca deve ser usado para descrever um erro JSON.
- **PROPOSTA:** `Location` de uma criação identifica os metadados da entrada, na forma `/api/v2/entries?path=<caminho codificado como valor de query>`. Exemplo: `/api/v2/entries?path=documentos%2Fnota.txt`. A URI não contém o caminho absoluto local.
- CORS permite preflight sem Bearer para as origens configuradas, preservando autenticação na requisição efetiva; não constitui um endpoint adicional de arquivos. `Location` e `Content-Disposition` precisam ser expostos ao cliente web quando aplicável.
- Exemplos de transferência não prometem `Content-Length`, suporte a Range, ETags, paginação, jobs ou compatibilidade com uma API anterior. Esses recursos não fazem parte deste contrato inicial.

São requisitos: rejeitar caminhos absolutos, segmentos `..`, bytes nulos, formatos ambíguos e qualquer travessia por links simbólicos. **PROPOSTA:** rejeitar string vazia, barras repetidas ou finais, segmento `.` interno e `\` com `400 invalid_path`; absolutos e segmentos `..` resultam em `403 path_forbidden`. Formatos reconhecidos como absolutos, inclusive unidade Windows e UNC, têm precedência sobre a regra de barra invertida. Symlinks e entradas que não sejam arquivo regular ou diretório resultam em `403 entry_forbidden`. **Propostas adicionais de filesystem:** arquivos com `nlink > 1` resultam em `403 entry_forbidden`; travessia detectada para dispositivo diferente resulta em `409 cross_device_operation`. Isso não comprova detecção completa de montagens. O tratamento de nomes da plataforma e limites reais de concorrência constam em [filesystem.md](../filesystem.md).

| Campo | Tipo JSON | Obrigatoriedade/padrão | Significado e restrições |
| --- | --- | --- | --- |
| `name` | string | Sempre presente; sem padrão | Nome da entrada, sem caminho pai. **PROPOSTA:** para a raiz, `"."`. |
| `path` | string (`RelativePath`) | Sempre presente; sem padrão | Caminho relativo; raiz `"."`; nunca caminho absoluto local. |
| `type` | string enum | Sempre presente; sem padrão | Somente `"file"` ou `"directory"`. |
| `size` | integer ou null | Sempre presente; sem padrão | Arquivo: quantidade não negativa de bytes. Diretório: `null`, sem cálculo recursivo. |
| `modifiedAt` | string temporal | Sempre presente; sem padrão | Instante UTC padronizado. **PROPOSTA:** RFC 3339/ISO 8601 com sufixo `Z` e milissegundos. |

Exemplo de metadados da raiz, conforme a proposta de nome estável:

Todas as seções abaixo herdam `400 malformed_request`, `401 authentication_required`, `422 validation_failed` e `500 internal_error` quando suas condições concretas se aplicarem. Rotas com caminhos herdam `400 invalid_path`, `403 path_forbidden`, `403 entry_forbidden` e a proposta `409 cross_device_operation` para travessia detectada entre dispositivos. Rotas com corpo herdam `415 unsupported_media_type`; rotas JSON também herdam a proposta `413 payload_too_large` para excesso do limite de corpo JSON. Os erros específicos são informados por endpoint e definidos em [errors.md](../errors.md).

Status e códigos adicionais são **propostas de mapeamento** a confirmar com implementação e testes, respeitando os status obrigatórios do pedido. Um erro listado não significa que exista código capaz de produzi-lo nesta etapa.

Exemplos de shell/curl para execução **futura**, após a etapa que disponibilizar servidor, certificados e tokens. Nenhum foi executado contra uma API nesta etapa. Substitua os valores de exemplo; o nome do host deve constar no SAN do certificado. `CA_CERT` indica o certificado confiável ou CA no cliente; nunca a chave privada.

**Content-Type aceito:** não aplicável, sem corpo. **Resposta:** `200 application/json`, objeto `{ "status": "ok" }`; **PROPOSTA:** `status` é literal obrigatório `"ok"`, sem outros campos. Não expõe configuração, tokens ou caminhos. Não verifica nem afirma disponibilidade de todas as operações de arquivos.

Diretórios precedem arquivos; nomes são ordenados deterministicamente dentro de cada grupo. **PROPOSTA:** comparação lexicográfica dos bytes UTF-8, sensível a maiúsculas/minúsculas, sem locale e sem normalização Unicode. Não inclui paginação nem recursão.

**Erros previstos:** compartilhados de caminhos; `404 entry_not_found` para diretório ausente; `409 entry_conflict` se `path` for arquivo ou componente intermediário incompatível. **PROPOSTA:** symlink ou entrada especial entre os filhos examinados faz a listagem inteira falhar com `403 entry_forbidden`, sem ocultar seletivamente a entrada.

**Content-Type aceito:** não aplicável. **Resposta:** `200`, bytes do arquivo, MIME apropriado com fallback `application/octet-stream`. `Content-Disposition` entrega um nome seguro; **PROPOSTA:** `attachment` com nome base protegido contra injeção de headers e extensão `filename*` para nomes Unicode. Não há envelope JSON nem compactação implícita. Não carrega o arquivo completo na memória.

**Content-Type aceito:** `multipart/form-data`. O MIME declarado pela parte não estabelece o destino nem concede permissões adicionais. **PROPOSTA:** arquivo de zero bytes é válido dentro do limite; ausência da parte não equivale a arquivo vazio.

**Resposta:** criação: `201 application/json`, `EntryMetadata`, header `Location`. Substituição de arquivo regular existente: `204`, sem corpo. O padrão numérico e o nome da opção de limite serão registrados em [configuration.md](../configuration.md); não existe valor implementado nesta etapa.

| Local/campo | Tipo | Obrigatório/padrão | Restrições |
| --- | --- | --- | --- |
| Query: `path` | `RelativePath` | Sim; sem padrão | Arquivo regular ou diretório; raiz proibida. |
| Query: `recursive` | boolean no contrato | Não; `false` | **PROPOSTA:** strings exatas `true` ou `false` na URL; rejeitar `1`, `0`, vazio e variações de caixa. |
| Headers: `Authorization` | string | Sim; sem padrão | Bearer válido. |
| Rota/corpo | Ausentes | Não aplicável | Não recebe corpo. |

Pelo menos `name` ou `parentPath` deve ser informado. `{}` e `{ "overwrite": true }` são inválidos. `null` não equivale a omissão. **PROPOSTA:** violações do schema de `name` são `422 validation_failed`; os campos que contêm caminhos completos seguem `RelativePath` e seu mapeamento próprio.

**Content-Type aceito:** `application/json`. **Resposta:** `200 application/zip`, bytes do ZIP, com `Content-Disposition` e nome seguro. **PROPOSTA:** disposição `attachment`, nome `<nome do diretório>.zip`; para raiz, nome estável `raiz.zip`, sem expor sua localização absoluta. Não há corpo JSON de sucesso nem arquivo ZIP permanente.

Limites configuráveis de entradas e volume são obrigatórios; nomes/padrões constarão em [configuration.md](../configuration.md). **PROPOSTA:** contar arquivos e diretórios, inclusive vazios, sem contar o próprio diretório solicitado; medir volume por bytes não comprimidos efetivamente lidos. Não carregar o ZIP inteiro em memória. A implementação escolherá o momento de enviar headers e documentará a consequência para falhas descobertas durante a produção do ZIP.

**Erros previstos:** compartilhados de caminhos/corpos; `404 entry_not_found` para diretório ausente; `409 entry_conflict` para arquivo ou intermediário incompatível; `403 entry_forbidden` para symlinks/entradas proibidas na árvore. **PROPOSTA:** `413 payload_too_large` para ultrapassar quantidade de entradas ou volume permitido, quando ainda for possível responder com erro HTTP. Após headers, aplicar interrupção descrita em [errors.md](../errors.md#transferência-já-iniciada).

Esta etapa verifica apenas a consistência documental. Os exemplos não comprovam a existência do servidor. A cada implementação de endpoint, substituir a indicação de inexistência pelos arquivos e símbolos reais, registrar o mecanismo efetivo de transferência e confrontar campos, erros, efeitos e exemplos com testes observáveis. Não marcar os demais endpoints como implementados por antecipação.


## Trechos de errors.md

**Erros HTTP: PLANEJADOS — NÃO IMPLEMENTADOS.** Não existem middleware de erros ou respostas HTTP do contrato em execução. Na etapa 2 existem esquemas Zod e `ConfigurationError` somente para configuração local, documentados na seção seguinte. O formato HTTP geral, os status aplicáveis e as restrições de exposição vêm do pedido. Os identificadores concretos, a estrutura dos erros de campos e as fronteiras HTTP abaixo são **PROPOSTAS**, a confirmar durante implementação e testes, sem alterar os status obrigatórios do contrato.

O pedido original está em [requirements.md](requirements.md). Consulte [endpoints.md](../endpoints.md), [filesystem.md](../filesystem.md), [security.md](../security.md) e [progress.md](progress.md). Os códigos HTTP propostos não descrevem símbolos TypeScript existentes.

## Erros de configuração local — implementados na etapa 2

A CLI [src/check-config.ts](../../src/check-config.ts) escreve problemas em stderr e
termina com código **2** para `ConfigurationError`, **1** para falha inesperada
com mensagem genérica, ou **0** após validação bem-sucedida. Não há resposta HTTP,
Problem Details ou impressão da configuração completa. Um sucesso só comprova
sintaxe e relações lexicais: filesystem, tokens e certificados não são examinados.
Os testes verificam erros conhecidos, sanitização e códigos 0/2; não foi injetada
uma falha inesperada para testar o ramo de código 1.

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `type` | string identificadora URI | Sim | Identificador estável. **PROPOSTA:** `urn:passa-arquivo:problem:<code>`; não é uma URL de documentação existente. |
| `title` | string | Sim | Descrição curta e estável da categoria. |
| `status` | integer | Sim | Código HTTP efetivo. |
| `detail` | string | Sim | Explicação da ocorrência, sem segredo nem localização absoluta do servidor. |
| `code` | string | Sim | Código estável da aplicação do catálogo abaixo. |
| `errors` | array de objetos | Não | Somente quando houver falhas de campos úteis ao cliente; estrutura proposta abaixo. |

### Erros de campos — proposta

## Catálogo proposto

| HTTP | `code` | `title` proposto | Condições concretas |
| --- | --- | --- | --- |
| 400 | `malformed_request` | Requisição malformada | JSON inválido ou ausente quando obrigatório; framing multipart inválido, incluindo boundary ausente; payload em endpoint que não aceita corpo; codificação de URL inválida quando detectada pelo parser. |
| 400 | `invalid_path` | Caminho inválido | Caminho presente com string vazia, NUL, separadores repetidos/finais, segmento `.` interno, `\` ou sintaxe não suportada, após a decodificação apropriada. Formatos reconhecidos como absolutos têm precedência como `path_forbidden`. |
| 401 | `authentication_required` | Autenticação necessária | Bearer ausente, malformado, inválido ou não mais válido; todas as rotas, inclusive `/health`, exigem autenticação. |
| 403 | `path_forbidden` | Caminho proibido | Caminho absoluto, segmento `..`, escape da raiz ou tentativa identificável de atingir estado privado/interno. |
| 403 | `entry_forbidden` | Operação proibida sobre a entrada | Symlink direto, intermediário ou encontrado em árvore; entrada especial; excluir/mover/renomear/copiar a raiz. **Proposta adicional:** arquivo com mais de um hard link detectável (`nlink > 1`), conforme filesystem.md. |
| 404 | `entry_not_found` | Entrada não encontrada | Entrada de origem ausente, diretório consultado ausente, ou diretório pai necessário inexistente nas operações que não o criam. |
| 409 | `entry_conflict` | Conflito de entrada | Destino existente sem sobrescrita permitida; incompatibilidade entre arquivo/diretório; componente intermediário que não é diretório; diretório não vazio sem `recursive=true`; tentativa de substituir ou mesclar diretórios. |
| 409 | `cross_device_operation` | Operação entre filesystems não suportada | `EXDEV` ou incompatibilidade identificada de filesystem impede movimentação/publicação com as garantias adotadas; não contornar silenciosamente por cópia seguida de exclusão. **Proposta adicional:** travessia detectada para dispositivo diferente, sem prometer detecção completa de montagens, conforme filesystem.md. |
| 413 | `payload_too_large` | Limite de tamanho excedido | Arquivo de upload excede o limite configurado. **PROPOSTAS adicionais:** corpo JSON excede `PASSA_JSON_MAX_BYTES`; ZIP excede volume não comprimido ou quantidade de entradas permitidos, detectado antes de enviar os headers de sucesso. |
| 415 | `unsupported_media_type` | Tipo de mídia não suportado | Endpoint JSON recebe Content-Type ausente/incompatível; upload recebe tipo diferente de multipart/form-data. Falha no framing de um multipart declarado pertence a `malformed_request`. |
| 422 | `validation_failed` | Validação da requisição falhou | JSON estruturalmente válido fora do schema; campo obrigatório ausente; campo desconhecido; `null` indevido; query duplicada/desconhecida/estruturada; booleano fora do contrato; multipart com parte ausente, extra ou campo inesperado; `PATCH` sem name/parentPath; nome inválido; cópia da mesma entrada; mover/copiar diretório para descendente. |
| 500 | `internal_error` | Erro interno | Falha inesperada sem tradução segura mais específica, inclusive erro operacional de infraestrutura ainda não classificado. A resposta não fornece detalhes internos. |

`503` não é adotado nesta etapa: não foi identificada uma condição concreta de indisponibilidade temporária que justifique esse contrato. Saturação, quotas e filas não serão inventadas para preencher uma tabela. Se uma condição real surgir, sua classificação será documentada e testada na etapa correspondente.

Não há endpoint efetivamente exposto nesta etapa; `404` de rota desconhecida e tratamento de método não suportado ainda não possuem códigos próprios aprovados. O comportamento desses limites HTTP será definido com o roteamento e incluído aqui, com testes, antes de declarar a camada HTTP concluída.

| Requisição ou situação | Resultado proposto | Motivo |
| --- | --- | --- |
| Sem Bearer em rota protegida | 401 `authentication_required` | Credencial necessária antes de operar sobre entradas. |
| `GET /api/v2/entries` sem `path` | 422 `validation_failed` | Campo obrigatório ausente. |
| `GET /api/v2/entries?path=` | 400 `invalid_path` | Campo existe, mas caminho vazio tem sintaxe inválida. |
| `GET /api/v2/directories/entries` sem `path` | 200 quando implementado e operação bem-sucedida | Padrão documentado é `.`. |
| `path=a%2F..%2Fb` em query | 403 `path_forbidden` | A única decodificação normal produz segmento `..`. |
| `path=a%252Fb` em query | Tratar como nome literal `a%2Fb`, sujeito às outras regras | Não decodificar `%2F` novamente. |
| `path=a//b`, `path=a/` ou `path=a/./b` | 400 `invalid_path` | Formas ambíguas recusadas pela proposta de sintaxe. |
| `path=%2Fetc%2Fpasswd` | 403 `path_forbidden` | Caminho absoluto após decodificação. |
| Query `recursive=1` ou `recursive=null` | 422 `validation_failed` | Somente `true` ou `false` são booleanos aceitos na URL. |
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
| Symlink entre filhos da listagem | 403 `entry_forbidden` | Proposta: falhar a listagem inteira, não ocultar a entrada. |
| `PATCH` calcula caminho final igual ao atual | 200 com metadados | Contrato exige no-op bem-sucedido. |
| Cópia tem origem e destino correspondentes à mesma entrada | 422 `validation_failed` | Contrato proíbe essa cópia, mesmo com overwrite. |
| Segunda exclusão após sucesso, entrada continua ausente | 404 `entry_not_found` | Idempotência do efeito não exige repetir o mesmo status. |

A tradução de erros será centralizada, preservando regras de arquivos testáveis sem iniciar HTTP. Cada status/código adotado exigirá um caso observável em testes, com verificação de Content-Type, campos obrigatórios, não exposição de segredos e limites após início de transferência. Até lá, o catálogo permanece planejado, e nenhum teste de erro foi executado.

