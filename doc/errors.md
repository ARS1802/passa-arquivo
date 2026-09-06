# Erros e validação

## Estado

**Erros HTTP: PLANEJADOS — NÃO IMPLEMENTADOS.** Não existem middleware de erros ou respostas HTTP do contrato em execução. Na etapa 2 existem esquemas Zod e `ConfigurationError` somente para configuração local, documentados na seção seguinte. O formato HTTP geral, os status aplicáveis e as restrições de exposição vêm do pedido. Os identificadores concretos, a estrutura dos erros de campos e as fronteiras HTTP abaixo são **PROPOSTAS**, a confirmar durante implementação e testes, sem alterar os status obrigatórios do contrato.

O pedido original está em [requirements.md](requirements.md). Consulte [endpoints.md](endpoints.md), [filesystem.md](filesystem.md), [security.md](security.md) e [progress.md](progress.md). Os códigos HTTP propostos não descrevem símbolos TypeScript existentes.

## Erros de configuração local — implementados na etapa 2

`ConfigurationError`, em [src/config/index.ts](../src/config/index.ts), representa
falhas de parsing e validação de opções. Sua mensagem é `Configuração inválida.`;
`issues` contém uma lista de objetos `{ option: string, message: string }`, sem
valores fornecidos. Cada opção reconhecida usa seu nome CLI estático; nomes
arbitrários desconhecidos são substituídos por `arguments` ou `environment`.
As mensagens Zod usadas aqui são definidas pelo projeto e não reproduzem entradas.

A CLI [src/check-config.ts](../src/check-config.ts) escreve problemas em stderr e
termina com código **2** para `ConfigurationError`, **1** para falha inesperada
com mensagem genérica, ou **0** após validação bem-sucedida. Não há resposta HTTP,
Problem Details ou impressão da configuração completa. Um sucesso só comprova
sintaxe e relações lexicais: filesystem, tokens e certificados não são examinados.
Os testes verificam erros conhecidos, sanitização e códigos 0/2; não foi injetada
uma falha inesperada para testar o ramo de código 1.

## Representação `application/problem+json`

Todo erro que ainda puder ser representado por uma resposta HTTP tem `Content-Type: application/problem+json`. O status da linha HTTP e o campo `status` devem coincidir.

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `type` | string identificadora URI | Sim | Identificador estável. **PROPOSTA:** `urn:passa-arquivo:problem:<code>`; não é uma URL de documentação existente. |
| `title` | string | Sim | Descrição curta e estável da categoria. |
| `status` | integer | Sim | Código HTTP efetivo. |
| `detail` | string | Sim | Explicação da ocorrência, sem segredo nem localização absoluta do servidor. |
| `code` | string | Sim | Código estável da aplicação do catálogo abaixo. |
| `errors` | array de objetos | Não | Somente quando houver falhas de campos úteis ao cliente; estrutura proposta abaixo. |

Não incluir stack trace, token, chave privada, valores integrais de headers de autenticação ou caminhos absolutos locais. Não copiar mensagens brutas de bibliotecas ou do sistema operacional para `detail`. Caminhos relativos podem ser apresentados somente quando necessários para explicar a ocorrência, sem concatenar a raiz local.

```json
{
  "type": "urn:passa-arquivo:problem:entry_not_found",
  "title": "Entrada não encontrada",
  "status": 404,
  "detail": "A entrada solicitada não existe.",
  "code": "entry_not_found"
}
```

### Erros de campos — proposta

Cada item de `errors` contém `location`, enum `query | body | headers`; `field`, string com o nome/caminho lógico do campo; e `message`, descrição segura. Os três campos são obrigatórios quando um item estiver presente. Não incluir o valor rejeitado por padrão; nunca incluir credenciais. Erros de autenticação usam o erro geral, sem reproduzir o header.

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

Os nomes `EntryMetadata` e dos problemas são contratos documentais. A implementação poderá usar funções ou classes sem que o formato público dependa de tipos HTTP nas regras internas.

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

## Fronteiras de validação

A distinção principal é entre formato da requisição, autenticação, formato/isolamento do caminho, existência/tipo da entrada e conflito da operação. Não converter qualquer exceção em `400`, `403` ou `500` indiscriminadamente.

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

A precedência exata entre vários erros simultâneos será fixada junto à cadeia HTTP, preservando autenticação antes das operações. Os exemplos da tabela pressupõem credencial válida e nenhum erro anterior aplicável. Uma violação lexical de caminho não deve ser ocultada por coerção silenciosa nem por resolução que normalize `..` antes de rejeitá-lo.

Os erros do sistema operacional dependem do contexto. `ENOENT` em uma origem ou pai solicitado pode significar `404`; a mesma falha em um diretório interno que deveria existir pode representar defeito interno. `ENOTDIR` em um componente solicitado representa conflito de tipo. `EXDEV` não autoriza reduzir garantias silenciosamente. Erros de permissão local ou de infraestrutura não devem ser apresentados como uma autorização diferente para tokens, pois todos os tokens possuem as mesmas permissões neste MVP.

## Autenticação e headers

Respostas `401` incluem `WWW-Authenticate: Bearer`. Não distinguir publicamente tokens conhecidos e desconhecidos nem devolver o segredo inválido. `403` pressupõe cliente autenticado cuja operação viola a política de caminhos/entradas; não substitui `401` para credenciais inválidas.

Preflight CORS pode ser respondido sem Bearer, conforme [security.md](security.md). Isso não torna a operação efetiva pública. Recusa de autorização CORS para uma origem não substitui autenticação nem a validação TLS do cliente.

Respostas `204` são estritamente sem corpo. Não enviar `null`, `{}` ou um problema JSON após marcar status `204`.

## Transferência já iniciada

Antes de enviar headers, uma falha conhecida pode produzir o problema JSON correspondente. Depois de enviar headers/bytes de download ou ZIP, não é possível trocar retroativamente o status de sucesso ou concatenar um JSON de erro ao arquivo.

Nessa situação, a implementação deverá:

1. Interromper/destruir a transferência e encerrar os recursos associados.
2. Cancelar leitura, escrita ou compactação em andamento conforme suporte do mecanismo adotado.
3. Remover os temporários pertencentes à operação, sem remover a origem ou um destino anterior.
4. Registrar uma descrição operacional segura, sem tokens, chaves, stack traces expostos ao cliente ou caminhos absolutos na resposta.

O cliente pode receber um arquivo parcial ou detectar falha de transporte; não há garantia de um segundo status HTTP ou de recuperação automática. A mesma regra vale quando um limite de ZIP é identificado após os headers.

Upload interrompido **antes da publicação** preserva o arquivo anterior e exige remoção do staging da operação. Se a conexão desaparecer **depois da publicação**, a falta da resposta não significa que a mutação deixou de ocorrer. O cliente pode consultar o destino ou repetir o `PUT`; não existe acompanhamento remoto de operações.

Exclusão recursiva e criação de pais podem falhar parcialmente. O erro deve refletir a falha sem prometer rollback de alterações já realizadas; as garantias por operação constam em [filesystem.md](filesystem.md).

## Falhas de inicialização e verificações futuras

Configuração inválida, certificado/chave inválidos, falha ao preparar estado privado e erro real de bind impedem inicialização. Antes de o servidor aceitar conexões não há resposta HTTP `application/problem+json` a emitir. Registrar diagnóstico seguro e não anunciar prontidão prematuramente. Não abrir HTTP de fallback nem matar outro processo para recuperar a porta.

A tradução de erros será centralizada, preservando regras de arquivos testáveis sem iniciar HTTP. Cada status/código adotado exigirá um caso observável em testes, com verificação de Content-Type, campos obrigatórios, não exposição de segredos e limites após início de transferência. Até lá, o catálogo permanece planejado, e nenhum teste de erro foi executado.
